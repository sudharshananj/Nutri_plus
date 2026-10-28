import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from backend.config import Config
from backend.database import init_db
from backend.routes.profile_routes import profile_bp
from backend.routes.recommend_routes import recommend_bp
from backend.routes.feedback_routes import feedback_bp
from backend.routes.plan_routes import plan_bp
from backend.routes.food_scanner_routes import scanner_bp

# Set up Rate Limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[Config.RATELIMIT_DEFAULT],
    storage_uri="memory://"
)


def create_app(config_class=Config) -> Flask:
    """Application factory for Nutrition Plus."""
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

    app = Flask(__name__, static_folder=str(frontend_dir), static_url_path="")
    app.config.from_object(config_class)

    # Enable CORS
    CORS(
        app,
        resources={r"/api/*": {"origins": config_class.ALLOWED_ORIGINS}},
        supports_credentials=True,
        allow_headers=["Content-Type", "X-Session-Token", "Authorization"]
    )

    # Initialize Rate Limiter
    limiter.init_app(app)
    limiter.limit(config_class.RATELIMIT_RECOMMENDATIONS)(recommend_bp)

    # Initialize Database on startup
    with app.app_context():
        init_db()

    # Register Blueprints
    app.register_blueprint(profile_bp)
    app.register_blueprint(recommend_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(plan_bp)
    app.register_blueprint(scanner_bp)

    # Health check endpoint
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "ok",
            "service": "Nutrition Plus API",
            "version": "1.0.0",
            "scope": "Adults 18+ general wellness recommendations; not medical advice."
        }), 200

    # Serve Frontend Single-Page and Static Pages
    @app.route("/", methods=["GET"])
    def serve_index():
        return send_from_directory(str(frontend_dir), "index.html")

    @app.route("/<path:path>", methods=["GET"])
    def serve_frontend_files(path):
        target = frontend_dir / path
        if target.exists() and target.is_file():
            return send_from_directory(str(frontend_dir), path)
        return send_from_directory(str(frontend_dir), "index.html")

    # Security Headers (OWASP API Top 10 recommendations)
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissive CSP for local development while keeping safety
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "media-src 'self' blob:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:*;"
        )
        return response

    # Unified JSON Error Handlers
    @app.errorhandler(400)
    def bad_request(err):
        return jsonify({
            "error": "Bad Request",
            "details": getattr(err, "description", str(err))
        }), 400

    @app.errorhandler(404)
    def not_found(err):
        return jsonify({
            "error": "Not Found",
            "details": getattr(err, "description", "The requested endpoint was not found.")
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(err):
        return jsonify({
            "error": "Method Not Allowed",
            "details": "The HTTP method is not allowed for this route."
        }), 405

    @app.errorhandler(429)
    def ratelimit_handler(err):
        return jsonify({
            "error": "Too Many Requests",
            "details": "Rate limit exceeded. Please wait a minute before retrying."
        }), 429

    @app.errorhandler(500)
    def internal_server_error(err):
        return jsonify({
            "error": "Internal Server Error",
            "details": "An unexpected error occurred. Please try again later."
        }), 500

    return app


if __name__ == "__main__":
    app = create_app()
    print("=" * 60)
    print("  Nutrition Plus Recommendation Engine Active")
    print(f"  Local Server: http://localhost:{Config.PORT}")
    print("  Scope: Adults 18+ general wellness ideas. Not medical advice.")
    print("=" * 60)
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
