"""SQLite database setup and helpers using the standard library sqlite3.

Schema (matches the Project 2 ER design):

  users             one row per account (password stored as a salted PBKDF2 hash)
  sessions          login tokens (only a SHA-256 of each token is stored)
  content_types     lookup: listing / social / email / video
  tones             lookup: formal / casual / promotional / luxury / concise / friendly
  properties        the property facts a piece of content was generated from
  generated_outputs the generated copy, linked to its user, property, content type
                    and tone, plus settings, model provenance and timing

One user has many properties; one property has many generated records; many
generated records share a content type and tone.

Databases created by Project 1 (a single generated_outputs table) are migrated in
place on startup: new tables are created, missing columns added, lookup ids and a
property row are back-filled for each old record. Records created before accounts
existed have no owner until the first account is registered, which claims them.
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# DB_PATH env var overrides the location (the Cloud Run image uses /tmp/propcopy.db,
# which is wiped whenever the container restarts).
DB_PATH = Path(os.environ.get("DB_PATH") or Path(__file__).parent / "propcopy.db")

CONTENT_TYPES = {
    "listing": "Listing description",
    "social": "Social media post",
    "email": "Email campaign",
    "video": "Video script",
}
TONES = {
    "formal": "Formal",
    "casual": "Casual",
    "promotional": "Promotional",
    "luxury": "Luxury",
    "concise": "Concise",
    "friendly": "Friendly",
}
PROPERTY_FIELDS = [
    "title", "property_type", "price", "location", "address", "bedrooms", "bathrooms",
    "parking", "land_size", "interior_size", "features", "amenities", "agent_notes", "image_path",
]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'agent',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_types (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    code  TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tones (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    code  TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    property_type TEXT NOT NULL DEFAULT '',
    price         TEXT NOT NULL DEFAULT '',
    location      TEXT NOT NULL DEFAULT '',
    address       TEXT NOT NULL DEFAULT '',
    bedrooms      TEXT NOT NULL DEFAULT '',
    bathrooms     TEXT NOT NULL DEFAULT '',
    parking       TEXT NOT NULL DEFAULT '',
    land_size     TEXT NOT NULL DEFAULT '',
    interior_size TEXT NOT NULL DEFAULT '',
    features      TEXT NOT NULL DEFAULT '',
    amenities     TEXT NOT NULL DEFAULT '',
    agent_notes   TEXT NOT NULL DEFAULT '',
    image_path    TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

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

# Columns added to generated_outputs after Project 1. Applied only when missing, so
# repeated startups are no-ops and real errors are not swallowed.
_OUTPUT_COLUMNS = [
    ("image_path", "TEXT NOT NULL DEFAULT ''"),
    ("model_used", "TEXT NOT NULL DEFAULT 'template'"),
    ("generation_time_ms", "INTEGER NOT NULL DEFAULT 0"),
    ("user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE"),
    ("property_id", "INTEGER REFERENCES properties(id)"),
    ("content_type_id", "INTEGER REFERENCES content_types(id)"),
    ("tone_id", "INTEGER REFERENCES tones(id)"),
    ("length", "TEXT NOT NULL DEFAULT 'medium'"),
    ("platform", "TEXT NOT NULL DEFAULT 'instagram'"),
    ("keywords", "TEXT NOT NULL DEFAULT ''"),
    ("channel_sources", "TEXT NOT NULL DEFAULT '{}'"),
    ("updated_at", "TEXT"),
]

_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_outputs_user ON generated_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_user ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
"""


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(_SCHEMA)
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(generated_outputs)")}
        for column, ddl in _OUTPUT_COLUMNS:
            if column not in existing:
                conn.execute(f"ALTER TABLE generated_outputs ADD COLUMN {column} {ddl}")
        conn.executescript(_INDEXES)
        for code, label in CONTENT_TYPES.items():
            conn.execute("INSERT OR IGNORE INTO content_types (code, label) VALUES (?, ?)", (code, label))
        for code, label in TONES.items():
            conn.execute("INSERT OR IGNORE INTO tones (code, label) VALUES (?, ?)", (code, label))
        _backfill(conn)


def _backfill(conn: sqlite3.Connection) -> None:
    """Link records from older schemas to the lookup tables and a property row."""
    conn.execute(
        "UPDATE generated_outputs SET content_type_id = "
        "(SELECT id FROM content_types WHERE code = generated_outputs.content_type) "
        "WHERE content_type_id IS NULL"
    )
    conn.execute(
        "UPDATE generated_outputs SET tone_id = (SELECT id FROM tones WHERE code = generated_outputs.tone) "
        "WHERE tone_id IS NULL"
    )
    orphans = conn.execute(
        "SELECT id, user_id, title, location, image_path FROM generated_outputs WHERE property_id IS NULL"
    ).fetchall()
    for row in orphans:
        cur = conn.execute(
            "INSERT INTO properties (user_id, title, location, image_path) VALUES (?, ?, ?, ?)",
            (row["user_id"], row["title"], row["location"], row["image_path"]),
        )
        conn.execute("UPDATE generated_outputs SET property_id = ? WHERE id = ?", (cur.lastrowid, row["id"]))


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─── users & sessions ─────────────────────────────────────────────────────────

def create_user(name: str, email: str, password_hash: str) -> dict:
    """Create an account. The first account ever created also claims any records
    saved before accounts existed (Project 1 / pre-auth data)."""
    with _connect() as conn:
        first = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (name, email, password_hash, "admin" if first else "agent"),
        )
        user_id = cur.lastrowid
        if first:
            conn.execute("UPDATE generated_outputs SET user_id = ? WHERE user_id IS NULL", (user_id,))
            conn.execute("UPDATE properties SET user_id = ? WHERE user_id IS NULL", (user_id,))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row)


