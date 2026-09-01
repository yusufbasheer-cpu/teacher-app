from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.auth.dependencies import AuthenticationFailure, authenticate_request
from app.config import get_settings
from app.integrations.supabase import SupabasePersistenceError, SupabaseRestClient
from app.models import LessonPlanSaveRequest
from app.services.lesson_plan import save_lesson_plan

router = APIRouter(prefix="/api/lesson-plan", tags=["lesson-plan"])


def generic_error() -> JSONResponse:
    return JSONResponse({"error": "Something went wrong. Please try again."}, status_code=500)


@router.post("/save")
async def save(request: Request) -> JSONResponse:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user = await authenticate_request(
                request.headers.get("authorization"), client=client
            )
            try:
                body = await request.json()
            except ValueError:
                return JSONResponse({"error": "Invalid request."}, status_code=400)
            try:
                payload = LessonPlanSaveRequest.model_validate(body)
            except (ValidationError, TypeError):
                return JSONResponse({"error": "Invalid request."}, status_code=400)
            result = await save_lesson_plan(
                payload, user, SupabaseRestClient(client, get_settings())
            )
    except AuthenticationFailure as exc:
        if exc.status_code == 401 and str(exc) == "Unauthorized":
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return generic_error() if exc.status_code == 500 else JSONResponse(
            {"error": "Unauthorized"}, status_code=401
        )
    except (SupabasePersistenceError, httpx.HTTPError, Exception):
        return generic_error()
    return JSONResponse(result, status_code=201 if result["action"] == "inserted" else 200)
