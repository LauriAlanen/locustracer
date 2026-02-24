"""
Tracer router — pipeline execution and results endpoints.
"""

from fastapi import APIRouter, HTTPException

from tracer.api.schemas.tracer import (
    PipelineResponse,
    PipelineRunRequest,
    ErrorResponse,
)
from tracer.api.services.tracer_service import get_latest_results, run_pipeline

router = APIRouter(prefix="/tracer", tags=["Tracer"])


@router.get(
    "/results",
    response_model=PipelineResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get latest results",
    description="Returns the most recent pipeline results. Run the pipeline first if no results exist.",
)
async def get_results():
    results = get_latest_results()
    if results is None:
        raise HTTPException(
            status_code=404,
            detail="No pipeline results found. Run the pipeline first via POST /api/tracer/run.",
        )
    return results


@router.post(
    "/run",
    response_model=PipelineResponse,
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Run pipeline",
    description="Executes the full TimeMachine pipeline (feature extraction → GCC-PHAT → triangulation) and returns results.",
)
async def run_tracer(request: PipelineRunRequest = PipelineRunRequest()):
    try:
        results = run_pipeline(
            input_file=request.input_file,
            visualize=request.visualize,
        )
        return results
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
