# REM Content Studio

AI-powered real estate marketing content generator. Enter structured property data and produce listing copy, social posts, email newsletters, and video walk-through scripts across six tones and three length settings.

---

## Quick start

### Option 1 — Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- The SQLite database (`backend/propcopy.db`) is mounted as a volume and persists between restarts.

### Option 2 — Manual (two terminals)

**Terminal 1 — backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
npm install
npm run dev
```

Frontend runs at http://localhost:5173. Vite proxies `/api` requests to `http://localhost:8000` automatically.

---

## Workflow

| Step | Page | Description |
|------|------|-------------|
| 1 | `/property` | Enter structured property data |
| 2 | `/settings` | Choose content type, tone, length, and keywords |
| 3 | `/generated` | Review all four generated channels |
| 4 | `/edit` | Refine copy with tone/persuasion/length controls |
| 5 | `/export` | Copy, download (TXT/PDF/DOCX), or save to library |
| — | `/library` | Browse and view all previously saved outputs |

---

## API reference

Base URL: `http://localhost:8000`

### `POST /api/generate`

Generate content for all four channels and save to the library.

**Request body**

```json
{
  "title": "Sunlit 3-Bed Terrace with City Views",
  "price": "$1,250,000",
  "location": "Richmond, VIC",
  "address": "42 Hawthorn Grove, Richmond VIC 3121",
  "bedrooms": "3",
  "bathrooms": "2",
  "parking": "2",
  "land_size": "320 m²",
  "interior_size": "142 m²",
  "features": "North-facing living, engineered oak floors, SMEG kitchen",
  "amenities": "Split AC, NBN, security intercom",
  "agent_notes": "Vendor motivated; flexible settlement.",
  "content_type": "listing",
  "tone": "formal",
  "length": "medium",
  "keywords": "north-facing, walk to schools"
}
```

**Tone options:** `formal` | `casual` | `promotional` | `luxury` | `concise` | `friendly`

**Length options:** `short` | `medium` | `long`

**Response**

```json
{
  "id": 1,
  "bundle": {
    "listing": "We are pleased to present…",
    "social": "Now available: …",
    "email": "Subject: Property Opportunity: …\n\nDear Client,\n…",
    "video": "[Scene 1 — Introduction]\n…"
  },
  "model_used": "template",
  "generation_time_ms": 2
}
```

`model_used` is `"template"` when `USE_LLM=false` or every channel fell back,
the model name (e.g. `"mistralai/Mistral-7B-Instruct-v0.2"`) when every
channel used the LLM successfully, or `"<model name> (partial)"` when only
some channels did. See "AI content generation" below.

---

### `GET /api/library`

Return all saved outputs, newest first.

**Response** — array of:

```json
{
  "id": 1,
  "title": "Sunlit 3-Bed Terrace with City Views",
  "location": "Richmond, VIC",
  "content_type": "listing",
  "tone": "formal",
  "preview": "We are pleased to present Sunlit 3-Bed…",
  "model_used": "template",
  "generation_time_ms": 2,
  "created_at": "2024-01-15 10:32:11"
}
```

---

### `GET /api/library/{id}`

Return the full content bundle for one saved record.

**Response**

```json
{
  "id": 1,
  "title": "Sunlit 3-Bed Terrace with City Views",
  "location": "Richmond, VIC",
  "content_type": "listing",
  "tone": "formal",
  "bundle": { "listing": "…", "social": "…", "email": "…", "video": "…" },
  "model_used": "template",
  "generation_time_ms": 2,
  "created_at": "2024-01-15 10:32:11"
}
```

---

### `DELETE /api/library/{id}`

Delete a saved record. Returns `204 No Content`.

---

### `POST /api/export`

Generate a downloadable file. Returns a binary file with `Content-Disposition: attachment`.

**Request body**

```json
{
  "bundle": {
    "listing": "…",
    "social": "…",
    "email": "…",
    "video": "…"
  },
  "format": "pdf",
  "title": "Sunlit 3-Bed Terrace",
  "tone": "formal"
}
```

**Format options:** `txt` | `pdf` | `docx`

---

