from fastapi import APIRouter, Request

from app.services.geo import GeoLocation, resolve_geo_location

router = APIRouter()


@router.get("/api/geo", response_model=GeoLocation)
async def get_geo(request: Request) -> GeoLocation:
    return await resolve_geo_location(request.headers)
