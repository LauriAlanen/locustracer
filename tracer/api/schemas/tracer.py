"""
Pydantic schemas for type-safe API request/response models.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ── System schemas ──────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = Field(default="ok", examples=["ok"])
    version: str = Field(default="0.1.0", examples=["0.1.0"])


class MicrophonePosition(BaseModel):
    id: int = Field(..., description="Microphone identifier (0-3)")
    label: str = Field(..., description="Human-readable label", examples=["Mic 0"])
    position: List[float] = Field(..., description="[x, y] coordinates in meters")
    color: str = Field(default="#4da6ff", description="Display color hex")


class RoomDimensions(BaseModel):
    width: float = Field(..., description="Room width in meters (X axis)")
    depth: float = Field(..., description="Room depth in meters (Y axis)")
    height: float = Field(..., description="Room height in meters (Z axis)")


class SystemConfigResponse(BaseModel):
    room: RoomDimensions
    microphones: List[MicrophonePosition]
    speed_of_sound: float = Field(..., description="Speed of sound in m/s")


# ── Tracer schemas ──────────────────────────────────────────────────

class ProcessedSegment(BaseModel):
    start_sample: int = Field(..., description="Start sample index")
    end_sample: int = Field(..., description="End sample index")
    delays: List[int] = Field(..., description="GCC-PHAT delays relative to Mic 0 (samples)")


class LocationResult(BaseModel):
    segment_idx: int = Field(..., description="Index of the processed segment")
    position: List[float] = Field(..., description="Estimated [x, y] in meters")
    cost: float = Field(..., description="Residual triangulation error")


class PipelineResponse(BaseModel):
    source_file: str = Field(..., description="Input audio file path")
    sample_rate: int = Field(..., description="Audio sample rate in Hz")
    processed_segments: List[ProcessedSegment]
    locations: List[LocationResult]


class PipelineRunRequest(BaseModel):
    input_file: Optional[str] = Field(
        default=None,
        description="Path to input WAV file. If not provided, uses default simulation file."
    )
    visualize: bool = Field(
        default=False,
        description="Whether to generate visualization plots"
    )


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Error description")
