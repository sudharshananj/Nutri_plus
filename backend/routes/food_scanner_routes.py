import json
from flask import Blueprint, jsonify, request
from backend.database import get_db_connection
from backend.services.food_scanner import scan_and_detect_food

scanner_bp = Blueprint("scanner_bp", __name__)


@scanner_bp.route("/api/scan-food", methods=["POST"])
def scan_food():
    """
    Offline Food Scanner & Calorie Detection.
    Accepts:
      - JSON: {"image_base64": "...", "client_hint": "..."}
      - OR Multipart: file 'image' + field 'client_hint'
    Returns food recognition, estimated calories, macros, portion options, and recipe link.
    """
    try:
        image_base64 = None
        image_bytes = None
        client_hint = None

        if request.is_json:
            data = request.get_json(silent=True) or {}
            image_base64 = data.get("image_base64")
            client_hint = data.get("client_hint")
        elif request.files and "image" in request.files:
            file = request.files["image"]
            image_bytes = file.read()
            client_hint = request.form.get("client_hint") or file.filename
        else:
            # Fallback check for form data
            client_hint = request.form.get("client_hint")
            image_base64 = request.form.get("image_base64")

        result = scan_and_detect_food(
            image_base64=image_base64,
            image_bytes=image_bytes,
            client_hint=client_hint
        )

        # Check if matched catalog meal has a recipe in the database
        meal_id = result.get("catalog_meal_id")
        if meal_id:
            conn = get_db_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, prep_time_min, cook_time_min, recipe_steps, ingredients FROM meals WHERE id = ?", (meal_id,))
                row = cursor.fetchone()
                if row:
                    result["catalog_recipe"] = {
                        "id": row["id"],
                        "name": row["name"],
                        "prep_time_min": row["prep_time_min"],
                        "cook_time_min": row["cook_time_min"],
                        "ingredients": json.loads(row["ingredients"]) if row["ingredients"] else [],
                        "recipe_steps": json.loads(row["recipe_steps"]) if row["recipe_steps"] else []
                    }
            finally:
                conn.close()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "error": "Food scan failed",
            "details": str(e),
            "disclaimer": "Sample visual estimation for general wellness awareness, not clinical nutrition."
        }), 500
