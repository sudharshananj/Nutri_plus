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


def init_db():
    """Initialize database tables from schema.sql and seed catalog if empty."""
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    conn = get_db_connection()
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        conn.commit()

        # Check if meals catalog is already populated
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS count FROM meals")
        meal_count = cursor.fetchone()["count"]

        if meal_count == 0:
            seed_catalog(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", Config.DATABASE_PATH)
