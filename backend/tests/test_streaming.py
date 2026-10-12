"""
Tests for live generation (backend/streaming.py) and the /api/generate/stream endpoint.

Stub backends stand in for a real model (same approach as test_orchestrator.py), and
database.save_output is replaced so tests never write to propcopy.db.
"""
import json
import time

import pytest

import streaming
from ai_service.interface import AIBackend, AIBackendError
from models import GenerateRequest

CHANNELS = ["listing", "social", "email", "video"]


def _request(**overrides) -> GenerateRequest:
    defaults = dict(
        title="Test House", location="Testville", bedrooms="3", bathrooms="2",
        features="Big kitchen, sunny deck", content_type="listing", tone="formal", length="short",
    )
    defaults.update(overrides)
    return GenerateRequest(**defaults)


def _events(request: GenerateRequest) -> list[dict]:
    return [json.loads(line) for line in streaming.stream_generation(request)]


class _StreamingBackend(AIBackend):
    model_name = "stub-stream"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        return "unused"

    def generate_stream(self, prompt: str, max_new_tokens: int = 400):
        for word in ["Lovely ", "home ", "here."]:
            yield word


class _WholeTextBackend(AIBackend):
    """A backend without generate_stream (like remote_http) — text arrives in one chunk."""

    model_name = "stub-whole"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        return "Complete text."


class _FailsOnVideoBackend(_StreamingBackend):
    def generate_stream(self, prompt: str, max_new_tokens: int = 400):
        if "VIDEO WALKTHROUGH" in prompt:
            raise AIBackendError("simulated failure")
        yield from super().generate_stream(prompt, max_new_tokens)


class _HangingBackend(AIBackend):
    model_name = "stub-hang"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        time.sleep(5)
        return "too late"


@pytest.fixture
def saved(monkeypatch):
    calls = []

    def fake_save(**kwargs):
        calls.append(kwargs)
        return 42

    monkeypatch.setattr(streaming.database, "save_output", fake_save)
    return calls


def _use(monkeypatch, backend):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setattr(streaming, "get_backend", lambda: backend)


def test_template_path_when_llm_disabled(monkeypatch, saved):
    monkeypatch.setenv("USE_LLM", "false")
    events = _events(_request())

    assert events[0] == {"type": "start", "engine": "template", "model": None, "jobs": [f"{c}:0" for c in CHANNELS]}
    done_events = [e for e in events if e["type"] == "job_done"]
    assert {e["job"] for e in done_events} == {f"{c}:0" for c in CHANNELS}
    assert all(e["source"] == "template" for e in done_events)
    final = events[-1]
    assert final["type"] == "done" and final["model_used"] == "template" and final["id"] == 42
    assert set(final["bundle"]) == set(CHANNELS)
    assert saved[0]["model_used"] == "template"


def test_streams_deltas_then_full_ai_result(monkeypatch, saved):
    _use(monkeypatch, _StreamingBackend())
    events = _events(_request())

    deltas = [e for e in events if e["type"] == "delta" and e["job"] == "listing:0"]
    assert "".join(d["text"] for d in deltas) == "Lovely home here."
    final = events[-1]
    assert final["model_used"] == "stub-stream"
    assert final["bundle"]["listing"] == "Lovely home here."
    assert saved[0]["bundle"]["extras"] == {} and saved[0]["bundle"]["variants"] == {}


def test_backend_without_streaming_sends_one_chunk(monkeypatch, saved):
    _use(monkeypatch, _WholeTextBackend())
    events = _events(_request())

    listing_deltas = [e for e in events if e["type"] == "delta" and e["job"] == "listing:0"]
    assert [d["text"] for d in listing_deltas] == ["Complete text."]
    assert events[-1]["model_used"] == "stub-whole"


def test_failed_job_falls_back_to_template_and_marks_partial(monkeypatch, saved):
    _use(monkeypatch, _FailsOnVideoBackend())
    events = _events(_request())

    video_done = next(e for e in events if e["type"] == "job_done" and e["job"] == "video:0")
    assert video_done["source"] == "template"
    assert video_done["text"]  # template text, never empty
    assert events[-1]["model_used"] == "stub-stream (partial)"


def test_deadline_falls_back_without_waiting_for_slow_model(monkeypatch, saved):
    _use(monkeypatch, _HangingBackend())
    monkeypatch.setenv("LLM_STREAM_TIMEOUT_SECONDS", "0.5")
    start = time.monotonic()
    events = _events(_request())

    assert time.monotonic() - start < 3
    assert all(e["source"] == "template" for e in events if e["type"] == "job_done")
    assert events[-1]["model_used"] == "template"


def test_variations_and_extras_are_returned_and_saved(monkeypatch, saved):
    monkeypatch.setenv("USE_LLM", "false")
    events = _events(_request(variations=3, extra_formats=["sms", "headlines"]))

    start = events[0]
    assert "listing:2" in start["jobs"] and "extra:sms" in start["jobs"]
    final = events[-1]
    assert all(len(final["variants"][c]) == 2 for c in CHANNELS)
    assert set(final["extras"]) == {"sms", "headlines"}
    assert len(final["extras"]["sms"]) <= 160
    assert saved[0]["bundle"]["extras"] == final["extras"]


def test_focus_channel_is_planned_first(monkeypatch, saved):
    monkeypatch.setenv("USE_LLM", "false")
    events = _events(_request(content_type="email", variations=2))
    assert events[0]["jobs"][:2] == ["email:0", "email:1"]


def test_ollama_defaults_to_one_request_at_a_time(monkeypatch):
    class OllamaBackend(_StreamingBackend):
        pass

    monkeypatch.delenv("LLM_STREAM_CONCURRENCY", raising=False)
    assert streaming._concurrency(OllamaBackend()) == 1
    assert streaming._concurrency(_StreamingBackend()) == 4
    monkeypatch.setenv("LLM_STREAM_CONCURRENCY", "3")
    assert streaming._concurrency(OllamaBackend()) == 3


def test_variations_out_of_range_rejected():
    with pytest.raises(ValueError):
        _request(variations=4)


def test_stream_endpoint_returns_ndjson(monkeypatch, saved, client, auth_headers):
    monkeypatch.setenv("USE_LLM", "false")
    body = {"title": "Test House", "location": "Testville", "tone": "casual", "length": "extended"}
    with client.stream("POST", "/api/generate/stream", json=body, headers=auth_headers) as res:
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("application/x-ndjson")
        lines = [json.loads(line) for line in res.iter_lines() if line]
    assert lines[0]["type"] == "start" and lines[-1]["type"] == "done"


def test_stream_endpoint_validates_like_generate(client, auth_headers):
    res = client.post("/api/generate/stream", json={"title": "", "location": ""}, headers=auth_headers)
    assert res.status_code == 422
