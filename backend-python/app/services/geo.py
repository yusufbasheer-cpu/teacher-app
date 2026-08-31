from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from urllib.parse import quote

import httpx
from pydantic import BaseModel

from app.config import Settings, get_settings

logger = logging.getLogger("backend_python.geo")


class GeoLocation(BaseModel):
    country_code: str
    country_name: str


def _normalized_headers(headers: Mapping[str, str]) -> dict[str, str]:
    return {str(key).lower(): str(value) for key, value in headers.items()}


def get_client_ip(headers: Mapping[str, str]) -> str:
    normalized = _normalized_headers(headers)
    forwarded = normalized.get("x-forwarded-for")
    real_ip = normalized.get("x-real-ip")
    ip = forwarded.split(",")[0].strip() if forwarded else real_ip.strip() if real_ip else ""
    return ip


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


async def _try_ipapi_co(
    client: httpx.AsyncClient,
    ip: str,
    settings: Settings,
) -> GeoLocation | None:
    if ip and ip not in {"127.0.0.1", "::1"}:
        url = f"https://ipapi.co/{quote(ip, safe='')}/json/"
    else:
        url = "https://ipapi.co/json/"
    logger.info("[geo] Trying ipapi.co: %s", url)

    try:
        res = await client.get(
            url,
            headers={"User-Agent": settings.geo_user_agent},
            timeout=settings.geo_provider_timeout_seconds,
        )
    except Exception as exc:
        logger.warning("[geo] ipapi.co fetch failed: %s", exc)
        return None

    if res.status_code != 200:
        logger.warning("[geo] ipapi.co responded with status: %s", res.status_code)
        return None

    data = res.json()
    if not isinstance(data, dict):
        logger.warning("[geo] ipapi.co returned non-object payload")
        return None

    if data.get("error"):
        logger.warning("[geo] ipapi.co returned error: %s", data.get("reason"))
        return None

    country_code = data.get("country_code")
    if not country_code:
        logger.warning("[geo] ipapi.co returned no country_code: %s", data)
        return None

    result = GeoLocation(
        country_code=str(country_code),
        country_name=str(data.get("country_name") or country_code),
    )
    logger.info("[geo] ipapi.co success: %s", result.model_dump())
    return result


async def _try_country_is(client: httpx.AsyncClient, settings: Settings) -> GeoLocation | None:
    logger.info("[geo] Trying api.country.is")

    try:
        res = await client.get(
            "https://api.country.is/",
            timeout=settings.geo_provider_timeout_seconds,
        )
    except Exception as exc:
        logger.warning("[geo] api.country.is fetch failed: %s", exc)
        return None

    if res.status_code != 200:
        logger.warning("[geo] api.country.is responded with status: %s", res.status_code)
        return None

    data = res.json()
    if not isinstance(data, dict):
        logger.warning("[geo] api.country.is returned non-object payload")
        return None

    country = data.get("country")
    if not country:
        logger.warning("[geo] api.country.is returned no country: %s", data)
        return None

    result = GeoLocation(country_code=str(country), country_name=str(country))
    logger.info("[geo] api.country.is success: %s", result.model_dump())
    return result


async def resolve_geo_location(
    headers: Mapping[str, str],
    *,
    settings: Settings | None = None,
    client: httpx.AsyncClient | None = None,
) -> GeoLocation:
    settings = settings or get_settings()
    normalized = _normalized_headers(headers)

    logger.info("[geo] Fetching location...")

    vercel_country = normalized.get("x-vercel-ip-country")
    if vercel_country:
        logger.info("[geo] Location result via Vercel header: %s", vercel_country)
        return GeoLocation(country_code=vercel_country, country_name=vercel_country)

    logger.info("[geo] No Vercel geo header - falling back to external APIs")
    ip = get_client_ip(normalized)
    logger.info("[geo] Detected IP: %s", ip or "(none)")

    async with _client_scope(client, settings.geo_provider_timeout_seconds) as active_client:
        ipapi_result = await _try_ipapi_co(active_client, ip, settings)
        if ipapi_result:
            logger.info("[geo] Location result: %s", ipapi_result.model_dump())
            return ipapi_result

        country_is_result = await _try_country_is(active_client, settings)
        if country_is_result:
            logger.info("[geo] Location result: %s", country_is_result.model_dump())
            return country_is_result

    logger.info("[geo] All detection methods failed - defaulting to UAE")
    return GeoLocation(
        country_code=settings.geo_default_country_code,
        country_name=settings.geo_default_country_name,
    )
