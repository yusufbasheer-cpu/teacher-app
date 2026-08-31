from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ready",
        "service": settings.app_name,
        "pilot": "geo",
    }
