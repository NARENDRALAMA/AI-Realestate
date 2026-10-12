# Progress Log — Project 2 (ITSU3009): AI-Powered Real Estate Marketing Content Generation

This log records what was built on top of the Project 1 codebase, how each
piece was tested, problems that came up and how they were fixed, and what is
explicitly not done. Written for the team report.

## Summary

Project 1's template-based content generator (`backend/generator.py`) is
unchanged and still runs on every request as an automatic, always-on safety
net. On top of it, we added a real open-source LLM integration path that can
be switched on with `USE_LLM=true` and falls back to the template engine
per-channel whenever the LLM is disabled, unavailable, errors, or times out.

Six pieces were built, in priority order, each committed separately:

1. **AI service + backend abstraction** (`backend/ai_service/`)
2. **Prompt engineering module** (`backend/prompts.py`)
3. **LLM orchestration module** (`backend/orchestrator.py`)
4. **Minimal DB + UI changes** (`model_used`/`generation_time_ms` columns and badges)
5. **Evaluation script** (`backend/evaluate.py`)
6. **Tests and docs** (`backend/tests/`, README)

## What was done and how it was tested

### 1. AI service + backend abstraction

- `AIBackend` interface with two implementations: `LocalTransformersBackend`
  (loads a Hugging Face model with `transformers`+`torch` in-process) and
  `RemoteHTTPBackend` (calls another machine's `/generate` endpoint over
  HTTP). A `factory.get_backend()` picks one from `LLM_BACKEND`/
  `LLM_MODEL_NAME`/`LLM_LOAD_IN_4BIT` env vars.
- `ai_service/service_app.py` — a small standalone FastAPI app exposing
  `POST /generate`, meant to run wherever the model actually lives (a Colab
  GPU, a lab machine). `ai_service/colab_notebook.ipynb` runs this on a Colab
  GPU runtime and exposes it via an ngrok tunnel.
