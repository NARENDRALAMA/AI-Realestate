# Deployment — REM Content Studio

ITSU3009 Project 2 (industry partner Tech Adaptive). Deployed 3 November 2026.

## Live URLs

| What | URL |
|---|---|
| Web app (Cloudflare Pages) | https://rem-content-studio.pages.dev |
| API (Google Cloud Run) | https://rem-api-154218404779.australia-southeast1.run.app |
| API health check | https://rem-api-154218404779.australia-southeast1.run.app/api/health |

Demo login: `demo@remcontentstudio.app`. The password is in Secret Manager (`demo-password`); ask the team member who set it.

## Architecture

```
 Browser
   │  HTTPS
   ▼
 Cloudflare Pages  ── static React build (dist/), security headers from dist/_headers
   │  fetch() to VITE_API_URL (CORS: only the Pages origin + localhost:5173)
   ▼
 Google Cloud Run  ── service rem-api, australia-southeast1, 1 vCPU / 512 MiB, 0–1 instances
   │  FastAPI + Uvicorn, SQLite at /tmp/propcopy.db (ephemeral)
   │  CF_API_TOKEN + DEMO_PASSWORD read from Secret Manager
   │  HTTPS, Bearer token
   ▼
 Cloudflare Workers AI ── @cf/mistralai/mistral-small-3.1-24b-instruct
```

The orchestrator calls the model once per channel (listing, social, email, video), all four at once, under one
shared deadline (`LLM_TIMEOUT_SECONDS`, 60 s in the cloud). If a channel errors, times out, or is rejected by
the output guard, that channel keeps its template text. Every saved output records `model_used`
(`workers-ai/mistral-small-3.1-24b-instruct`, `… (partial)` or `template`) and `generation_time_ms`.

Local development is unchanged: `scripts/run-local.sh` still uses Ollama (`LLM_BACKEND=ollama`).

### Model choice

The brief named `@cf/mistral/mistral-7b-instruct-v0.1`. Cloudflare deprecated it (and
`@hf/mistral/mistral-7b-instruct-v0.2`) on 30 May 2026, and it is no longer in the Workers AI catalogue. The team
chose the closest Mistral model still available, **Mistral Small 3.1 (24B)**. Reports should say "Mistral
Small 3.1 24B on Workers AI" for the cloud version and "Mistral 7B Instruct via Ollama" for the laptop version.
The model is a setting (`CF_MODEL`), not code.

### Data persistence (important)

SQLite lives at `/tmp/propcopy.db` inside the container. Cloud Run keeps `/tmp` in memory, so **all accounts and
saved library items are lost whenever the instance restarts**: after about 15 minutes idle (it scales to zero), on
every redeploy, or on every settings change. This is acceptable for the prototype. The demo account is recreated
at every startup from `DEMO_EMAIL` / `DEMO_PASSWORD`, so the live demo login always works. Any other account has to
be registered again after a restart. For real persistence, use Cloud SQL or Firestore, or mount a Cloud Storage
bucket (not done; it costs extra and needs code changes).

## Cloud resources

| Provider | Resource | Name |
|---|---|---|
| Google Cloud | Project (billing linked) | `rem-content-studio-11035946` |
| Google Cloud | Budget alert, 5 AUD, emails at 50/90/100 % | `REM Content Studio 5 AUD` |
| Google Cloud | Artifact Registry Docker repo | `rem` (australia-southeast1) |
| Google Cloud | Service account (secret reader only) | `rem-api@rem-content-studio-11035946.iam.gserviceaccount.com` |
| Google Cloud | Secret Manager secrets (region-pinned) | `cf-api-token`, `demo-password` |
| Google Cloud | Cloud Run service | `rem-api` |
| Cloudflare | Pages project | `rem-content-studio` (production branch `main`) |
| Cloudflare | Workers AI | used through the REST API on account `e7abb1594df871d0f5cefef86709c9b8` |
| Cloudflare | API token | "Workers AI" template token, stored only in Secret Manager |

## Configuration

### Cloud Run environment variables (`deploy/cloudrun.env.yaml`)

| Variable | Value in the cloud | Purpose |
|---|---|---|
| `USE_LLM` | `true` | Feature flag; `false` = templates only |
| `LLM_BACKEND` | `workers_ai` | `ollama` (local default), `workers_ai`, `remote_http`, `local_transformers` |
| `CF_ACCOUNT_ID` | Cloudflare account id | Not secret |
| `CF_MODEL` | `@cf/mistralai/mistral-small-3.1-24b-instruct` | Workers AI model |
| `LLM_TIMEOUT_SECONDS` | `60` | Shared deadline for `/api/generate` |
| `LLM_STREAM_TIMEOUT_SECONDS` | `90` | Shared deadline for `/api/generate/stream` |
| `ENABLE_API_DOCS` | `false` | Hides `/docs`, `/redoc`, `/openapi.json` |
| `TRUSTED_PROXY_HOPS` | `1` | Client IP for rate limiting = last `X-Forwarded-For` entry |
| `DEMO_EMAIL` | `demo@remcontentstudio.app` | Demo account created at startup |
| `ALLOWED_ORIGINS` | `https://rem-content-studio.pages.dev,http://localhost:5173` | CORS allow-list; wildcards are ignored |

