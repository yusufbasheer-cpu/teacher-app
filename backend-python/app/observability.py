from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "x-request-id"
_MAX_INCOMING_REQUEST_ID_LENGTH = 100

access_logger = logging.getLogger("backend_python.access")


def _resolve_request_id(request: Request) -> str:
    incoming = request.headers.get(REQUEST_ID_HEADER, "").strip()
    is_safe_length = 0 < len(incoming) <= _MAX_INCOMING_REQUEST_ID_LENGTH
    if is_safe_length and incoming.isascii() and incoming.isprintable():
        return incoming
    return uuid.uuid4().hex


async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = _resolve_request_id(request)
    request.state.request_id = request_id
    start = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        access_logger.exception(
            "request failed method=%s path=%s request_id=%s duration_ms=%.1f",
            request.method,
            request.url.path,
            request_id,
            duration_ms,
        )
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers[REQUEST_ID_HEADER] = request_id
    access_logger.info(
        "request method=%s path=%s status=%s request_id=%s duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        request_id,
        duration_ms,
    )
    return response
