from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings, get_settings


class SupabasePersistenceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class SupabaseRestClient:
    def __init__(self, client: httpx.AsyncClient, settings: Settings | None = None) -> None:
        self.client = client
        self.settings = settings or get_settings()

    def _headers(self, access_token: str, prefer: str) -> dict[str, str]:
        return {
            "apikey": self.settings.supabase_anon_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    async def insert_lesson_plan(self, payload: dict[str, Any], access_token: str) -> str:
        response = await self.client.post(
            f"{self.settings.supabase_url.rstrip('/')}/rest/v1/lesson_plans",
            params={"select": "id"},
            headers=self._headers(access_token, "return=representation"),
            json=payload,
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise SupabasePersistenceError(response.status_code, "Lesson plan insert failed")
        try:
            rows = response.json()
            plan_id = rows[0].get("id") if isinstance(rows, list) and rows else None
        except (ValueError, IndexError, AttributeError):
            plan_id = None
        if not isinstance(plan_id, str) or not plan_id:
            raise SupabasePersistenceError(500, "Lesson plan insert returned no id")
        return plan_id

    async def update_lesson_plan(
        self, payload: dict[str, Any], access_token: str, plan_id: str, user_id: str
    ) -> None:
        response = await self.client.patch(
            f"{self.settings.supabase_url.rstrip('/')}/rest/v1/lesson_plans",
            params={"id": f"eq.{plan_id}", "user_id": f"eq.{user_id}"},
            headers=self._headers(access_token, "return=minimal"),
            json=payload,
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise SupabasePersistenceError(response.status_code, "Lesson plan update failed")
