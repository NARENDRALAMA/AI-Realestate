"""SQLite database setup and helpers using the standard library sqlite3."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "propcopy.db"

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS generated_outputs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    location        TEXT    NOT NULL,
    content_type    TEXT    NOT NULL,
    tone            TEXT    NOT NULL,
    generated_content TEXT  NOT NULL,
    image_path      TEXT    NOT NULL DEFAULT '',
    model_used      TEXT    NOT NULL DEFAULT 'template',
    generation_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
"""

# Migrations applied on top of _CREATE_TABLE for databases created before a
# column existed. Each is a no-op (caught below) once the column is present —
# this is how backend/propcopy.db picks up new columns without losing data.
_MIGRATIONS = [
    "ALTER TABLE generated_outputs ADD COLUMN image_path TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE generated_outputs ADD COLUMN model_used TEXT NOT NULL DEFAULT 'template'",
    "ALTER TABLE generated_outputs ADD COLUMN generation_time_ms INTEGER NOT NULL DEFAULT 0",
]


def init_db() -> None:
    with _connect() as conn:
        conn.execute(_CREATE_TABLE)
        for migration in _MIGRATIONS:
            try:
                conn.execute(migration)
            except sqlite3.OperationalError:
                pass  # Column already exists


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_output(
    title: str,
    location: str,
    content_type: str,
    tone: str,
    bundle: dict,
    image_path: str = "",
    model_used: str = "template",
    generation_time_ms: int = 0,
) -> int:
    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO generated_outputs
                (title, location, content_type, tone, generated_content, image_path, model_used, generation_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (title, location, content_type, tone, json.dumps(bundle), image_path, model_used, generation_time_ms),
        )
        return cursor.lastrowid


def list_outputs() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, location, content_type, tone, generated_content,
                   model_used, generation_time_ms, created_at
            FROM generated_outputs
            ORDER BY id DESC
            """
        ).fetchall()
    result = []
    for row in rows:
        bundle = json.loads(row["generated_content"])
        # Preview: use the primary content_type channel, fall back to listing
        ct = row["content_type"]
        preview_text = bundle.get(ct) or bundle.get("listing") or ""
        result.append(
            {
                "id": row["id"],
                "title": row["title"],
                "location": row["location"],
                "content_type": row["content_type"],
                "tone": row["tone"],
                "preview": preview_text[:100].replace("\n", " "),
                "model_used": row["model_used"],
                "generation_time_ms": row["generation_time_ms"],
                "created_at": row["created_at"],
            }
        )
    return result


def get_output(record_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, title, location, content_type, tone, generated_content,
                   model_used, generation_time_ms, created_at
            FROM generated_outputs WHERE id = ?
            """,
            (record_id,),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "content_type": row["content_type"],
        "tone": row["tone"],
        "bundle": json.loads(row["generated_content"]),
        "model_used": row["model_used"],
        "generation_time_ms": row["generation_time_ms"],
        "created_at": row["created_at"],
    }


def delete_output(record_id: int) -> bool:
    with _connect() as conn:
        cursor = conn.execute(
            "DELETE FROM generated_outputs WHERE id = ?", (record_id,)
        )
        return cursor.rowcount > 0


def get_stats() -> dict:
    with _connect() as conn:
        total: int = conn.execute(
            "SELECT COUNT(*) FROM generated_outputs"
        ).fetchone()[0]

        this_week: int = conn.execute(
            "SELECT COUNT(*) FROM generated_outputs WHERE created_at >= datetime('now', '-7 days')"
        ).fetchone()[0]

        by_type_rows = conn.execute(
            "SELECT content_type, COUNT(*) as cnt FROM generated_outputs GROUP BY content_type"
        ).fetchall()

        by_tone_rows = conn.execute(
            "SELECT tone, COUNT(*) as cnt FROM generated_outputs GROUP BY tone"
        ).fetchall()

        recent_rows = conn.execute(
            """
            SELECT title, content_type, tone, created_at
            FROM generated_outputs ORDER BY id DESC LIMIT 5
            """
        ).fetchall()

    return {
        "total": total,
        "this_week": this_week,
        "by_type": {r["content_type"]: r["cnt"] for r in by_type_rows},
        "by_tone": {r["tone"]: r["cnt"] for r in by_tone_rows},
        "recent": [
            {
                "title": r["title"],
                "content_type": r["content_type"],
                "tone": r["tone"],
                "created_at": r["created_at"],
            }
            for r in recent_rows
        ],
    }
