import json
from pathlib import Path
import sqlite3
import sys

# Ensure root directory is on sys.path for direct script execution
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

def seed_catalog(conn: sqlite3.Connection):
    """Seed meals and workouts from JSON catalog into SQLite database."""
    base_dir = Path(__file__).resolve().parent
    meals_file = base_dir / "data" / "meals.json"
    workouts_file = base_dir / "data" / "workouts.json"

    cursor = conn.cursor()

    if meals_file.exists():
        with open(meals_file, "r", encoding="utf-8") as f:
            meals_data = json.load(f)

        for meal in meals_data:
            cursor.execute(
                """
                INSERT OR REPLACE INTO meals (
                    id, name, cuisine, meal_type, diet_tags, allergens,
                    ingredients, prep_time_min, cook_time_min, cost_level,
                    goal_tags, sample_calories, sample_protein_g, description,
                    recipe_steps, chef_tips
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    meal["id"],
                    meal["name"],
                    meal["cuisine"],
                    meal["meal_type"],
                    json.dumps(meal.get("diet_tags", [])),
                    json.dumps(meal.get("allergens", [])),
                    json.dumps(meal.get("ingredients", [])),
                    int(meal.get("prep_time_min", 15)),
                    int(meal.get("cook_time_min", 10)),
                    meal.get("cost_level", "medium"),
                    json.dumps(meal.get("goal_tags", [])),
                    int(meal.get("sample_calories", 0)),
                    float(meal.get("sample_protein_g", 0.0)),
                    meal.get("description", ""),
                    json.dumps(meal.get("recipe_steps", [])),
                    meal.get("chef_tips", "")
                )
            )

    if workouts_file.exists():
        with open(workouts_file, "r", encoding="utf-8") as f:
            workouts_data = json.load(f)

        for w in workouts_data:
            cursor.execute(
                """
                INSERT OR REPLACE INTO workouts (
                    id, name, category, intensity, duration_min,
                    equipment, steps, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    w["id"],
                    w["name"],
                    w["category"],
                    w["intensity"],
                    int(w.get("duration_min", 20)),
                    json.dumps(w.get("equipment", ["none"])),
                    json.dumps(w.get("steps", [])),
                    w.get("description", "")
                )
            )

    conn.commit()


if __name__ == "__main__":
    from database import get_db_connection, init_db
    init_db()
    conn = get_db_connection()
    seed_catalog(conn)
    conn.close()
    print("Catalog seeded successfully!")