## Project structure

```
.
├── backend/
│   ├── main.py             # FastAPI app and routes
│   ├── generator.py        # Template-based content generation engine (Project 1, unchanged)
│   ├── orchestrator.py     # LLM Orchestration Module — tries the AI backend, falls back to templates
│   ├── prompts.py          # Prompt Engineering Module — LangChain PromptTemplates per content type
│   ├── ai_service/         # AI service abstraction (local Transformers / remote HTTP backends)
│   │   ├── interface.py
│   │   ├── local_transformers_backend.py
│   │   ├── remote_http_backend.py
│   │   ├── factory.py
│   │   ├── service_app.py       # Standalone FastAPI inference service (POST /generate)
│   │   └── colab_notebook.ipynb # Runs service_app.py on a Colab GPU
│   ├── evaluate.py         # Template vs LLM evaluation script -> evaluate_results.csv
│   ├── tests/               # pytest suite (prompts, orchestrator fallback, evaluation checks)
│   ├── models.py           # Pydantic request/response models
│   ├── database.py         # SQLite helpers (propcopy.db)
│   ├── export_utils.py     # TXT / PDF / DOCX file builders
│   ├── requirements.txt
│   ├── requirements-llm.txt # torch/transformers/accelerate/bitsandbytes — only for local_transformers
│   └── Dockerfile
├── src/
│   ├── context/            # React context + AppProvider (calls real API)
│   ├── lib/
│   │   ├── api.ts          # Typed fetch wrappers for all endpoints
│   │   └── mockGenerator.ts  # Local edit refinements (improve/shorten)
│   ├── pages/
│   │   ├── Library.tsx     # Output library browser
│   │   └── …               # Other workflow pages
│   └── types/index.ts      # Shared TypeScript types
├── docker-compose.yml
└── vite.config.ts          # Proxy: /api → backend
```

---

## AI content generation (Project 2)

Project 1's template engine (`generator.py`) still runs on every request and is
the **safety net**: it always builds a complete 4-channel bundle first. On top
of that, when `USE_LLM=true`, `orchestrator.py` sends each of the 4 channels to
a real open-source LLM concurrently and replaces the template text with the
LLM's output wherever it succeeds within the timeout. If the LLM is disabled,
unavailable, errors, or times out — per channel — that channel simply keeps
its template text. Nothing about Project 1's behaviour changes when
`USE_LLM=false` (the default).

### How it fits together

