"""Audit API checks against a scratch copy of the database (never touches backend/propcopy.db).
Run from backend/: .venv/bin/python ../audit/api_checks.py <mode>
  modes: offline   (validation, migration, unavailable model, exports, concurrency, template path)
         journey   (real-model journey: generate, regenerate, library, exports, timeout, threads)
"""
import io, json, os, shutil, sqlite3, sys, threading, time, zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))
OUT = HERE / "raw"
import database
SCRATCH = OUT / "scratch.db"
if SCRATCH.exists(): SCRATCH.unlink()
database.DB_PATH = SCRATCH
from fastapi.testclient import TestClient
import main
from ai_service import factory

PROP = dict(title="Audit Test Cottage", price="$720,000", location="Katoomba, NSW", bedrooms="2",
            bathrooms="1", parking="1", land_size="600 m²", interior_size="95 m²",
            features="wood fireplace, mountain views, renovated bathroom", content_type="listing",
            tone="formal", length="medium")
log = []
def rec(name, **kw):
    kw["check"] = name; log.append(kw); print(json.dumps(kw, ensure_ascii=False)[:600], flush=True)

def env(**kw):
    for k, v in kw.items(): os.environ[k] = v
    factory.get_backend.cache_clear()

def exports(c, bundle, tag):
    for fmt in ("txt", "pdf", "docx"):
        r = c.post("/api/export", json=dict(bundle=bundle, format=fmt, title=PROP["title"], tone="formal"))
        p = OUT / f"export_{tag}.{fmt}"; p.write_bytes(r.content)
        info = dict(status=r.status_code, bytes=len(r.content), file=p.name, ctype=r.headers.get("content-type"))
        if fmt == "txt":
            t = r.content.decode("utf-8")
            info["all_channels_verbatim"] = all(bundle[ch] in t for ch in bundle)
        elif fmt == "pdf":
            info["magic_ok"] = r.content[:5] == b"%PDF-"
            try:
                from pypdf import PdfReader
                t = " ".join(pg.extract_text() for pg in PdfReader(io.BytesIO(r.content)).pages)
                norm = lambda s: " ".join(s.split())
                info["pages"] = len(PdfReader(io.BytesIO(r.content)).pages)
                info["first_para_of_each_channel_found"] = {ch: norm(bundle[ch].split("\n\n")[0])[:60] in norm(t) for ch in bundle}
            except ImportError:
                info["text_check"] = "pypdf not installed"
        else:
            z = zipfile.ZipFile(io.BytesIO(r.content)); info["zip_ok"] = z.testzip() is None
            try:
                import docx
                d = docx.Document(io.BytesIO(r.content)); paras = [p.text for p in d.paragraphs]
                joined = "\n".join(paras)
                info["paragraphs"] = len(paras)
                info["channel_paragraphs_found"] = {ch: all(seg.strip() in joined for seg in bundle[ch].split("\n\n") if seg.strip()) for ch in bundle}
            except ImportError:
                info["text_check"] = "python-docx not installed"
        rec(f"export_{tag}_{fmt}", **info)

