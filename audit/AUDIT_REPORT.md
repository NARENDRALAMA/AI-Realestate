# ITSU3009 Project 2 — Requirements Audit

**System:** AI-Powered Real Estate Marketing Content Generation System (Tech Adaptive)
**Audit date:** 12 October 2026 · **Repository:** `Pema/AI realestate` (working tree, commit `e8db02b` + uncommitted changes)
**Scope note:** This audit checks the team's documented requirements (brief, system requirements, design proposal, September progress report). The official ITSU3009 final assessment guide was not available, so this audit does **not** confirm assessment submission requirements.

All evidence referenced below is in `audit/raw/`. Scripts used: `audit/compare_llm_vs_template.py`, `audit/api_checks.py`, `audit/serve_scratch.py`. All API checks ran against scratch databases; `backend/propcopy.db` was not written to.

---

## 0. Changes made to the application during this session (before the audit request)

These were made at the user's request ("we use the full-fledged LLM now") **before** the audit instructions arrived. The audit covers the tree including them. Nothing else in the application was changed by the audit.

| File | Change |
|---|---|
| `backend/orchestrator.py` | `USE_LLM` default `false` → `true`; `LLM_TIMEOUT_SECONDS` default `15` → `180`; docstring. |
| `backend/ai_service/factory.py` | `LLM_BACKEND` default `remote_http` → `ollama`. **Bug fix:** `OllamaBackend` was built with a hard-coded 60 s HTTP timeout regardless of `LLM_TIMEOUT_SECONDS`; because Ollama serialises requests, the 3rd/4th channel queued past 60 s and silently fell back to templates. Now passes `LLM_TIMEOUT_SECONDS`. |
| `docker-compose.yml` | Backend env now `USE_LLM=true`, `LLM_BACKEND=ollama`, `LLM_MODEL_NAME=mistral`, `LLM_OLLAMA_URL=http://host.docker.internal:11434`, `LLM_TIMEOUT_SECONDS=180`. |
| `README.md`, `backend/evaluate.py` | Defaults/description updated to match. |

`npm run build` also regenerated `dist/` (build output).

---

## 1. Verdict

**Demonstrated to work (with execution evidence):**
- Real open-weight LLM inference: **Mistral 7B Instruct (Q4_K_M) via Ollama generated all 4 channels for all 10 evaluation properties — 40/40 channels from the model, 0 fallbacks.**
- Listing, social, email and video generation with the expected structure (email subject/greeting/sign-off 10/10; video ≥3 labelled scenes 10/10).
- Six tones and LangChain prompts that change with tone, length and channel.
- Per-channel template fallback when the model is unreachable, misconfigured or times out; feature flag.
- TXT / PDF / DOCX export of both template and LLM content (emoji show as boxes in PDF).
- SQLite persistence across a server restart; stats computed from real rows; safe, repeatable migration of Project 1 databases.
- 47 backend tests pass; frontend type-check/build and ESLint pass.

**Not met / broken:**
- **Performance:** real 4-channel generation takes **39–58 s (mean 47 s)** on an Apple M5 — about 3× the 15 s target.
- **Authentication, users, ownership, lookup tables:** not implemented. Any client can read and **delete** any record.
- **Database design:** a single `generated_outputs` table; property facts (price, bedrooms, etc.), length and settings are **not stored**, so a reopened library item cannot be regenerated faithfully.
- **Factuality:** the model includes supplied facts well, but **25/40 model texts add amenities not supplied** (e.g. "modern appliances", "steps from cafes", "landscaped garden"); all 10 model emails contain unfilled placeholders (`[Your Name]`, `[Recipient's Name]`).
- **Known bug still present:** medium-length template listing omits the price (0/30 runs).
- **Social:** no platform selector, no LinkedIn, no configured character limits; model social posts run 655–980 characters.

**Unverified (not executed or not executable here):** Firefox and Edge (Chrome journey passed), Docker startup (Docker not installed), 99 % availability, SUS usability score, HTTPS deployment, PEP 8 (no Python linter installed), Transformers and remote-HTTP backends with a real model, real-model concurrency.

