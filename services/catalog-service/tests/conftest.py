"""Fixtures : app FastAPI branchée sur SQLite en mémoire, sans auth-service ni PostgreSQL."""

import time

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import create_app
from app.security import get_revocation_checker
from app.seed import seed_if_empty

SECRET = "test-secret-with-at-least-32-bytes-ok"
REVOKED: set[str] = set()


def make_token(user_id: int = 1, role: str = "STANDARD", jti: str | None = None, **overrides):
    payload = {
        "sub": str(user_id),
        "role": role,
        "jti": jti or f"jti-{user_id}-{role}",
        "exp": int(time.time()) + 3600,
    }
    payload.update(overrides)
    return jwt.encode(payload, SECRET, algorithm="HS256")


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def db_session():
    # Un seul "connexion" partagée (StaticPool) pour que la base en mémoire survive entre requêtes.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def attach_schema(dbapi_connection, _record):
        # SQLite n'a pas de schémas : on en simule un nommé "catalog" comme dans PostgreSQL.
        dbapi_connection.execute("ATTACH DATABASE ':memory:' AS catalog")

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    REVOKED.clear()
    app = create_app(run_startup=False)

    def fake_revocation_check(token: str, _settings):
        # Simule auth-service : un token dont le jti est "révoqué" est refusé.
        from fastapi import HTTPException

        if jwt.decode(token, options={"verify_signature": False})["jti"] in REVOKED:
            raise HTTPException(401, "Token révoqué ou invalide")

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        database_url="sqlite://", jwt_secret=SECRET, auth_service_url="http://auth-service:3001"
    )
    app.dependency_overrides[get_revocation_checker] = lambda: fake_revocation_check
    return TestClient(app)


@pytest.fixture
def seeded(db_session):
    seed_if_empty(db_session)
    return db_session


@pytest.fixture
def user_headers():
    return auth(make_token(2, "STANDARD"))


@pytest.fixture
def admin_headers():
    return auth(make_token(1, "ADMIN"))
