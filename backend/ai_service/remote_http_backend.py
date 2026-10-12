"""
Calls another machine's /generate endpoint over HTTP.

This lets the model run somewhere with a real GPU (a Colab notebook, a lab
workstation, a cloud VM) while this backend itself stays lightweight — it only
needs `httpx`, never `torch`. The other side just needs to run
`backend/ai_service/service_app.py` (see `colab_notebook.ipynb` for the Colab
version) and expose it through a tunnel (ngrok, Colab port forwarding, etc.).
"""
from __future__ import annotations

import httpx

from .interface import AIBackend, AIBackendError


class RemoteHTTPBackend(AIBackend):
    def __init__(self, url: str, model_name: str, request_timeout: float = 30.0) -> None:
        self.url = url.rstrip("/")
        self.model_name = model_name
        self.request_timeout = request_timeout

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        try:
            response = httpx.post(
                f"{self.url}/generate",
                json={"prompt": prompt, "max_new_tokens": max_new_tokens},
                timeout=self.request_timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AIBackendError(f"remote AI service call failed: {exc}") from exc

        data = response.json()
        text = data.get("text")
        if not text:
            raise AIBackendError("remote AI service returned an empty response")
        return text
