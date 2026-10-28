from typing import Any, Dict, List, Tuple


ALLOWED_EATING_PATTERNS = ["vegan", "vegetarian", "eggetarian", "non_veg", "halal", "jain"]
ALLOWED_ALLERGENS = ["peanut", "tree_nut", "milk", "egg", "soy", "wheat", "fish", "shellfish", "sesame"]
ALLOWED_CUISINES = ["south_indian", "north_indian", "continental", "mediterranean", "east_asian"]
ALLOWED_BUDGET_LEVELS = ["low", "medium", "high"]
ALLOWED_GOALS = ["balanced", "more_energy", "light_meals", "high_protein", "stay_active"]
ALLOWED_ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active"]
ALLOWED_EQUIPMENT = ["none", "dumbbells", "resistance_band", "yoga_mat", "gym"]
ALLOWED_FEEDBACK_ACTIONS = ["like", "dislike", "skip", "swap"]

# Medical keywords strictly forbidden under Hard Scope Rule 1
MEDICAL_KEYWORDS = [
    "condition", "disease", "medication", "diagnosis", "diabetes", 
    "hypertension", "thyroid", "pcos", "cancer", "prescription", 
    "disorder", "syndrome", "pill", "drug", "blood_pressure", 
    "cholesterol", "insulin", "asthma", "pregnancy", "pregnant", "cardiovascular"
]


