"""Authentification : vérification du JWT (localement) puis de la révocation (via auth-service)."""

from dataclasses import dataclass

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    role: str


def check_not_revoked(token: str, settings: Settings) -> None:
    """Demande à auth-service si le token a été révoqué (logout) : 200 = valide."""
    try:
        response = httpx.get(
            f"{settings.auth_service_url}/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
            timeout=3.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Service d'authentification indisponible") from exc
    if response.status_code != 200:
        raise HTTPException(401, "Token révoqué ou invalide")


def get_revocation_checker():
    """Dépendance isolée pour pouvoir la remplacer dans les tests."""
    return check_not_revoked


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
    revocation_checker=Depends(get_revocation_checker),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(401, "Authentification requise")
    token = credentials.credentials

    # 1. Signature et expiration vérifiées ici, avec le secret partagé (HS256).
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "jti"]},
        )
        user = CurrentUser(id=int(payload["sub"]), role=payload["role"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(401, "Token invalide ou expiré") from exc

    # 2. Révocation : seul auth-service connaît la liste des tokens révoqués.
    revocation_checker(token, settings)
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "ADMIN":
        raise HTTPException(403, "Droits administrateur requis")
    return user
