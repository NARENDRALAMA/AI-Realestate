"""
Calls a model hosted on Cloudflare Workers AI through its REST API.

    POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{CF_MODEL}
    Authorization: Bearer {CF_API_TOKEN}

This is the cloud deployment's model backend: Cloud Run has no GPU, so the
model runs on Cloudflare's GPUs and this class only needs `httpx`. Any failure
(network error, non-2xx status, `success: false`, empty text) raises
AIBackendError, so the orchestrator's shared deadline and template fallback
behave exactly as they do with Ollama.

Env vars (read in factory.py):
  CF_ACCOUNT_ID   Cloudflare account id
  CF_API_TOKEN    API token with the "Workers AI: Read" permission (keep it in a
                  secret store, never in code or git)
  CF_MODEL        Workers AI model id (default: DEFAULT_MODEL below)
"""
from __future__ import annotations

import os

import httpx

from .interface import AIBackend, AIBackendError

DEFAULT_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct"
API_BASE = "https://api.cloudflare.com/client/v4/accounts"


def label_for(model_id: str) -> str:
    """Short name saved as model_used, e.g. "workers-ai/mistral-small-3.1-24b-instruct"."""
    return "workers-ai/" + model_id.rstrip("/").split("/")[-1]


class WorkersAIBackend(AIBackend):
    def __init__(
        self,
        account_id: str,
        api_token: str,
        model_id: str = DEFAULT_MODEL,
        request_timeout: float = 60.0,
    ) -> None:
        if not account_id or not api_token:
            raise ValueError("CF_ACCOUNT_ID and CF_API_TOKEN are required for LLM_BACKEND=workers_ai")
        self.model_id = model_id
        self.model_name = label_for(model_id)
        self.url = f"{API_BASE}/{account_id}/ai/run/{model_id}"
        self._headers = {"Authorization": f"Bearer {api_token}"}
        self.request_timeout = request_timeout

    def __repr__(self) -> str:  # never print the token
        return f"WorkersAIBackend(model={self.model_id!r})"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_new_tokens,
            # Low temperature keeps the copy close to the supplied facts (same as Ollama).
            "temperature": float(os.environ.get("LLM_TEMPERATURE", "0.3")),
        }
        try:
            response = httpx.post(
                self.url, json=payload, headers=self._headers, timeout=self.request_timeout
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            # Status only: the response body can echo request details.
            raise AIBackendError(f"Workers AI returned HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise AIBackendError(f"Workers AI call failed: {type(exc).__name__}") from exc
        except ValueError as exc:
            raise AIBackendError("Workers AI returned invalid JSON") from exc

        if not isinstance(data, dict) or data.get("success") is False:
            raise AIBackendError("Workers AI reported an error")
        text = _extract_text(data.get("result"))
        if not text:
            raise AIBackendError("Workers AI returned an empty response")
        return text.strip()


def _extract_text(result: object) -> str:
    """Text-generation models return {"response": "..."}; some newer ones use the
    OpenAI shape {"choices": [{"message": {"content": "..."}}]}. Accept both."""
    if not isinstance(result, dict):
        return ""
    text = result.get("response")
    if isinstance(text, str):
        return text
    choices = result.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str):
            return content
    return ""
