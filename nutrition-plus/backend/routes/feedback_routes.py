from flask import Blueprint, jsonify, request
from backend.database import get_db_connection
from backend.routes.auth_helper import get_current_user
from backend.services.feedback_service import record_feedback
from backend.services.validator import ALLOWED_FEEDBACK_ACTIONS

feedback_bp = Blueprint("feedback_bp", __name__)


@feedback_bp.route("/api/feedback", methods=["POST"])
def post_feedback():
    """
    Record user interaction (like, dislike, skip, swap).
    Updates soft-preference weights; NEVER alters allergen or diet exclusions.
    """
    conn = get_db_connection()
    try:
        user = get_current_user(conn)
        if not user:
            return jsonify({"error": "Unauthorized", "details": "Invalid or missing X-Session-Token header."}), 401

        req = request.get_json(silent=True) or {}
        item_type = req.get("item_type", "")
        item_id = req.get("item_id", "")
        action = req.get("action", "").lower().strip()

        if item_type not in ("meal", "workout"):
            return jsonify({"error": "Invalid item_type", "details": "Must be 'meal' or 'workout'."}), 400

        if not item_id:
            return jsonify({"error": "Missing item_id", "details": "item_id is required."}), 400

        if action not in ALLOWED_FEEDBACK_ACTIONS:
            return jsonify({
                "error": "Invalid action",
                "details": f"Action must be one of: {', '.join(ALLOWED_FEEDBACK_ACTIONS)}."
            }), 400

        updated_weights = record_feedback(conn, user["id"], item_type, item_id, action)

        return jsonify({
            "status": "success",
            "message": f"Recorded feedback '{action}' for {item_type} {item_id}.",
            "updated_weights": updated_weights
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to record feedback", "details": str(e)}), 500
    finally:
        conn.close()
