import sqlite3
from typing import Optional
from flask import request


def get_current_user(conn: sqlite3.Connection) -> Optional[sqlite3.Row]:
    """Retrieve user record from X-Session-Token header."""
    token = request.headers.get("X-Session-Token")
    if not token:
        # Also check Authorization header as fallback: Bearer <token>
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()

    if not token:
        return None

    cursor = conn.cursor()
    cursor.execute("SELECT id, session_token, created_at FROM users WHERE session_token = ?", (token,))
    return cursor.fetchone()
