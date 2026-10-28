import json
import secrets
from flask import Blueprint, jsonify, request
from backend.database import get_db_connection
from backend.routes.auth_helper import get_current_user
from backend.services.validator import ValidationError, validate_profile_payload

profile_bp = Blueprint("profile_bp", __name__)


@profile_bp.route("/api/session", methods=["POST"])
def create_session():
    """Create an anonymous user session and return a cryptographically secure token."""
    token = secrets.token_urlsafe(32)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (session_token) VALUES (?)", (token,))
        conn.commit()
        user_id = cursor.lastrowid
        return jsonify({
            "status": "success",
            "session_token": token,
            "user_id": user_id,
            "message": "Anonymous session created successfully."
        }), 201
    finally:
        conn.close()


@profile_bp.route("/api/profile", methods=["POST"])
def save_profile():
    """Save or update user wellness preferences and transformation goals."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        payload = request.get_json(silent=True) or {}
        validated = validate_profile_payload(payload)

        cursor = conn.cursor()
        # Check if profile exists for this user
        cursor.execute("SELECT id FROM profiles WHERE user_id = ?", (user["id"],))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE profiles SET
                    age = ?,
                    height_cm = ?,
                    current_weight_kg = ?,
                    target_weight_kg = ?,
                    eating_pattern = ?,
                    allergens = ?,
                    cuisines = ?,
                    budget_level = ?,
                    max_cook_time_min = ?,
                    goal = ?,
                    activity_level = ?,
                    equipment = ?,
                    workout_minutes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (
                    validated["age"],
                    validated.get("height_cm"),
                    validated.get("current_weight_kg"),
                    validated.get("target_weight_kg"),
                    validated["eating_pattern"],
                    json.dumps(validated["allergens"]),
                    json.dumps(validated["cuisines"]),
                    validated["budget_level"],
                    validated["max_cook_time_min"],
                    validated["goal"],
                    validated["activity_level"],
                    json.dumps(validated["equipment"]),
                    validated["workout_minutes"],
                    user["id"]
                )
            )
        else:
            cursor.execute(
                """
                INSERT INTO profiles (
                    user_id, age, height_cm, current_weight_kg, target_weight_kg,
                    eating_pattern, allergens, cuisines, budget_level,
                    max_cook_time_min, goal, activity_level, equipment,
                    workout_minutes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    validated["age"],
                    validated.get("height_cm"),
                    validated.get("current_weight_kg"),
                    validated.get("target_weight_kg"),
                    validated["eating_pattern"],
                    json.dumps(validated["allergens"]),
                    json.dumps(validated["cuisines"]),
                    validated["budget_level"],
                    validated["max_cook_time_min"],
                    validated["goal"],
                    validated["activity_level"],
                    json.dumps(validated["equipment"]),
                    validated["workout_minutes"]
                )
            )

        conn.commit()

        # Compute general wellness indicators if height and weight are provided
        transformation_summary = _build_transformation_summary(validated)

        return jsonify({
            "status": "success",
            "message": "Profile saved successfully.",
            "profile": validated,
            "transformation_summary": transformation_summary
        }), 200

    except ValidationError as ve:
        return jsonify({"error": ve.message, "details": ve.errors}), 400
    finally:
        conn.close()


@profile_bp.route("/api/profile", methods=["GET"])
def get_profile():
    """Retrieve saved profile for the current session."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        cursor = conn.cursor()
        cursor.execute("SELECT * FROM profiles WHERE user_id = ?", (user["id"],))
        row = cursor.fetchone()

        if not row:
            return jsonify({"profile": None, "message": "No profile saved yet for this session."}), 200

        profile_data = {
            "age": row["age"],
            "height_cm": row["height_cm"],
            "current_weight_kg": row["current_weight_kg"],
            "target_weight_kg": row["target_weight_kg"],
            "eating_pattern": row["eating_pattern"],
            "allergens": json.loads(row["allergens"]),
            "cuisines": json.loads(row["cuisines"]),
            "budget_level": row["budget_level"],
            "max_cook_time_min": row["max_cook_time_min"],
            "goal": row["goal"],
            "activity_level": row["activity_level"],
            "equipment": json.loads(row["equipment"]),
            "workout_minutes": row["workout_minutes"],
            "updated_at": row["updated_at"]
        }

        transformation_summary = _build_transformation_summary(profile_data)

        return jsonify({
            "profile": profile_data,
            "transformation_summary": transformation_summary
        }), 200
    finally:
        conn.close()


def _build_transformation_summary(data: dict) -> dict:
    """Build general wellness context metrics (BMI, target delta) with strict disclaimers."""
    height = data.get("height_cm")
    weight = data.get("current_weight_kg")
    target = data.get("target_weight_kg")

    summary = {
        "disclaimer": "Reference metrics for general wellness tracking only. Not a medical assessment or clinical prescription."
    }

    if height and weight and height > 0:
        h_meters = height / 100.0
        bmi = round(weight / (h_meters * h_meters), 1)
        summary["bmi_reference"] = bmi
        if bmi < 18.5:
            summary["bmi_category"] = "Lower general range"
        elif bmi < 25.0:
            summary["bmi_category"] = "Standard general range"
        elif bmi < 30.0:
            summary["bmi_category"] = "Moderate wellness focus range"
        else:
            summary["bmi_category"] = "Active lifestyle management range"

    if weight and target:
        delta = round(target - weight, 1)
        summary["transformation_delta_kg"] = delta
        if delta > 0:
            summary["transformation_direction"] = f"Gradual wellness build (+{delta} kg target)"
        elif delta < 0:
            summary["transformation_direction"] = f"Gradual toning and conditioning ({delta} kg target)"
        else:
            summary["transformation_direction"] = "Healthy lifestyle and stamina maintenance"

    return summary
