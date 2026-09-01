from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.verify_captcha import (
    TurnstileTransportError,
    get_client_ip,
    verify_turnstile_token,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "contract-fixtures"
    / "verify-captcha"
    / "verify-captcha-contract.json"
)


class FakeTurnstileClient:
    def __init__(self, response: dict[str, Any] | None) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def post(
        self, url: str, *, json: dict[str, Any] | None = None, timeout: float | None = None
    ) -> httpx.Response:
        self.calls.append({"url": url, "json": json, "timeout": timeout})
        if self.response is None or self.response.get("networkError"):
            raise httpx.ConnectError("connection refused")
        return httpx.Response(
            self.response["status"],
            json=self.response["json"],
            request=httpx.Request("POST", url),
        )


def load_cases() -> list[dict[str, Any]]:
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return list(data["cases"])


def _settings_for(case: dict[str, Any]) -> Settings:
    secret = "test-secret" if case["secretConfigured"] else ""
    return Settings(turnstile_secret_key=secret, turnstile_timeout_seconds=5.0)


def test_route_matches_shared_contract_fixture(monkeypatch) -> None:
    client = TestClient(create_app())

    for case in load_cases():
        settings = _settings_for(case)
        monkeypatch.setattr("app.api.routes.verify_captcha.get_settings", lambda s=settings: s)

        if "rawBody" in case:
            content = case["rawBody"].encode("utf-8")
        else:
            content = json.dumps(case.get("body", {})).encode("utf-8")

        fake_client = FakeTurnstileClient(case.get("turnstileResponse"))

        async def fake_verify(secret_key, token, remote_ip, *, settings=None, _fc=fake_client):
            return await verify_turnstile_token(
                secret_key, token, remote_ip, settings=settings, client=_fc
            )

        monkeypatch.setattr("app.api.routes.verify_captcha.verify_turnstile_token", fake_verify)

        response = client.post(
            "/api/auth/verify-captcha",
            content=content,
            headers={"content-type": "application/json"},
        )

        assert response.status_code == case["expected"]["status"], case["name"]
        assert response.json() == case["expected"]["json"], case["name"]

        if case["turnstileCalled"]:
            assert len(fake_client.calls) == 1, case["name"]
            if "expectedTurnstileToken" in case:
                assert fake_client.calls[0]["json"]["response"] == case["expectedTurnstileToken"]
        else:
            assert fake_client.calls == [], case["name"]


def test_service_matches_shared_contract_fixture() -> None:
    for case in load_cases():
        if not case["secretConfigured"] or not case["turnstileCalled"]:
            continue

        token = case["body"]["token"].strip()
        fake_client = FakeTurnstileClient(case["turnstileResponse"])
        settings = _settings_for(case)

        async def run(
            _token=token, _settings=settings, _client=fake_client
        ) -> tuple[bool, list[str] | None]:
            return await verify_turnstile_token(
                "test-secret", _token, "203.0.113.5", settings=_settings, client=_client
            )

        if case["turnstileResponse"].get("networkError"):
            try:
                asyncio.run(run())
                raise AssertionError(f"expected TurnstileTransportError for {case['name']}")
            except TurnstileTransportError:
                pass
        else:
            success, error_codes = asyncio.run(run())
            expected_json = case["turnstileResponse"]["json"]
            assert success == bool(expected_json.get("success")), case["name"]
            assert error_codes == expected_json.get("error-codes"), case["name"]


def test_client_ip_extraction() -> None:
    assert get_client_ip({"x-forwarded-for": "203.0.113.1, 10.0.0.1"}) == "203.0.113.1"
    assert get_client_ip({"x-real-ip": "203.0.113.2"}) == "203.0.113.2"
    assert get_client_ip({}) == "unknown"


def test_non_string_or_null_body_token_is_missing_not_a_crash(monkeypatch) -> None:
    client = TestClient(create_app())
    settings = Settings(turnstile_secret_key="test-secret", turnstile_timeout_seconds=5.0)
    monkeypatch.setattr("app.api.routes.verify_captcha.get_settings", lambda: settings)

    response = client.post("/api/auth/verify-captcha", json={"token": 12345})
    assert response.status_code == 400
    assert response.json() == {"ok": False, "error": "Missing captcha token."}

    response_null_body = client.post(
        "/api/auth/verify-captcha",
        content=b"null",
        headers={"content-type": "application/json"},
    )
    assert response_null_body.status_code == 400
    assert response_null_body.json() == {"ok": False, "error": "Missing captcha token."}
