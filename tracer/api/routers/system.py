"""
System router — health check and system configuration endpoints.
"""

from fastapi import APIRouter

from tracer.api.schemas.tracer import HealthResponse, SystemConfigResponse
from tracer.api.services.tracer_service import get_system_config

router = APIRouter(prefix="/system", tags=["System"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns the current health status of the API.",
)
async def health_check():
    return HealthResponse()


@router.get(
    "/config",
    response_model=SystemConfigResponse,
    summary="System configuration",
    description="Returns room dimensions, microphone positions, and physical constants.",
)
async def system_config():
    return get_system_config()
