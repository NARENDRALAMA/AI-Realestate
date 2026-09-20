"""
Standalone FastAPI inference service.

This is a *separate* small app from the main REM Content Studio backend. Run it
on whatever machine actually has a GPU (a Colab notebook, a lab workstation, a
cloud box) and it loads one model with LocalTransformersBackend and serves it
over HTTP. The main backend then talks to it through RemoteHTTPBackend
(LLM_BACKEND=remote_http, LLM_SERVICE_URL=<this service's public URL>).

Run it locally:

    cd backend
    pip install -r requirements.txt -r requirements-llm.txt
    LLM_MODEL_NAME=Qwen/Qwen2.5-0.5B-Instruct \
        uvicorn ai_service.service_app:app --host 0.0.0.0 --port 9000

On Colab (real GPU, a 7B/8B model): see ai_service/colab_notebook.ipynb, which
starts this same app and exposes it through a tunnel.
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .local_transformers_backend import LocalTransformersBackend

app = FastAPI(title="REM AI Inference Service", version="1.0.0")

_MODEL_NAME = os.environ.get("LLM_MODEL_NAME", "mistralai/Mistral-7B-Instruct-v0.2")
_LOAD_IN_4BIT = os.environ.get("LLM_LOAD_IN_4BIT", "false").lower() == "true"

_backend: LocalTransformersBackend | None = None


class GenerateIn(BaseModel):
    prompt: str
    max_new_tokens: int = 400


class GenerateOut(BaseModel):
    text: str
    model: str


@app.on_event("startup")
def load_model() -> None:
    global _backend
    _backend = LocalTransformersBackend(_MODEL_NAME, load_in_4bit=_LOAD_IN_4BIT)


@app.get("/health")
def health() -> dict:
    return {"status": "ok" if _backend is not None else "loading", "model": _MODEL_NAME}


@app.post("/generate", response_model=GenerateOut)
def generate(body: GenerateIn) -> GenerateOut:
    if _backend is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    text = _backend.generate(body.prompt, max_new_tokens=body.max_new_tokens)
    return GenerateOut(text=text, model=_MODEL_NAME)
