"""
Live (streaming) generation for POST /api/generate/stream.

Emits newline-delimited JSON events so the UI can show copy appearing as the model
writes it:

  {"type": "start",   "engine": "ai"|"template", "model": str|None, "jobs": [...]}
  {"type": "delta",   "job": "listing:0", "text": "next chunk"}
  {"type": "job_done","job": "listing:0", "source": "ai"|"template", "text": "full text"}
  {"type": "done",    "id": int, "model_used": str, "generation_time_ms": int,
                      "bundle": {...}, "variants": {...}, "extras": {...}}
  {"type": "error",   "message": str}

Jobs are the four core channels (× `variations`) plus any requested extra formats,
e.g. "listing:0", "listing:1", "extra:sms". Every job has a template result computed
up front; a job keeps its AI text only if the model finishes it without error before
the stream deadline, otherwise it falls back to the template — so the final result is
always complete. Backends with `generate_stream()` (Ollama) stream token by token;
others send each job's text in one chunk when it's done.

Env vars (in addition to orchestrator.py's USE_LLM):
  LLM_STREAM_TIMEOUT_SECONDS   overall deadline for a streaming run (default 300)
  LLM_STREAM_CONCURRENCY       jobs sent to the model at once (default 4; 1 for Ollama,
                               which serves one request at a time unless started with
                               OLLAMA_NUM_PARALLEL=4 — then set this to 4 too: a 4-channel
                               run drops from ~45 s to ~20 s on an Apple M5)
"""
from __future__ import annotations

import json
import logging
import os
import queue
import threading
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor

import database
from ai_service.factory import get_backend
from ai_service.interface import AIBackend, AIBackendError
from extras import build_extra_prompt, max_tokens_for, max_tokens_for_extra, template_extra
from generator import generate_bundle
from models import GenerateRequest
from orchestrator import CHANNELS, _use_llm
from postprocess import clean_channel, guard_output, remove_placeholders
from prompts import build_prompt

logger = logging.getLogger("streaming")


def _deadline_seconds() -> float:
    return float(os.environ.get("LLM_STREAM_TIMEOUT_SECONDS", "300"))


def _concurrency(backend: AIBackend) -> int:
    configured = os.environ.get("LLM_STREAM_CONCURRENCY")
    if configured:
        return max(1, int(configured))
    return 1 if type(backend).__name__ == "OllamaBackend" else 4


def _line(event: dict) -> str:
    return json.dumps(event, ensure_ascii=False) + "\n"


def _plan_jobs(request: GenerateRequest) -> list[tuple[str, str, int]]:
    """(job id, prompt kind, token budget) for every piece of content in this run."""
    jobs: list[tuple[str, str, int]] = []
    # The user's main-focus channel first, so it's written (and shown) first.
    ordered = [request.content_type] + [c for c in CHANNELS if c != request.content_type]
    for channel in ordered:
        for v in range(request.variations):
            jobs.append((f"{channel}:{v}", channel, max_tokens_for(request.length)))
    for fmt in request.extra_formats:
        jobs.append((f"extra:{fmt}", fmt, max_tokens_for_extra(fmt)))
    return jobs


def _template_results(request: GenerateRequest) -> dict[str, str]:
    """Template text for every job. Variations re-run the template engine, whose
    phrase choices are randomised, so each variation reads slightly differently."""
    results: dict[str, str] = {}
    for v in range(request.variations):
        bundle = generate_bundle(request).model_dump()
        for channel in CHANNELS:
            results[f"{channel}:{v}"] = bundle[channel]
    for fmt in request.extra_formats:
        results[f"extra:{fmt}"] = template_extra(fmt, request)
    return results


def _prompt_for(job: str, kind: str, request: GenerateRequest) -> str:
    return build_extra_prompt(kind, request) if job.startswith("extra:") else build_prompt(kind, request)


def _run_job(
    backend: AIBackend,
    job: str,
    prompt: str,
    budget: int,
    events: "queue.Queue[tuple]",
    cancel: threading.Event,
) -> None:
    """Runs in a worker thread: pushes ("delta", job, chunk) then ("ok"|"fail", job, payload)."""
    if cancel.is_set():
        return
    try:
        parts: list[str] = []
        stream = getattr(backend, "generate_stream", None)
        if callable(stream):
            for chunk in stream(prompt, budget):
                if cancel.is_set():
                    return
                parts.append(chunk)
                events.put(("delta", job, chunk))
            text = "".join(parts).strip()
        else:
            text = backend.generate(prompt, budget).strip()
            if text:
                events.put(("delta", job, text))
        if not text:
            raise AIBackendError("empty response")
        events.put(("ok", job, text))
    except Exception as exc:  # any failure means this job falls back to its template
        events.put(("fail", job, str(exc)))


