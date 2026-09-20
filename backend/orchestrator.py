"""
LLM Orchestration Module.

This is the glue between the API layer and everything else: for a given
request it always builds the template bundle first (fast, deterministic,
never fails — our safety net), and then, if USE_LLM=true, tries to replace
each of the 4 channels with real LLM output.

All 4 channels are sent to the AI backend concurrently (one thread per
channel) so the user waits roughly one timeout window, not four. Any channel
that errors out or exceeds LLM_TIMEOUT_SECONDS (default 15s) simply keeps its
template text — the bundle returned to the caller is always complete.

Env vars:
  USE_LLM               "true"/"false" (default: false)
  LLM_TIMEOUT_SECONDS   per-channel timeout in seconds (default: 15)
"""
from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from ai_service.factory import get_backend
from ai_service.interface import AIBackend, AIBackendError
from generator import generate_bundle
from models import GenerateRequest, GeneratedBundle
from prompts import build_prompt

logger = logging.getLogger("orchestrator")

CHANNELS: list[str] = ["listing", "social", "email", "video"]


def _use_llm() -> bool:
    return os.environ.get("USE_LLM", "false").lower() == "true"


def _timeout_seconds() -> float:
    return float(os.environ.get("LLM_TIMEOUT_SECONDS", "15"))


def _generate_channel(backend: AIBackend, request: GenerateRequest, channel: str) -> str:
    prompt = build_prompt(channel, request)
    return backend.generate(prompt)


def generate_with_fallback(request: GenerateRequest) -> tuple[GeneratedBundle, str, int]:
    """
    Build the marketing copy bundle for a request.

    Returns (bundle, model_used, generation_time_ms):
      - model_used == "template" when USE_LLM is off, the backend is
        unavailable, or every channel fell back.
      - model_used == "<model name>" when every channel succeeded via the LLM.
      - model_used == "<model name> (partial)" when only some channels did.
    """
    start = time.monotonic()
    bundle = generate_bundle(request)  # template safety net, always succeeds

    if not _use_llm():
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.info("path=template reason=use_llm_disabled time_ms=%d", elapsed_ms)
        return bundle, "template", elapsed_ms

    try:
        backend = get_backend()
    except Exception as exc:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.warning("path=template reason=backend_unavailable error=%s time_ms=%d", exc, elapsed_ms)
        return bundle, "template", elapsed_ms

    timeout = _timeout_seconds()
    values = bundle.model_dump()
    successes = 0

    # Not using `with ThreadPoolExecutor(...)` on purpose: its __exit__ calls
    # shutdown(wait=True), which would block on a channel that already timed
    # out until its thread actually finishes — defeating the timeout entirely.
    # shutdown(wait=False) lets us return as soon as every future is resolved
    # or timed out; any leftover thread just finishes quietly in the background
    # and its result is discarded.
    pool = ThreadPoolExecutor(max_workers=len(CHANNELS))
    try:
        futures = {
            channel: pool.submit(_generate_channel, backend, request, channel)
            for channel in CHANNELS
        }
        for channel, future in futures.items():
            try:
                values[channel] = future.result(timeout=timeout)
                successes += 1
            except FutureTimeoutError:
                logger.warning("path=template channel=%s reason=timeout timeout_s=%s", channel, timeout)
            except AIBackendError as exc:
                logger.warning("path=template channel=%s reason=backend_error error=%s", channel, exc)
            except Exception as exc:  # unexpected error in a single channel must not break the others
                logger.warning("path=template channel=%s reason=unexpected_error error=%s", channel, exc)
    finally:
        pool.shutdown(wait=False)

    elapsed_ms = int((time.monotonic() - start) * 1000)

    if successes == len(CHANNELS):
        model_used = backend.model_name
        path = "llm"
    elif successes > 0:
        model_used = f"{backend.model_name} (partial)"
        path = "llm_partial"
    else:
        model_used = "template"
        path = "template"

    logger.info(
        "path=%s model=%s successes=%d/%d time_ms=%d",
        path, model_used, successes, len(CHANNELS), elapsed_ms,
    )

    return GeneratedBundle(**values), model_used, elapsed_ms
