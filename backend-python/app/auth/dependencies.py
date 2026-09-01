from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings, get_settings

BEARER_RE = re.compile(r"^Bearer[ \t]+([^ \t]+)$")


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    access_token: str


class AuthenticationFailure(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    match = BEARER_RE.fullmatch(authorization.strip())
    return match.group(1) if match else None


async def authenticate_request(
    authorization: str | None,
    *,
    client: httpx.AsyncClient,
    settings: Settings | None = None,
) -> AuthenticatedUser:
    settings = settings or get_settings()
    token = extract_bearer_token(authorization)
    if not token:
        raise AuthenticationFailure(401, "Unauthorized")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise AuthenticationFailure(500, "Supabase authentication is not configured")

    try:
        response = await client.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as exc:
        raise AuthenticationFailure(500, "Supabase authentication failed") from exc

    if response.status_code != 200:
        raise AuthenticationFailure(401, "Invalid session. Please log in again.")
    try:
        user: Any = response.json()
        user_id = user.get("id") if isinstance(user, dict) else None
    except ValueError as exc:
        raise AuthenticationFailure(500, "Supabase authentication returned invalid data") from exc
    if not isinstance(user_id, str) or not user_id:
        raise AuthenticationFailure(401, "Invalid session. Please log in again.")
    return AuthenticatedUser(user_id=user_id, access_token=token)
