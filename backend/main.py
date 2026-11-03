from __future__ import annotations

import logging
import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

import auth
import database
import export_utils
from auth import current_user
from generator import refine_persuasive, refine_shorten, refine_tone
from models import (
    AuthResponse,
    ExportRequest,
    GeneratedBundle,
    GenerateRequest,
    GenerateResponse,
    LibraryDetail,
    LibraryItem,
    LibraryUpdate,
    LoginRequest,
    PropertyFacts,
    RefineRequest,
    RefineResponse,
    RegisterRequest,
    StatsResponse,
    UserOut,
)
from orchestrator import generate_with_sources
from ratelimit import limiter
from streaming import stream_generation

logger = logging.getLogger("main")


def seed_demo_account() -> None:
    """Create the demo login from DEMO_EMAIL / DEMO_PASSWORD (and optional DEMO_NAME)
    if it doesn't exist yet. On Cloud Run the SQLite file is wiped on every restart,
    so this runs at each startup to keep the live demo login working."""
    email = os.environ.get("DEMO_EMAIL", "").strip().lower()
    password = os.environ.get("DEMO_PASSWORD", "")
    if not email or not password:
        return
    if len(password) < 8:
        logger.warning("DEMO_PASSWORD is shorter than 8 characters; demo account not created")
        return
    if database.get_user_by_email(email) is None:
        name = os.environ.get("DEMO_NAME", "Demo Agent")
        database.create_user(name, email, auth.hash_password(password))
        logger.info("demo account created")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    database.init_db()
    seed_demo_account()
    yield


# Interactive API docs (/docs, /redoc, /openapi.json) are on for local development
# and turned off in production with ENABLE_API_DOCS=false.
_DOCS = os.environ.get("ENABLE_API_DOCS", "true").lower() == "true"

app = FastAPI(
    title="REM Content Studio API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _DOCS else None,
    redoc_url="/redoc" if _DOCS else None,
    openapi_url="/openapi.json" if _DOCS else None,
)


def allowed_origins() -> list[str]:
    """Exact origins from ALLOWED_ORIGINS (comma-separated; CORS_ORIGINS is the older
    name). Wildcards are dropped: only listed origins may call the API from a browser."""
    raw = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS") or "http://localhost:5173"
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return [o for o in origins if "*" not in o]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    # Sign-in uses a bearer token in the Authorization header, not cookies.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    # The export download reads its filename from this header.
    expose_headers=["Content-Disposition"],
    max_age=600,
)

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
# The API only returns JSON and file downloads, so nothing it serves may run scripts.
# The Swagger UI (local development only) needs its own scripts, so it is exempt.
_API_CSP = "default-src 'none'; frame-ancestors 'none'"
_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    if not request.url.path.startswith(_DOC_PATHS):
        response.headers.setdefault("Content-Security-Policy", _API_CSP)
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        response.headers.setdefault("Cache-Control", "no-store")
    return response


# ─── health & auth ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post(
    "/api/auth/register", response_model=AuthResponse, status_code=201, dependencies=[Depends(limiter("auth"))]
)
def register(request: RegisterRequest) -> AuthResponse:
    try:
        user = database.create_user(request.name, request.email, auth.hash_password(request.password))
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    return AuthResponse(token=auth.start_session(user["id"]), user=UserOut(**auth.public_user(user)))


@app.post("/api/auth/login", response_model=AuthResponse, dependencies=[Depends(limiter("auth"))])
def login(request: LoginRequest) -> AuthResponse:
    user = database.get_user_by_email(request.email)
    if user is None or not auth.verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return AuthResponse(token=auth.start_session(user["id"]), user=UserOut(**auth.public_user(user)))


@app.post("/api/auth/logout", status_code=204)
def logout(user: dict = Depends(current_user)) -> Response:
    auth.end_session(user["token"])
    return Response(status_code=204)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: dict = Depends(current_user)) -> UserOut:
    return UserOut(**auth.public_user(user))


# ─── generate ─────────────────────────────────────────────────────────────────

@app.post("/api/generate", response_model=GenerateResponse, dependencies=[Depends(limiter("generate"))])
def generate(request: GenerateRequest, user: dict = Depends(current_user)) -> GenerateResponse:
    bundle, model_used, generation_time_ms, sources = generate_with_sources(request)
    record_id = database.save_output(
        user_id=user["id"],
        request=request,
        bundle=bundle.model_dump(),
        model_used=model_used,
        generation_time_ms=generation_time_ms,
        channel_sources=sources,
    )
    return GenerateResponse(
        id=record_id,
        bundle=bundle,
        model_used=model_used,
        generation_time_ms=generation_time_ms,
        channel_sources=sources,
    )