`DB_PATH=/tmp/propcopy.db` and `PORT` are set in the Dockerfile and by Cloud Run.
Optional: `RATE_LIMIT_GENERATE` (default `10/60`), `RATE_LIMIT_REFINE` (`30/60`), `RATE_LIMIT_AUTH` (`10/60`),
`RATE_LIMIT_ENABLED`, `DEMO_NAME`, `LLM_TEMPERATURE`. `backend/.env.example` lists every name.

### Secrets (names only, values are never in git or in this file)

| Env var in container | Secret Manager secret |
|---|---|
| `CF_API_TOKEN` | `cf-api-token` (Cloudflare "Workers AI" template token) |
| `DEMO_PASSWORD` | `demo-password` (8+ characters) |

### Frontend build variable

`VITE_API_URL=https://rem-api-154218404779.australia-southeast1.run.app` is baked in at build time
(`src/lib/api.ts`). `scripts/write-headers.mjs` then writes `dist/_headers` with a Content-Security-Policy that
allows only this API URL and the SHA-256 hashes of the page's inline script and style blocks.

## Commands used

### One-time setup

```bash
# Tools (macOS)
brew install --cask google-cloud-sdk
gcloud auth login
npx wrangler login

# Google Cloud project + billing + budget
gcloud projects create rem-content-studio-11035946 --name="REM Content Studio"
gcloud billing projects link rem-content-studio-11035946 --billing-account=<BILLING_ACCOUNT_ID>
gcloud config set project rem-content-studio-11035946
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com billingbudgets.googleapis.com
gcloud billing budgets create --billing-account=<BILLING_ACCOUNT_ID> \
  --display-name="REM Content Studio 5 AUD" --budget-amount=5AUD \
  --filter-projects=projects/rem-content-studio-11035946 \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
  # (the billing account is in AUD; a USD amount is rejected)

# Image repository
gcloud artifacts repositories create rem --repository-format=docker --location=australia-southeast1
gcloud auth configure-docker australia-southeast1-docker.pkg.dev

# Secrets: created empty, values typed in by a team member (never pasted into chat or files)
gcloud secrets create cf-api-token  --replication-policy=user-managed --locations=australia-southeast1
gcloud secrets create demo-password --replication-policy=user-managed --locations=australia-southeast1
read -s T && printf %s "$T" | gcloud secrets versions add cf-api-token  --data-file=-; unset T
read -s T && printf %s "$T" | gcloud secrets versions add demo-password --data-file=-; unset T

# Least-privilege runtime identity
gcloud iam service-accounts create rem-api --display-name="REM API (Cloud Run)"
for s in cf-api-token demo-password; do
  gcloud secrets add-iam-policy-binding $s \
    --member=serviceAccount:rem-api@rem-content-studio-11035946.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done

# Cloudflare Pages project (current wrangler forwards Pages commands to Workers;
# --force is needed once to create a classic Pages project)
npx wrangler pages project create rem-content-studio --production-branch=main --force
```

### Deploy / redeploy

```bash
deploy/redeploy.sh            # backend + frontend
deploy/redeploy.sh backend    # only Cloud Run
deploy/redeploy.sh frontend   # only Pages
```

The script runs these steps:

```bash
# Backend: build for Cloud Run's CPU type (linux/amd64, even on an Apple Silicon Mac) and deploy
IMG=australia-southeast1-docker.pkg.dev/rem-content-studio-11035946/rem/rem-api:<tag>
docker build --platform linux/amd64 -t $IMG backend
docker push $IMG          # retried: pushes from Docker Desktop sometimes drop mid-upload
gcloud run deploy rem-api --image=$IMG --region=australia-southeast1 \
  --service-account=rem-api@rem-content-studio-11035946.iam.gserviceaccount.com \
  --allow-unauthenticated --port=8000 --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=1 --concurrency=40 --timeout=300 \
  --env-vars-file=deploy/cloudrun.env.yaml \
  --set-secrets=CF_API_TOKEN=cf-api-token:latest,DEMO_PASSWORD=demo-password:latest

# Frontend
VITE_API_URL=https://rem-api-154218404779.australia-southeast1.run.app npm run build
VITE_API_URL=https://rem-api-154218404779.australia-southeast1.run.app node scripts/write-headers.mjs
npx wrangler pages deploy dist --project-name=rem-content-studio --branch=main
```

Change one setting without rebuilding (creates a new revision, which also wipes the database):

```bash
gcloud run services update rem-api --region=australia-southeast1 --update-env-vars=USE_LLM=false
gcloud run services update rem-api --region=australia-southeast1 --env-vars-file=deploy/cloudrun.env.yaml  # restore
```

Rotate the Cloudflare token: add a new version (same `read -s` command as above), then redeploy the backend
(`:latest` is read when an instance starts), then revoke the old token in the Cloudflare dashboard.

If the Pages URL ever changes, update `ALLOWED_ORIGINS` in `deploy/cloudrun.env.yaml` and redeploy the backend.
If the Cloud Run URL changes, update `API_URL` in `deploy/redeploy.sh` and redeploy the frontend.

