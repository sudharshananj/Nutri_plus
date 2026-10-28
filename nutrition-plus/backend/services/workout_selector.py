from typing import Any, Dict, List, Optional, Set, Tuple

ACTIVITY_INTENSITY_MAP = {
    "sedentary": ["low"],
    "light": ["low", "moderate"],
    "moderate": ["moderate", "low"],
    "active": ["moderate", "high", "low"]
}

GOAL_CATEGORY_BOOSTS = {
    "stay_active": {"cardio": 2.0, "walk": 2.0, "strength": 1.0},
    "more_energy": {"mobility": 2.0, "walk": 2.0, "yoga": 1.5},
    "high_protein": {"strength": 2.5, "mobility": 1.0},
    "light_meals": {"yoga": 2.0, "mobility": 2.0, "walk": 1.5},
    "balanced": {"walk": 1.5, "strength": 1.5, "yoga": 1.5, "mobility": 1.5, "cardio": 1.5}
}


def filter_and_rank_workouts(
    workouts: List[Dict[str, Any]],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    exclude_ids: Set[str] = None
) -> List[Dict[str, Any]]:
    """
    Filter workouts by equipment and duration, then rank deterministically.
    """
    if exclude_ids is None:
        exclude_ids = set()

    user_equip = set(e.lower() for e in profile.get("equipment", ["none"]))
    user_equip.add("none")  # 'none' is universally available

    user_activity = profile.get("activity_level", "light").lower()
    allowed_intensities = ACTIVITY_INTENSITY_MAP.get(user_activity, ["low", "moderate"])

    target_duration = profile.get("workout_minutes", 20)
    user_goal = profile.get("goal", "balanced").lower()
    goal_boosts = GOAL_CATEGORY_BOOSTS.get(user_goal, {})

    candidates = []
    for w in workouts:
        if w.get("id") in exclude_ids:
            continue

        # 1. Equipment check: all required equipment must be owned by user
        w_equip = set(e.lower() for e in w.get("equipment", ["none"]))
        if not w_equip.issubset(user_equip):
            continue

        # 2. Duration check: duration should be <= target_duration + 5 min tolerance
        duration = w.get("duration_min", 20)
        if duration > (target_duration + 5):
            continue

        # 3. Intensity check
        intensity = w.get("intensity", "low").lower()
        intensity_fit = 2.0 if intensity in allowed_intensities else 0.5

        # 4. Goal boost
        cat = w.get("category", "").lower()
        goal_fit = goal_boosts.get(cat, 0.5)

        # 5. Feedback weight
        w_fb = preference_weights.get(("workout_category", cat), 0.0)
        feedback_adj = max(-2.0, min(2.0, w_fb))

        # Base score
        score = 4.0 + intensity_fit + goal_fit + feedback_adj
        score = max(1.0, min(10.0, round(score, 2)))

        w_copy = dict(w)
        w_copy["score"] = score
        candidates.append(w_copy)

    # Sort candidates by score descending, then duration closeness to target_duration
    candidates.sort(key=lambda x: (-x["score"], abs(x.get("duration_min", 20) - target_duration), x.get("name", "")))
    return candidates


def select_daily_workouts(
    workouts: List[Dict[str, Any]],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Selects up to `limit` diverse workout ideas matching the user's constraints.
    """
    ranked = filter_and_rank_workouts(workouts, profile, preference_weights)
    
    # Try to provide distinct categories for rich variety
    selected = []
    seen_categories = set()

    for w in ranked:
        cat = w.get("category")
        if cat not in seen_categories:
            selected.append(w)
            seen_categories.add(cat)
            if len(selected) >= limit:
                break

    # If we still have slots left, backfill with top remaining
    if len(selected) < limit:
        chosen_ids = {w["id"] for w in selected}
        for w in ranked:
            if w["id"] not in chosen_ids:
                selected.append(w)
                chosen_ids.add(w["id"])
                if len(selected) >= limit:
                    break

    return selected


def swap_workout(
    workouts: List[Dict[str, Any]],
    profile: Dict[str, Any],
    preference_weights: Dict[Tuple[str, str], float],
    exclude_ids: Set[str]
) -> Optional[Dict[str, Any]]:
    """Return next-best alternative workout."""
    ranked = filter_and_rank_workouts(workouts, profile, preference_weights, exclude_ids=exclude_ids)
    if ranked:
        return ranked[0]
    return None
