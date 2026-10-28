import json
from flask import Blueprint, jsonify, request
from backend.database import get_db_connection
from backend.routes.auth_helper import get_current_user
from backend.services.explainer import explain_meal, explain_workout
from backend.services.feedback_service import get_user_preference_weights
from backend.services.ranker import select_daily_meal_plan, swap_meal
from backend.services.safety_filter import apply_safety_filter
from backend.services.validator import ValidationError, validate_profile_payload
from backend.services.workout_selector import select_daily_workouts, swap_workout

recommend_bp = Blueprint("recommend_bp", __name__)


def load_all_meals_from_db(conn) -> list:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM meals")
    rows = cursor.fetchall()
    meals = []
    for r in rows:
        meals.append({
            "id": r["id"],
            "name": r["name"],
            "cuisine": r["cuisine"],
            "meal_type": r["meal_type"],
            "diet_tags": json.loads(r["diet_tags"]),
            "allergens": json.loads(r["allergens"]),
            "ingredients": json.loads(r["ingredients"]),
            "prep_time_min": r["prep_time_min"],
            "cook_time_min": r["cook_time_min"],
            "cost_level": r["cost_level"],
            "goal_tags": json.loads(r["goal_tags"]),
            "sample_calories": r["sample_calories"],
            "sample_protein_g": r["sample_protein_g"],
            "description": r["description"],
            "recipe_steps": json.loads(r["recipe_steps"]) if r["recipe_steps"] else [],
            "chef_tips": r["chef_tips"] or ""
        })
    return meals


def load_all_workouts_from_db(conn) -> list:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workouts")
    rows = cursor.fetchall()
    workouts = []
    for r in rows:
        keys = r.keys()
        workouts.append({
            "id": r["id"],
            "name": r["name"],
            "category": r["category"],
            "intensity": r["intensity"],
            "duration_min": r["duration_min"],
            "equipment": json.loads(r["equipment"]),
            "steps": json.loads(r["steps"]) if r["steps"] else [],
            "description": r["description"],
            "target_body_part": r["target_body_part"] if "target_body_part" in keys else "full_body",
            "workout_type": r["workout_type"] if "workout_type" in keys else "both",
            "goal_focus": json.loads(r["goal_focus"]) if "goal_focus" in keys and r["goal_focus"] else ["build_muscle", "weight_loss"],
            "sets_reps_muscle": r["sets_reps_muscle"] if "sets_reps_muscle" in keys else "4 sets x 8-12 reps",
            "sets_reps_loss": r["sets_reps_loss"] if "sets_reps_loss" in keys else "3 sets x 15-20 reps",
            "demo_model": r["demo_model"] if "demo_model" in keys else "squat"
        })
    return workouts


