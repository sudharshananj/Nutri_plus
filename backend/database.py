import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.config import Config
from backend.seed import seed_catalog


def get_db_connection() -> sqlite3.Connection:
    """Create and return an SQLite database connection with row factory and foreign keys."""
    # Ensure directory exists
    Config.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(Config.DATABASE_PATH), timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def migrate_tables(conn: sqlite3.Connection):
    """Ensure any newly added columns exist in existing database tables."""
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(workouts)")
    cols = [r["name"] for r in cursor.fetchall()]
    if "target_body_part" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN target_body_part TEXT DEFAULT 'full_body'")
    if "workout_type" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN workout_type TEXT DEFAULT 'both'")
    if "goal_focus" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN goal_focus TEXT DEFAULT '[\"build_muscle\", \"weight_loss\"]'")
    if "sets_reps_muscle" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN sets_reps_muscle TEXT DEFAULT '4 sets x 8-12 reps'")
    if "sets_reps_loss" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN sets_reps_loss TEXT DEFAULT '3 sets x 15-20 reps'")
    if "demo_model" not in cols:
        cursor.execute("ALTER TABLE workouts ADD COLUMN demo_model TEXT DEFAULT 'squat'")
    conn.commit()


def init_db(force_reseed: bool = False):
    """Initialize database tables from schema.sql and seed catalog if empty or forced."""
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    conn = get_db_connection()
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        conn.commit()

        # Run safe migrations
        migrate_tables(conn)

        # Check if meals catalog is already populated
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS count FROM meals")
        meal_count = cursor.fetchone()["count"]

        if meal_count == 0 or force_reseed:
            seed_catalog(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", Config.DATABASE_PATH)
