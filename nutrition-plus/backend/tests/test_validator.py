import pytest
from backend.services.validator import ValidationError, validate_profile_payload


def test_validator_valid_payload():
    payload = {
        "age": 25,
        "eating_pattern": "vegetarian",
        "allergens": ["peanut"],
        "cuisines": ["south_indian", "mediterranean"],
        "budget_level": "medium",
        "max_cook_time_min": 30,
        "goal": "more_energy",
        "activity_level": "moderate",
        "equipment": ["yoga_mat"],
        "workout_minutes": 25,
        "height_cm": 175,
        "current_weight_kg": 70.5,
        "target_weight_kg": 68.0
    }
    validated = validate_profile_payload(payload)
    assert validated["age"] == 25
    assert validated["eating_pattern"] == "vegetarian"
    assert validated["allergens"] == ["peanut"]
    assert validated["height_cm"] == 175
    assert validated["current_weight_kg"] == 70.5


def test_validator_rejects_under_18():
    payload = {
        "age": 17,
        "eating_pattern": "vegetarian",
        "budget_level": "low",
        "max_cook_time_min": 20,
        "goal": "balanced",
        "activity_level": "light",
        "workout_minutes": 15
    }
    with pytest.raises(ValidationError) as exc:
        validate_profile_payload(payload)
    assert "adults 18+ only" in exc.value.errors.get("age", "").lower()


def test_validator_rejects_medical_data_fields():
    # Test reject medical fields: condition, disease, medication, diabetes, etc.
    forbidden_keys = [
        "condition", "disease", "medication", "diagnosis", 
        "diabetes", "hypertension", "thyroid", "prescription"
    ]
    for key in forbidden_keys:
        payload = {
            "age": 22,
            "eating_pattern": "vegan",
            "budget_level": "low",
            "max_cook_time_min": 20,
            "goal": "balanced",
            "activity_level": "light",
            "workout_minutes": 15,
            key: "Type 2"
        }
        with pytest.raises(ValidationError) as exc:
            validate_profile_payload(payload)
        assert "medical" in exc.value.message.lower()


def test_validator_rejects_invalid_enums():
    payload = {
        "age": 30,
        "eating_pattern": "carnivore_extreme",  # Invalid
        "budget_level": "free",                 # Invalid
        "goal": "cure_disease",                 # Invalid
        "activity_level": "olympian",           # Invalid
        "max_cook_time_min": 30,
        "workout_minutes": 30
    }
    with pytest.raises(ValidationError) as exc:
        validate_profile_payload(payload)
    assert "eating_pattern" in exc.value.errors
    assert "budget_level" in exc.value.errors
    assert "goal" in exc.value.errors


def test_validator_validates_transformation_metrics():
    # Out of range height/weight
    payload = {
        "age": 25,
        "eating_pattern": "vegetarian",
        "budget_level": "low",
        "max_cook_time_min": 20,
        "goal": "balanced",
        "activity_level": "light",
        "workout_minutes": 15,
        "height_cm": 350,       # Out of range (max 250)
        "current_weight_kg": 500.0 # Out of range (max 300)
    }
    with pytest.raises(ValidationError) as exc:
        validate_profile_payload(payload)
    assert "height_cm" in exc.value.errors
    assert "current_weight_kg" in exc.value.errors
