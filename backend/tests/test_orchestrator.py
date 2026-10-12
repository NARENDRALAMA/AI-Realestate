"""
Tests for the LLM orchestration module (backend/orchestrator.py).

These use a stub AIBackend instead of a real model — there's no GPU in CI or
in this dev environment, and downloading a multi-GB model would make tests
slow and non-deterministic. The stub lets us exercise every fallback branch
(all succeed, some time out, some error, backend unavailable entirely,
USE_LLM off) quickly and reproducibly.
"""
import time

import pytest

import orchestrator
from ai_service.interface import AIBackend, AIBackendError
from models import GenerateRequest


def _request(**overrides) -> GenerateRequest:
    defaults = dict(title="Test House", location="Testville", content_type="listing",
                     tone="formal", length="short")
    defaults.update(overrides)
    return GenerateRequest(**defaults)


class _AllSuccessBackend(AIBackend):
    model_name = "stub-success"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        return f"LLM: {prompt[:10]}"


class _AlwaysFailsBackend(AIBackend):
    model_name = "stub-fail"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        raise AIBackendError("simulated failure")


class _SlowBackend(AIBackend):
    model_name = "stub-slow"

    def __init__(self, delay: float):
        self.delay = delay

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        time.sleep(self.delay)
        return "too slow"


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    """Every test controls USE_LLM/LLM_TIMEOUT_SECONDS explicitly."""
    monkeypatch.delenv("USE_LLM", raising=False)
    monkeypatch.delenv("LLM_TIMEOUT_SECONDS", raising=False)
    yield


def test_use_llm_false_returns_template_bundle(monkeypatch):
    monkeypatch.setenv("USE_LLM", "false")
    bundle, model_used, elapsed_ms = orchestrator.generate_with_fallback(_request())
    assert model_used == "template"
    assert elapsed_ms >= 0
    assert bundle.listing  # template engine always produces something


def test_use_llm_true_with_working_backend_uses_llm_for_all_channels(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setattr(orchestrator, "get_backend", lambda: _AllSuccessBackend())

    bundle, model_used, _ = orchestrator.generate_with_fallback(_request())

    assert model_used == "stub-success"
    for channel in orchestrator.CHANNELS:
        assert getattr(bundle, channel).startswith("LLM:")


def test_backend_errors_fall_back_to_template_per_channel(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setattr(orchestrator, "get_backend", lambda: _AlwaysFailsBackend())

    bundle, model_used, _ = orchestrator.generate_with_fallback(_request())

    # Every channel failed, so we should be fully back on the template engine.
    assert model_used == "template"
    assert bundle.listing and not bundle.listing.startswith("LLM:")


def test_timeout_falls_back_and_stays_within_the_timeout_window(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "1")
    monkeypatch.setattr(orchestrator, "get_backend", lambda: _SlowBackend(delay=5))

    start = time.monotonic()
    bundle, model_used, _ = orchestrator.generate_with_fallback(_request())
    wall_clock = time.monotonic() - start

    assert model_used == "template"
    # Must not wait for the slow backend (5s) to finish; should return near the 1s timeout.
    assert wall_clock < 3.0


def test_backend_unavailable_falls_back_to_template(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")

    def _boom():
        raise RuntimeError("LLM_SERVICE_URL not configured")

    monkeypatch.setattr(orchestrator, "get_backend", _boom)

    bundle, model_used, _ = orchestrator.generate_with_fallback(_request())
    assert model_used == "template"
    assert bundle.listing


def test_partial_success_is_reported_as_partial(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")

    class _PartialBackend(AIBackend):
        model_name = "stub-partial"

        def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
            if "social media post" in prompt.lower():
                raise AIBackendError("this channel fails")
            return f"LLM: {prompt[:10]}"

    monkeypatch.setattr(orchestrator, "get_backend", lambda: _PartialBackend())

    bundle, model_used, _ = orchestrator.generate_with_fallback(_request())

    assert model_used == "stub-partial (partial)"
    assert bundle.listing.startswith("LLM:")
    assert not bundle.social.startswith("LLM:")
