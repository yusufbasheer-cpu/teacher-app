from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import AuthenticatedUser, AuthenticationFailure, authenticate_request
from app.config import Settings
from app.integrations.supabase import SupabasePersistenceError, SupabaseRestClient
from app.main import create_app
from app.models import LessonPlanSaveRequest
from app.services.lesson_plan import save_lesson_plan

TOKEN_A = "synthetic-user-a-token"
TOKEN_B = "synthetic-user-b-token"
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"
SETTINGS = Settings(supabase_url="https://example.supabase.co", supabase_anon_key="public-anon-key")


def request_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "form": {
            "curriculumType": "CBSE/NCERT",
            "curriculumFramework": "  ",
            "grade": "Grade 3",
            "subject": "Math",
            "chapter": "  Fractions ",
            "topic": "Decimals",
            "learningObjectives": "Objective text",
        },
        "lessonPlan": {"Full Lesson Plan": "Plan"},
        "sectionImages": {"Full Lesson Plan": ["https://example.com/image.png"]},
        "pptSlideImageUrls": ["https://example.com/slide.png", None],
    }
    body.update(overrides)
    return body


def parsed_request(**overrides: Any) -> LessonPlanSaveRequest:
    return LessonPlanSaveRequest.model_validate(request_body(**overrides))


class FakeSupabaseClient:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self.responses = responses
        self.calls: list[dict[str, Any]] = []

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append({"method": "GET", "url": url, **kwargs})
        return self.responses.pop(0)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append({"method": "POST", "url": url, **kwargs})
        return self.responses.pop(0)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append({"method": "PATCH", "url": url, **kwargs})
        return self.responses.pop(0)


class FakeClientContext:
    def __init__(self, client: FakeSupabaseClient) -> None:
        self.client = client

    async def __aenter__(self) -> FakeSupabaseClient:
        return self.client

    async def __aexit__(self, *_args: Any) -> None:
        return None


def response(status: int, body: Any) -> httpx.Response:
    return httpx.Response(status, json=body, request=httpx.Request("GET", "https://example.test"))


def test_auth_validates_token_and_returns_server_derived_identity() -> None:
    client = FakeSupabaseClient([response(200, {"id": USER_A, "email": "a@example.test"})])

    user = asyncio.run(
        authenticate_request(f"Bearer {TOKEN_A}", client=client, settings=SETTINGS)
    )

    assert user == AuthenticatedUser(user_id=USER_A, access_token=TOKEN_A)
    assert client.calls[0]["headers"] == {
        "apikey": "public-anon-key",
        "Authorization": f"Bearer {TOKEN_A}",
    }


def test_auth_rejects_missing_malformed_and_invalid_tokens() -> None:
    client = FakeSupabaseClient([response(401, {"error": "invalid"})])

    with pytest.raises(AuthenticationFailure) as missing:
        asyncio.run(authenticate_request(None, client=client, settings=SETTINGS))
    assert missing.value.status_code == 401

    with pytest.raises(AuthenticationFailure) as malformed:
        asyncio.run(authenticate_request("Token nope", client=client, settings=SETTINGS))
    assert malformed.value.status_code == 401

    with pytest.raises(AuthenticationFailure) as invalid:
        asyncio.run(authenticate_request("Bearer expired", client=client, settings=SETTINGS))
    assert invalid.value.status_code == 401


def test_insert_payload_and_caller_token_are_preserved() -> None:
    client = FakeSupabaseClient([response(201, [{"id": "plan-1"}])])
    persistence = SupabaseRestClient(client, SETTINGS)

    result = asyncio.run(
        save_lesson_plan(parsed_request(), AuthenticatedUser(USER_A, TOKEN_A), persistence)
    )

    call = client.calls[0]
    assert result == {"action": "inserted", "id": "plan-1"}
    assert call["method"] == "POST"
    assert call["headers"]["Authorization"] == f"Bearer {TOKEN_A}"
    assert "service" not in call["headers"]["Authorization"].lower()
    assert call["params"] == {"select": "id"}
    assert call["json"]["user_id"] == USER_A
    assert call["json"]["curriculum_framework"] == ""
    assert call["json"]["chapter"] == "Fractions"
    assert json.loads(call["json"]["lesson_plan"]["__sectionImageUrls"])["Full Lesson Plan"]


def test_update_filters_by_authenticated_user_and_preserves_token() -> None:
    client = FakeSupabaseClient([response(204, None)])
    persistence = SupabaseRestClient(client, SETTINGS)

    result = asyncio.run(
        save_lesson_plan(
            parsed_request(activePlanId="plan-owned-by-b"),
            AuthenticatedUser(USER_A, TOKEN_A),
            persistence,
        )
    )

    call = client.calls[0]
    assert result == {"action": "updated", "id": "plan-owned-by-b"}
    assert call["method"] == "PATCH"
    assert call["params"] == {"id": "eq.plan-owned-by-b", "user_id": f"eq.{USER_A}"}
    assert call["headers"]["Authorization"] == f"Bearer {TOKEN_A}"
    assert call["json"]["user_id"] == USER_A


