import re
from typing import Any, Dict, List, Set, Tuple

ALLERGEN_KEYWORD_ALIASES: Dict[str, List[str]] = {
    "milk": [
        "milk", "paneer", "curd", "yogurt", "ghee", "butter", 
        "cheese", "cream", "whey", "casein", "malai", "dahi", "feta"
    ],
    "peanut": [
        "peanut", "peanuts", "groundnut", "groundnuts", "peanut butter"
    ],
    "tree_nut": [
        "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", 
        "pistachio", "pistachios", "pecan", "hazelnut"
    ],
    "wheat": [
        "wheat", "atta", "maida", "bread", "pasta", "semolina", 
        "rava", "sooji", "vermicelli", "couscous", "pita"
    ],
    "egg": [
        "egg", "eggs", "albumen", "yolk", "omelette", "scramble"
    ],
    "soy": [
        "soy", "soya", "tofu", "edamame", "miso", "tempeh", "tamari"
    ],
    "fish": [
        "fish", "salmon", "tuna", "cod", "tilapia", "sea bass", "anchovy"
    ],
    "shellfish": [
        "prawn", "prawns", "shrimp", "crab", "lobster", "clam", "mussel", "oyster"
    ],
    "sesame": [
        "sesame", "til", "tahini"
    ]
}


def check_ingredient_for_allergens(ingredients: List[str], user_allergens: Set[str]) -> List[str]:
    """Scan ingredient text lines for allergen keyword aliases."""
    detected = set()
    text = " ".join(ingredients).lower()
    
    for allergen in user_allergens:
        aliases = ALLERGEN_KEYWORD_ALIASES.get(allergen, [allergen])
        for alias in aliases:
            # Use word boundary search to avoid false positives
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, text):
                detected.add(allergen)
                break
    return list(detected)


def apply_safety_filter(
    meals: List[Dict[str, Any]], 
    eating_pattern: str, 
    user_allergens: List[str]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Applies the primary safety exclusion filter.
    Returns:
        (safe_meals, excluded_meals_with_reasons)
    """
    safe_meals = []
    excluded_meals = []
    
    user_allergen_set = set(a.lower() for a in user_allergens)
    target_pattern = eating_pattern.lower()

    for meal in meals:
        reasons = []

        # 1. Diet Pattern Match
        meal_diet_tags = [t.lower() for t in meal.get("diet_tags", [])]
        if target_pattern not in meal_diet_tags:
            reasons.append(f"Incompatible with '{eating_pattern}' eating pattern.")

        # 2. Declared Allergens Match
        meal_declared_allergens = set(a.lower() for a in meal.get("allergens", []))
        direct_allergen_clash = meal_declared_allergens.intersection(user_allergen_set)
        if direct_allergen_clash:
            clash_str = ", ".join(sorted(direct_allergen_clash))
            reasons.append(f"Contains declared allergen: {clash_str}.")

        # 3. Ingredient Keyword Scan
        ingredients = meal.get("ingredients", [])
        scanned_clash = check_ingredient_for_allergens(ingredients, user_allergen_set)
        for allergy in scanned_clash:
            if allergy not in direct_allergen_clash:
                reasons.append(f"Contains ingredient alias for allergen '{allergy}'.")

        if reasons:
            excluded_meals.append({
                "id": meal.get("id"),
                "name": meal.get("name"),
                "reasons": reasons
            })
        else:
            safe_meals.append(meal)

    return safe_meals, excluded_meals
