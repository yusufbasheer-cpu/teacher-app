from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from typing import Any
from urllib.parse import urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

pytestmark = pytest.mark.integration

SAFE_ENVIRONMENTS = {"local", "test", "staging"}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
PRODUCTION_WORDS = ("prod", "production", "live")


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        pytest.skip(f"{name} is required for Supabase integration tests")
    return value


def _integration_config() -> dict[str, str]:
    if os.environ.get("RUN_SUPABASE_INTEGRATION_TESTS") != "1":
        pytest.skip("set RUN_SUPABASE_INTEGRATION_TESTS=1 to run Supabase integration tests")
    if os.environ.get("ALLOW_SUPABASE_INTEGRATION_MUTATIONS") != "1":
        pytest.skip("set ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1 for isolated test mutations")

    environment = _require_env("SUPABASE_INTEGRATION_ENVIRONMENT").lower()
    if environment not in SAFE_ENVIRONMENTS:
        raise RuntimeError(
            "Refusing Supabase integration mutations unless "
            "SUPABASE_INTEGRATION_ENVIRONMENT is local, test, or staging"
        )

    url = _require_env("SUPABASE_INTEGRATION_URL").rstrip("/")
    lowered_url = url.lower()
    if any(word in lowered_url for word in PRODUCTION_WORDS):
        raise RuntimeError("Refusing to run Supabase integration tests against production-like URL")
    host = urlparse(url).hostname
    if environment == "local" and host not in LOCAL_HOSTS:
        raise RuntimeError(
            "Refusing local Supabase integration tests unless "
            "SUPABASE_INTEGRATION_URL points at localhost, 127.0.0.1, or ::1"
        )

    return {
        "environment": environment,
        "url": url,
        "anon_key": _require_env("SUPABASE_INTEGRATION_ANON_KEY"),
        "service_role_key": _require_env("SUPABASE_INTEGRATION_SERVICE_ROLE_KEY"),
    }


