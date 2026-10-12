"""
Calls a local Ollama server (https://ollama.com) for generation.

Ollama is the pragmatic way to run a real 7B/8B instruct model on a laptop
with no CUDA GPU — notably Apple Silicon Macs, where `bitsandbytes` (used by
LocalTransformersBackend's 4-bit quantisation) simply doesn't work. Ollama
ships its own pre-quantised GGUF models and runs them with Metal acceleration
on Mac, or CPU/CUDA elsewhere, with none of the torch/transformers/
bitsandbytes install headaches.

Setup (once, on the machine that will run the model):
    brew install ollama        # or see https://ollama.com/download
    ollama pull mistral        # downloads a 4-bit-quantised Mistral-7B-Instruct
    ollama serve                # usually started automatically after install

Then point this backend at it — no torch/transformers needed on this side,
just the httpx call below:
    LLM_BACKEND=ollama LLM_MODEL_NAME=mistral USE_LLM=true uvicorn main:app ...
"""
from __future__ import annotations

import json
import os
from collections.abc import Iterator

import httpx

from .interface import AIBackend, AIBackendError


class OllamaBackend(AIBackend):
    def __init__(
        self, model_name: str, base_url: str = "http://localhost:11434", request_timeout: float = 60.0
    ) -> None:
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.request_timeout = request_timeout

    @staticmethod
    def _options(max_new_tokens: int) -> dict:
        # A low temperature keeps the model closer to the supplied facts
        # (fewer invented amenities); LLM_TEMPERATURE overrides it.
        return {
            "num_predict": max_new_tokens,
            "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.3")),
        }

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": self._options(max_new_tokens),
                },
                timeout=self.request_timeout,
            )
            response.raise_for_status()
        except httpx.ConnectError as exc:
            raise AIBackendError(
                f"could not reach Ollama at {self.base_url} — is `ollama serve` running? ({exc})"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIBackendError(f"Ollama call failed: {exc}") from exc

        data = response.json()
        text = data.get("response")
        if not text:
            raise AIBackendError(
                f"Ollama returned no text — check the model is pulled (`ollama pull {self.model_name}`)"
            )
        return text.strip()

    def generate_stream(self, prompt: str, max_new_tokens: int = 400) -> Iterator[str]:
        """Yield text chunks as the model produces them (Ollama's native streaming).

        The read timeout applies between chunks, not to the whole response, and defaults
        to 300s (LLM_STREAM_READ_TIMEOUT) because Ollama queues concurrent requests: a
        channel may legitimately wait for others to finish before its first token.
        """
        read_timeout = float(os.environ.get("LLM_STREAM_READ_TIMEOUT", "300"))
        produced = False
        try:
            with httpx.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": True,
                    "options": self._options(max_new_tokens),
                },
                timeout=httpx.Timeout(10.0, read=read_timeout),
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    if data.get("error"):
                        raise AIBackendError(f"Ollama error: {data['error']}")
                    chunk = data.get("response", "")
                    if chunk:
                        produced = True
                        yield chunk
                    if data.get("done"):
                        break
        except httpx.ConnectError as exc:
            raise AIBackendError(
                f"could not reach Ollama at {self.base_url} — is `ollama serve` running? ({exc})"
            ) from exc
        except httpx.HTTPError as exc:
            raise AIBackendError(f"Ollama call failed: {exc}") from exc
        if not produced:
            raise AIBackendError(
                f"Ollama returned no text — check the model is pulled (`ollama pull {self.model_name}`)"
            )
