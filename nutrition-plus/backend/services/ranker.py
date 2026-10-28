from typing import Any, Dict, List, Optional, Set, Tuple

BUDGET_MAP = {"low": 1, "medium": 2, "high": 3}


def calculate_meal_score(
    meal: Dict[str, Any],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    used_cuisines: Set[str] = None
) -> Tuple[float, Dict[str, float]]:
    """
    Compute transparent deterministic score (0.0 to 10.0) for a safe meal.
    """
    if used_cuisines is None:
        used_cuisines = set()

    score = 0.0
    breakdown = {}

    # 1. Cuisine Match (+3.0)
    user_cuisines = profile.get("cuisines", [])
    meal_cuisine = meal.get("cuisine", "")
    if meal_cuisine in user_cuisines:
        score += 3.0
        breakdown["cuisine_match"] = 3.0
    else:
        breakdown["cuisine_match"] = 0.0

    # 2. Prep Time Match (+2.0 max, scaled)
    max_cook = profile.get("max_cook_time_min", 30)
    prep_time = meal.get("prep_time_min", 15)
    if prep_time <= max_cook:
        # Shorter prep time within user budget yields slightly higher score
        time_score = round(2.0 * max(0.5, 1.0 - (prep_time / (max_cook * 1.8))), 2)
    else:
        # Exceeds target cook time: penalize gently
        over = prep_time - max_cook
        time_score = max(0.0, round(1.0 - (over / 25.0), 2))
    score += time_score
    breakdown["time_match"] = time_score

    # 3. Budget Match (+2.0 max)
    user_budget_val = BUDGET_MAP.get(profile.get("budget_level", "medium"), 2)
    meal_budget_val = BUDGET_MAP.get(meal.get("cost_level", "medium"), 2)
    budget_diff = meal_budget_val - user_budget_val

    if budget_diff == 0:
        budget_score = 2.0
    elif budget_diff == -1:
        budget_score = 1.5  # One tier more affordable
    elif budget_diff == 1:
        budget_score = 0.5  # One tier higher
    else:
        budget_score = 0.0
    score += budget_score
    breakdown["budget_match"] = budget_score

    # 4. Goal Match (+2.0)
    user_goal = profile.get("goal", "balanced")
    meal_goals = meal.get("goal_tags", [])
    if user_goal in meal_goals:
        goal_score = 2.0
    else:
        goal_score = 0.5
    score += goal_score
    breakdown["goal_match"] = goal_score

    # 5. Variety Bonus (+1.0 default, penalty if cuisine repeated in same day)
    if meal_cuisine in used_cuisines:
        variety_score = 0.2
    else:
        variety_score = 1.0
    score += variety_score
    breakdown["variety"] = variety_score

    # 6. Stored Feedback Weights (Soft Preferences, clamped [-3.0, +3.0])
    w_cuisine = preference_weights.get(("cuisine", meal_cuisine), 0.0)
    w_cost = preference_weights.get(("cost_level", meal.get("cost_level", "")), 0.0)
    raw_fb = w_cuisine + w_cost
    feedback_adj = max(-3.0, min(3.0, raw_fb))
    score += feedback_adj
    breakdown["feedback_adjustment"] = round(feedback_adj, 2)

    # Final score clamped strictly to [0.0, 10.0]
    final_score = max(0.0, min(10.0, round(score, 2)))
    return final_score, breakdown


def rank_meals_for_slot(
    safe_meals: List[Dict[str, Any]],
    slot: str,
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    used_cuisines: Set[str] = None,
    exclude_ids: Set[str] = None
) -> List[Tuple[Dict[str, Any], float, Dict[str, float]]]:
    """
    Ranks safe meals for a given meal slot (breakfast, lunch, dinner, snack).
    Returns list of (meal_dict, score, breakdown) sorted descending.
    """
    if exclude_ids is None:
        exclude_ids = set()
    if used_cuisines is None:
        used_cuisines = set()

    slot_candidates = [
        m for m in safe_meals 
        if m.get("meal_type") == slot and m.get("id") not in exclude_ids
    ]

    scored = []
    for m in slot_candidates:
        s, bd = calculate_meal_score(m, profile, preference_weights, used_cuisines)
        scored.append((m, s, bd))

    # Tie breaker: higher score, shorter prep time, then alphabetical by name
    scored.sort(key=lambda x: (-x[1], x[0].get("prep_time_min", 999), x[0].get("name", "")))
    return scored


def select_daily_meal_plan(
    safe_meals: List[Dict[str, Any]],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float]
) -> List[Dict[str, Any]]:
    """
    Selects one top meal per slot (breakfast, lunch, dinner, snack) with no duplicates.
    """
    slots = ["breakfast", "lunch", "dinner", "snack"]
    chosen_meals = []
    chosen_ids = set()
    used_cuisines = set()

    for slot in slots:
        ranked = rank_meals_for_slot(
            safe_meals, slot, profile, preference_weights, 
            used_cuisines=used_cuisines, exclude_ids=chosen_ids
        )
        if ranked:
            top_meal, top_score, breakdown = ranked[0]
            chosen_ids.add(top_meal["id"])
            used_cuisines.add(top_meal.get("cuisine"))
            
            # Clone and attach metadata
            meal_entry = dict(top_meal)
            meal_entry["slot"] = slot
            meal_entry["score"] = top_score
            meal_entry["score_breakdown"] = breakdown
            chosen_meals.append(meal_entry)

    return chosen_meals


def swap_meal(
    safe_meals: List[Dict[str, Any]],
    slot: str,
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    exclude_ids: Set[str]
) -> Optional[Dict[str, Any]]:
    """
    Picks the next best safe alternative for a slot, excluding already displayed meals.
    """
    ranked = rank_meals_for_slot(
        safe_meals, slot, profile, preference_weights, exclude_ids=exclude_ids
    )
    if ranked:
        top_alt, top_score, breakdown = ranked[0]
        alt_entry = dict(top_alt)
        alt_entry["slot"] = slot
        alt_entry["score"] = top_score
        alt_entry["score_breakdown"] = breakdown
        return alt_entry
    return None
