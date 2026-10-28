import json
from pathlib import Path
import pytest
from backend.services.ranker import calculate_meal_score, select_daily_meal_plan, swap_meal
from backend.services.safety_filter import apply_safety_filter


@pytest.fixture
def catalog_meals():
    path = Path(__file__).resolve().parent.parent / "data" / "meals.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_cuisine_bonus_increases_score():
    meal = {
        "id": "m1",
        "name": "Test Meal",
        "cuisine": "south_indian",
        "prep_time_min": 15,
        "cost_level": "low",
        "goal_tags": ["balanced"]
    }
    profile_matching = {
        "cuisines": ["south_indian"],
        "max_cook_time_min": 30,
        "budget_level": "low",
        "goal": "balanced"
    }
    profile_non_matching = {
        "cuisines": ["mediterranean"],
        "max_cook_time_min": 30,
        "budget_level": "low",
        "goal": "balanced"
    }

    score_match, bd_match = calculate_meal_score(meal, profile_matching, {})
    score_nomatch, bd_nomatch = calculate_meal_score(meal, profile_non_matching, {})

    assert score_match > score_nomatch
    assert bd_match["cuisine_match"] == 3.0
    assert bd_nomatch["cuisine_match"] == 0.0


def test_feedback_adjusts_score_within_bounds():
    meal = {
        "id": "m1",
        "name": "Test Meal",
        "cuisine": "north_indian",
        "prep_time_min": 20,
        "cost_level": "medium",
        "goal_tags": ["balanced"]
    }
    profile = {
        "cuisines": ["north_indian"],
        "max_cook_time_min": 30,
        "budget_level": "medium",
        "goal": "balanced"
    }

    # Positive feedback weight
    weights_pos = {("cuisine", "north_indian"): 1.5}
    score_pos, _ = calculate_meal_score(meal, profile, weights_pos)

    # Negative feedback weight
    weights_neg = {("cuisine", "north_indian"): -2.0}
    score_neg, _ = calculate_meal_score(meal, profile, weights_neg)

    assert score_pos > score_neg
    assert 0.0 <= score_pos <= 10.0
    assert 0.0 <= score_neg <= 10.0


def test_daily_meal_plan_selection(catalog_meals):
    profile = {
        "age": 28,
        "eating_pattern": "vegetarian",
        "allergens": ["peanut"],
        "cuisines": ["south_indian", "north_indian"],
        "budget_level": "low",
        "max_cook_time_min": 25,
        "goal": "more_energy",
        "activity_level": "moderate",
        "equipment": ["none"],
        "workout_minutes": 20
    }
    safe_meals, _ = apply_safety_filter(catalog_meals, profile["eating_pattern"], profile["allergens"])
    plan = select_daily_meal_plan(safe_meals, profile, {})

    # Plan should have meals for distinct slots
    assert len(plan) == 4
    slots = [m["slot"] for m in plan]
    assert "breakfast" in slots
    assert "lunch" in slots
    assert "dinner" in slots
    assert "snack" in slots

    # Ensure no duplicates
    ids = [m["id"] for m in plan]
    assert len(ids) == len(set(ids))


def test_swap_meal_returns_new_unseen_item(catalog_meals):
    profile = {
        "age": 30,
        "eating_pattern": "vegetarian",
        "allergens": [],
        "cuisines": ["south_indian", "north_indian"],
        "budget_level": "low",
        "max_cook_time_min": 30,
        "goal": "balanced"
    }
    safe_meals, _ = apply_safety_filter(catalog_meals, profile["eating_pattern"], profile["allergens"])
    plan = select_daily_meal_plan(safe_meals, profile, {})
    current_breakfast = next(m for m in plan if m["slot"] == "breakfast")

    swapped = swap_meal(
        safe_meals=safe_meals,
        slot="breakfast",
        profile=profile,
        preference_weights={},
        exclude_ids={current_breakfast["id"]}
    )

    assert swapped is not None
    assert swapped["id"] != current_breakfast["id"]
    assert swapped["slot"] == "breakfast"
