import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)


class Config:
    """Application configuration with safe defaults."""
    SECRET_KEY = os.getenv("SECRET_KEY", "nutrition-plus-development-secret-key-32chars")
    
    # Database path
    db_env_path = os.getenv("DATABASE_PATH", "backend/nutrition_plus.db")
    if os.path.isabs(db_env_path):
        DATABASE_PATH = Path(db_env_path)
    else:
        DATABASE_PATH = BASE_DIR / db_env_path
        
    # CORS Origins
    allowed_origins_raw = os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:5000,http://127.0.0.1:5000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080,null"
    )
    ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

    # Rate Limiting
    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "60 per minute")
    RATELIMIT_RECOMMENDATIONS = os.getenv("RATELIMIT_RECOMMENDATIONS", "20 per minute")

    # App Settings
    DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    PORT = int(os.getenv("PORT", "5000"))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max request size (supports camera photo uploads)
