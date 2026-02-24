"""
Pydantic schemas for simulation request/response models.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class TrajectoryShape(str, Enum):
    circle = "circle"
    figure8 = "figure8"
    linear = "linear"
    random_walk = "random_walk"


class SimulationFrame(BaseModel):
    step: int = Field(..., description="Frame index")
    timestamp: float = Field(..., description="Time in seconds")
    true_position: List[float] = Field(..., description="Ground truth [x, y] in meters")
    delays: List[int] = Field(..., description="Theoretical sample delays [mic1, mic2, mic3]")
    solved_position: List[float] = Field(..., description="Solver-estimated [x, y] in meters")
    residual: float = Field(..., description="Solver residual error")


class TrajectoryRequest(BaseModel):
    shape: TrajectoryShape = Field(default=TrajectoryShape.circle, description="Trajectory shape")
    steps: int = Field(default=100, ge=10, le=500, description="Number of trajectory steps")
    speed: float = Field(default=0.5, ge=0.1, le=2.0, description="Movement speed multiplier")
    sample_rate: int = Field(default=44100, description="Audio sample rate in Hz")
    interval_ms: int = Field(default=200, ge=50, le=1000, description="Interval between SSE events in ms")


class TrajectoryResponse(BaseModel):
    shape: str
    total_steps: int
    duration_seconds: float
    frames: List[SimulationFrame]
