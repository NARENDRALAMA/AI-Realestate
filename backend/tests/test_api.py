"""API-level tests: authentication, per-user ownership, library persistence of facts,
settings and edits, input/upload validation, and migration of Project 1 databases.
All generation here uses the template path (USE_LLM=false) — no model needed."""

import json
import sqlite3

import pytest

from conftest import register

PROPERTY = {
    "title": "Audit Cottage",
    "property_type": "house",
    "price": "$720,000",
    "location": "Katoomba, NSW",
    "bedrooms": "2",
    "bathrooms": "1",
    "parking": "1",
    "features": "wood fireplace, mountain views",
    "content_type": "social",
    "tone": "casual",
    "length": "short",
    "platform": "linkedin",
    "keywords": "cottage",
}


@pytest.fixture(autouse=True)
def template_only(monkeypatch):
    monkeypatch.setenv("USE_LLM", "false")


def _generate(client, headers, **overrides):
    res = client.post("/api/generate", json={**PROPERTY, **overrides}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


# ─── auth ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/library"),
        ("get", "/api/library/1"),
        ("delete", "/api/library/1"),
        ("get", "/api/stats"),
        ("post", "/api/generate"),
        ("post", "/api/generate/stream"),
        ("post", "/api/export"),
        ("post", "/api/refine/shorten"),
        ("post", "/api/upload-image"),
        ("put", "/api/library/1"),
        ("get", "/api/auth/me"),
    ],
)
def test_protected_routes_reject_anonymous_requests(client, method, path):
    res = getattr(client, method)(path)
    assert res.status_code == 401
    assert res.json()["detail"] == "Please sign in to continue."


def test_bad_token_is_rejected(client):
    res = client.get("/api/library", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_register_login_me_logout(client):
    headers = register(client, email="Jo@Example.com")
    assert client.get("/api/auth/me", headers=headers).json()["email"] == "jo@example.com"

    res = client.post("/api/auth/login", json={"email": "jo@example.com", "password": "correct horse"})
    assert res.status_code == 200
    login_headers = {"Authorization": f"Bearer {res.json()['token']}"}
    assert client.post("/api/auth/logout", headers=login_headers).status_code == 204
    assert client.get("/api/auth/me", headers=login_headers).status_code == 401
    assert client.get("/api/auth/me", headers=headers).status_code == 200  # other session unaffected


def test_wrong_password_and_duplicate_email(client):
    register(client)
    bad = client.post("/api/auth/login", json={"email": "agent@example.com", "password": "wrong password"})
    assert bad.status_code == 401
    dup = client.post("/api/auth/register", json={"name": "X", "email": "agent@example.com", "password": "another one"})
    assert dup.status_code == 409


def test_password_is_hashed_not_stored(client, temp_database):
    register(client)
    stored = sqlite3.connect(temp_database).execute("SELECT password_hash FROM users").fetchone()[0]
    assert "correct horse" not in stored and stored.startswith("pbkdf2_sha256$")


def test_short_password_and_bad_email_rejected(client):
    assert (
        client.post("/api/auth/register", json={"name": "A", "email": "a@b.co", "password": "short"}).status_code == 422
    )
    assert (
        client.post("/api/auth/register", json={"name": "A", "email": "nope", "password": "long enough"}).status_code
        == 422
    )


# ─── ownership ────────────────────────────────────────────────────────────────


def test_users_cannot_see_or_change_each_others_records(client):
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    record = _generate(client, alice)

    assert client.get("/api/library", headers=bob).json() == []
    assert client.get(f"/api/library/{record['id']}", headers=bob).status_code == 404
    assert client.delete(f"/api/library/{record['id']}", headers=bob).status_code == 404
    edit = {"bundle": {**record["bundle"], "listing": "hijacked"}}
    assert client.put(f"/api/library/{record['id']}", json=edit, headers=bob).status_code == 404
    assert client.get("/api/stats", headers=bob).json()["total"] == 0

    assert client.get(f"/api/library/{record['id']}", headers=alice).json()["bundle"]["listing"] != "hijacked"
    assert client.get("/api/stats", headers=alice).json()["total"] == 1


# ─── library: facts, settings, provenance, edits ──────────────────────────────


def test_library_detail_restores_facts_settings_and_sources(client, auth_headers):
    record = _generate(client, auth_headers)
    assert record["channel_sources"] == {c: "template" for c in ("listing", "social", "email", "video")}

    detail = client.get(f"/api/library/{record['id']}", headers=auth_headers).json()
    prop = detail["property"]
    for field in ("title", "property_type", "price", "location", "bedrooms", "bathrooms", "parking", "features"):
        assert prop[field] == PROPERTY[field]
    assert (detail["length"], detail["platform"], detail["keywords"]) == ("short", "linkedin", "cottage")
    assert detail["channel_sources"]["listing"] == "template"


def test_edits_are_saved_to_the_library(client, auth_headers):
    record = _generate(client, auth_headers)
    edited = {**record["bundle"], "listing": "Edited listing text."}
    res = client.put(f"/api/library/{record['id']}", json={"bundle": edited}, headers=auth_headers)
    assert res.status_code == 200 and res.json()["updated_at"]
    assert (
        client.get(f"/api/library/{record['id']}", headers=auth_headers).json()["bundle"]["listing"]
        == "Edited listing text."
    )


def test_delete_removes_record_and_its_property(client, auth_headers, temp_database):
    record = _generate(client, auth_headers)
    assert client.delete(f"/api/library/{record['id']}", headers=auth_headers).status_code == 204
    con = sqlite3.connect(temp_database)
    assert con.execute("SELECT COUNT(*) FROM properties").fetchone()[0] == 0


def test_records_link_to_lookup_tables(client, auth_headers, temp_database):
    _generate(client, auth_headers)
    row = (
        sqlite3.connect(temp_database)
        .execute(
            "SELECT ct.code, t.code, g.user_id IS NOT NULL, g.property_id IS NOT NULL FROM generated_outputs g "
            "JOIN content_types ct ON ct.id = g.content_type_id JOIN tones t ON t.id = g.tone_id"
        )
        .fetchone()
    )
    assert row == ("social", "casual", 1, 1)


# ─── validation ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "field,value",
    [
        ("bedrooms", "lots"),
        ("bathrooms", "-1"),
        ("price", "-5"),
        ("platform", "tiktok"),
        ("property_type", "castle"),
        ("title", "  "),
    ],
)
def test_invalid_property_input_rejected(client, auth_headers, field, value):
    res = client.post("/api/generate", json={**PROPERTY, field: value}, headers=auth_headers)
    assert res.status_code == 422


