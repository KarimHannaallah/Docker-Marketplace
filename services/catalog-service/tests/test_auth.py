import httpx
import pytest
from fastapi import HTTPException

from app.config import Settings
from app.security import check_not_revoked
from tests.conftest import REVOKED, SECRET, auth, make_token

PROTECTED = [
    "/catalog/categories",
    "/catalog/products",
    "/catalog/products/1",
]


def test_health_is_public(client):
    assert client.get("/health").json()["status"] == "ok"


@pytest.mark.parametrize("url", PROTECTED)
def test_401_without_token(client, seeded, url):
    assert client.get(url).status_code == 401


def test_401_with_garbage_token(client, seeded):
    assert client.get("/catalog/products", headers=auth("pas-un-jwt")).status_code == 401


def test_401_with_wrong_secret(client, seeded):
    import jwt

    token = jwt.encode(
        {"sub": "1", "role": "ADMIN", "jti": "x", "exp": 9999999999},
        "un-autre-secret-de-plus-de-32-octets!",
        "HS256",
    )
    assert client.get("/catalog/products", headers=auth(token)).status_code == 401


def test_401_with_expired_token(client, seeded):
    token = make_token(exp=1)
    assert client.get("/catalog/products", headers=auth(token)).status_code == 401


def test_401_when_token_revoked(client, seeded, user_headers):
    assert client.get("/catalog/products", headers=user_headers).status_code == 200
    REVOKED.add("jti-2-STANDARD")
    assert client.get("/catalog/products", headers=user_headers).status_code == 401


def test_403_for_standard_on_admin_routes(client, seeded, user_headers):
    body = {"name": "X", "price": 1}
    assert client.post("/catalog/products", json=body, headers=user_headers).status_code == 403
    assert client.put("/catalog/products/1", json=body, headers=user_headers).status_code == 403
    assert client.delete("/catalog/products/1", headers=user_headers).status_code == 403
    assert (
        client.post("/catalog/categories", json={"name": "X"}, headers=user_headers).status_code
        == 403
    )


def test_401_before_403_on_admin_routes(client):
    assert client.post("/catalog/products", json={"name": "X", "price": 1}).status_code == 401


# --- appel réel à auth-service (httpx simulé) ---

SETTINGS = Settings(database_url="", jwt_secret=SECRET, auth_service_url="http://auth:3001")


def test_check_not_revoked_ok(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: httpx.Response(200))
    check_not_revoked("t", SETTINGS)  # ne lève rien


def test_check_not_revoked_rejected(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: httpx.Response(401))
    with pytest.raises(HTTPException) as exc:
        check_not_revoked("t", SETTINGS)
    assert exc.value.status_code == 401


def test_check_not_revoked_auth_service_down(monkeypatch):
    def boom(*_a, **_k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", boom)
    with pytest.raises(HTTPException) as exc:
        check_not_revoked("t", SETTINGS)
    assert exc.value.status_code == 503
