"""
Tests for WorkersAIBackend (Cloudflare Workers AI REST API), with httpx.post
mocked so no network call or real token is needed, plus the end-to-end
fallback: a failing Workers AI call must still return template text.
"""
import httpx
import pytest

from ai_service import factory
from ai_service.interface import AIBackendError
from ai_service.workers_ai_backend import WorkersAIBackend, label_for
from models import GenerateRequest
from orchestrator import generate_with_sources

MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct"
URL = f"https://api.cloudflare.com/client/v4/accounts/acct123/ai/run/{MODEL}"


class _FakeResponse:
    def __init__(self, json_body, status_code=200):
        self._json_body = json_body
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        if isinstance(self._json_body, Exception):
            raise self._json_body
        return self._json_body


def _backend():
    return WorkersAIBackend("acct123", "secret-token", MODEL, request_timeout=5)


def test_generate_posts_to_rest_api_and_returns_text(monkeypatch):
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers, timeout))
        return _FakeResponse({"success": True, "errors": [], "result": {"response": "  A sunny home.  "}})

    monkeypatch.setattr(httpx, "post", fake_post)
    assert _backend().generate("Write a listing", max_new_tokens=123) == "A sunny home."

    url, body, headers, timeout = calls[0]
    assert url == URL
    assert headers == {"Authorization": "Bearer secret-token"}
    assert body["messages"] == [{"role": "user", "content": "Write a listing"}]
    assert body["max_tokens"] == 123
    assert timeout == 5


def test_accepts_openai_style_result(monkeypatch):
    body = {"success": True, "result": {"choices": [{"message": {"content": "Hello"}}]}}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(body))
    assert _backend().generate("x") == "Hello"


@pytest.mark.parametrize(
    "response",
    [
        _FakeResponse({"success": False, "errors": [{"message": "bad"}], "result": None}, status_code=401),
        _FakeResponse({"success": False, "errors": [{"code": 5007}], "result": None}),
        _FakeResponse({"success": True, "result": {"response": ""}}),
        _FakeResponse(ValueError("not json")),
    ],
    ids=["http-401", "success-false", "empty-text", "bad-json"],
)
def test_failures_raise_backend_error(monkeypatch, response):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: response)
    with pytest.raises(AIBackendError):
        _backend().generate("x")


def test_network_error_raises_backend_error_without_leaking_token(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(httpx, "post", boom)
    with pytest.raises(AIBackendError) as info:
        _backend().generate("x")
    assert "secret-token" not in str(info.value)
    assert "secret-token" not in repr(_backend())


def test_missing_credentials_rejected():
    with pytest.raises(ValueError):
        WorkersAIBackend("", "token", MODEL)


def test_label():
    assert label_for(MODEL) == "workers-ai/mistral-small-3.1-24b-instruct"


@pytest.fixture
def workers_env(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setenv("LLM_BACKEND", "workers_ai")
    monkeypatch.setenv("CF_ACCOUNT_ID", "acct123")
    monkeypatch.setenv("CF_API_TOKEN", "secret-token")
    monkeypatch.setenv("CF_MODEL", MODEL)
    factory.get_backend.cache_clear()
    yield
    factory.get_backend.cache_clear()


def _request():
    return GenerateRequest(title="Sunny Cottage", location="Hobart", bedrooms="3", features="Garden")


def test_factory_builds_workers_ai_backend(workers_env):
    backend = factory.get_backend()
    assert isinstance(backend, WorkersAIBackend)
    assert backend.model_name == "workers-ai/mistral-small-3.1-24b-instruct"


def test_orchestrator_uses_workers_ai(workers_env, monkeypatch):
    body = {"success": True, "result": {"response": "Sunny Cottage in Hobart has 3 bedrooms and a garden."}}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(body))
    _bundle, model_used, _ms, sources = generate_with_sources(_request())
    assert model_used == "workers-ai/mistral-small-3.1-24b-instruct"
    assert set(sources.values()) == {"ai"}


def test_bad_token_falls_back_to_templates(workers_env, monkeypatch):
    body = {"success": False, "errors": [{"code": 10000, "message": "Authentication error"}]}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(body, status_code=401))
    bundle, model_used, _ms, sources = generate_with_sources(_request())
    assert model_used == "template"
    assert set(sources.values()) == {"template"}
    assert all(getattr(bundle, c).strip() for c in ("listing", "social", "email", "video"))