@recommend_bp.route("/api/recommendations", methods=["POST"])
def get_recommendations():
    """
    Generate personalised, explainable meal and movement ideas.
    Enforces Safety Filter before Ranker, ensuring allergen/diet rules are NEVER breached.
    """
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        user_id = user["id"] if user else None

        req_json = request.get_json(silent=True) or {}

        # If payload is empty and user session exists, load saved profile
        if not req_json and user_id:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
            p_row = cursor.fetchone()
            if not p_row:
                return jsonify({"error": "No profile found", "details": "Please submit your preferences first."}), 400
            profile_data = {
                "age": p_row["age"],
                "height_cm": p_row["height_cm"],
                "current_weight_kg": p_row["current_weight_kg"],
                "target_weight_kg": p_row["target_weight_kg"],
                "eating_pattern": p_row["eating_pattern"],
                "allergens": json.loads(p_row["allergens"]),
                "cuisines": json.loads(p_row["cuisines"]),
                "budget_level": p_row["budget_level"],
                "max_cook_time_min": p_row["max_cook_time_min"],
                "goal": p_row["goal"],
                "activity_level": p_row["activity_level"],
                "equipment": json.loads(p_row["equipment"]),
                "workout_minutes": p_row["workout_minutes"]
            }
        else:
            profile_data = validate_profile_payload(req_json)

        # 1. Load catalog data
        all_meals = load_all_meals_from_db(conn)
        all_workouts = load_all_workouts_from_db(conn)

        # 2. Safety filter (runs FIRST - Hard Scope Rule 4)
        safe_meals, excluded_meals = apply_safety_filter(
            meals=all_meals,
            eating_pattern=profile_data["eating_pattern"],
            user_allergens=profile_data["allergens"]
        )

        if not safe_meals:
            return jsonify({
                "status": "zero_matches",
                "message": "No meals matched all your constraints. Relaxing cooking time or budget while keeping all your allergy settings strictly unchanged may help.",
                "meals": [],
                "workouts": [],
                "excluded_count": len(excluded_meals),
                "excluded_sample": excluded_meals[:10]
            }), 200

        # 3. Soft preference weights
        weights = get_user_preference_weights(conn, user_id) if user_id else {}

        # 4. Ranker & slot selection
        daily_meals = select_daily_meal_plan(safe_meals, profile_data, weights)

        # 5. Workout selection
        daily_workouts = select_daily_workouts(all_workouts, profile_data, weights, limit=3)

        # 6. Explainer
        for meal in daily_meals:
            meal["reason"] = explain_meal(meal, profile_data, weights)
            if user_id:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO recommendations (user_id, item_type, item_id, slot, score, reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, "meal", meal["id"], meal.get("slot"), meal.get("score"), meal["reason"])
                )

        for workout in daily_workouts:
            workout["reason"] = explain_workout(workout, profile_data, weights)
            if user_id:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO recommendations (user_id, item_type, item_id, slot, score, reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, "workout", workout["id"], "movement", workout.get("score"), workout["reason"])
                )

        if user_id:
            conn.commit()

        # Build transformation and BMI reference if available
        height = profile_data.get("height_cm")
        weight = profile_data.get("current_weight_kg")
        target = profile_data.get("target_weight_kg")
        transformation_summary = None
        if height and weight:
            h_m = height / 100.0
            bmi = round(weight / (h_m * h_m), 1)
            transformation_summary = {
                "bmi": bmi,
                "current_weight_kg": weight,
                "target_weight_kg": target,
                "target_delta_kg": round(target - weight, 1) if target else None,
                "disclaimer": "General wellness reference only, not a clinical prescription."
            }

        return jsonify({
            "disclaimer": "General wellness ideas, not medical advice. Sample nutrient values are unverified.",
            "meals": daily_meals,
            "workouts": daily_workouts,
            "excluded_count": len(excluded_meals),
            "excluded_sample": excluded_meals[:12],
            "transformation_summary": transformation_summary
        }), 200

    except ValidationError as ve:
        return jsonify({"error": ve.message, "details": ve.errors}), 400
    finally:
        conn.close()


