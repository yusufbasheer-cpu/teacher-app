from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger("backend_python.verify_captcha")

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileTransportError(Exception):
    """Raised when the Turnstile verify call fails at the transport/parse level.

    Matches the existing Next behavior: fail open (treat as verified)
    whenever the request throws or the response body isn't valid JSON —
    Turnstile's own HTTP status code is never inspected.
    """


def get_client_ip(headers: Mapping[str, str]) -> str:
    normalized = {str(key).lower(): str(value) for key, value in headers.items()}
    forwarded = normalized.get("x-forwarded-for")
    real_ip = normalized.get("x-real-ip")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if real_ip:
        return real_ip.strip()
    return "unknown"


@asynccontextmanager
async def _client_scope(
    client: httpx.AsyncClient | None,
    timeout_seconds: float,
) -> AsyncIterator[httpx.AsyncClient]:
    if client is not None:
        yield client
        return

    async with httpx.AsyncClient(timeout=timeout_seconds) as created:
        yield created


async def verify_turnstile_token(
    secret_key: str,
    token: str,
    remote_ip: str,
    *,
    settings: Settings | None = None,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, list[str] | None]:
    settings = settings or get_settings()

    async with _client_scope(client, settings.turnstile_timeout_seconds) as active_client:
        try:
            response = await active_client.post(
                TURNSTILE_VERIFY_URL,
                json={"secret": secret_key, "response": token, "remoteip": remote_ip},
                timeout=settings.turnstile_timeout_seconds,
            )
            data = response.json()
        except Exception as exc:
            logger.warning("[captcha] Turnstile verify request failed: %s", exc)
            raise TurnstileTransportError from exc

    return bool(data.get("success")), data.get("error-codes")
