from __future__ import annotations

import re
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import database
import export_utils
from generator import generate_bundle, refine_persuasive, refine_shorten, refine_tone
from models import (
    ExportRequest,
    GenerateRequest,
    GenerateResponse,
    GeneratedBundle,
    LibraryDetail,
    LibraryItem,
    RefineRequest,
    RefineResponse,
    StatsResponse,
)

app = FastAPI(title="REM Content Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    database.init_db()


# ─── generate ─────────────────────────────────────────────────────────────────

@app.post("/api/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest) -> GenerateResponse:
    bundle = generate_bundle(request)
    record_id = database.save_output(
        title=request.title,
        location=request.location,
        content_type=request.content_type,
        tone=request.tone,
        bundle=bundle.model_dump(),
        image_path=request.image_path,
    )
    return GenerateResponse(id=record_id, bundle=bundle)


# ─── library ──────────────────────────────────────────────────────────────────

@app.get("/api/library", response_model=list[LibraryItem])
def get_library() -> list[LibraryItem]:
    rows = database.list_outputs()
    return [LibraryItem(**row) for row in rows]


@app.get("/api/library/{record_id}", response_model=LibraryDetail)
def get_library_item(record_id: int) -> LibraryDetail:
    row = database.get_output(record_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return LibraryDetail(
        id=row["id"],
        title=row["title"],
        location=row["location"],
        content_type=row["content_type"],
        tone=row["tone"],
        bundle=GeneratedBundle(**row["bundle"]),
        created_at=row["created_at"],
    )


@app.delete("/api/library/{record_id}")
def delete_library_item(record_id: int) -> Response:
    deleted = database.delete_output(record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Record not found")
    return Response(status_code=204)


# ─── refine ───────────────────────────────────────────────────────────────────

@app.post("/api/refine/tone", response_model=RefineResponse)
def refine_tone_endpoint(request: RefineRequest) -> RefineResponse:
    return RefineResponse(refined=refine_tone(request))


@app.post("/api/refine/persuasive", response_model=RefineResponse)
def refine_persuasive_endpoint(request: RefineRequest) -> RefineResponse:
    return RefineResponse(refined=refine_persuasive(request))


@app.post("/api/refine/shorten", response_model=RefineResponse)
def refine_shorten_endpoint(request: RefineRequest) -> RefineResponse:
    return RefineResponse(refined=refine_shorten(request))


# ─── stats ────────────────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=StatsResponse)
def get_stats() -> StatsResponse:
    data = database.get_stats()
    return StatsResponse(**data)


# ─── image upload ─────────────────────────────────────────────────────────────

_UPLOADS_DIR = Path(__file__).parent / "uploads"

_SAFE_FILENAME = re.compile(r'[^a-zA-Z0-9._-]')


@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)) -> dict:
    _UPLOADS_DIR.mkdir(exist_ok=True)
    safe_name = _SAFE_FILENAME.sub('_', file.filename or "upload")
    dest = _UPLOADS_DIR / safe_name
    content = await file.read()
    dest.write_bytes(content)
    return {"path": f"uploads/{safe_name}"}


# ─── export ───────────────────────────────────────────────────────────────────

_MIME = {
    "txt": "text/plain; charset=utf-8",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

_EXT = {"txt": "txt", "pdf": "pdf", "docx": "docx"}


@app.post("/api/export")
def export_content(request: ExportRequest) -> Response:
    fmt = request.format
    title = request.title
    tone = request.tone
    bundle = request.bundle

    if fmt == "txt":
        data = export_utils.build_txt(bundle, title, tone)
    elif fmt == "pdf":
        data = export_utils.build_pdf(bundle, title, tone)
    elif fmt == "docx":
        data = export_utils.build_docx(bundle, title, tone)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt}")

    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in title)[:40]
    filename = f"rem-content-{safe_title}-{tone}.{_EXT[fmt]}"

    return Response(
        content=data,
        media_type=_MIME[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
