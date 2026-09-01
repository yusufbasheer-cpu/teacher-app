from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.services.verify_captcha import (
    TurnstileTransportError,
    get_client_ip,
    verify_turnstile_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("backend_python.verify_captcha")


@router.post("/verify-captcha")
async def verify_captcha(request: Request) -> JSONResponse:
    settings = get_settings()
    secret_key = settings.turnstile_secret_key.strip()

    # Matches Next exactly: with no secret configured, return early
    # without ever parsing the request body.
    if not secret_key:
        return JSONResponse({"ok": True})

    raw_body = await request.body()
    try:
        body = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        return JSONResponse({"ok": False, "error": "Invalid request."}, status_code=400)

    token = body.get("token") if isinstance(body, dict) else None
    token = token.strip() if isinstance(token, str) else ""
    if not token:
        return JSONResponse({"ok": False, "error": "Missing captcha token."}, status_code=400)

    client_ip = get_client_ip(request.headers)

    try:
        success, error_codes = await verify_turnstile_token(
            secret_key, token, client_ip, settings=settings
        )
    except TurnstileTransportError:
        return JSONResponse({"ok": True})

    if not success:
        logger.warning("[captcha] Turnstile verification failed: %s", error_codes)
        return JSONResponse(
            {"ok": False, "error": "Captcha verification failed. Please try again."},
            status_code=403,
        )

    return JSONResponse({"ok": True})
