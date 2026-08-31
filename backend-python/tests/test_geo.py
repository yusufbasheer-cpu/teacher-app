from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.geo import GeoLocation, resolve_geo_location

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "contract-fixtures" / "geo" / "geo-contract.json"
)


class FakeGeoClient:
    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, dict[str, str], float | None]] = []

    async def get(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> httpx.Response:
        self.calls.append((url, headers or {}, timeout))
        if not self.responses:
            raise AssertionError(f"Unexpected request: {url}")
        expected = self.responses.pop(0)
        assert expected["url"] in url
        content = (
            json.dumps(expected["json"]).encode("utf-8")
            if expected.get("json") is not None
            else (expected.get("text") or "").encode("utf-8")
        )
        return httpx.Response(
            expected["status"],
            content=content,
            request=httpx.Request("GET", url),
        )


def load_cases() -> list[dict[str, Any]]:
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return list(data["cases"])


def test_geo_route_parity_with_shared_fixture() -> None:
    client = TestClient(create_app())
    cases = load_cases()

    for case in cases:
        if case["name"] == "vercel_header":
            response = client.get("/api/geo", headers=case["headers"])
            assert response.status_code == 200
            assert response.json() == case["expected"]


def test_geo_service_matches_shared_fixture() -> None:
    cases = load_cases()

    for case in cases:
        fake_client = FakeGeoClient(list(case.get("fetches", [])))
        result = asyncio.run(resolve_geo_location(case["headers"], client=fake_client))

        assert isinstance(result, GeoLocation)
        assert result.model_dump() == case["expected"]

        if case["name"] == "vercel_header":
            assert fake_client.calls == []
        elif case["name"] == "ipapi_success":
            assert [call[0] for call in fake_client.calls] == ["https://ipapi.co/203.0.113.10/json/"]
        elif case["name"] == "countryis_success":
            assert [call[0] for call in fake_client.calls] == [
                "https://ipapi.co/198.51.100.9/json/",
                "https://api.country.is/",
            ]
        elif case["name"] == "fallback_uae":
            assert [call[0] for call in fake_client.calls] == [
                "https://ipapi.co/json/",
                "https://api.country.is/",
            ]