def _clean(job: str, text: str, request: GenerateRequest) -> str:
    kind = job.split(":")[0]
    if kind == "extra":
        return remove_placeholders(guard_output(text, request))
    return clean_channel(kind, text, request)


def stream_generation(request: GenerateRequest, user_id: int | None = None) -> Iterator[str]:
    start = time.monotonic()
    jobs = _plan_jobs(request)
    job_ids = [j for j, _, _ in jobs]
    templates = _template_results(request)
    final: dict[str, str] = {}
    sources: dict[str, str] = {}

    backend: AIBackend | None = None
    if _use_llm():
        try:
            backend = get_backend()
        except Exception as exc:
            logger.warning("stream path=template reason=backend_unavailable error=%s", exc)

    yield _line({
        "type": "start",
        "engine": "ai" if backend else "template",
        "model": backend.model_name if backend else None,
        "jobs": job_ids,
    })

    if backend is None:
        for job in job_ids:
            final[job], sources[job] = templates[job], "template"
            yield _line({"type": "job_done", "job": job, "source": "template", "text": templates[job]})
    else:
        events: queue.Queue[tuple] = queue.Queue()
        cancel = threading.Event()
        pool = ThreadPoolExecutor(max_workers=_concurrency(backend))
        try:
            for job, kind, budget in jobs:
                pool.submit(_run_job, backend, job, _prompt_for(job, kind, request), budget, events, cancel)

            deadline = start + _deadline_seconds()
            pending = set(job_ids)
            while pending:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    for job in sorted(pending):
                        logger.warning("stream path=template job=%s reason=deadline", job)
                        final[job], sources[job] = templates[job], "template"
                        yield _line({"type": "job_done", "job": job, "source": "template", "text": templates[job]})
                    pending.clear()
                    break
                try:
                    kind, job, payload = events.get(timeout=min(remaining, 1.0))
                except queue.Empty:
                    continue
                if job not in pending:
                    continue  # late output from a job that already fell back
                if kind == "delta":
                    yield _line({"type": "delta", "job": job, "text": payload})
                elif kind == "ok":
                    pending.discard(job)
                    try:
                        text = _clean(job, payload, request)
                    except AIBackendError as exc:  # output guard rejected the copy
                        logger.warning("stream path=template job=%s reason=output_guard error=%s", job, exc)
                        final[job], sources[job] = templates[job], "template"
                        yield _line({"type": "job_done", "job": job, "source": "template", "text": templates[job]})
                        continue
                    final[job], sources[job] = text, "ai"
                    yield _line({"type": "job_done", "job": job, "source": "ai", "text": text})
                else:
                    pending.discard(job)
                    logger.warning("stream path=template job=%s reason=backend_error error=%s", job, payload)
                    final[job], sources[job] = templates[job], "template"
                    yield _line({"type": "job_done", "job": job, "source": "template", "text": templates[job]})
        finally:
            # Also runs if the client disconnects mid-stream (the generator is closed):
            # stop streaming workers and don't wait for queued ones.
            cancel.set()
            pool.shutdown(wait=False, cancel_futures=True)

    ai_count = sum(1 for s in sources.values() if s == "ai")
    if backend is not None and ai_count == len(job_ids):
        model_used = backend.model_name
    elif backend is not None and ai_count > 0:
        model_used = f"{backend.model_name} (partial)"
    else:
        model_used = "template"

    bundle = {channel: final[f"{channel}:0"] for channel in CHANNELS}
    variants = {
        channel: [final[f"{channel}:{v}"] for v in range(1, request.variations)]
        for channel in CHANNELS
        if request.variations > 1
    }
    extras = {fmt: final[f"extra:{fmt}"] for fmt in request.extra_formats}
    channel_sources = {channel: sources[f"{channel}:0"] for channel in CHANNELS}
    elapsed_ms = int((time.monotonic() - start) * 1000)

    try:
        record_id = database.save_output(
            user_id=user_id,
            request=request,
            bundle={**bundle, "extras": extras, "variants": variants},
            model_used=model_used,
            generation_time_ms=elapsed_ms,
            channel_sources=channel_sources,
        )
    except Exception as exc:
        logger.exception("stream save failed")
        yield _line({"type": "error", "message": f"Generated, but saving to the library failed: {exc}"})
        return

    logger.info("stream model=%s ai=%d/%d time_ms=%d", model_used, ai_count, len(job_ids), elapsed_ms)
    yield _line({
        "type": "done",
        "id": record_id,
        "model_used": model_used,
        "generation_time_ms": elapsed_ms,
        "channel_sources": channel_sources,
        "bundle": bundle,
        "variants": variants,
        "extras": extras,
    })
