import json
from pathlib import Path
import pytest
from backend.services.safety_filter import apply_safety_filter, check_ingredient_for_allergens


@pytest.fixture
def catalog_meals():
    path = Path(__file__).resolve().parent.parent / "data" / "meals.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_peanut_allergic_user_never_receives_peanut_meals(catalog_meals):
    """Hard Scope Rule 4: A peanut-allergic user must never receive a peanut meal."""
    user_allergens = ["peanut"]
    safe_meals, excluded_meals = apply_safety_filter(
        meals=catalog_meals,
        eating_pattern="vegetarian",
        user_allergens=user_allergens
    )

    assert len(safe_meals) > 0
    assert len(excluded_meals) > 0

    # Ensure none of the safe meals contain declared peanut or peanut ingredients
    for m in safe_meals:
        assert "peanut" not in [a.lower() for a in m.get("allergens", [])]
        for ing in m.get("ingredients", []):
            ing_lower = ing.lower()
            assert "peanut" not in ing_lower
            assert "groundnut" not in ing_lower


def test_vegan_user_never_receives_animal_products(catalog_meals):
    """Vegan eating pattern must exclude milk, paneer, ghee, curd, eggs, chicken, and fish."""
    safe_meals, excluded = apply_safety_filter(
        meals=catalog_meals,
        eating_pattern="vegan",
        user_allergens=[]
    )

    assert len(safe_meals) > 0

    for m in safe_meals:
        assert "vegan" in [t.lower() for t in m.get("diet_tags", [])]
        # Inspect ingredients for animal dairy/egg/meat items
        ing_text = " ".join(m.get("ingredients", [])).lower()
        # Replace plant-based 'peanut butter' so it doesn't trigger a false dairy butter alarm
        ing_clean = ing_text.replace("peanut butter", "peanut paste")
        forbidden_terms = ["chicken", "fish", "salmon", "egg", "paneer", "curd", "ghee", "butter", "cheese"]
        for term in forbidden_terms:
            assert term not in ing_clean, f"Meal {m['id']} ({m['name']}) contains '{term}' which violates vegan pattern."


def test_ingredient_keyword_alias_detection():
    """Ingredient alias scanner must detect dairy, wheat, tree nuts even if tag is missing."""
    ingredients = [
        "1 cup warm milk",
        "50g crumbled paneer",
        "2 tbsp crushed almonds"
    ]
    detected = check_ingredient_for_allergens(ingredients, {"milk", "tree_nut", "peanut"})
    assert "milk" in detected
    assert "tree_nut" in detected
    assert "peanut" not in detected


def test_excluded_meals_provide_clear_reasons(catalog_meals):
    """Safety filter must return human-readable exclusion reasons for transparency."""
    safe_meals, excluded = apply_safety_filter(
        meals=catalog_meals,
        eating_pattern="jain",
        user_allergens=["milk", "peanut"]
    )
    for ex in excluded:
        assert "id" in ex
        assert "name" in ex
        assert len(ex["reasons"]) > 0
