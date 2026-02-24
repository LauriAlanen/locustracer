"""
Locus Tracer API — FastAPI application factory.

Start with:
    uvicorn tracer.api.main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tracer.api.routers import system, tracer, simulation


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print("[API] Locus Tracer API starting up...")
    yield
    print("[API] Locus Tracer API shutting down...")


app = FastAPI(
    title="Locus Tracer API",
    description="REST API for the Locus sound source localization system. "
    "Provides endpoints for running the TimeMachine pipeline and retrieving results.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────────────
# Allow the Vite dev server and any local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternative dev port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────
app.include_router(system.router, prefix="/api")
app.include_router(tracer.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": "Locus Tracer API",
        "version": "0.1.0",
        "docs": "/docs",
    }
