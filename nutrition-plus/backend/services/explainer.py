from typing import Any, Dict, List, Tuple


def explain_meal(
    meal: Dict[str, Any],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float]
) -> str:
    """
    Construct an explainable, human-readable justification for recommending this meal.
    Free from clinical or medical claims.
    """
    reasons = []

    # 1. Diet Pattern
    pattern = profile.get("eating_pattern", "").replace("_", " ").title()
    if pattern:
        reasons.append(f"Matches your {pattern} eating pattern")

    # 2. Allergens Avoidance
    allergens = profile.get("allergens", [])
    if allergens:
        clean_allergens = [a.replace("_", " ") for a in allergens]
        if len(clean_allergens) == 1:
            reasons.append(f"strictly avoids {clean_allergens[0]}")
        else:
            reasons.append(f"strictly avoids {', '.join(clean_allergens[:-1])} and {clean_allergens[-1]}")
    else:
        reasons.append("fits all your safety preferences")

    # 3. Time Match
    prep = meal.get("prep_time_min", 15)
    max_cook = profile.get("max_cook_time_min", 30)
    if prep <= max_cook:
        reasons.append(f"takes only {prep} mins (within your {max_cook}-min window)")
    else:
        reasons.append(f"takes {prep} mins")

    # 4. Budget Match
    user_budget = profile.get("budget_level", "medium")
    meal_cost = meal.get("cost_level", "medium")
    if user_budget == meal_cost:
        reasons.append(f"fits your {user_budget} budget tier")
    elif (user_budget == "medium" and meal_cost == "low") or (user_budget == "high" and meal_cost in ("low", "medium")):
        reasons.append(f"is very budget-friendly ({meal_cost} cost)")

    # 5. Cuisine Match
    user_cuisines = profile.get("cuisines", [])
    meal_cuisine = meal.get("cuisine", "")
    cuisine_display = meal_cuisine.replace("_", " ").title()
    if meal_cuisine in user_cuisines:
        reasons.append(f"suits your {cuisine_display} preference")

    # 6. Goal Alignment
    user_goal = profile.get("goal", "").replace("_", " ")
    if user_goal:
        reasons.append(f"supports your {user_goal} wellness focus")

    # 7. Feedback Influence
    cuisine_weight = preference_weights.get(("cuisine", meal_cuisine), 0.0)
    if cuisine_weight > 0.4:
        reasons.append(f"prioritized based on your positive feedback for {cuisine_display} dishes")
    elif cuisine_weight < -0.4:
        reasons.append(f"adjusted for your soft preference history")

    # Sentence synthesis
    if len(reasons) <= 2:
        return f"{reasons[0].capitalize()} and {reasons[1]}."
    
    first_part = ", ".join(reasons[:-1])
    return f"{first_part.capitalize()}, and {reasons[-1]}."


def explain_workout(
    workout: Dict[str, Any],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float]
) -> str:
    """
    Construct an explainable justification for recommending this workout routine.
    """
    reasons = []

    # 1. Equipment Match
    equip = workout.get("equipment", ["none"])
    if equip == ["none"] or "none" in equip and len(equip) == 1:
        reasons.append("Needs no equipment")
    else:
        clean_eq = [e.replace("_", " ") for e in equip if e != "none"]
        if clean_eq:
            reasons.append(f"Utilizes your available {' and '.join(clean_eq)}")
        else:
            reasons.append("Needs no equipment")

    # 2. Intensity & Activity Level
    intensity = workout.get("intensity", "low")
    activity = profile.get("activity_level", "light")
    reasons.append(f"has a {intensity}-intensity level calibrated for your {activity} routine")

    # 3. Duration
    dur = workout.get("duration_min", 20)
    reasons.append(f"completes in {dur} minutes")

    # 4. Category & Feedback
    cat = workout.get("category", "")
    w_fb = preference_weights.get(("workout_category", cat), 0.0)
    if w_fb > 0.4:
        reasons.append(f"promoted based on your preference for {cat} activities")

    if len(reasons) <= 2:
        return f"{reasons[0]} and {reasons[1]}."

    first_part = ", ".join(reasons[:-1])
    return f"{first_part}, and {reasons[-1]}."