@recommend_bp.route("/api/recommendations/swap", methods=["POST"])
def swap_recommendation():
    """Swap one meal or workout with the next-best alternative."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        user_id = user["id"] if user else None

        req = request.get_json(silent=True) or {}
        item_type = req.get("item_type", "meal")
        slot = req.get("slot", "breakfast")
        exclude_ids = set(req.get("exclude_ids", []))
        profile_override = req.get("profile")

        # Load profile
        if profile_override:
            profile_data = validate_profile_payload(profile_override)
        elif user_id:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
            p_row = cursor.fetchone()
            if not p_row:
                return jsonify({"error": "No profile found for swap"}), 400
            profile_data = {
                "age": p_row["age"],
                "eating_pattern": p_row["eating_pattern"],
                "allergens": json.loads(p_row["allergens"]),
                "cuisines": json.loads(p_row["cuisines"]),
                "budget_level": p_row["budget_level"],
                "max_cook_time_min": p_row["max_cook_time_min"],
                "goal": p_row["goal"],
                "activity_level": p_row["activity_level"],
                "equipment": json.loads(p_row["equipment"]),
                "workout_minutes": p_row["workout_minutes"]
            }
        else:
            return jsonify({"error": "Missing profile data for swap"}), 400

        weights = get_user_preference_weights(conn, user_id) if user_id else {}

        if item_type == "meal":
            all_meals = load_all_meals_from_db(conn)
            safe_meals, _ = apply_safety_filter(
                meals=all_meals,
                eating_pattern=profile_data["eating_pattern"],
                user_allergens=profile_data["allergens"]
            )
            swapped = swap_meal(safe_meals, slot, profile_data, weights, exclude_ids)
            if not swapped:
                return jsonify({
                    "status": "exhausted",
                    "message": f"No further alternative meals found for slot '{slot}' under your safety constraints."
                }), 200

            swapped["reason"] = explain_meal(swapped, profile_data, weights)
            return jsonify({"status": "success", "item": swapped}), 200

        elif item_type == "workout":
            all_workouts = load_all_workouts_from_db(conn)
            swapped = swap_workout(all_workouts, profile_data, weights, exclude_ids)
            if not swapped:
                return jsonify({
                    "status": "exhausted",
                    "message": "No further alternative workouts found matching your equipment and duration constraints."
                }), 200

            swapped["reason"] = explain_workout(swapped, profile_data, weights)
            return jsonify({"status": "success", "item": swapped}), 200

        return jsonify({"error": "Invalid item_type", "details": "Must be 'meal' or 'workout'."}), 400

    except ValidationError as ve:
        return jsonify({"error": ve.message, "details": ve.errors}), 400
    finally:
        conn.close()


@recommend_bp.route("/api/catalog/meals", methods=["GET"])
def get_catalog_meals():
    """Browse catalog with transparent filters and pagination."""
    conn = get_db_connection()
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(50, max(1, int(request.args.get("per_page", 12))))
        cuisine = request.args.get("cuisine")
        meal_type = request.args.get("meal_type")
        diet = request.args.get("diet")

        query = "SELECT * FROM meals WHERE 1=1"
        params = []

        if cuisine:
            query += " AND cuisine = ?"
            params.append(cuisine.lower())
        if meal_type:
            query += " AND meal_type = ?"
            params.append(meal_type.lower())

        cursor = conn.cursor()
        cursor.execute(query, params)
        all_rows = cursor.fetchall()

        matched = []
        for r in all_rows:
            diet_tags = json.loads(r["diet_tags"])
            if diet and diet.lower() not in diet_tags:
                continue
            matched.append({
                "id": r["id"],
                "name": r["name"],
                "cuisine": r["cuisine"],
                "meal_type": r["meal_type"],
                "diet_tags": diet_tags,
                "allergens": json.loads(r["allergens"]),
                "ingredients": json.loads(r["ingredients"]),
                "prep_time_min": r["prep_time_min"],
                "cook_time_min": r["cook_time_min"],
                "cost_level": r["cost_level"],
                "goal_tags": json.loads(r["goal_tags"]),
                "sample_calories": r["sample_calories"],
                "sample_protein_g": r["sample_protein_g"],
                "description": r["description"],
                "recipe_steps": json.loads(r["recipe_steps"]) if r["recipe_steps"] else [],
                "chef_tips": r["chef_tips"]
            })

        total = len(matched)
        start = (page - 1) * per_page
        end = start + per_page
        paged_items = matched[start:end]

        return jsonify({
            "page": page,
            "per_page": per_page,
            "total_items": total,
            "total_pages": (total + per_page - 1) // per_page,
            "items": paged_items,
            "disclaimer": "Sample catalog values for general wellness only; unverified."
        }), 200
    finally:
        conn.close()


@recommend_bp.route("/api/meals/<meal_id>/recipe", methods=["GET"])
def get_meal_recipe(meal_id: str):
    """Retrieve full step-by-step recipe, ingredients, and cooking tips for a meal."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Meal not found", "details": f"No meal with id '{meal_id}'."}), 404

        return jsonify({
            "id": row["id"],
            "name": row["name"],
            "cuisine": row["cuisine"],
            "meal_type": row["meal_type"],
            "prep_time_min": row["prep_time_min"],
            "cook_time_min": row["cook_time_min"],
            "ingredients": json.loads(row["ingredients"]),
            "recipe_steps": json.loads(row["recipe_steps"]) if row["recipe_steps"] else [],
            "chef_tips": row["chef_tips"] or "",
            "sample_nutrition": {
                "calories": row["sample_calories"],
                "protein_g": row["sample_protein_g"]
            },
            "disclaimer": "Sample cooking guide for general home preparation; unverified nutrition values."
        }), 200
    finally:
        conn.close()


@recommend_bp.route("/api/catalog/workouts", methods=["GET"])
def get_catalog_workouts():
    """Retrieve catalog workouts with filters for target_body_part, workout_type (gym/home/both), and goal (build_muscle/weight_loss)."""
    conn = get_db_connection()
    try:
        all_workouts = load_all_workouts_from_db(conn)
        body_part = request.args.get("body_part")
        workout_type = request.args.get("workout_type")
        goal = request.args.get("goal")

        filtered = []
        for w in all_workouts:
            if body_part and body_part != "all":
                w_bp = w.get("target_body_part", "full_body")
                if w_bp != body_part:
                    continue

            if workout_type and workout_type != "all":
                w_type = w.get("workout_type", "both")
                equip = [e.lower() for e in w.get("equipment", [])]
                if workout_type == "gym":
                    if w_type != "gym" and not any(e in ("gym", "dumbbells") for e in equip):
                        continue
                elif workout_type == "home":
                    if w_type == "gym" and "none" not in equip and "dumbbells" not in equip and "resistance_band" not in equip and "yoga_mat" not in equip:
                        continue

            if goal and goal != "all":
                w_goals = w.get("goal_focus", ["build_muscle", "weight_loss"])
                if goal not in w_goals:
                    continue

            filtered.append(w)

        return jsonify({
            "total": len(filtered),
            "items": filtered,
            "disclaimer": "General movement suggestions; unverified clinical fitness."
        }), 200
    finally:
        conn.close()