def test_user_a_cannot_target_user_b_row_through_update_contract() -> None:
    client = FakeSupabaseClient([response(204, None)])
    persistence = SupabaseRestClient(client, SETTINGS)

    asyncio.run(
        save_lesson_plan(
            parsed_request(activePlanId="user-b-row"),
            AuthenticatedUser(USER_A, TOKEN_A),
            persistence,
        )
    )

    call = client.calls[0]
    assert call["params"]["user_id"] == f"eq.{USER_A}"
    assert call["json"]["user_id"] == USER_A
    assert call["headers"]["Authorization"] != f"Bearer {TOKEN_B}"


def test_zero_row_update_returns_false_positive_success_matching_next() -> None:
    """Existing, preserved behavior — not introduced by this migration.

    PostgREST's UPDATE returns 204 with no error whenever zero rows match
    the filter (wrong id, or an id owned by another user and blocked by
    RLS) — a plain SQL UPDATE against a false WHERE clause is not an
    error condition. Neither this Python persistence client nor the
    existing Next implementation (src/lib/lesson-plan-save.ts) requests
    `Prefer: return=representation` or inspects `Content-Range` to detect
    "0 rows affected", so both report a false-positive
    `{"action": "updated", ...}` success for an id that does not exist,
    or does not belong to the caller. See
    docs/migration-audit/LESSON_PLANS_MUTATION_CONTRACT.md.
    """
    client = FakeSupabaseClient([response(204, None)])
    persistence = SupabaseRestClient(client, SETTINGS)

    result = asyncio.run(
        save_lesson_plan(
            parsed_request(activePlanId="does-not-exist-or-not-owned"),
            AuthenticatedUser(USER_A, TOKEN_A),
            persistence,
        )
    )

    assert result == {"action": "updated", "id": "does-not-exist-or-not-owned"}


def test_route_matches_next_error_and_success_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.routes.lesson_plan as route_module

    fake = FakeSupabaseClient(
        [
            response(200, {"id": USER_A}),
            response(201, [{"id": "plan-2"}]),
            response(200, {"id": USER_A}),
        ]
    )
    monkeypatch.setattr(
        route_module.httpx, "AsyncClient", lambda **_kwargs: FakeClientContext(fake)
    )
    monkeypatch.setattr(route_module, "get_settings", lambda: SETTINGS)
    import app.auth.dependencies as auth_module

    monkeypatch.setattr(auth_module, "get_settings", lambda: SETTINGS)
    client = TestClient(create_app())

    result = client.post(
        "/api/lesson-plan/save",
        headers={"Authorization": f"Bearer {TOKEN_A}"},
        json=request_body(),
    )
    assert result.status_code == 201
    assert result.json() == {"action": "inserted", "id": "plan-2"}

    invalid_json = client.post(
        "/api/lesson-plan/save",
        headers={"Authorization": f"Bearer {TOKEN_A}"},
        content="{not-json",
    )
    assert invalid_json.status_code == 400


def test_route_returns_400_for_invalid_payload_and_401_without_auth() -> None:
    client = TestClient(create_app())
    missing_auth = client.post("/api/lesson-plan/save", json=request_body())
    assert missing_auth.status_code == 401
    assert missing_auth.json() == {"error": "Unauthorized"}


def test_route_returns_400_for_invalid_payload_after_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.routes.lesson_plan as route_module
    import app.auth.dependencies as auth_module

    fake = FakeSupabaseClient([response(200, {"id": USER_A})])
    monkeypatch.setattr(
        route_module.httpx, "AsyncClient", lambda **_kwargs: FakeClientContext(fake)
    )
    monkeypatch.setattr(auth_module, "get_settings", lambda: SETTINGS)
    client = TestClient(create_app())

    result = client.post(
        "/api/lesson-plan/save",
        headers={"Authorization": f"Bearer {TOKEN_A}"},
        json={"form": {}, "lessonPlan": {}},
    )
    assert result.status_code == 400
    assert result.json() == {"error": "Invalid request."}


def test_persistence_failure_is_not_exposed() -> None:
    client = FakeSupabaseClient([response(403, {"message": "RLS denied"})])
    persistence = SupabaseRestClient(client, SETTINGS)

    with pytest.raises(SupabasePersistenceError) as failure:
        asyncio.run(
            save_lesson_plan(parsed_request(), AuthenticatedUser(USER_A, TOKEN_A), persistence)
        )
    assert failure.value.status_code == 403
    assert str(failure.value) == "Lesson plan insert failed"
