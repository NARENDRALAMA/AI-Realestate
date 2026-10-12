# REM Content Studio

AI-powered real estate marketing content generator (ITSU3009 Project 2, Tech Adaptive).
Agents sign in, enter structured property details, and an open-weight LLM (Mistral 7B
Instruct via Ollama) writes a listing description, a social post for Instagram, Facebook
or LinkedIn, an email newsletter and a video walkthrough script in one of six tones and
four lengths. Copy can be edited, refined, saved to a private library and exported as
TXT, PDF or DOCX.

---

## Quick start (local, Apple Silicon or any machine with Ollama)

Prerequisites: Python 3.9+, Node 20+, [Ollama](https://ollama.com).

```bash
# once
ollama pull mistral                      # ~4.4 GB, Mistral 7B Instruct Q4_K_M
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && cd ..
npm install

# every time
scripts/run-local.sh                     # starts Ollama (4 parallel), the API and the web app
```

Open **http://localhost:5173**, choose **Create an account**, and start with
**Create content**. The first account created also takes ownership of any records
saved before accounts existed.

Manual alternative (three terminals):

```bash
OLLAMA_NUM_PARALLEL=4 ollama serve
cd backend && LLM_STREAM_CONCURRENCY=4 .venv/bin/uvicorn main:app --port 8000
npm run dev
```

### Docker

```bash
OLLAMA_NUM_PARALLEL=4 ollama serve        # on the host; the container calls it
docker compose up --build
```

The backend container reaches Ollama on the host through `host.docker.internal`.
Docker was not available on the machine used for the audit, so this path is untested.

---

## Using the app

| Step | Page | What happens |
|---|---|---|
| — | `/login` | Sign in or create an account. Every page under `/app` requires it. |
| 1 | `/app/property` | Property details: title*, location*, property type, price, address, bedrooms, bathrooms, parking, land/interior size, features, amenities, agent notes, photo (JPG/PNG/WebP ≤ 5 MB). Bedrooms/bathrooms must be numbers (2.5 allowed). |
| 2 | `/app/settings` | Focus channel, tone (formal, friendly, casual, promotional, luxury, concise), social platform (Instagram 2,200 / Facebook 500 / LinkedIn 1,300 characters), length (short, medium, long, extra long), keywords, 1–3 versions, extra formats. |
| 3 | `/app/generated` | Copy streams in live, channel by channel. Badges show the engine ("AI · mistral", "Partly AI", "Template fallback"), time taken, and a "Template" mark on any channel the model didn't finish. |
| 4 | `/app/edit` | Edit directly or use Improve tone / More persuasive / Shorten. Edits are saved to the library automatically. |
| 5 | `/app/export` | Copy, or download TXT, PDF or DOCX. |
| — | `/app/library` | Private list of your content with search, filters (type, tone, engine, date) and stats. "Open in editor" restores the exact property details and settings, so Regenerate reuses them. |

Listing length targets: short ~80–120 words, medium ~150–220, long ~230–300,
extra long 400+. Medium and long meet the 150–300-word requirement for SEO listings.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Template fallback" badge | Ollama isn't running or the model isn't pulled: `ollama serve`, `ollama pull mistral`. |
| Generation takes ~45 s instead of ~20 s | Ollama is serving one request at a time. Restart it with `OLLAMA_NUM_PARALLEL=4` and set `LLM_STREAM_CONCURRENCY=4` for the API. |
| Sent back to sign-in | Sessions last 7 days (`SESSION_DAYS`); signing out ends the session on the server. |
| "Edits not saved" badge | The API was unreachable when saving; your edits stay in the page and are retried on the next change. |

---

## API reference

Base URL `http://localhost:8000`. Every route except `GET /api/health`,
`POST /api/auth/register` and `POST /api/auth/login` needs
`Authorization: Bearer <token>`; without it the API returns `401`. Records belonging to
another account return `404`.

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` | `{name, email, password(≥8)}` → `{token, user}` (201; 409 if the email exists) |
| `POST /api/auth/login` | `{email, password}` → `{token, user}` (401 on bad credentials) |
| `POST /api/auth/logout` | Ends the current session (204) |
| `GET /api/auth/me` | Current user |
| `POST /api/generate` | Generate all four channels and save → `{id, bundle, model_used, generation_time_ms, channel_sources}` |
| `POST /api/generate/stream` | Same input plus `extra_formats`, `variations`; newline-delimited JSON events (`start`, `delta`, `job_done`, `done`, `error`) |
| `GET /api/library` | Your saved records, newest first |
| `GET /api/library/{id}` | One record with `property` facts, `length`, `platform`, `keywords`, `bundle`, `channel_sources`, `extras`, `variants`, `created_at`, `updated_at` |
| `PUT /api/library/{id}` | Save edited copy `{bundle, extras}` |
| `DELETE /api/library/{id}` | Delete (204) |
| `GET /api/stats` | Totals, this week, by type, by tone, recent (your records only) |
| `POST /api/refine/{tone,persuasive,shorten}` | Rule-based refinements of one channel |
| `POST /api/upload-image` | Multipart `file`; real JPG/PNG/WebP only, ≤ 5 MB → `{path}` |
| `POST /api/export` | `{bundle, format: txt|pdf|docx, title, tone, extras}` → file download |

Generate request body (snake_case): `title`*, `location`*, `property_type`
(`house|apartment|townhouse|unit|villa|land|acreage|other`), `price`, `address`,
`bedrooms`, `bathrooms`, `parking`, `land_size`, `interior_size`, `features`,
`amenities`, `agent_notes`, `image_path`, `content_type`, `tone`, `length`,
`keywords`, `platform`.

`model_used` is `"mistral"` when every channel came from the model,
`"mistral (partial)"` when some fell back, and `"template"` when none did;
`channel_sources` says which, per channel.

---

## Data model

SQLite (`backend/propcopy.db`, created and migrated on startup — see `database.py`):

```
users ──< sessions
users ──< properties ──< generated_outputs >── content_types
                                           >── tones
```

- `users`: name, email (unique), PBKDF2-SHA256 password hash (600k iterations), role, created_at
- `sessions`: SHA-256 of the bearer token, user, expiry
- `content_types`, `tones`: seeded lookup tables
- `properties`: every input fact, owner
- `generated_outputs`: owner, property, content type, tone, length, platform, keywords,
  bundle JSON (channels, extras, variants), model_used, generation_time_ms,
  channel_sources, created_at, updated_at

Project 1 databases are migrated in place: missing tables/columns are added, each old
record gets lookup ids and a property row, and the first registered account claims them.

---

## AI generation

```
GenerateRequest ─► generator.generate_bundle()        template copy (always succeeds; fallback only)
                ─► prompts.build_prompt(channel)       grounded LangChain prompt per channel
                ─► ai_service.factory.get_backend()   Ollama (default) | Transformers | remote HTTP
                ─► orchestrator / streaming           4 channels in parallel, one shared deadline;
                                                      failed/late channels keep template text
                ─► postprocess.clean_channel()        removes [placeholder] lines, fits social limit
```

Grounding: prompts list only supplied facts and tell the model not to describe
anything else (appliances, gardens, views, nearby schools/shops…), to include price,
location, bedrooms and bathrooms with digits, and never to use placeholders.
Ollama runs at temperature 0.3 (`LLM_TEMPERATURE`).

| Variable | Default | Meaning |
|---|---|---|
| `USE_LLM` | `true` | `false` forces template-only output (tests/offline) |
| `LLM_BACKEND` | `ollama` | `ollama`, `local_transformers` or `remote_http` |
| `LLM_MODEL_NAME` | `mistral` for Ollama | Ollama tag or Hugging Face id |
| `LLM_OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `LLM_TIMEOUT_SECONDS` | `180` | Shared deadline for the 4 channels (`/api/generate`) and Ollama HTTP timeout |
| `LLM_STREAM_TIMEOUT_SECONDS` | `300` | Deadline for a streaming run |
| `LLM_STREAM_CONCURRENCY` | `1` for Ollama | Set to `4` when Ollama runs with `OLLAMA_NUM_PARALLEL=4` |
| `LLM_TEMPERATURE` | `0.3` | Sampling temperature (Ollama) |
| `LLM_SERVICE_URL` | — | `remote_http` only (e.g. Colab ngrok URL) |
| `LLM_LOAD_IN_4BIT` | `false` | `local_transformers` on CUDA only |
| `SESSION_DAYS` | `7` | Login session lifetime |
| `CORS_ORIGINS` | localhost:5173 + Amplify URL | Comma-separated allowed origins |

The Transformers and remote-HTTP backends (`ai_service/`, `colab_notebook.ipynb`)
remain for GPU machines but have only been tested with stubs; Ollama is the backend
used and measured. See `audit/AUDIT_REPORT.md` for the design change rationale.

Measured on an Apple M5 (17 GB), Mistral 7B Q4_K_M, warm model, 4 channels, medium:
~45 s with Ollama serving one request at a time; **~20 s** with
`OLLAMA_NUM_PARALLEL=4`. In the UI the first text appears within a few seconds.

---

## Tests, lint and evaluation

```bash
cd backend
.venv/bin/python -m pytest          # 97 tests; no model or GPU needed (stub backends)
.venv/bin/ruff check .              # PEP 8 style, pyflakes, import order
cd .. && npx eslint . && npm run build
```

```bash
cd backend
USE_LLM=false EVAL_OUTPUT=eval_template.csv .venv/bin/python evaluate.py   # template baseline
USE_LLM=true  EVAL_OUTPUT=eval_llm.csv      .venv/bin/python evaluate.py   # real model
```

`evaluate.py` runs 10 synthetic properties once each (all four channels) and scores
each channel: facts present (digits or words), contradicted bed/bath counts,
unsupported-amenity terms, placeholders, word range, Flesch reading ease, source and
timing. Human ratings of tone and relevance are not automated.

---

## Project structure

```
backend/
  main.py            FastAPI routes (auth-protected)
  auth.py            password hashing, sessions, current_user dependency
  database.py        schema, migration, per-user queries
  models.py          request/response models and validation
  prompts.py         grounded LangChain prompts (channel × tone × length × platform)
  orchestrator.py    parallel generation with shared deadline and per-channel fallback
  streaming.py       live NDJSON generation used by the UI
  postprocess.py     placeholder removal, social character limits
  generator.py       template engine (fallback) and rule-based refinements
  extras.py          headlines, Facebook ad, SMS, flyer, SEO
  export_utils.py    TXT / PDF / DOCX
  evaluate.py        template vs model evaluation
  ai_service/        Ollama, Transformers and remote-HTTP backends
  tests/
src/
  pages/             Login, PropertyInput, ContentSettings, GeneratedContent, EditReview, Export, Library, Batch…
  context/           AuthProvider, AppProvider (workspace state, autosave, reload restore)
  lib/api.ts         typed API client (adds the bearer token)
audit/               requirements audit, evidence and re-test results
scripts/run-local.sh one-command local start
```

## Known limitations

- Generation of all four channels takes ~20 s on an Apple M5 even with parallel
  requests, above the 15 s target; a GPU host or a smaller model would be needed.
- Real-model concurrency beyond one user, Docker, Firefox/Edge, uptime, SUS usability
  scores and HTTPS deployment have not been measured.
- The model can still occasionally add details that weren't supplied; review copy
  before publishing (the evaluation reports how often).
- Refinements (Improve tone, More persuasive, Shorten) are rule-based, not AI.
- Images are stored on local disk (`backend/uploads/`), not S3, and are not analysed.
