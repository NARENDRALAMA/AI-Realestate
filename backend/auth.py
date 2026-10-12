"""Accounts and login sessions.

Passwords are hashed with PBKDF2-HMAC-SHA256 (600,000 iterations, Python standard
library) and a random per-user salt. Logging in issues a random bearer token; only its SHA-256 is stored, so a
leaked database doesn't expose usable tokens. Tokens expire after
SESSION_DAYS (default 7).

Every /api route except /api/auth/register, /api/auth/login and /api/health
depends on `current_user`, which rejects missing, unknown or expired tokens with 401.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import database

_ITERATIONS = 600_000
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(iterations))
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    days = float(os.environ.get("SESSION_DAYS", "7"))
    expires = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    database.create_session(user_id, _token_hash(token), expires)
    return token


def end_session(token: str) -> None:
    database.delete_session(_token_hash(token))


def public_user(user: dict) -> dict:
    return {k: user[k] for k in ("id", "name", "email", "role", "created_at")}


def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = database.get_session_user(_token_hash(credentials.credentials))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user["token"] = credentials.credentials
    return user
