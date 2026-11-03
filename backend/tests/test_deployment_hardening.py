"""Deployment hardening: CORS allow-list, security headers, rate limiting,
demo-account seeding, DB_PATH and the API-docs switch."""
import importlib

import pytest
from fastapi.testclient import TestClient

import database
import main
import ratelimit

PROPERTY = {"title": "Sunny Cottage", "location": "Hobart", "bedrooms": "3"}


@pytest.fixture(autouse=True)
def template_only(monkeypatch):
    monkeypatch.setenv("USE_LLM", "false")


# ─── CORS ─────────────────────────────────────────────────────────────────────

def test_allowed_origins_drop_wildcards(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://rem.pages.dev/, *, http://localhost:5173")
    assert main.allowed_origins() == ["https://rem.pages.dev", "http://localhost:5173"]


def test_allowed_origins_fall_back_to_old_name(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example")
    assert main.allowed_origins() == ["https://a.example"]


def test_cors_preflight_allowed_origin(client):
    res = client.options(
        "/api/generate",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight_disallowed_origin(client):
    res = client.options(
        "/api/generate",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert res.status_code == 400
    assert "access-control-allow-origin" not in res.headers


def test_cors_simple_request_disallowed_origin_gets_no_allow_header(client):
    res = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in res.headers


# ─── security headers ─────────────────────────────────────────────────────────

def test_security_headers_present(client):
    res = client.get("/api/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in res.headers["content-security-policy"]
    assert "max-age=" in res.headers["strict-transport-security"]


def test_api_responses_not_cached(client, auth_headers):
    assert client.get("/api/auth/me", headers=auth_headers).headers["cache-control"] == "no-store"


# ─── rate limiting ────────────────────────────────────────────────────────────

def test_generate_is_rate_limited(client, auth_headers, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_GENERATE", "2/60")
    for _ in range(2):
        assert client.post("/api/generate", json=PROPERTY, headers=auth_headers).status_code == 200
    res = client.post("/api/generate", json=PROPERTY, headers=auth_headers)
    assert res.status_code == 429
    assert int(res.headers["retry-after"]) >= 1
    # The streaming endpoint shares the same bucket.
    assert client.post("/api/generate/stream", json=PROPERTY, headers=auth_headers).status_code == 429


def test_login_is_rate_limited(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_AUTH", "3/60")
    codes = [
        client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong-pass"}).status_code
        for _ in range(4)
    ]
    assert codes == [401, 401, 401, 429]


def test_rate_limit_can_be_disabled(client, auth_headers, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_GENERATE", "1/60")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    for _ in range(3):
        assert client.post("/api/generate", json=PROPERTY, headers=auth_headers).status_code == 200


def test_client_ip_uses_last_forwarded_hop_only_when_trusted(monkeypatch):
    class Req:
        headers = {"x-forwarded-for": "6.6.6.6, 203.0.113.9"}

        class client:  # noqa: N801
            host = "10.0.0.1"

    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    assert ratelimit.client_ip(Req) == "10.0.0.1"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    assert ratelimit.client_ip(Req) == "203.0.113.9"  # the forged first entry is ignored


# ─── demo account ─────────────────────────────────────────────────────────────

def test_demo_account_seeded_at_startup(monkeypatch):
    monkeypatch.setenv("DEMO_EMAIL", "Demo@Example.com")
    monkeypatch.setenv("DEMO_PASSWORD", "demo-password-123")
    with TestClient(main.app) as c:
        res = c.post("/api/auth/login", json={"email": "demo@example.com", "password": "demo-password-123"})
        assert res.status_code == 200
    # A second startup (e.g. Cloud Run restart with a kept DB) doesn't duplicate it.
    with TestClient(main.app):
        pass
    assert database.get_user_by_email("demo@example.com") is not None


def test_no_demo_account_without_env(monkeypatch):
    monkeypatch.delenv("DEMO_EMAIL", raising=False)
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    with TestClient(main.app):
        pass
    assert database.get_user_by_email("demo@example.com") is None


def test_short_demo_password_is_refused(monkeypatch):
    monkeypatch.setenv("DEMO_EMAIL", "demo@example.com")
    monkeypatch.setenv("DEMO_PASSWORD", "short")
    with TestClient(main.app):
        pass
    assert database.get_user_by_email("demo@example.com") is None


# ─── config ───────────────────────────────────────────────────────────────────

def test_db_path_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "nested" / "x.db"))
    reloaded = importlib.reload(database)
    try:
        reloaded.init_db()
        assert (tmp_path / "nested" / "x.db").exists()
    finally:
        monkeypatch.delenv("DB_PATH")
        importlib.reload(database)


def test_docs_can_be_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_API_DOCS", "false")
    reloaded = importlib.reload(main)
    try:
        with TestClient(reloaded.app) as c:
            assert c.get("/docs").status_code == 404
            assert c.get("/openapi.json").status_code == 404
    finally:
        monkeypatch.delenv("ENABLE_API_DOCS")
        importlib.reload(main)


# ─── input length limits ──────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "field,size",
    [("features", 2001), ("title", 201), ("location", 201), ("price", 51), ("agent_notes", 2001)],
)
def test_generate_rejects_oversized_fields(client, auth_headers, field, size):
    res = client.post("/api/generate", json={**PROPERTY, field: "A" * size}, headers=auth_headers)
    assert res.status_code == 422


def test_generate_accepts_fields_at_the_limit(client, auth_headers):
    body = {**PROPERTY, "features": "A" * 2000, "title": "T" * 200}
    assert client.post("/api/generate", json=body, headers=auth_headers).status_code == 200


def test_register_rejects_huge_name_and_password(client):
    res = client.post(
        "/api/auth/register", json={"name": "N" * 101, "email": "big@example.com", "password": "p" * 129}
    )
    assert res.status_code == 422


def test_export_rejects_huge_title_and_content(client, auth_headers):
    bundle = {"listing": "x", "social": "x", "email": "x", "video": "x"}
    big_title = {"format": "txt", "title": "T" * 201, "tone": "formal", "bundle": bundle}
    assert client.post("/api/export", json=big_title, headers=auth_headers).status_code == 422
    big_body = {"format": "txt", "title": "T", "tone": "formal", "bundle": {**bundle, "listing": "x" * 20001}}
    assert client.post("/api/export", json=big_body, headers=auth_headers).status_code == 422