### Logs

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="rem-api"' \
  --project rem-content-studio-11035946 --limit 50 --format="value(timestamp,textPayload)"
```

Lines with `path=template … reason=…` show every fallback (timeout, Workers AI error, output guard).

## Smoke test results (3 Nov 2026)

`python3 audit/deploy/smoke_test.py <API_URL> https://rem-content-studio.pages.dev <runs>` registers a throwaway
account and generates all four channels for a sample property (3-bed house, Sandy Bay, Hobart).

| Scenario | model_used | Channels from AI | generation_time_ms |
|---|---|---|---|
| Workers AI, run 1–3 (first deploy) | `workers-ai/mistral-small-3.1-24b-instruct` | 4/4 | 9 040, 7 097, 7 184 |
| Workers AI, final revision, 5 runs | `workers-ai/mistral-small-3.1-24b-instruct` | 4/4 | 7 027, 6 776, 6 898, 7 117, 6 844 |
| Workers AI, streaming endpoint | `workers-ai/mistral-small-3.1-24b-instruct` | 4/4 | 7 164 |
| Forced failure: wrong Cloudflare credentials (Workers AI returned HTTP 401) | `template` | 0/4, all 4 still filled | 275 |
| Forced failure: feature flag `USE_LLM=false` | `template` | 0/4, all 4 still filled | 0 |

**Generation time for 4 channels: about 7 s in the cloud (6.8–9.0 s) vs 40–46 s on the laptop with Ollama**, roughly
6× faster. Times are measured warm; the first request after the service has been idle also includes a Cloud Run
cold start (a few seconds). Raw outputs: `audit/deploy/smoke_*.txt`.

## Cost notes

Expected cost for coursework use: **$0**. Everything below is within free tiers at this traffic.

| Item | Free tier / price | Our usage |
|---|---|---|
| Cloud Run (request-based billing) | 180 000 vCPU-s, 360 000 GiB-s, 2 M requests per month free | ~10 vCPU-s per generation; scales to 0 when idle |
| Artifact Registry | 0.5 GB storage free | ~80 MB per image. Delete old tags now and then (see below) |
| Secret Manager | 6 active secret versions, 10 000 accesses per month free | 2 versions |
| Cloudflare Pages | Free plan | Static site |
| Workers AI | 10 000 neurons/day free; then $0.011 per 1 000 neurons (Workers Paid only) | Estimated ~150 neurons per 4-channel generation (~60–70 generations/day free); check the Workers AI dashboard for real usage |

On the Cloudflare free plan, going over the daily allowance does not bill: Workers AI returns errors and the app
falls back to templates. `max-instances=1` and the rate limits cap Cloud Run spend. The 5 AUD budget alert emails
the billing account owner; it does not stop services.

Clean up old images:

```bash
gcloud artifacts docker images list australia-southeast1-docker.pkg.dev/rem-content-studio-11035946/rem/rem-api --include-tags
gcloud artifacts docker images delete australia-southeast1-docker.pkg.dev/rem-content-studio-11035946/rem/rem-api:<old-tag>
```

## Tear down

Irreversible; agree as a team first.

```bash
# Everything on Google Cloud (Cloud Run, images, secrets, service account) in one go;
# the project can be restored for 30 days.
gcloud projects delete rem-content-studio-11035946
# Budget alert (lives on the billing account, not the project)
gcloud billing budgets list --billing-account=<BILLING_ACCOUNT_ID>
gcloud billing budgets delete <BUDGET_ID> --billing-account=<BILLING_ACCOUNT_ID>
# Cloudflare Pages site
npx wrangler pages project delete rem-content-studio
# Cloudflare API token: dashboard → My Profile → API Tokens → revoke the Workers AI token
```

## Deployment-related code changes

- `backend/ai_service/workers_ai_backend.py`: new `WorkersAIBackend` (same `AIBackend` interface as Ollama).
- `backend/ai_service/factory.py`: `LLM_BACKEND=workers_ai`.
- `backend/main.py`: `ALLOWED_ORIGINS` CORS allow-list (no wildcards, no credentials, `Content-Disposition`
  exposed for export downloads), security headers, `ENABLE_API_DOCS`, demo-account seeding.
- `backend/ratelimit.py`: per-IP limits on generate, refine and login/register.
- `backend/database.py`: `DB_PATH`.
- `backend/Dockerfile`, `backend/.dockerignore`: `$PORT`, non-root user, DB in `/tmp`, no local DB/venv/secrets
  in the image.
- `scripts/write-headers.mjs`, `scripts/prerender.mjs`: Pages security headers with a strict CSP.
- `deploy/cloudrun.env.yaml`, `deploy/redeploy.sh`.

Security fixes made after testing are listed in [SECURITY_TESTING.md](SECURITY_TESTING.md).

**Team note:** backend dependencies were upgraded for security and now need **Python 3.10+**. Rebuild your local
virtualenv with Python 3.12 (`python3.12 -m venv backend/.venv && backend/.venv/bin/pip install -r
backend/requirements-dev.txt`). An old 3.9 venv keeps working only until it is reinstalled.
