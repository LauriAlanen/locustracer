"""
Simulation router — trajectory generation and real-time SSE streaming.
"""

import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from tracer.api.schemas.simulation import (
    TrajectoryShape,
    TrajectoryResponse,
)
from tracer.api.services.simulation_service import generate_trajectory

router = APIRouter(prefix="/simulation", tags=["Simulation"])


@router.get(
    "/trajectory",
    response_model=TrajectoryResponse,
    summary="Get full trajectory",
    description="Pre-compute and return an entire trajectory with solver verification at each step.",
)
async def get_trajectory(
    shape: TrajectoryShape = Query(default=TrajectoryShape.circle),
    steps: int = Query(default=100, ge=10, le=500),
    speed: float = Query(default=0.5, ge=0.1, le=2.0),
    sample_rate: int = Query(default=44100),
    interval_ms: int = Query(default=200, ge=50, le=1000),
):
    frames = generate_trajectory(
        shape=shape.value,
        steps=steps,
        speed=speed,
        sample_rate=sample_rate,
        interval_ms=interval_ms,
    )

    return TrajectoryResponse(
        shape=shape.value,
        total_steps=len(frames),
        duration_seconds=round(len(frames) * (interval_ms / 1000.0), 2),
        frames=frames,
    )


@router.get(
    "/stream",
    summary="Stream simulation (SSE)",
    description="Real-time Server-Sent Events stream of simulation frames. "
    "Each event contains a position update with solver verification.",
)
async def stream_simulation(
    shape: TrajectoryShape = Query(default=TrajectoryShape.circle),
    steps: int = Query(default=100, ge=10, le=500),
    speed: float = Query(default=0.5, ge=0.1, le=2.0),
    sample_rate: int = Query(default=44100),
    interval_ms: int = Query(default=200, ge=50, le=1000),
):
    # Pre-compute the full trajectory
    frames = generate_trajectory(
        shape=shape.value,
        steps=steps,
        speed=speed,
        sample_rate=sample_rate,
        interval_ms=interval_ms,
    )

    async def event_generator():
        # Send start event
        yield f"event: start\ndata: {json.dumps({'total_steps': len(frames), 'shape': shape.value})}\n\n"

        for frame in frames:
            yield f"event: frame\ndata: {json.dumps(frame)}\n\n"
            await asyncio.sleep(interval_ms / 1000.0)

        # Send end event
        yield f"event: end\ndata: {json.dumps({'status': 'completed'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