```
GenerateRequest
      │
      ▼
generator.generate_bundle()   ──────────────► template bundle (always succeeds)
      │
      ▼ (only if USE_LLM=true)
prompts.build_prompt(channel) ──► one grounded prompt per content type
      │
      ▼
ai_service.factory.get_backend() ──► LocalTransformersBackend  or  RemoteHTTPBackend
      │                                   (runs a model here)        (calls another
      │                                                                machine's /generate)
      ▼
orchestrator runs all 4 channels concurrently, each with its own
LLM_TIMEOUT_SECONDS budget; a channel that errors/times out keeps its
template text. Returns (bundle, model_used, generation_time_ms).
```

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `USE_LLM` | `false` | Feature flag — `true` to attempt real LLM generation, `false` to always use templates. |
| `LLM_BACKEND` | `remote_http` | `local_transformers` (load the model in this process) or `remote_http` (call another machine's inference service). |
| `LLM_MODEL_NAME` | `mistralai/Mistral-7B-Instruct-v0.2` | Hugging Face model id. For CPU-only laptop development, use a small model instead, e.g. `Qwen/Qwen2.5-0.5B-Instruct`. |
| `LLM_LOAD_IN_4BIT` | `false` | `local_transformers` only — 4-bit quantisation via bitsandbytes, to fit a 7B/8B model on a smaller GPU. |
| `LLM_SERVICE_URL` | _(empty)_ | `remote_http` only — base URL of a running `ai_service/service_app.py` (e.g. a Colab ngrok URL). Required when `LLM_BACKEND=remote_http`. |
| `LLM_TIMEOUT_SECONDS` | `15` | Per-channel timeout before falling back to the template for that channel. |

### Running the AI inference service

**Locally (small model, CPU is fine for testing the wiring):**

```bash
cd backend
pip install -r requirements.txt -r requirements-llm.txt
LLM_MODEL_NAME=Qwen/Qwen2.5-0.5B-Instruct \
    uvicorn ai_service.service_app:app --host 0.0.0.0 --port 9000
```

Then point the main backend at it:

```bash
USE_LLM=true LLM_BACKEND=remote_http LLM_SERVICE_URL=http://localhost:9000 \
    uvicorn main:app --reload --port 8000
```

**On Google Colab (real GPU, Mistral-7B-Instruct or Llama-3-8B-Instruct):**

1. Open `backend/ai_service/colab_notebook.ipynb` in Colab.
2. Runtime → Change runtime type → GPU.
3. Run the cells in order: clone the repo, install `requirements.txt` +
   `requirements-llm.txt` + `pyngrok`, set `LLM_MODEL_NAME` /
   `LLM_LOAD_IN_4BIT`, start `ai_service.service_app` in the background, wait
   for `/health` to report `"ok"`, then open an ngrok tunnel (needs a free
   ngrok auth token — https://dashboard.ngrok.com/get-started/your-authtoken).
4. Copy the printed URL and set it on whichever machine runs the main
   backend: `LLM_BACKEND=remote_http`, `LLM_SERVICE_URL=<that URL>`, `USE_LLM=true`.
5. Llama-3 models are gated on Hugging Face — log in with
   `huggingface_hub.login("hf_...")` in the notebook first.

### Running the tests

```bash
cd backend
pip install -r requirements.txt   # includes pytest, langchain-core, httpx
pytest tests/ -v
```

All 21 tests use a stub `AIBackend` — none of them download a model or need a
GPU, so they run the same everywhere.

### Running the evaluation

```bash
cd backend
python evaluate.py                        # template path only (works anywhere)
USE_LLM=true LLM_BACKEND=remote_http LLM_SERVICE_URL=<url> python evaluate.py  # + real LLM path
```

Runs 10 sample properties × 4 content types through `generate_with_fallback()`,
checks factual accuracy (supplied price/location/bedrooms/bathrooms present,
no invented bed/bath counts), word-count bounds per content type, and a
Flesch reading-ease score. Writes `backend/evaluate_results.csv` and prints a
pass-rate summary split by `model_used` (`template` vs the real model name).

### Known limitations / not implemented

- **No real LLM inference has been run in the development environment used to
  build this feature** — it has no GPU and no verified way to download
  multi-GB model weights. The AI service, prompts, and orchestration/fallback
  logic are implemented and tested against a stub backend; running an actual
  7B/8B model requires Colab (see above) or a machine with a GPU.
- Login/authentication — not implemented.
- User / ContentType / Tone lookup tables — content types and tones stay as
  fixed enums (`models.py`), not database-backed lookup tables.
- AWS S3 — uploaded images are stored on local disk (`backend/uploads/`), unchanged from Project 1.
- Live dashboard data — the Library page's stats are the same simple SQL aggregates as Project 1; no real-time/streaming dashboard.
- Image analysis — uploaded property images are stored but never inspected by the AI backend; prompts do not reference image content.
- The evaluation script's factual-accuracy check is a simple substring/regex heuristic, not a full NLP fact-checker — it catches obvious hallucinated bedroom/bathroom counts and missing required facts, not every possible inaccuracy.
- The template engine's `listing` content type does not print the `price` field at all (a pre-existing Project 1 behaviour, surfaced by `evaluate.py`'s factual-accuracy check — see `PROGRESS_LOG.md`). Not changed here to avoid touching tested Project 1 code outside this feature's scope.

---

## Notes

- Project 1's deterministic template engine (`generator.py`) is unchanged and remains the fallback for every request; see "AI content generation" above for how the LLM path layers on top of it.
- The frontend `mockGenerator.ts` is still used for the **Edit & Review** in-session refinements (improve tone / make persuasive / shorten). These run locally with no network call.
- The SQLite file lives at `backend/propcopy.db` and is auto-created on first run.