@pytest.fixture()
def supabase_config(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    config = _integration_config()
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", config["url"])
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", config["anon_key"])
    get_settings.cache_clear()
    return config


@pytest.fixture()
def supabase_admin(supabase_config: dict[str, str]) -> Iterator[httpx.Client]:
    headers = {
        "apikey": supabase_config["service_role_key"],
        "Authorization": f"Bearer {supabase_config['service_role_key']}",
    }
    with httpx.Client(base_url=supabase_config["url"], headers=headers, timeout=15.0) as client:
        yield client


def _auth_headers(config: dict[str, str], token: str) -> dict[str, str]:
    return {"apikey": config["anon_key"], "Authorization": f"Bearer {token}"}


def _admin_json_headers(config: dict[str, str], prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": config["service_role_key"],
        "Authorization": f"Bearer {config['service_role_key']}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _create_user(admin: httpx.Client, config: dict[str, str], label: str) -> dict[str, str]:
    password = f"RlsTest-{uuid.uuid4()}-Aa1!"
    email = f"rls-{label}-{uuid.uuid4()}@example.test"
    response = admin.post(
        "/auth/v1/admin/users",
        headers=_admin_json_headers(config),
        json={"email": email, "password": password, "email_confirm": True},
    )
    response.raise_for_status()
    user_id = response.json()["id"]

    token_response = httpx.post(
        f"{config['url']}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": config["anon_key"], "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15.0,
    )
    token_response.raise_for_status()
    return {
        "id": user_id,
        "email": email,
        "password": password,
        "token": token_response.json()["access_token"],
    }


def _delete_user(admin: httpx.Client, user_id: str) -> None:
    admin.delete(f"/auth/v1/admin/users/{user_id}")


@pytest.fixture()
def synthetic_users(
    supabase_admin: httpx.Client, supabase_config: dict[str, str]
) -> Iterator[tuple[dict[str, str], dict[str, str]]]:
    users: list[dict[str, str]] = []
    try:
        users.append(_create_user(supabase_admin, supabase_config, "user-a"))
        users.append(_create_user(supabase_admin, supabase_config, "user-b"))
        yield users[0], users[1]
    finally:
        for user in users:
            _delete_test_rows(supabase_admin, supabase_config, user["id"])
            _delete_user(supabase_admin, user["id"])


def _payload(topic: str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "form": {
            "curriculumType": "CBSE/NCERT",
            "curriculumFramework": "",
            "grade": "Grade 3",
            "subject": "Math",
            "chapter": f"rls-integration-{uuid.uuid4()}",
            "topic": topic,
            "learningObjectives": "Verify RLS ownership for the FastAPI pilot.",
        },
        "lessonPlan": {"Full Lesson Plan": topic, "testRun": "fastapi-rls-integration"},
        "sectionImages": {},
        "pptSlideImageUrls": [],
    }
    body.update(overrides)
    return body


def _insert_admin_row(
    admin: httpx.Client,
    config: dict[str, str],
    user_id: str,
    topic: str,
) -> str:
    response = admin.post(
        "/rest/v1/lesson_plans",
        params={"select": "id"},
        headers=_admin_json_headers(config, "return=representation"),
        json={
            "user_id": user_id,
            "curriculum_type": "CBSE/NCERT",
            "curriculum_framework": "",
            "subject": "Math",
            "grade": "Grade 3",
            "chapter": f"rls-integration-{uuid.uuid4()}",
            "topic": topic,
            "learning_objectives": "Synthetic integration row.",
            "lesson_plan": {"Full Lesson Plan": topic, "testRun": "fastapi-rls-integration"},
        },
    )
    response.raise_for_status()
    return response.json()[0]["id"]


def _fetch_row(admin: httpx.Client, config: dict[str, str], row_id: str) -> dict[str, Any] | None:
    response = admin.get(
        "/rest/v1/lesson_plans",
        params={"id": f"eq.{row_id}", "select": "*"},
        headers=_admin_json_headers(config),
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def _delete_test_rows(admin: httpx.Client, config: dict[str, str], user_id: str) -> None:
    admin.delete(
        "/rest/v1/lesson_plans",
        params={"user_id": f"eq.{user_id}", "lesson_plan->>testRun": "eq.fastapi-rls-integration"},
        headers=_admin_json_headers(config),
    )


def _call_save(client: TestClient, token: str | None, body: dict[str, Any]) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/api/lesson-plan/save", headers=headers, json=body)


def test_fastapi_lesson_plan_save_preserves_real_supabase_rls(
    supabase_admin: httpx.Client,
    supabase_config: dict[str, str],
    synthetic_users: tuple[dict[str, str], dict[str, str]],
) -> None:
    user_a, user_b = synthetic_users
    app_client = TestClient(create_app())

    insert_response = _call_save(app_client, user_a["token"], _payload("User A insert"))
    assert insert_response.status_code == 201
    inserted_id = insert_response.json()["id"]
    inserted_row = _fetch_row(supabase_admin, supabase_config, inserted_id)
    assert inserted_row is not None
    assert inserted_row["user_id"] == user_a["id"]
    assert inserted_row["topic"] == "User A insert"

    own_update = _call_save(
        app_client,
        user_a["token"],
        _payload("User A update", activePlanId=inserted_id),
    )
    assert own_update.status_code == 200
    assert own_update.json() == {"action": "updated", "id": inserted_id}
    updated_row = _fetch_row(supabase_admin, supabase_config, inserted_id)
    assert updated_row is not None
    assert updated_row["user_id"] == user_a["id"]
    assert updated_row["topic"] == "User A update"

    user_b_row_id = _insert_admin_row(
        supabase_admin, supabase_config, user_b["id"], "User B original"
    )
    cross_user = _call_save(
        app_client,
        user_a["token"],
        _payload("User A attempted overwrite", activePlanId=user_b_row_id, user_id=user_b["id"]),
    )
    assert cross_user.status_code == 200
    user_b_row = _fetch_row(supabase_admin, supabase_config, user_b_row_id)
    assert user_b_row is not None
    assert user_b_row["user_id"] == user_b["id"]
    assert user_b_row["topic"] == "User B original"

    spoof_insert = _call_save(
        app_client,
        user_a["token"],
        _payload("Spoofed insert", user_id=user_b["id"]),
    )
    assert spoof_insert.status_code == 201
    spoof_row = _fetch_row(supabase_admin, supabase_config, spoof_insert.json()["id"])
    assert spoof_row is not None
    assert spoof_row["user_id"] == user_a["id"]

    missing_auth = _call_save(app_client, None, _payload("Missing auth"))
    assert missing_auth.status_code == 401

    invalid_auth = _call_save(app_client, "not-a-real-token", _payload("Invalid auth"))
    assert invalid_auth.status_code == 401

    direct_cross_user = httpx.patch(
        f"{supabase_config['url']}/rest/v1/lesson_plans",
        params={"id": f"eq.{user_b_row_id}"},
        headers={
            **_auth_headers(supabase_config, user_a["token"]),
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={"topic": "Direct User A attempted overwrite"},
        timeout=15.0,
    )
    assert 200 <= direct_cross_user.status_code < 300
    user_b_after_direct = _fetch_row(supabase_admin, supabase_config, user_b_row_id)
    assert user_b_after_direct is not None
    assert user_b_after_direct["topic"] == "User B original"

    direct_spoof_insert = httpx.post(
        f"{supabase_config['url']}/rest/v1/lesson_plans",
        params={"select": "id"},
        headers={
            **_auth_headers(supabase_config, user_a["token"]),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json={
            "user_id": user_b["id"],
            "curriculum_type": "CBSE/NCERT",
            "curriculum_framework": "",
            "subject": "Math",
            "grade": "Grade 3",
            "chapter": f"rls-integration-{uuid.uuid4()}",
            "topic": "Direct spoof insert",
            "learning_objectives": "Synthetic integration row.",
            "lesson_plan": {
                "Full Lesson Plan": "Direct spoof",
                "testRun": "fastapi-rls-integration",
            },
        },
        timeout=15.0,
    )
    assert direct_spoof_insert.status_code in {401, 403}
