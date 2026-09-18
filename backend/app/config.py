"""
Application Configuration Module.
Loads environment variables using Pydantic Settings.
"""
import os
import re
from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base directory
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


def sanitize_database_url(url: str) -> str:
    """
    Ensure the SQLAlchemy database URL uses psycopg2 driver
    and correctly encodes special characters (like '@') in passwords.
    """
    if not url:
        return url

    # Replace postgresql:// with postgresql+psycopg2:// if needed
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)

    # If the URL has multiple '@' characters due to unencoded password
    # e.g., postgresql+psycopg2://postgres:Pass@word@localhost:5432/dbname
    pattern = r"^(postgresql(?:\+[a-zA-Z0-9]+)?:\/\/)([^:]+):(.*)@([^@]+:\d+\/[^?]+)(.*)$"
    match = re.match(pattern, url)
    if match:
        prefix, user, password, host_db, rest = match.groups()
        # Only encode if password is not already encoded (does not contain %)
        if "%" not in password:
            encoded_password = quote_plus(password)
            url = f"{prefix}{user}:{encoded_password}@{host_db}{rest}"

    return url


class Settings(BaseSettings):
    """Application settings schema."""
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/national_infrastructure"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DASHSCOPE_API_KEY: str = ""
    PROJECT_NAME: str = "Nirmaan Dristi National Infrastructure Intelligence API"
    DEBUG: bool = True

    # Authentication
    SECRET_KEY: str = "CHANGE_ME_USE_ENV_VAR_IN_PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        return sanitize_database_url(self.DATABASE_URL)

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