def get_user_by_email(email: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def create_session(user_id: int, token_hash: str, expires_at: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (token_hash, user_id, expires_at),
        )


def get_session_user(token_hash: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > datetime('now')
            """,
            (token_hash,),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token_hash: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


# ─── generated content ────────────────────────────────────────────────────────

def save_output(
    *,
    user_id: int | None,
    request,
    bundle: dict,
    model_used: str = "template",
    generation_time_ms: int = 0,
    channel_sources: dict[str, str] | None = None,
) -> int:
    """Store the property facts and the generated copy. `request` is a GenerateRequest."""
    with _connect() as conn:
        facts = {f: getattr(request, f, "") or "" for f in PROPERTY_FIELDS}
        # Column names come from the PROPERTY_FIELDS constant, never from input;
        # every value is a bound "?" parameter.
        cur = conn.execute(
            f"INSERT INTO properties (user_id, {', '.join(PROPERTY_FIELDS)}) "  # nosec B608
            f"VALUES (?, {', '.join('?' for _ in PROPERTY_FIELDS)})",
            (user_id, *facts.values()),
        )
        property_id = cur.lastrowid
        cur = conn.execute(
            """
            INSERT INTO generated_outputs
                (user_id, property_id, title, location, content_type, content_type_id, tone, tone_id,
                 length, platform, keywords, generated_content, image_path, model_used,
                 generation_time_ms, channel_sources)
            VALUES (?, ?, ?, ?, ?, (SELECT id FROM content_types WHERE code = ?), ?,
                    (SELECT id FROM tones WHERE code = ?), ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, property_id, request.title, request.location,
                request.content_type, request.content_type, request.tone, request.tone,
                request.length, request.platform, request.keywords, json.dumps(bundle),
                request.image_path, model_used, generation_time_ms, json.dumps(channel_sources or {}),
            ),
        )
        return cur.lastrowid


def list_outputs(user_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, location, content_type, tone, generated_content,
                   model_used, generation_time_ms, created_at
            FROM generated_outputs
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
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


def get_output(user_id: int, record_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM generated_outputs WHERE id = ? AND user_id = ?",
            (record_id, user_id),
        ).fetchone()
        prop = None
        if row is not None and row["property_id"] is not None:
            prop = conn.execute("SELECT * FROM properties WHERE id = ?", (row["property_id"],)).fetchone()
    if row is None:
        return None
    facts = {f: (prop[f] if prop is not None else "") or "" for f in PROPERTY_FIELDS}
    facts["title"] = facts["title"] or row["title"]
    facts["location"] = facts["location"] or row["location"]
    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "content_type": row["content_type"],
        "tone": row["tone"],
        "length": row["length"],
        "platform": row["platform"],
        "keywords": row["keywords"],
        "property": facts,
        "bundle": json.loads(row["generated_content"]),
        "model_used": row["model_used"],
        "generation_time_ms": row["generation_time_ms"],
        "channel_sources": json.loads(row["channel_sources"] or "{}"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"] or "",
    }


def update_output(user_id: int, record_id: int, bundle: dict, extras: dict[str, str]) -> bool:
    """Save edited copy. Variants are kept; extras are replaced by the edited ones."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT generated_content FROM generated_outputs WHERE id = ? AND user_id = ?",
            (record_id, user_id),
        ).fetchone()
        if row is None:
            return False
        stored = json.loads(row["generated_content"])
        stored.update(bundle)
        if extras:
            stored["extras"] = {**(stored.get("extras") or {}), **extras}
        conn.execute(
            "UPDATE generated_outputs SET generated_content = ?, updated_at = datetime('now') WHERE id = ?",
            (json.dumps(stored), record_id),
        )
    return True


def delete_output(user_id: int, record_id: int) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT property_id FROM generated_outputs WHERE id = ? AND user_id = ?",
            (record_id, user_id),
        ).fetchone()
        if row is None:
            return False
        conn.execute("DELETE FROM generated_outputs WHERE id = ?", (record_id,))
        if row["property_id"] is not None:
            # Remove the property too once nothing else was generated from it.
            conn.execute(
                "DELETE FROM properties WHERE id = ? AND NOT EXISTS "
                "(SELECT 1 FROM generated_outputs WHERE property_id = ?)",
                (row["property_id"], row["property_id"]),
            )
        return True


def get_stats(user_id: int) -> dict:
    with _connect() as conn:
        total: int = conn.execute(
            "SELECT COUNT(*) FROM generated_outputs WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

        this_week: int = conn.execute(
            "SELECT COUNT(*) FROM generated_outputs WHERE user_id = ? AND created_at >= datetime('now', '-7 days')",
            (user_id,),
        ).fetchone()[0]

        by_type_rows = conn.execute(
            """
            SELECT ct.code AS code, COUNT(*) AS cnt FROM generated_outputs g
            JOIN content_types ct ON ct.id = g.content_type_id
            WHERE g.user_id = ? GROUP BY ct.code
            """,
            (user_id,),
        ).fetchall()

        by_tone_rows = conn.execute(
            """
            SELECT t.code AS code, COUNT(*) AS cnt FROM generated_outputs g
            JOIN tones t ON t.id = g.tone_id
            WHERE g.user_id = ? GROUP BY t.code
            """,
            (user_id,),
        ).fetchall()

        recent_rows = conn.execute(
            """
            SELECT title, content_type, tone, created_at
            FROM generated_outputs WHERE user_id = ? ORDER BY id DESC LIMIT 5
            """,
            (user_id,),
        ).fetchall()

    return {
        "total": total,
        "this_week": this_week,
        "by_type": {r["code"]: r["cnt"] for r in by_type_rows},
        "by_tone": {r["code"]: r["cnt"] for r in by_tone_rows},
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
