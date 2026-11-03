"""
Builds the AI backend configured by environment variables.

  LLM_BACKEND        "local_transformers" | "remote_http" | "ollama" | "workers_ai"
                       (default: ollama, for local development)
  LLM_MODEL_NAME      Model identifier — a Hugging Face model id for local_transformers/
                       remote_http (e.g. mistralai/Mistral-7B-Instruct-v0.2), or an
                       Ollama model tag for ollama (e.g. "mistral", "llama3").
  LLM_LOAD_IN_4BIT    "true"/"false" — only used by local_transformers, and only on a
                       CUDA GPU (bitsandbytes has no Apple Silicon / CPU support).
  LLM_SERVICE_URL     Base URL of the running ai_service.service_app — only used
                       by remote_http, e.g. an ngrok URL from Colab.
  LLM_OLLAMA_URL      Base URL of a running `ollama serve` — only used by ollama
                       (default: http://localhost:11434).
  CF_ACCOUNT_ID,      Only used by workers_ai (Cloudflare Workers AI REST API).
  CF_API_TOKEN,       CF_MODEL defaults to workers_ai_backend.DEFAULT_MODEL.
  CF_MODEL

The backend is cached (built once per process) so a local model's weights are
only loaded once, not on every request.
"""
from __future__ import annotations

import os
from functools import lru_cache

from .interface import AIBackend

_DEFAULT_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"


@lru_cache(maxsize=1)
def get_backend() -> AIBackend:
    backend_name = os.environ.get("LLM_BACKEND", "ollama")
    model_name = os.environ.get("LLM_MODEL_NAME", _DEFAULT_MODEL)

    if backend_name == "local_transformers":
        from .local_transformers_backend import LocalTransformersBackend

        load_in_4bit = os.environ.get("LLM_LOAD_IN_4BIT", "false").lower() == "true"
        return LocalTransformersBackend(model_name, load_in_4bit=load_in_4bit)

    if backend_name == "remote_http":
        from .remote_http_backend import RemoteHTTPBackend

        url = os.environ.get("LLM_SERVICE_URL", "")
        if not url:
            raise ValueError("LLM_SERVICE_URL is required when LLM_BACKEND=remote_http")
        return RemoteHTTPBackend(url, model_name)

    if backend_name == "ollama":
        from .ollama_backend import OllamaBackend

        ollama_url = os.environ.get("LLM_OLLAMA_URL", "http://localhost:11434")
        ollama_model = os.environ.get("LLM_MODEL_NAME", "mistral")
        # Ollama serves requests one at a time, so a channel may queue behind the
        # others; the HTTP timeout must cover the orchestrator's whole deadline.
        request_timeout = float(os.environ.get("LLM_TIMEOUT_SECONDS", "180"))
        return OllamaBackend(ollama_model, base_url=ollama_url, request_timeout=request_timeout)

    if backend_name == "workers_ai":
        from .workers_ai_backend import DEFAULT_MODEL, WorkersAIBackend

        return WorkersAIBackend(
            account_id=os.environ.get("CF_ACCOUNT_ID", ""),
            api_token=os.environ.get("CF_API_TOKEN", ""),
            model_id=os.environ.get("CF_MODEL") or DEFAULT_MODEL,
            request_timeout=float(os.environ.get("LLM_TIMEOUT_SECONDS", "60")),
        )

    raise ValueError(f"Unknown LLM_BACKEND: {backend_name!r}")