- **Tested**: confirmed `backend/main.py` still imports and runs with none of
  the heavy `torch`/`transformers` packages installed (they're isolated in
  `requirements-llm.txt` and only imported inside `LocalTransformersBackend.__init__`
  and `RemoteHTTPBackend`'s httpx usage), so the default install stays exactly
  as light as Project 1's. Validated the notebook file is well-formed JSON.
- **Manual verification**: `cd backend && python3 -c "import main"` imports
  cleanly.

### 2. Prompt engineering module

- One LangChain `PromptTemplate` per content type (listing/social/email/video),
  built from the validated `GenerateRequest` fields. Every prompt states a
  grounding rule up front: use only the supplied facts, never invent bedrooms,
  bathrooms, price, features, or location, and stay within a target word count
  for the requested length.
- **Tested**: manually built prompts for a sample property and inspected the
  output; later covered by `tests/test_prompts.py` (6 tests) checking that
  every content type produces a distinct instruction, supplied facts appear
  verbatim, and omitted facts don't appear at all.

### 3. LLM orchestration module

- `generate_with_fallback()` always builds the full template bundle first
  (fast, deterministic, cannot fail), then — only if `USE_LLM=true` — tries
  all 4 channels against the configured AI backend **concurrently** (one
  thread per channel) so total wait time stays close to one
  `LLM_TIMEOUT_SECONDS` window (default 15s) instead of four. Any channel
  that errors or times out keeps its template text. Logs the path taken,
  the model, and generation time in ms.
- **Problem hit and fixed**: the first implementation called
  `future.result(timeout=LLM_TIMEOUT_SECONDS)` inside a `for` loop over the
  4 channel futures. `future.result(timeout=...)` starts its own fresh clock
  on *each call* — it does not share a deadline across the loop. With one
  slow channel this happened to look fine in manual testing (the other 3
  channels resolved almost instantly, so only the loop iteration for the
  slow one actually waited). But writing
  `tests/test_orchestrator.py::test_timeout_falls_back_and_stays_within_the_timeout_window`
  with **all 4** channels slow caught it immediately: 4 channels × a 1s
  timeout took ~4 seconds instead of ~1. Fixed by switching to
  `concurrent.futures.wait(futures.values(), timeout=timeout)`, which applies
  one shared deadline across every channel at once. Re-verified the fix
  with the same test (now passes, wall-clock stays under 3s for a 1s
  timeout with a 5s-slow stub) and re-ran `evaluate.py` and the FastAPI app
  to confirm nothing else regressed.
- Also fixed a related pitfall: the executor was originally used as
  `with ThreadPoolExecutor(...) as pool:`, whose `__exit__` blocks
  (`shutdown(wait=True)`) until every submitted thread finishes — including
  ones we'd already given up on as timed out. Switched to an explicit
  `pool.shutdown(wait=False)` so a stuck/slow backend call can't hold up the
  whole request; the abandoned thread just finishes quietly in the
  background and its result is discarded.
- **Tested**: `tests/test_orchestrator.py` (6 tests, all using a stub
  `AIBackend`, no real model needed): `USE_LLM=false` returns the template
  bundle; a fully-working stub backend is used for all 4 channels; a backend
  that always raises falls back to the template for every channel; a slow
  backend times out and the request still returns within the timeout window
  (not 4x it); a backend that fails to construct at all (e.g.
  `LLM_SERVICE_URL` not set) falls back cleanly; a backend that succeeds on
  some channels and fails on others is reported as `"<model> (partial)"`.

### 4. Minimal DB + UI changes

- `database.py`: added `model_used TEXT DEFAULT 'template'` and
  `generation_time_ms INTEGER DEFAULT 0` columns, using the same
  `ALTER TABLE` migration pattern the codebase already used for
  `image_path`. `models.py`, `main.py` updated to read/write the new fields.
- Frontend: `api.ts`, `app-state.ts`, `AppProvider.tsx` thread the new fields
  through; `GeneratedContent.tsx` shows an "AI: `<model>`" / "Template
  fallback" badge and the generation time next to the existing Regenerate
  button (no new button was needed — Project 1 already had one); `Library.tsx`
  shows the same badge/time in the list and the detail drawer.
- **Problem hit and fixed**: none for this step, but it was deliberately
  tested against both a synthetic pre-existing "old schema" database (with
  only the original columns) and the real, already-populated
  `backend/propcopy.db` shipped in this repo, to make sure the migration
  doesn't lose data. Both preserved every existing row and defaulted the two
  new columns to `'template'` / `0` correctly.
- **Tested**: a full `generate → library list → library detail` round trip
  through FastAPI's `TestClient` against a scratch database; `npm run build`
  (`tsc -b && vite build`) passes with zero type errors.
- **Manual verification**: `cd backend && uvicorn main:app --reload --port 8000`
  and `npm run dev`, then Property → Settings → Generate. The Generated
  Content page shows a "Template fallback" badge and a millisecond count
  next to Regenerate; the same appears on each Library entry.

### 5. Evaluation script

- `evaluate.py` runs 10 synthetic sample properties × 4 content types through
  `generate_with_fallback()`, checking: factual accuracy (supplied
  price/location/bedrooms/bathrooms are present in the output text, and no
  bedroom/bathroom count appears that contradicts what was supplied), a
  word-count range calibrated per content type (not per length setting — a
  "medium" social post is naturally much shorter than a "medium" listing),
  and a hand-rolled Flesch Reading Ease score (vowel-group syllable
  counting, no extra dependency). Writes `evaluate_results.csv` and prints a
  pass-rate summary split by `model_used`.
- **Real finding, not a bug**: running it against the actual template engine
  (`USE_LLM=false`, the only path runnable without a GPU/model download in
  this environment) gave **100% length-ok, 80% facts-ok** across 40
  generations. Investigating the 20% miss: the `listing` content type's
  template, at medium length, never prints the property's `price` at all
  (see `generator.py::_generate_listing` — no length branch references
  `p.price`), so `price_present` fails for every sample property that
  supplied a price. This is a genuine, pre-existing characteristic of the
  Project 1 template engine that the evaluation surfaced — it was **not**
  changed, to avoid touching tested Project 1 behaviour outside this
  feature's scope. Recorded under "Known limitations" in the README and here
  for the report.
- **Tested**: `tests/test_evaluate.py` (8 tests) covers the scoring
  functions directly — word count, Flesch score on easy vs. empty text,
  fact-presence detection, invented-bedroom-count detection (including that
  it does *not* false-positive when the correct count is just mentioned
  twice), and length-range flagging.
- **Manual verification**: `cd backend && python3 evaluate.py` — prints
  `template 40 80.0% 100.0% ...` and writes `evaluate_results.csv` (committed
  to the repo as the reference run). Also exercised the LLM-path branch of
  the script with a stub backend (not committed, since no real model ran
  here) to confirm it correctly scores fabricated/ungrounded text as
  `facts_ok=False` — i.e. the check actually catches hallucination when it's
  present, not just when it's absent.

### 6. Tests and docs

- 21 pytest tests total across `test_prompts.py`, `test_orchestrator.py`,
  `test_evaluate.py`, all passing, none requiring a GPU or a model download
  (a `conftest.py` makes the backend's flat modules importable from `tests/`).
- README: new "AI content generation" section (architecture diagram in
  prose, every env var, how to run the inference service locally and on
  Colab, how to run tests and the evaluation script), updated API reference
  examples and project structure diagram, and a "Known limitations / not
  implemented" list.

## Problems hit and how they were fixed

1. **Timeout compounding across concurrent channels** (see section 3 above)
   — the most significant bug found. Caught by writing a test with *all*
   channels slow, not just one. Fixed with `concurrent.futures.wait()` and a
   shared deadline; re-verified with tests, `evaluate.py`, and the app.
2. **`ThreadPoolExecutor` context manager blocking on shutdown** (see section
   3) — fixed with explicit `shutdown(wait=False)`.
3. **`package-lock.json` churn from `npm install`** in this sandboxed dev
   environment (unrelated optional-platform-dependency resolution, not a
   real dependency change) — reverted before committing so it doesn't show
   up as noise in the PR.
4. **Evaluation length thresholds initially miscalibrated** — the first pass
   used one word-count range per *length setting*, which unfairly failed
   every `social` post (deliberately short regardless of length) against a
   range sized for `listing`/`email`/`video`. Recalibrated to per-content-type
   ranges measured from the template engine's actual output, with margin.

## What is not done (explicitly out of scope per the brief)

- Login/authentication.
- User / ContentType / Tone lookup tables (content types and tones remain
  fixed enums, as in Project 1).
- AWS S3 (uploaded images stay on local disk, unchanged from Project 1).
- Live dashboard data (Library page stats are the same simple SQL aggregates
  as Project 1).
- Image analysis (uploaded images are stored but never inspected by the AI
  backend or referenced in prompts).

## What is built but not run against a real model

**No real LLM inference was executed in the environment used to build this
feature** — it has no GPU and no verified way to download multi-GB model
weights (Mistral-7B-Instruct, Llama-3-8B-Instruct). Everything downstream of
"a backend returns text" (prompts, grounding, orchestration, fallback,
concurrency/timeout handling, the DB columns, the UI badges, the evaluation
scoring logic) was built and verified against a stub `AIBackend` that returns
controlled text instantly, which is sufficient to prove the *logic* is
correct but is **not** the same as having actually run Mistral-7B or
Llama-3-8B and read its output. To get a real template-vs-LLM comparison for
the report:

1. Follow the Colab steps in `README.md` → "Running the AI inference service"
   to get `ai_service/service_app.py` running on a GPU with a real model,
   exposed via ngrok.
2. Run `USE_LLM=true LLM_BACKEND=remote_http LLM_SERVICE_URL=<ngrok URL> python evaluate.py`
   from `backend/` to get real `evaluate_results.csv` rows with
   `model_used` set to the actual model name instead of `"template"`.
3. Compare that CSV against the committed `backend/evaluate_results.csv`
   (the template-only baseline) for the report.