mode = sys.argv[1]
with TestClient(main.app) as c:
    if mode == "offline":
        # validation
        for name, body in [("missing_title", {**PROP, "title": "  "}), ("missing_location", {k: v for k, v in PROP.items() if k != "location"}),
                           ("bad_tone", {**PROP, "tone": "angry"}), ("bad_length", {**PROP, "length": "huge"}),
                           ("bad_type", {**PROP, "content_type": "tiktok"}), ("non_numeric_bedrooms", {**PROP, "bedrooms": "lots"}),
                           ("negative_price", {**PROP, "price": "-5"})]:
            env(USE_LLM="false")
            r = c.post("/api/generate", json=body)
            rec("validation_" + name, status=r.status_code, body=r.text[:200])
        # template path
        env(USE_LLM="false")
        t = time.monotonic(); r = c.post("/api/generate", json=PROP); ms = int((time.monotonic()-t)*1000)
        j = r.json(); rec("template_generate", status=r.status_code, model_used=j["model_used"], generation_time_ms=j["generation_time_ms"], wall_ms=ms,
                          listing_has_price=PROP["price"] in j["bundle"]["listing"])
        # missing-price bug: medium listing over 30 random template draws
        hits = sum(PROP["price"] in c.post("/api/generate", json=PROP).json()["bundle"]["listing"] for _ in range(30))
        rec("p2_14_medium_listing_price_present_30_runs", present=hits, of=30)
        nop = {**PROP, "price": ""}
        txt = c.post("/api/generate", json=nop).json()["bundle"]
        rec("p2_14_absent_price_not_invented", any_dollar_amount=any("$" in v for v in txt.values()))
        # unavailable model
        env(USE_LLM="true", LLM_BACKEND="ollama", LLM_OLLAMA_URL="http://127.0.0.1:9", LLM_TIMEOUT_SECONDS="180")
        t = time.monotonic(); r = c.post("/api/generate", json=PROP)
        rec("model_unavailable", status=r.status_code, model_used=r.json()["model_used"], wall_ms=int((time.monotonic()-t)*1000))
        env(LLM_BACKEND="remote_http", LLM_SERVICE_URL="")
        r = c.post("/api/generate", json=PROP); rec("remote_http_unconfigured", status=r.status_code, model_used=r.json()["model_used"])
        env(LLM_BACKEND="ollama", LLM_OLLAMA_URL="http://localhost:11434")
        # exports of template output
        exports(c, j["bundle"], "template")
        # 404s / bad export
        rec("library_missing_404", status=c.get("/api/library/999999").status_code)
        rec("export_bad_format", status=c.post("/api/export", json=dict(bundle=j["bundle"], format="rtf")).status_code)
        # concurrency, template path (model NOT exercised)
        env(USE_LLM="false")
        def one(_):
            t = time.monotonic(); r = c.post("/api/generate", json=PROP); return r.status_code, int((time.monotonic()-t)*1000)
        with ThreadPoolExecutor(10) as ex: res = list(ex.map(one, range(30)))
        rec("concurrency_template_10_workers_30_requests", statuses=sorted({s for s, _ in res}), max_ms=max(m for _, m in res), mean_ms=sum(m for _, m in res)//len(res))
        # stats reflect DB
        before = c.get("/api/stats").json()["total"]; c.post("/api/generate", json=PROP); after = c.get("/api/stats").json()
        rows = sqlite3.connect(SCRATCH).execute("select count(*) from generated_outputs").fetchone()[0]
        rec("stats_from_db", before=before, after=after["total"], db_rows=rows, by_type=after["by_type"])
        # auth: protected endpoints?
        rec("unauthenticated_access", library=c.get("/api/library").status_code, delete=c.delete("/api/library/1").status_code, stats=c.get("/api/stats").status_code)
        # upload validation
        r = c.post("/api/upload-image", files={"file": ("evil.html", b"<script>alert(1)</script>", "text/html")})
        rec("upload_non_image_accepted", status=r.status_code, body=r.text)
        (HERE.parent / "backend" / r.json()["path"]).unlink(missing_ok=True)
    elif mode == "journey":
        env(USE_LLM="true", LLM_BACKEND="ollama", LLM_MODEL_NAME="mistral", LLM_OLLAMA_URL="http://localhost:11434", LLM_TIMEOUT_SECONDS="180")
        t = time.monotonic(); r = c.post("/api/generate", json=PROP); ms = int((time.monotonic()-t)*1000); g1 = r.json()
        rec("real_generate", status=r.status_code, model_used=g1["model_used"], generation_time_ms=g1["generation_time_ms"], wall_ms=ms, id=g1["id"])
        (OUT / "journey_generate_1.json").write_text(json.dumps(g1, indent=2, ensure_ascii=False))
        t = time.monotonic(); r = c.post("/api/generate", json={**PROP, "tone": "casual", "length": "short"}); g2 = r.json()
        rec("real_regenerate_casual_short", status=r.status_code, model_used=g2["model_used"], generation_time_ms=g2["generation_time_ms"], wall_ms=int((time.monotonic()-t)*1000),
            listing_words_before=len(g1["bundle"]["listing"].split()), listing_words_after=len(g2["bundle"]["listing"].split()), changed=g1["bundle"] != g2["bundle"])
        (OUT / "journey_generate_2_casual_short.json").write_text(json.dumps(g2, indent=2, ensure_ascii=False))
        lib = c.get("/api/library").json(); det = c.get(f"/api/library/{g1['id']}").json()
        rec("library_roundtrip", items=len(lib), detail_matches=det["bundle"] == g1["bundle"], model_used=det["model_used"], stored_fields=sorted(det))
        exports(c, det["bundle"], "llm")
        # the UI's real path: POST /api/generate/stream
        t = time.monotonic(); first = None; sources = {}; done = None
        with c.stream("POST", "/api/generate/stream", json=PROP) as s:
            for line in s.iter_lines():
                if not line: continue
                ev = json.loads(line)
                if ev["type"] == "delta" and first is None: first = int((time.monotonic()-t)*1000)
                if ev["type"] == "job_done": sources[ev["job"]] = ev["source"]
                if ev["type"] in ("done", "error"): done = ev
        rec("real_stream", wall_ms=int((time.monotonic()-t)*1000), first_token_ms=first, job_sources=sources,
            model_used=done.get("model_used"), generation_time_ms=done.get("generation_time_ms"), id=done.get("id"))
        (OUT / "journey_stream_done.json").write_text(json.dumps(done, indent=2, ensure_ascii=False))
        # timeout path with real model: 5s deadline
        env(LLM_TIMEOUT_SECONDS="5")
        base_threads = threading.active_count()
        walls = []
        for i in range(3):
            t = time.monotonic(); r = c.post("/api/generate", json=PROP); walls.append(int((time.monotonic()-t)*1000))
            rec(f"real_timeout_5s_run{i+1}", status=r.status_code, model_used=r.json()["model_used"], wall_ms=walls[-1], threads_alive=threading.active_count())
        time.sleep(1); rec("threads_after_timeouts", baseline=base_threads, now=threading.active_count())
        time.sleep(40); rec("threads_after_40s_drain", baseline=base_threads, now=threading.active_count())
(OUT / f"api_checks_{mode}.json").write_text(json.dumps(log, indent=2, ensure_ascii=False))
