import sqlite3
from typing import Dict, Tuple

ACTION_WEIGHT_DELTAS = {
    "like": 0.5,
    "dislike": -0.7,
    "skip": -0.2,
    "swap": -0.3
}

MIN_WEIGHT = -3.0
MAX_WEIGHT = 3.0


def record_feedback(
    conn: sqlite3.Connection,
    user_id: int,
    item_type: str,
    item_id: str,
    action: str
) -> Dict[str, float]:
    """
    Record user feedback and adjust soft-preference weights.
    Never modifies allergen, diet pattern, or exclusion criteria.
    """
    if action not in ACTION_WEIGHT_DELTAS:
        raise ValueError(f"Invalid feedback action: {action}")

    delta = ACTION_WEIGHT_DELTAS[action]
    updated_weights = {}

    cursor = conn.cursor()
    # Log the feedback event
    cursor.execute(
        """
        INSERT INTO feedback (user_id, item_type, item_id, action)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, item_type, item_id, action)
    )

    if item_type == "meal":
        cursor.execute("SELECT cuisine, cost_level FROM meals WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if row:
            dimensions = [
                ("cuisine", row["cuisine"]),
                ("cost_level", row["cost_level"])
            ]
            for dim, val in dimensions:
                new_w = _apply_weight_delta(conn, user_id, dim, val, delta)
                updated_weights[f"{dim}:{val}"] = new_w

    elif item_type == "workout":
        cursor.execute("SELECT category FROM workouts WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if row:
            dim = "workout_category"
            val = row["category"]
            new_w = _apply_weight_delta(conn, user_id, dim, val, delta)
            updated_weights[f"{dim}:{val}"] = new_w

    conn.commit()
    return updated_weights


def _apply_weight_delta(
    conn: sqlite3.Connection,
    user_id: int,
    dimension: str,
    value: str,
    delta: float
) -> float:
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT weight FROM preference_weights
        WHERE user_id = ? AND dimension = ? AND value = ?
        """,
        (user_id, dimension, value)
    )
    row = cursor.fetchone()
    current_w = row["weight"] if row else 0.0

    new_w = max(MIN_WEIGHT, min(MAX_WEIGHT, current_w + delta))
    new_w = round(new_w, 2)

    cursor.execute(
        """
        INSERT INTO preference_weights (user_id, dimension, value, weight)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, dimension, value) DO UPDATE SET weight = excluded.weight
        """,
        (user_id, dimension, value, new_w)
    )
    return new_w


def get_user_preference_weights(conn: sqlite3.Connection, user_id: int) -> Dict[Tuple[str, str], float]:
    """Retrieve all soft preference weights for a given user as a dict keyed by (dimension, value)."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT dimension, value, weight FROM preference_weights WHERE user_id = ?",
        (user_id,)
    )
    rows = cursor.fetchall()
    return {(row["dimension"], row["value"]): float(row["weight"]) for row in rows}
