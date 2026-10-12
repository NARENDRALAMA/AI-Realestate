"""Make the backend's flat modules (models, orchestrator, prompts, ...) importable
from tests/ regardless of how pytest is invoked, and give every test its own
throwaway SQLite database so nothing is written to propcopy.db."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))


@pytest.fixture(autouse=True)
def temp_database(tmp_path, monkeypatch):
    import database

    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    database.init_db()
    return database.DB_PATH


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        yield c


def register(client, email="agent@example.com", name="Agent", password="correct horse"):
    res = client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture
def auth_headers(client):
    return register(client)