def test_half_bathrooms_allowed(client, auth_headers):
    assert _generate(client, auth_headers, bathrooms="2.5")["id"]


def test_upload_accepts_real_images_only(client, auth_headers, tmp_path, monkeypatch):
    import main

    monkeypatch.setattr(main, "_UPLOADS_DIR", tmp_path / "uploads")
    html = client.post(
        "/api/upload-image", files={"file": ("x.png", b"<script>alert(1)</script>", "image/png")}, headers=auth_headers
    )
    assert html.status_code == 415
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    ok = client.post(
        "/api/upload-image", files={"file": ("../../evil name.png", png, "image/png")}, headers=auth_headers
    )
    assert ok.status_code == 200
    path = ok.json()["path"]
    assert path.startswith("uploads/evil_name-") and path.endswith(".png") and ".." not in path
    big = client.post(
        "/api/upload-image",
        files={"file": ("big.png", png + b"\x00" * (5 * 1024 * 1024), "image/png")},
        headers=auth_headers,
    )
    assert big.status_code == 413


# ─── migration ────────────────────────────────────────────────────────────────


def _project1_db(path):
    con = sqlite3.connect(path)
    con.execute(
        "CREATE TABLE generated_outputs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, "
        "location TEXT NOT NULL, content_type TEXT NOT NULL, tone TEXT NOT NULL, generated_content TEXT NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
    bundle = json.dumps({"listing": "a", "social": "b", "email": "c", "video": "d"})
    for i in range(3):
        con.execute(
            "INSERT INTO generated_outputs (title, location, content_type, tone, generated_content) "
            "VALUES (?, ?, ?, ?, ?)",
            (f"Old {i}", "Ryde", "listing", "formal", bundle),
        )
    con.commit()
    con.close()


def test_project1_database_migrates_and_first_user_claims_records(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    import database
    import main

    old = tmp_path / "project1.db"
    _project1_db(old)
    monkeypatch.setattr(database, "DB_PATH", old)
    database.init_db()
    database.init_db()  # repeated startup is safe

    con = sqlite3.connect(old)
    assert con.execute("SELECT COUNT(*) FROM generated_outputs").fetchone()[0] == 3
    assert (
        con.execute("SELECT COUNT(*) FROM generated_outputs WHERE property_id IS NULL OR tone_id IS NULL").fetchone()[0]
        == 0
    )

    with TestClient(main.app) as c:
        first = register(c, email="owner@example.com")
        second = register(c, email="later@example.com")
        assert len(c.get("/api/library", headers=first).json()) == 3
        assert c.get("/api/library", headers=second).json() == []
        detail = c.get("/api/library/1", headers=first).json()
        assert detail["property"]["title"] == "Old 0" and detail["model_used"] == "template"
