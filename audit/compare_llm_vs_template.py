"""Audit: run the same 10 synthetic properties (evaluate.SAMPLE_PROPERTIES) through the
template engine and the real model, all 4 channels, recording raw text, per-channel
source, per-channel model latency and evaluate.py's automated scores.

Run from backend/:  ../backend/.venv/bin/python ../audit/compare_llm_vs_template.py
Uses whatever USE_LLM / LLM_* env vars are set for the LLM pass.
"""
import csv, json, os, re, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import orchestrator, evaluate
from models import GenerateRequest
from generator import generate_bundle

OUT = Path(__file__).parent / "raw"
CHANNELS = orchestrator.CHANNELS
timings = {}
_orig = orchestrator._generate_channel
def _timed(backend, request, channel):
    t = time.monotonic()
    try:
        return _orig(backend, request, channel)
    finally:
        timings[channel] = int((time.monotonic() - t) * 1000)
orchestrator._generate_channel = _timed

def numbers_not_in_input(text, prop):
    supplied = " ".join(str(v) for v in prop.values())
    nums = set(re.findall(r"\d[\d,\.]*", text))
    return sorted(n for n in nums if n.rstrip(".,") not in supplied)

rows, raw = [], []
for prop in evaluate.SAMPLE_PROPERTIES:
    req = GenerateRequest(title=prop["title"], price=prop.get("price", ""), location=prop["location"],
        bedrooms=prop.get("bedrooms", ""), bathrooms=prop.get("bathrooms", ""), parking=prop.get("parking", ""),
        land_size=prop.get("land_size", ""), interior_size=prop.get("interior_size", ""),
        features=prop.get("features", ""), content_type="listing", tone="formal", length="medium")
    t = time.monotonic(); tmpl = generate_bundle(req); tmpl_ms = int((time.monotonic() - t) * 1000)
    timings.clear()
    bundle, model_used, gen_ms = orchestrator.generate_with_fallback(req)
    for ch in CHANNELS:
        for engine, text in (("template", getattr(tmpl, ch)), ("llm_run", getattr(bundle, ch))):
            source = "template" if engine == "template" else ("template_fallback" if text == getattr(tmpl, ch) else "model")
            ev = evaluate._evaluate_text(text, prop, ch)
            rows.append(dict(property=prop["title"], channel=ch, engine=engine, source=source,
                model_used=model_used if engine == "llm_run" else "template",
                request_ms=gen_ms if engine == "llm_run" else tmpl_ms,
                channel_model_ms=timings.get(ch, "") if engine == "llm_run" else "",
                word_count=ev["word_count"], length_ok=ev["length_ok"], flesch=ev["readability"],
                facts_ok=ev["facts_ok"], **{k: v for k, v in ev.items() if k.endswith("_present") or k.startswith("no_")},
                numbers_not_in_input=";".join(numbers_not_in_input(text, prop))))
            raw.append(dict(property=prop, channel=ch, engine=engine, source=source, text=text))
    print(f"{prop['title']}: model_used={model_used} request_ms={gen_ms} per_channel={timings}", flush=True)

keys = sorted({k for r in rows for k in r}, key=lambda k: list(rows[0]).index(k) if k in rows[0] else 99)
with open(OUT / "comparison.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)
(OUT / "comparison_raw_outputs.json").write_text(json.dumps(raw, indent=2, ensure_ascii=False))
print("done")