@app.post("/api/generate/stream", dependencies=[Depends(limiter("generate"))])
def generate_stream(request: GenerateRequest, user: dict = Depends(current_user)) -> StreamingResponse:
    """Same inputs as /api/generate (plus extra_formats and variations), streamed as
    newline-delimited JSON events while the model writes. See streaming.py."""
    return StreamingResponse(
        stream_generation(request, user["id"]),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── library ──────────────────────────────────────────────────────────────────

@app.get("/api/library", response_model=list[LibraryItem])
def get_library(user: dict = Depends(current_user)) -> list[LibraryItem]:
    rows = database.list_outputs(user["id"])
    return [LibraryItem(**row) for row in rows]


def _detail(row: dict) -> LibraryDetail:
    bundle = row["bundle"]
    return LibraryDetail(
        id=row["id"],
        title=row["title"],
        location=row["location"],
        content_type=row["content_type"],
        tone=row["tone"],
        length=row["length"],
        platform=row["platform"],
        keywords=row["keywords"],
        property=PropertyFacts(**row["property"]),
        bundle=GeneratedBundle(**{k: bundle[k] for k in ("listing", "social", "email", "video")}),
        model_used=row["model_used"],
        generation_time_ms=row["generation_time_ms"],
        channel_sources=row["channel_sources"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        extras=bundle.get("extras") or {},
        variants=bundle.get("variants") or {},
    )


# Records belonging to another account return 404, not 403, so ids can't be probed.
@app.get("/api/library/{record_id}", response_model=LibraryDetail)
def get_library_item(record_id: int, user: dict = Depends(current_user)) -> LibraryDetail:
    row = database.get_output(user["id"], record_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return _detail(row)


@app.put("/api/library/{record_id}", response_model=LibraryDetail)
def update_library_item(record_id: int, update: LibraryUpdate, user: dict = Depends(current_user)) -> LibraryDetail:
    if not database.update_output(user["id"], record_id, update.bundle.model_dump(), update.extras):
        raise HTTPException(status_code=404, detail="Record not found")
    return _detail(database.get_output(user["id"], record_id))


@app.delete("/api/library/{record_id}")
def delete_library_item(record_id: int, user: dict = Depends(current_user)) -> Response:
    deleted = database.delete_output(user["id"], record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found")
    return Response(status_code=204)


# ─── refine ───────────────────────────────────────────────────────────────────

@app.post("/api/refine/tone", response_model=RefineResponse, dependencies=[Depends(limiter("refine"))])
def refine_tone_endpoint(request: RefineRequest, user: dict = Depends(current_user)) -> RefineResponse:
    return RefineResponse(refined=refine_tone(request))


@app.post("/api/refine/persuasive", response_model=RefineResponse, dependencies=[Depends(limiter("refine"))])
def refine_persuasive_endpoint(request: RefineRequest, user: dict = Depends(current_user)) -> RefineResponse:
    return RefineResponse(refined=refine_persuasive(request))


@app.post("/api/refine/shorten", response_model=RefineResponse, dependencies=[Depends(limiter("refine"))])
def refine_shorten_endpoint(request: RefineRequest, user: dict = Depends(current_user)) -> RefineResponse:
    return RefineResponse(refined=refine_shorten(request))


# ─── stats ────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(user: dict = Depends(current_user)) -> StatsResponse:
    data = database.get_stats(user["id"])
    return StatsResponse(**data)


# ─── image upload ─────────────────────────────────────────────────────────────

_UPLOADS_DIR = Path(__file__).parent / "uploads"

_SAFE_FILENAME = re.compile(r'[^a-zA-Z0-9._-]')
_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# Only real JPEG/PNG/WebP files are accepted: the bytes are checked, not just the name.
_IMAGE_SIGNATURES = {
    ".jpg": lambda b: b[:3] == b"\xff\xd8\xff",
    ".png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    ".webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(current_user)) -> dict:
    content = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
    ext = next((e for e, check in _IMAGE_SIGNATURES.items() if check(content)), None)
    if ext is None:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG or WebP image.")
    _UPLOADS_DIR.mkdir(exist_ok=True)
    stem = _SAFE_FILENAME.sub('_', Path(file.filename or "photo").stem)[:40] or "photo"
    safe_name = f"{stem}-{uuid.uuid4().hex[:8]}{ext}"
    (_UPLOADS_DIR / safe_name).write_bytes(content)
    return {"path": f"uploads/{safe_name}"}


# ─── export ───────────────────────────────────────────────────────────────────

_MIME = {
    "txt": "text/plain; charset=utf-8",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

_EXT = {"txt": "txt", "pdf": "pdf", "docx": "docx"}


@app.post("/api/export")
def export_content(request: ExportRequest, user: dict = Depends(current_user)) -> Response:
    fmt = request.format
    title = request.title
    tone = request.tone
    bundle = request.bundle

    if fmt == "txt":
        data = export_utils.build_txt(bundle, title, tone, request.extras)
    elif fmt == "pdf":
        data = export_utils.build_pdf(bundle, title, tone, request.extras)
    elif fmt == "docx":
        data = export_utils.build_docx(bundle, title, tone, request.extras)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt}")

    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in title)[:40]
    filename = f"rem-content-{safe_title}-{tone}.{_EXT[fmt]}"

    return Response(
        content=data,
        media_type=_MIME[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