**Overall:** the AI generation core works end-to-end at the API level, but the application does **not** yet meet the documented requirements for performance, authentication/data model, factual grounding and social-platform handling.

---

## 2. Requirement matrix

Statuses: PASS · PARTIAL · FAIL · UNVERIFIED · DOCUMENTED SCOPE CHANGE

### Core functional requirements (Project 1, inherited)

| Req | Status | Code location / API route | Executed evidence | Gap | Suggested fix |
|---|---|---|---|---|---|
| FR-01 Structured property input + validation | PARTIAL | `backend/models.py` `GenerateRequest`; `POST /api/generate`, `POST /api/generate/stream`, `POST /api/upload-image` | **Chrome:** empty form → "2 fields need attention" with per-field messages; bedrooms "lots" → "Use a number, like 3" (`02`, `03`). API: blank title → 422 "title is required"; missing location → 422; bad tone/length/type → 422 listing allowed values (`api_checks_offline.json`). | Fields: title, price, location, address, bedrooms, bathrooms, parking, land_size, interior_size, features, amenities, agent_notes, image_path (+ keywords). **No property-type field.** Numeric fields are unvalidated strings: `bedrooms="lots"` → 200 at the API (the UI blocks it, the backend doesn't) and output "Offering lots bedrooms"; `price="-5"` → 200. Image upload accepts any file (an `.html` file was accepted) and overwrites files with the same name. "Image metadata" = file path only. | Add `property_type`; validate numeric fields (int ≥ 0) and price format; restrict upload to image MIME/extension + size limit; unique filenames. |
| FR-02 Listing description, ~150–300 words, keywords | PARTIAL | `prompts.py` `_TEMPLATES["listing"]`, `_LENGTH_WORDS`; `generator.py` `_generate_listing` | Model medium listings: 94–153 words (10 runs). Template medium: 79–89 words. `keywords` field is passed into the prompt as "Keywords to emphasise". | Requirement says 150–300 words; implemented lengths are short 60–90, medium 120–180, long 220–320, extended 400–550. Only **long** sits inside 150–300; default (medium) usually falls below 150. Keyword use does not prove SEO ranking. | Decide which setting satisfies the 150–300 requirement and document it, or make medium target 150–220. |
| FR-03 Social posts per platform, hashtags/CTA, char limits | PARTIAL | `prompts.py` `_TEMPLATES["social"]` ("suitable for Instagram/Facebook"); `src/components/ChannelPanel.tsx` (shows char count) | Model posts include hashtags in 9/10; length 655–980 chars, 96–161 words. Template posts 154–178 chars, hashtags 10/10. | **No platform selector exists** (backend or UI). LinkedIn not supported. **No character limits are configured** anywhere — the UI only displays a count. Medium social prompt asks for 120–180 words, which is long for social. | Add `platform` (facebook/instagram/linkedin) to request + prompt; define per-platform limits in config; enforce/truncate and show limit in UI. |
| FR-04 Email newsletter: subject, body, closing | PARTIAL | `prompts.py` `_TEMPLATES["email"]`; `generator.py` `_generate_email` | Subject line 10/10, greeting 10/10, sign-off 10/10 for both model and template. | **All 10 model emails contain unfilled placeholders** (`[Your Name]`, `[Your Contact Information]`, `[Recipient's Name]`, `[Your Position]`). | Add agent name/contact to inputs, or instruct the prompt not to emit placeholders and post-check for `[...]`. |
| FR-05 Video walkthrough script with scenes | PASS | `prompts.py` `_TEMPLATES["video"]`; `generator.py` `_generate_video` | ≥3 labelled scenes in 10/10 model and 10/10 template scripts. | Model invents physical details per scene (see NFR-08). | — (covered by grounding fix) |
| FR-06 Tone/style selection affects wording | PASS (tones) / DOCUMENTED-SCOPE mismatch (lengths) | `models.py` `Tone`, `Length`; `prompts.py` `_TONE_GUIDANCE`; `src/lib/content-options.ts` | Six tones: **formal, casual, promotional, luxury, concise, friendly**. 6 tones × 4 lengths → 24/24 distinct prompts. Real regeneration formal→casual/short changed output (see §4 journey). | Progress report says **three** lengths; code has **four** (`short, medium, long, extended`). | Update documentation to four lengths (or remove `extended`). |
| FR-07 Export TXT/PDF/DOCX | PARTIAL | `POST /api/export`; `backend/export_utils.py` | Template and model bundles: TXT contains every channel verbatim; DOCX opens, every channel paragraph found; PDF opens (`%PDF-`), 2 pages, rendered and visually inspected (`export_template.pdf.png`, `export_llm_p2.pdf.png`), bullets and paragraphs preserved. Model bundle: TXT verbatim, DOCX all paragraphs found, PDF 3 pages. Bad format → 422. | **Emoji (used heavily in model social posts) render as `■` boxes in the PDF** (ReportLab core font). Export takes the bundle from the client, so it reflects edited text but is not tied to a saved record. | Register a Unicode TTF font in `export_utils.build_pdf` or strip emoji for PDF. |
| FR-08 Preview within a few seconds, consistent with exports | PASS (Chrome) | `src/pages/GeneratedContent.tsx`, `src/context/AppProvider.tsx` (uses `/api/generate/stream`) | Real server, `POST /api/generate/stream`: **first token 0.3 s, listing complete 7.7 s**, all 4 channels 43.2 s. **Chrome 154:** live streaming preview with per-channel "Done · AI" status; first content visible **4.3 s**, complete **43.4 s**; edited text appeared in all 3 exports (`audit/browser/05_*`, `06_generated.png`). | Full set takes ~43 s; preview content appears within seconds. Reloading the page clears the current result (it is only in the library). | Run and record the browser journey (screenshots) for the report. |
| FR-09 Regenerate after changing settings (~15 s) | PARTIAL | `GeneratedContent.tsx` `regenerate()`; same generate routes | API regeneration with new tone/length returns different text (§4). **Chrome:** settings changed to Casual/Short → regenerated in **31.8 s**, header "Casual tone · Short length", 78 words (`07_regenerated_casual_short.png`). | Takes ~40–58 s, not 15 s. Template engine uses `random.choice`, so identical settings are **not deterministic** (also true of the model). | See NFR-01. |
| FR-10 Library: persist, reopen, filter, reuse, re-export | PARTIAL | `GET /api/library`, `GET /api/library/{id}`, `DELETE /api/library/{id}`; `database.py`; `src/pages/Library.tsx` | Record created → server killed → restarted → record returned intact (`restart.db`). Library detail matches generated bundle. **Chrome:** library lists records with engine badges; tone filter (1 of 2), search (0 of 2, "No matches") work; detail view and "Open in editor" work (`11`–`13`). | DB stores only title, location, type, tone, bundle JSON, image path, model, time. **Price, bedrooms, bathrooms, features, length etc. are not saved**; "Open in editor" restores only title + location (Price "—", Specs "—", length shown as Medium though generated Short — `13_reopened_in_editor.png`). **Regenerating from a reopened item made Mistral invent "Three bedrooms" for a 2-bed property and drop the price** (`14_regen_from_library.png`). Edits made in Review & refine are **not saved** to the library (only exported). `created_at` is UTC without a zone marker. | Store full property facts + settings (see P2-10). |

### Project 2 design and implementation commitments

| Req | Status | Code location / API route | Executed evidence | Gap | Suggested fix |
|---|---|---|---|---|---|
| P2-01 Real open-weight LLM for all 4 types | PASS | `ai_service/ollama_backend.py`, `ai_service/factory.py`, `orchestrator.py` | Mistral 7B Instruct Q4_K_M via Ollama 0.34.3: **40/40 channels from the model** across 10 properties (`comparison.csv`, `comparison_raw_outputs.json`). Also via `POST /api/generate` and `/api/generate/stream` (§4). | — | — |
| P2-02 LangChain prompts for 4 types, 6 tones, lengths | PASS | `prompts.py` `build_prompt` | 4 distinct channel prompts; 24/24 distinct tone×length prompts; omitted facts absent from prompt. `tests/test_prompts.py` 6 pass. | 4 lengths, not 3 (see FR-06). | Doc update. |
| P2-03 Grounding rule; facts correct in real output | PARTIAL | `prompts.py` `_GROUNDING_RULES`, `_facts_block` | Model texts include all checked facts (price, suburb, beds, baths) in **38/40** after manual review (6 of 8 automated "misses" were numbers written as words); **0/40 contradicted bed/bath counts**. But **25/40 add unsupported amenities**. | Instruction alone does not stop invention. `evaluate.py` fact check is digits-only (false negatives) and doesn't detect invented amenities. | Lower temperature; add a negative example + "do not mention anything not listed"; post-generation check for common unsupported terms; improve evaluator. |
| P2-04 One shared deadline, per-channel fallback | PASS | `orchestrator.py` `generate_with_fallback` (`futures_wait(..., timeout)`) | Mocked: `test_timeout_falls_back_and_stays_within_the_timeout_window`. Real model, 5 s deadline, 3 consecutive runs: 5.02 / 5.01 / 5.02 s, all `template`; worker threads 3 → 7 → 3, back to baseline 3 after runs (no accumulation). | **Found during session:** Ollama HTTP client had its own 60 s timeout, causing silent fallbacks — fixed in `factory.py` (§0). | — |
| P2-05 Template fallback + feature flag | PASS | `orchestrator._use_llm`, `generator.generate_bundle` | `USE_LLM=false` → `model_used=template` (~1 ms). Ollama unreachable → template, 200, 21 ms. `remote_http` with no URL → template, 200. | Default flag is now `true` (§0). | — |
| P2-06 Provenance: `model_used`, `generation_time_ms`, distinguishable fallback | PARTIAL | `database.py` columns; `orchestrator.py`; `streaming.py`; `src/components/EngineBadge.tsx` | Stored and returned correctly (`mistral`, `template`, `mistral (partial)`). Streaming emits per-job `source` events. | Per-channel source is **not persisted** — a "(partial)" record does not say which channels fell back, and the saved text gives no marker. | Store per-channel source map in the record; show per-channel badge. |
| P2-07 Startup migration of Project 1 DBs | PASS | `database.init_db`, `_MIGRATIONS` | Synthetic old-schema DB: 5 → 5 rows; copy of shipped `propcopy.db`: 33 → 33 rows; `init_db()` run 3× with no error; new columns default to `template` / `0`. | Migrations rely on catching `OperationalError` (any error silently ignored). | Check `PRAGMA table_info` before `ALTER`. |
| P2-08 Authentication, users, protected APIs, isolation | FAIL | — (no auth code) | Unauthenticated `GET /api/library` 200, `DELETE /api/library/1` **204**, `GET /api/stats` 200. | No users, passwords, sessions or ownership; any client can delete any record. | Add User table, password hashing (bcrypt/argon2), JWT/session, protect routes, filter by owner. |
| P2-09 ContentType and Tone lookup tables | FAIL | `models.py` `Literal` enums | Schema inspected: no lookup tables. | Enums are stored as strings — a deviation from the ER diagram; listed as "not done" in `PROGRESS_LOG.md`. | Implement tables + FKs, or record as a documented scope change. |
| P2-10 Relations: User→Property→GeneratedContent | FAIL | `database.py` (single table `generated_outputs`) | Schema inspected. | No User or Property table; property facts not persisted (only title, location). | Add `properties` table with all facts and FK from generated content. |
| P2-11 UI pages connected to working endpoints; stats from DB | PASS (Chrome) | `src/pages/*`, `src/lib/api.ts`; `GET /api/stats` | Stats total went 66 → 67 after one generate and equals `COUNT(*)` of the DB. Build passes. **Chrome:** property → settings → generate → review/refine → export → library → home dashboard all worked against the live API, no console errors; library summary counts matched records. |  `src/lib/mockGenerator.ts` exists but is unused (dead code). | Run browser walkthrough; delete dead mock. |
| P2-12 Real Mistral vs template evaluation | PARTIAL (now executed) | `backend/evaluate.py`; `audit/compare_llm_vs_template.py` | See §3: same 10 properties × 4 channels, raw outputs retained. | Only formal tone, medium length. Tone, relevance and readability judged by automated proxy only; **no human judgment**. `evaluate.py` alone scores one channel per call and overwrites the baseline CSV. | Add human rating sheet; run additional tones/lengths; keep baseline file separate. |
| P2-13 Backend tests (report: 25) | PASS (with caveat) | `backend/tests/` | `pytest -v`: **47 passed** (6 files). | All AI tests use stubs/monkeypatch (`test_orchestrator`, `test_streaming`, `test_ollama_backend` with `FakeResponse`). None exercise a real model, the browser, the DB migration of real data, or exports. | Add export + library API tests; keep real-model tests as an opt-in marker. |
| P2-14 Missing price in medium listing; API error readability; eval thresholds | FAIL / PARTIAL | `generator.py` `_generate_listing` (medium branch); `src/lib/api.ts` `toApiError`; `evaluate.py` `_LENGTH_WORD_RANGE` | Medium template listing contained the price in **0/30** runs. Absent price → no `$` amount invented (pass). Eval thresholds are per content type (fixed). | Price bug **unresolved**. Frontend error formatting exists but was not browser-tested. | Add price sentence to the medium listing branch; add a test. |

### Non-functional targets

| Req | Status | Evidence | Gap | Suggested fix |
|---|---|---|---|---|
| NFR-01 Generation ≈15 s; ordinary actions within seconds | FAIL (model) / PASS (ordinary actions) | Real model, 4 channels, warm: **39.4–58.0 s, mean 47.2 s** (10 runs); per channel ~8–17 s each, serialised by Ollama. Template: ~1 ms. `/api/stats`, `/api/library`: ~1–2 ms. | ~3× over target. | Generate only the selected channel first (stream others); reduce `num_predict`; smaller model (e.g. Llama 3.2 3B / Qwen 2.5 3B); `OLLAMA_NUM_PARALLEL`; or GPU host. Re-measure. |
| NFR-02 ≥10 concurrent users | PARTIAL | Template path: 30 requests from 10 workers, all 200, max 44 ms (**model not exercised**). | Real model serialises requests: 10 simultaneous users would queue ~10 × 47 s. Not executed. | Measure real concurrency; queue + progress UI; parallel inference. |
| NFR-03 ~99 % availability; understandable errors | UNVERIFIED / PARTIAL | No crashes in any check; unavailable model degrades to template (200). API validation errors are raw Pydantic JSON (frontend reformats — not browser-verified). | No observation period defined, so availability can't be stated. | Define a test window and measure. |
| NFR-04 Auth, no sensitive logs, HTTPS | FAIL / UNVERIFIED | No auth (P2-08). Log statements reviewed: they log paths, model, timings and error text — no property data or credentials. HTTPS deployment: no deployed environment tested. | Unauthenticated delete; arbitrary file upload. | See P2-08, FR-01. |
| NFR-05 SUS > 70 | UNVERIFIED | No participant data found in the repo. | — | Run peer testing and record SUS sheets. |
| NFR-06 Maintainable modules, PEP 8, ESLint | PARTIAL | `npx eslint .` → 0 problems. `npm run build` (tsc + vite) passes. Python deps pinned. **No Python linter installed or configured** → PEP 8 unverified. | `pytest` is in runtime `requirements.txt`. | Add `ruff`/`flake8` config and run; move test deps to a dev file. |
| NFR-07 Docker; Chrome/Firefox/Edge | PARTIAL | **Chrome 154 (macOS): full journey passed, 0 console/page errors** (`audit/browser/`). Firefox, Edge: not installed — UNVERIFIED. Docker CLI not installed — UNVERIFIED. | `docker-compose.yml` now assumes Ollama on the host. | Install Docker Desktop, run `docker compose up`, record; test in all 3 browsers. |
| NFR-08 Output matches supplied facts | PARTIAL | Model: 38/40 include all checked facts; 0 contradictions; **25/40 contain unsupported claims**. Template: 32/40 (price bug) and **20/40 unsupported claims** ("schools, public transport" lifestyle line). | Both engines make claims that weren't supplied. | Grounding fixes (P2-03); remove generic lifestyle line from templates. |

---

## 3. Real model vs template — same 10 synthetic properties, 4 channels, formal tone, medium length

Dataset: `backend/evaluate.py` `SAMPLE_PROPERTIES` (exists, 10 properties). Raw outputs: `audit/raw/comparison_raw_outputs.json`; per-text metrics: `audit/raw/comparison.csv`.

| Metric | Template | Mistral 7B (Ollama) |
|---|---|---|
| Channels produced by | template 40/40 | **model 40/40 (0 fallbacks)** |
| All checked facts present (automated, digits only) | 32/40 (80 %) | 32/40 (80 %) |
| All checked facts present (after manual review of failures) | 32/40 — 8 listings missing price | **38/40** — 1 email missing price, 1 social missing bath count |
| Contradicted bed/bath count | 0 | 0 |
| Texts with unsupported amenity claims (term scan) | 20/40 | **25/40** |
| Unfilled placeholders (`[Your Name]` etc.) | 0 | 10/10 emails |
| Within length range (evaluate.py ranges) | 40/40 | 25/40 (social 0/10 — far longer than the 10–50 word range) |
| Mean Flesch Reading Ease | 25.8 | 38.7 (easier to read) |
| Request time (4 channels) | ~1 ms | **39.4–58.0 s, mean 47.2 s** |
| Mean per-channel model time | — | listing 30.6 s, social 26.9 s, email 30.7 s, video 28.8 s (includes queueing) |

Automated measures: fact presence, contradiction, length, Flesch, term scan. Human judgment applied only to the 8 fact failures and sample unsupported claims. **Tone and relevance were not human-rated.**

Examples of unsupported model claims (inputs didn't mention them): "stainless steel appliances", "just steps away from the best cafes, restaurants, and shops", "set amidst a landscaped garden", "with trams just steps away".

---

## 4. Real-model user journey (API level)

Synthetic property "Audit Test Cottage" (Katoomba, $720,000, 2 bed / 1 bath). Script: `audit/api_checks.py journey`; results `audit/raw/api_checks_journey.json`.

| Step | Route | Result |
|---|---|---|
| Validation (invalid inputs) | `POST /api/generate` | 422 with field + allowed values for blank title, missing location, bad tone/length/type; **200 for `bedrooms="lots"` and `price="-5"`** |
| Real generation (formal, medium) | `POST /api/generate` | 200, `model_used=mistral`, **58.2 s** |
| Regenerate (casual, short) | `POST /api/generate` | 200, `model_used=mistral`, **40.9 s**, listing 127 → 90 words, text changed |
| Real streaming (UI path), uvicorn server | `POST /api/generate/stream` | first token **0.3 s**; listing done 7.7 s, social 19.6 s, email 28.7 s, video 43.2 s; all jobs `source=ai` |
| Saving + library retrieval | `GET /api/library`, `GET /api/library/{id}` | 200; detail bundle identical to generated bundle; `model_used=mistral` retained |
| Export TXT / PDF / DOCX of model output | `POST /api/export` | 200 ×3; TXT verbatim; DOCX all paragraphs; PDF 3 pages, emoji → `■` |
| Timeout (5 s deadline) × 3 | `POST /api/generate` | 5.02 / 5.01 / 5.02 s, `template`, threads returned to baseline |
| Model unreachable | `POST /api/generate` | 200 `template` in 21 ms |
| Partial-channel failure | — | Mocked only (`test_partial_success_is_reported_as_partial`); not reproduced with the real model |
| Restart persistence | uvicorn restart | record intact after restart |

### Browser journey (Google Chrome 154, macOS, driven by Playwright; screenshots in `audit/browser/`, log `browser_run_log.txt`)

The browser automation extension wasn't connected, so installed Chrome was scripted with `playwright-core` (scratch install, not added to the project). Backend ran on a scratch DB (`audit/raw/browser.db`).

| Step | Result |
|---|---|
| Empty form → Continue | Blocked: "2 fields need attention — Listing title: Enter a listing title; Location: Enter the suburb and state" |
| Bedrooms "lots" | Blocked: "Bedrooms: Use a number, like 3" |
| Settings page | 4 focus types, 6 tones, 4 lengths, keywords, 1–3 versions, 5 extra formats. **No social platform selector.** |
| Generate (Formal/Medium) | Live streaming per channel; first content **4.3 s**; complete **43.4 s**; badge "AI · mistral", "Saved to library" |
| Change to Casual/Short → Generate | **31.8 s**; 78-word listing; header updated |
| Review & refine: manual edit + "Shorten" on email | Edit kept; Shorten 91 → 50 words (rule-based, not AI; splits emoji onto separate lines) |
| Export PDF / DOCX / TXT | All 3 downloaded; edit marker present in all 3; **PDF shows 22 emoji as black ■ boxes** (`browser_export.pdf.png`). TXT filename pattern differs from PDF/DOCX (`rem-content-casual-<timestamp>.txt`). |
| Library | Records, engine badges, tone filter, search, detail view all work |
| Library edits | **Manual edits not saved** to library record |
| Open in editor | Price/specs/features empty, length wrong (Medium instead of Short) |
| Regenerate reopened item | **Model invented "Three bedrooms" (actual 2) and omitted the price** |
| Page reload on result page | Current result cleared (library still has it) |
| Model unreachable | 1.5 s, "Template fallback" badge, content still produced (medium listing without price) |
| Home dashboard | Recent activity from the DB; heading still says "Create your first listing content" with records present (copy issue) |
| Console / page errors | 0 throughout |

---

## 5. Commands, results and blockers

| Command (from repo root unless noted) | Result |
|---|---|
| `cd backend && .venv/bin/python -m pytest -v` | **47 passed**, 3 deprecation warnings (`on_event`) |
| `npm run build` | pass (tsc + vite) |
| `npx eslint .` | 0 problems |
| `backend/.venv/bin/python -m flake8` | **blocked** — not installed |
| `cd backend && USE_LLM=true LLM_BACKEND=ollama LLM_MODEL_NAME=mistral LLM_TIMEOUT_SECONDS=180 .venv/bin/python ../audit/compare_llm_vs_template.py` | 10/10 properties, 40/40 model channels |
| `cd backend && .venv/bin/python ../audit/api_checks.py offline` | validation, fallback, export, concurrency, stats, auth, upload checks |
| `cd backend && .venv/bin/python ../audit/api_checks.py journey` | real-model journey (§4) |
| migration script (inline, see session) on `audit/raw/migration_*.db` | rows preserved, idempotent |
| `audit/serve_scratch.py` + curl, kill, restart | persistence confirmed |
| `docker --version` | **blocked** — Docker not installed |
| Chrome journey (Playwright + installed Chrome 154) | passed, 0 console errors — see §4 |
| Firefox / Edge | **blocked** — not installed |

## 6. Model, backend and hardware

- Hardware: Apple M5, 17.2 GB RAM, macOS 27.2 (Darwin 27.2.0)
- Inference: Ollama 0.34.3, model `mistral:latest` (Mistral 7B Instruct, 7.2 B params, Q4_K_M, 32 k context), `num_predict=400`, default sampling
- Backend config: `USE_LLM=true LLM_BACKEND=ollama LLM_MODEL_NAME=mistral LLM_TIMEOUT_SECONDS=180`; Python 3.9 venv in `backend/.venv`
- Runs were warm (model already loaded).

## 7. Design vs implementation differences

| Design (proposal / report) | Implementation | Classification |
|---|---|---|
| Hugging Face Transformers / PyTorch inference | Ollama (Mistral Q4_K_M) is the backend actually used; Transformers and remote-HTTP backends exist but were **never run with a real model** | Scope change — needs to be documented in the final report with rationale (no CUDA on Apple Silicon; bitsandbytes unsupported) |
| AWS S3 for model weights / exports; cloud GPU option | Local disk uploads; Ollama stores weights locally; no S3 code | Scope change to document; not an industry requirement |
| User, Property, ContentType, Tone, GeneratedContent entities | One table `generated_outputs` | Not implemented — either build it or formally revise the ER diagram |
| Three length settings | Four (`extended` added) | Doc update |
| Platform-specific social with character limits | Single generic social post | Gap |
| Template engine as primary + LLM optional (Sept report) | LLM primary by default, template as fallback (this session) | Change — document |
| — | Extra features not in design: streaming generation, extra formats (headlines, Facebook ad, SMS, flyer, SEO), up to 3 variations, refine endpoints (template-based, not LLM), batch page | Undocumented additions — describe or scope out |

## 8. Prioritised gap list

**Priority 1 — core functionality, security, factuality**
0a. **Regenerating a library item produces wrong facts** (model invented 3 bedrooms for a 2-bed property) because the facts aren't stored — fix together with P2-10.
0. **All Project 2 AI code is untracked in git** (`backend/ai_service/`, `orchestrator.py`, `prompts.py`, `extras.py`, `streaming.py` changes, `evaluate.py`, tests, `PROGRESS_LOG.md`). Repository history (last commit `e8db02b`) and any deployment built from it contain none of it. Commit it before anything else.
1. No authentication / users / ownership; unauthenticated delete (P2-08, NFR-04).
2. Model invents amenities in 25/40 texts; emails contain placeholders (P2-03, NFR-08, FR-04).
3. Property facts and settings not persisted; library reopen loses them (P2-10, FR-10).
4. Medium template listing omits price (P2-14) — matters because the template is still the fallback.
5. Numeric inputs and uploads not validated (FR-01).

**Priority 2 — performance, persistence, integration**
6. Generation 39–58 s vs 15 s target (NFR-01, FR-09).
7. Real-model concurrency untested; Ollama serialises requests (NFR-02).
8. Social: no platform selector or character limits (FR-03).
9. Per-channel provenance not stored (P2-06).
10. ContentType/Tone lookup tables (P2-09).

**Priority 3 — documentation and design reconciliation**
11. Document Ollama scope change, S3/cloud GPU decisions, 4 lengths, extra features.
12. Update `PROGRESS_LOG.md` (out of date: 25 vs 47 tests, no mention of Ollama/streaming/extras).
13. README API reference is missing `/api/generate/stream`, `/api/refine/*`, `/api/stats`, `/api/upload-image`.
14. User documentation, troubleshooting, browser/Docker/SUS evidence.

## 9. Missing documentation and evidence for the final report

- User guide (step-by-step with screenshots), troubleshooting (Ollama not running, model not pulled, slow generation, fallback badge).
- Setup for Ollama as the primary path (`ollama serve`, `ollama pull mistral`), hardware requirements and measured timings.
- Updated ER diagram matching the real schema, or the implemented full schema.
- Browser test record (Chrome, Firefox, Edge), Docker run log, SUS questionnaire results, availability observation.
- Human evaluation of tone/relevance for the model vs template comparison.

## 10. Proposed fix plan (not yet executed)

1. **Data model + auth** (largest): add `users`, `properties`, `content_types`, `tones` tables; FK from generated content; store all facts + length + per-channel source; password hashing + JWT; protect all `/api/*` routes; owner filtering; migration from current table.
2. **Grounding:** tighten prompts (explicit "never mention amenities, appliances, nearby places unless listed"; no placeholders; agent name/contact inputs); add post-generation check; fix `evaluate.py` to accept spelled-out numbers and flag unsupported terms; remove template lifestyle line; fix medium-listing price.
3. **Input validation:** numeric bedrooms/bathrooms/parking, price format, image-only uploads with size limit, `property_type` field.
4. **Social platforms:** add platform field, per-platform prompt and character limits.
5. **Performance:** generate selected channel first, reduce tokens, try a 3B model or parallel Ollama, re-measure against 15 s; real-model concurrency test.
6. **Evidence:** browser walkthrough, Docker run, SUS, Python linting, doc updates.

Each step should be re-verified with the scripts in `audit/` before it is reported as done.
