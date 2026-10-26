"""Configuration : tout vient des variables d'environnement."""

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    auth_service_url: str


def _sqlalchemy_url(url: str) -> str:
    # SQLAlchemy doit savoir qu'on utilise le driver psycopg (v3).
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@lru_cache
def get_settings() -> Settings:
    return Settings(
        database_url=_sqlalchemy_url(os.environ["DATABASE_URL"]),
        jwt_secret=os.environ["JWT_SECRET"],
        auth_service_url=os.environ.get("AUTH_SERVICE_URL", "http://auth-service:3001"),
    )
