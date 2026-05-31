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
  }
}
```

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
│   ├── main.py            # FastAPI app and routes
│   ├── generator.py       # Template-based content generation engine
│   ├── models.py          # Pydantic request/response models
│   ├── database.py        # SQLite helpers (propcopy.db)
│   ├── export_utils.py    # TXT / PDF / DOCX file builders
│   ├── requirements.txt
│   └── Dockerfile
├── src/
│   ├── context/           # React context + AppProvider (calls real API)
│   ├── lib/
│   │   ├── api.ts         # Typed fetch wrappers for all endpoints
│   │   └── mockGenerator.ts  # Local edit refinements (improve/shorten)
│   ├── pages/
│   │   ├── Library.tsx    # Output library browser
│   │   └── …             # Other workflow pages
│   └── types/index.ts     # Shared TypeScript types
├── docker-compose.yml
└── vite.config.ts         # Proxy: /api → backend
```

---

## Notes

- **No LLM used** — all content is produced by deterministic string templates. Drop-in LLM integration is planned for a later release; replace `generate_bundle()` in `backend/generator.py`.
- The frontend `mockGenerator.ts` is still used for the **Edit & Review** in-session refinements (improve tone / make persuasive / shorten). These run locally with no network call.
- The SQLite file lives at `backend/propcopy.db` and is auto-created on first run.
