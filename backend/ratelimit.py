"""Small in-memory, per-client sliding-window rate limiter.

Good enough for this deployment because Cloud Run runs at most one instance
(max-instances 1); with several instances each would keep its own counts.

Limits are "<requests>/<seconds>" strings from env vars, e.g.
  RATE_LIMIT_GENERATE="10/60"   /api/generate and /api/generate/stream (shared bucket)
  RATE_LIMIT_REFINE="30/60"     /api/refine/*
  RATE_LIMIT_AUTH="10/60"       /api/auth/login and /api/auth/register
  RATE_LIMIT_ENABLED="false"    turns every limit off

Clients are identified by IP. Behind Cloud Run's front end the real client IP
is the last entry of X-Forwarded-For (anything before it is client-supplied and
can be forged), so set TRUSTED_PROXY_HOPS=1 there; locally it defaults to 0 and
the socket address is used.
"""
from __future__ import annotations

import math
import os
import threading
import time
from collections import deque

from fastapi import HTTPException, Request

_DEFAULTS = {"generate": "10/60", "refine": "30/60", "auth": "10/60"}
_MAX_KEYS = 10_000

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}


def reset() -> None:
    with _lock:
        _hits.clear()


def _limit(bucket: str) -> tuple[int, float]:
    raw = os.environ.get(f"RATE_LIMIT_{bucket.upper()}", _DEFAULTS[bucket])
    count, _, seconds = raw.partition("/")
    return int(count), float(seconds or 60)


def client_ip(request: Request) -> str:
    hops = int(os.environ.get("TRUSTED_PROXY_HOPS", "0"))
    if hops > 0:
        forwarded = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(forwarded) >= hops:
            return forwarded[-hops]
    return request.client.host if request.client else "unknown"


def check(bucket: str, key: str) -> None:
    """Record one hit for (bucket, key); raise 429 if over the limit."""
    if os.environ.get("RATE_LIMIT_ENABLED", "true").lower() != "true":
        return
    limit, window = _limit(bucket)
    now = time.monotonic()
    full_key = f"{bucket}:{key}"
    with _lock:
        if len(_hits) > _MAX_KEYS:  # drop idle keys so memory stays bounded
            for k in [k for k, q in _hits.items() if not q or now - q[-1] > window]:
                del _hits[k]
        hits = _hits.setdefault(full_key, deque())
        while hits and now - hits[0] >= window:
            hits.popleft()
        if len(hits) >= limit:
            retry = max(1, math.ceil(window - (now - hits[0])))
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)


def limiter(bucket: str):
    """FastAPI dependency that rate-limits a route by client IP."""

    def dependency(request: Request) -> None:
        check(bucket, client_ip(request))

    return dependency
