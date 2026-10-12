"""
The AIBackend interface.

Both LocalTransformersBackend (runs a model in this process) and
RemoteHTTPBackend (calls a model running somewhere else, e.g. Colab) implement
this same tiny interface. The orchestrator only ever talks to an `AIBackend`,
so swapping between "model on my GPU" and "model on a friend's Colab GPU" is
just an environment variable change, not a code change.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class AIBackendError(Exception):
    """Raised whenever the AI backend cannot produce text (model unavailable,
    the remote service errored, the response was empty, etc.). The orchestrator
    catches this and falls back to the template engine."""


class AIBackend(ABC):
    #: Human-readable model name, shown in the UI badge and saved to the DB.
    model_name: str

    @abstractmethod
    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        """Return generated text for the given prompt, or raise AIBackendError."""
        raise NotImplementedError
