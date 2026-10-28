import json
from flask import Blueprint, jsonify, request
from backend.database import get_db_connection
from backend.routes.auth_helper import get_current_user

plan_bp = Blueprint("plan_bp", __name__)


@plan_bp.route("/api/plans", methods=["POST"])
def save_plan():
    """Save current daily meal and movement plan."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        req = request.get_json(silent=True) or {}
        title = (req.get("title") or "My Daily Wellness Plan").strip()[:100]
        plan_content = req.get("plan")

        if not plan_content:
            return jsonify({"error": "Missing plan content", "details": "The 'plan' object is required."}), 400

        plan_json_str = json.dumps(plan_content)

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO saved_plans (user_id, title, plan_json)
            VALUES (?, ?, ?)
            """,
            (user["id"], title, plan_json_str)
        )
        conn.commit()
        plan_id = cursor.lastrowid

        return jsonify({
            "status": "success",
            "message": "Plan saved successfully.",
            "plan_id": plan_id,
            "title": title
        }), 201
    finally:
        conn.close()


@plan_bp.route("/api/plans", methods=["GET"])
def list_plans():
    """List all plans saved by the current user."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, title, plan_json, created_at
            FROM saved_plans
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user["id"],)
        )
        rows = cursor.fetchall()
        plans = []
        for r in rows:
            try:
                parsed_plan = json.loads(r["plan_json"])
            except Exception:
                parsed_plan = {}
            plans.append({
                "id": r["id"],
                "title": r["title"],
                "plan": parsed_plan,
                "created_at": r["created_at"]
            })

        return jsonify({"plans": plans}), 200
    finally:
        conn.close()


@plan_bp.route("/api/plans/<int:plan_id>", methods=["DELETE"])
def delete_plan(plan_id: int):
    """Delete a saved plan, verifying object ownership (OWASP BOLA defense)."""
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        cursor = conn.cursor()
        cursor.execute("SELECT id, user_id FROM saved_plans WHERE id = ?", (plan_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Plan not found", "details": f"No plan with id {plan_id}."}), 404

        if row["user_id"] != user["id"]:
            # Forbidden: attempt to delete another user's plan
            return jsonify({"error": "Forbidden", "details": "You do not have permission to delete this plan."}), 403

        cursor.execute("DELETE FROM saved_plans WHERE id = ?", (plan_id,))
        conn.commit()

        return jsonify({"status": "success", "message": f"Plan {plan_id} deleted."}), 200
    finally:
        conn.close()
