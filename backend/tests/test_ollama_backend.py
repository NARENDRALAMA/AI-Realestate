"""
Tests for OllamaBackend — mocking httpx.post so these run without a real
Ollama server (there's no Ollama installed in this dev/test environment; the
backend was verified for real by the person running it locally on their own
machine with `ollama serve` up).
"""
import httpx
import pytest

from ai_service.interface import AIBackendError
from ai_service.ollama_backend import OllamaBackend


class _FakeResponse:
    def __init__(self, json_body, status_code=200):
        self._json_body = json_body
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._json_body


def test_generate_returns_response_text(monkeypatch):
    def fake_post(url, json, timeout):
        assert url == "http://localhost:11434/api/generate"
        assert json["model"] == "mistral"
        assert json["prompt"] == "hello"
        assert json["stream"] is False
        return _FakeResponse({"response": "  Generated text here.  ", "done": True})

    monkeypatch.setattr(httpx, "post", fake_post)

    backend = OllamaBackend("mistral")
    result = backend.generate("hello")
    assert result == "Generated text here."


def test_generate_raises_on_connect_error(monkeypatch):
    def fake_post(url, json, timeout):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "post", fake_post)

    backend = OllamaBackend("mistral")
    with pytest.raises(AIBackendError, match="ollama serve"):
        backend.generate("hello")


def test_generate_raises_on_empty_response(monkeypatch):
    def fake_post(url, json, timeout):
        return _FakeResponse({"response": "", "done": True})

    monkeypatch.setattr(httpx, "post", fake_post)

    backend = OllamaBackend("mistral")
    with pytest.raises(AIBackendError, match="ollama pull"):
        backend.generate("hello")


def test_base_url_trailing_slash_is_stripped():
    backend = OllamaBackend("mistral", base_url="http://localhost:11434/")
    assert backend.base_url == "http://localhost:11434"
