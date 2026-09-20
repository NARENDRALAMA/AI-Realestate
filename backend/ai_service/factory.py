"""
Builds the AI backend configured by environment variables.

  LLM_BACKEND        "local_transformers" | "remote_http"   (default: remote_http)
  LLM_MODEL_NAME      Hugging Face model id, e.g. mistralai/Mistral-7B-Instruct-v0.2
  LLM_LOAD_IN_4BIT    "true"/"false" — only used by local_transformers (default: false)
  LLM_SERVICE_URL     Base URL of the running ai_service.service_app — only used
                       by remote_http, e.g. an ngrok URL from Colab.

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
    backend_name = os.environ.get("LLM_BACKEND", "remote_http")
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

    raise ValueError(f"Unknown LLM_BACKEND: {backend_name!r}")