class ValidationError(Exception):
    def __init__(self, message: str, errors: Dict[str, str] = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


def sanitize_string(val: Any, max_len: int = 100) -> str:
    """Strip and clamp string inputs."""
    if not isinstance(val, str):
        return ""
    return val.strip()[:max_len]


def validate_profile_payload(data: Any) -> Dict[str, Any]:
    """Validate and sanitize user profile input dictionary."""
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object.")

    errors = {}

    # Reject any medical-related fields
    for key in data.keys():
        key_lower = str(key).lower()
        for med in MEDICAL_KEYWORDS:
            if med in key_lower:
                raise ValidationError(
                    "Nutrition Plus provides general wellness ideas only and does not collect medical history, diagnoses, or health conditions.",
                    {"medical_field": f"Field '{key}' is not allowed."}
                )

    # 1. Age (Strict: 18 - 100)
    if "age" not in data:
        errors["age"] = "Age is required."
    else:
        try:
            age = int(data["age"])
            if age < 18:
                errors["age"] = "This tool is for adults 18+ only."
            elif age > 100:
                errors["age"] = "Please enter an age between 18 and 100."
            data["age"] = age
        except (ValueError, TypeError):
            errors["age"] = "Age must be a valid integer."

    # 2. Eating Pattern
    eating_pattern = sanitize_string(data.get("eating_pattern", ""))
    if eating_pattern not in ALLOWED_EATING_PATTERNS:
        errors["eating_pattern"] = f"Eating pattern must be one of: {', '.join(ALLOWED_EATING_PATTERNS)}."
    data["eating_pattern"] = eating_pattern

    # 3. Allergens
    raw_allergens = data.get("allergens", [])
    if not isinstance(raw_allergens, list):
        errors["allergens"] = "Allergens must be a list of strings."
    else:
        cleaned_allergens = []
        for a in raw_allergens:
            item = sanitize_string(a).lower()
            if item and item not in ALLOWED_ALLERGENS:
                errors["allergens"] = f"Invalid allergen '{item}'. Allowed: {', '.join(ALLOWED_ALLERGENS)}."
                break
            if item and item not in cleaned_allergens:
                cleaned_allergens.append(item)
        data["allergens"] = cleaned_allergens

    # 4. Cuisines
    raw_cuisines = data.get("cuisines", [])
    if not isinstance(raw_cuisines, list):
        errors["cuisines"] = "Cuisines must be a list of strings."
    else:
        cleaned_cuisines = []
        for c in raw_cuisines:
            item = sanitize_string(c).lower()
            if item and item not in ALLOWED_CUISINES:
                errors["cuisines"] = f"Invalid cuisine '{item}'. Allowed: {', '.join(ALLOWED_CUISINES)}."
                break
            if item and item not in cleaned_cuisines:
                cleaned_cuisines.append(item)
        data["cuisines"] = cleaned_cuisines

    # 5. Budget Level
    budget = sanitize_string(data.get("budget_level", "")).lower()
    if budget not in ALLOWED_BUDGET_LEVELS:
        errors["budget_level"] = f"Budget level must be one of: {', '.join(ALLOWED_BUDGET_LEVELS)}."
    data["budget_level"] = budget

    # 6. Max Cooking Time
    if "max_cook_time_min" not in data:
        errors["max_cook_time_min"] = "Max cooking time is required."
    else:
        try:
            mct = int(data["max_cook_time_min"])
            if mct < 5 or mct > 180:
                errors["max_cook_time_min"] = "Max cooking time must be between 5 and 180 minutes."
            data["max_cook_time_min"] = mct
        except (ValueError, TypeError):
            errors["max_cook_time_min"] = "Max cooking time must be a number."

    # 7. Goal
    goal = sanitize_string(data.get("goal", "")).lower()
    if goal not in ALLOWED_GOALS:
        errors["goal"] = f"Goal must be one of: {', '.join(ALLOWED_GOALS)}."
    data["goal"] = goal

    # 8. Activity Level
    act = sanitize_string(data.get("activity_level", "")).lower()
    if act not in ALLOWED_ACTIVITY_LEVELS:
        errors["activity_level"] = f"Activity level must be one of: {', '.join(ALLOWED_ACTIVITY_LEVELS)}."
    data["activity_level"] = act

    # 9. Equipment
    raw_equip = data.get("equipment", ["none"])
    if not isinstance(raw_equip, list):
        errors["equipment"] = "Equipment must be a list of strings."
    else:
        cleaned_equip = []
        for e in raw_equip:
            item = sanitize_string(e).lower()
            if item and item not in ALLOWED_EQUIPMENT:
                errors["equipment"] = f"Invalid equipment '{item}'. Allowed: {', '.join(ALLOWED_EQUIPMENT)}."
                break
            if item and item not in cleaned_equip:
                cleaned_equip.append(item)
        if not cleaned_equip:
            cleaned_equip = ["none"]
        data["equipment"] = cleaned_equip

    # 10. Workout Minutes
    if "workout_minutes" not in data:
        errors["workout_minutes"] = "Workout minutes is required."
    else:
        try:
            wm = int(data["workout_minutes"])
            if wm < 5 or wm > 120:
                errors["workout_minutes"] = "Workout minutes must be between 5 and 120 minutes."
            data["workout_minutes"] = wm
        except (ValueError, TypeError):
            errors["workout_minutes"] = "Workout minutes must be a number."

    # 11. Physical Transformation Metrics (Height, Current Weight, Target Goal Weight)
    if "height_cm" in data and data["height_cm"] is not None:
        try:
            h = int(data["height_cm"])
            if h < 100 or h > 250:
                errors["height_cm"] = "Height must be between 100 cm and 250 cm."
            data["height_cm"] = h
        except (ValueError, TypeError):
            errors["height_cm"] = "Height must be a valid whole number in cm."
    else:
        data["height_cm"] = None

    if "current_weight_kg" in data and data["current_weight_kg"] is not None:
        try:
            cw = float(data["current_weight_kg"])
            if cw < 30.0 or cw > 300.0:
                errors["current_weight_kg"] = "Current weight must be between 30 kg and 300 kg."
            data["current_weight_kg"] = round(cw, 1)
        except (ValueError, TypeError):
            errors["current_weight_kg"] = "Current weight must be a valid number in kg."
    else:
        data["current_weight_kg"] = None

    if "target_weight_kg" in data and data["target_weight_kg"] is not None:
        try:
            tw = float(data["target_weight_kg"])
            if tw < 30.0 or tw > 300.0:
                errors["target_weight_kg"] = "Target weight must be between 30 kg and 300 kg."
            data["target_weight_kg"] = round(tw, 1)
        except (ValueError, TypeError):
            errors["target_weight_kg"] = "Target weight must be a valid number in kg."
    else:
        data["target_weight_kg"] = None

    if errors:
        raise ValidationError("Input validation failed.", errors)

    return data
