"""
Evaluation script: compares the template engine against the LLM path.

Runs a fixed set of 10 sample properties through all 4 content types
(listing/social/email/video), once with USE_LLM=false (template only) and
once with USE_LLM=true (LLM, falling back to template per-channel per the
orchestration rules in orchestrator.py). For every generated text it checks:

  1. Factual accuracy — bedrooms, bathrooms, price, and location that were
     supplied are actually present in the output, and no bedroom/bathroom
     count appears that wasn't supplied (a simple, explainable proxy for
     "did it invent a number").
  2. Length — word count falls within the target range for that length
     setting (60-90 / 120-180 / 220-320 words, matching prompts.py).
  3. Readability — a hand-rolled Flesch Reading Ease approximation (no extra
     dependency; syllables are estimated by counting vowel groups).

Results are written to backend/evaluate_results.csv (one row per generation)
and a short pass-rate summary is printed per path.

Run it:
    cd backend
    python evaluate.py                        # template path only
    USE_LLM=true LLM_BACKEND=remote_http \
        LLM_SERVICE_URL=https://... python evaluate.py   # + LLM path

If USE_LLM=true but the AI backend is unavailable, every LLM-path generation
simply falls back to the template (that's the fallback behaviour working as
designed) — the summary will show model_used="template" for those rows so
you can tell the difference between "the LLM was actually used" and
"it fell back."
"""
from __future__ import annotations

import csv
import os
import re
import time
from pathlib import Path

from models import GenerateRequest
from orchestrator import generate_with_fallback

_CONTENT_TYPES = ["listing", "social", "email", "video"]

# Word-count ranges are per content type, not per length setting: a "medium"
# social media post is naturally much shorter than a "medium" listing or video
# script (measured from the template engine's actual medium-length output,
# with margin either side for natural variation between tones and for LLM
# output, which won't hit the exact same word counts as the deterministic
# templates). This evaluation always runs at length="medium".
_LENGTH_WORD_RANGE = {
    "listing": (50, 150),
    "social": (10, 50),
    "email": (60, 170),
    "video": (80, 220),
}

_OUTPUT_CSV = Path(__file__).parent / "evaluate_results.csv"

# 10 synthetic sample properties covering a spread of locations, sizes, and
# missing-field combinations (e.g. some have no price, to check we don't
# invent one).
SAMPLE_PROPERTIES: list[dict] = [
    dict(title="Sunlit 3-Bed Terrace", price="$1,250,000", location="Richmond, VIC",
         bedrooms="3", bathrooms="2", parking="2", land_size="320 m²", interior_size="142 m²",
         features="North-facing living, engineered oak floors, SMEG kitchen"),
    dict(title="Modern 2-Bed Apartment", price="$680,000", location="South Yarra, VIC",
         bedrooms="2", bathrooms="1", parking="1", interior_size="85 m²",
         features="Floor-to-ceiling windows, city views, gym access"),
    dict(title="Family Home with Pool", price="$1,890,000", location="Brighton, VIC",
         bedrooms="4", bathrooms="3", parking="2", land_size="650 m²",
         features="In-ground pool, solar panels, home theatre"),
    dict(title="Cosy 1-Bed Studio", price="$420,000", location="Fitzroy, VIC",
         bedrooms="1", bathrooms="1", parking="0", interior_size="48 m²",
         features="Exposed brick, high ceilings, walk to trams"),
    dict(title="Acreage Retreat", price="", location="Yarra Valley, VIC",
         bedrooms="5", bathrooms="3", parking="4", land_size="2 hectares",
         features="Vineyard views, dam, workshop shed"),
    dict(title="Renovated Victorian Cottage", price="$1,050,000", location="Carlton, VIC",
         bedrooms="3", bathrooms="1", parking="1", land_size="210 m²",
         features="Period facade, modern extension, courtyard garden"),
    dict(title="Beachside Apartment", price="$795,000", location="St Kilda, VIC",
         bedrooms="2", bathrooms="2", parking="1", interior_size="92 m²",
         features="Ocean glimpses, balcony, secure building"),
    dict(title="New Build Townhouse", price="$920,000", location="Preston, VIC",
         bedrooms="3", bathrooms="2", parking="2", interior_size="160 m²",
         features="Ducted heating/cooling, solar hot water, low-maintenance yard"),
    dict(title="Inner-City Penthouse", price="$2,450,000", location="Melbourne, VIC",
         bedrooms="3", bathrooms="2", parking="2", interior_size="180 m²",
         features="Rooftop terrace, wine cellar, concierge"),
    dict(title="Quiet Suburban Bungalow", price="", location="Box Hill, VIC",
         bedrooms="2", bathrooms="1", parking="1", land_size="480 m²",
         features="Established garden, single-level, close to station"),
]


def _word_count(text: str) -> int:
    return len(text.split())


def _count_syllables(word: str) -> int:
    word = word.lower().strip(".,!?;:'\"")
    if not word:
        return 0
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def _flesch_reading_ease(text: str) -> float:
    """Approximate Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)."""
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    words = re.findall(r"[A-Za-z']+", text)
    if not sentences or not words:
        return 0.0
    syllables = sum(_count_syllables(w) for w in words)
    return round(
        206.835
        - 1.015 * (len(words) / len(sentences))
        - 84.6 * (syllables / len(words)),
        1,
    )


def _check_facts(text: str, prop: dict) -> dict:
    """Check that supplied facts appear, and that no un-supplied bed/bath count appears."""
    lower = text.lower()
    checks = {}

    if prop.get("price"):
        checks["price_present"] = prop["price"] in text
    if prop.get("location"):
        loc_first_part = prop["location"].split(",")[0].strip().lower()
        checks["location_present"] = loc_first_part in lower
    if prop.get("bedrooms"):
        checks["bedrooms_present"] = prop["bedrooms"] in text
    if prop.get("bathrooms"):
        checks["bathrooms_present"] = prop["bathrooms"] in text

    # No-invention check: any "<N> bed/bedroom" or "<N> bath/bathroom" mention
    # in the text must match the supplied count (if one was supplied).
    invented = False
    for n in re.findall(r"(\d+)\s*(?:-|\s)?bed(?:room)?s?\b", lower):
        if prop.get("bedrooms") and n != prop["bedrooms"]:
            invented = True
    for n in re.findall(r"(\d+)\s*(?:-|\s)?bath(?:room)?s?\b", lower):
        if prop.get("bathrooms") and n != prop["bathrooms"]:
            invented = True
    checks["no_invented_bed_bath_count"] = not invented

    return checks


def _evaluate_text(text: str, prop: dict, content_type: str) -> dict:
    words = _word_count(text)
    lo, hi = _LENGTH_WORD_RANGE[content_type]
    facts = _check_facts(text, prop)
    return {
        "word_count": words,
        "length_ok": lo <= words <= hi,
        "readability": _flesch_reading_ease(text),
        **facts,
        "facts_ok": all(facts.values()) if facts else True,
    }


def run_evaluation() -> list[dict]:
    rows: list[dict] = []
    length = "medium"

    for prop in SAMPLE_PROPERTIES:
        for content_type in _CONTENT_TYPES:
            request = GenerateRequest(
                title=prop["title"],
                price=prop.get("price", ""),
                location=prop["location"],
                bedrooms=prop.get("bedrooms", ""),
                bathrooms=prop.get("bathrooms", ""),
                parking=prop.get("parking", ""),
                land_size=prop.get("land_size", ""),
                interior_size=prop.get("interior_size", ""),
                features=prop.get("features", ""),
                content_type=content_type,
                tone="formal",
                length=length,
            )
            start = time.monotonic()
            bundle, model_used, generation_time_ms = generate_with_fallback(request)
            wall_ms = int((time.monotonic() - start) * 1000)
            text = getattr(bundle, content_type)
            evaluation = _evaluate_text(text, prop, content_type)

            rows.append({
                "property": prop["title"],
                "content_type": content_type,
                "model_used": model_used,
                "generation_time_ms": generation_time_ms,
                "wall_clock_ms": wall_ms,
                "word_count": evaluation["word_count"],
                "length_ok": evaluation["length_ok"],
                "readability_flesch": evaluation["readability"],
                "facts_ok": evaluation["facts_ok"],
            })
    return rows


def write_csv(rows: list[dict], path: Path = _OUTPUT_CSV) -> None:
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def print_summary(rows: list[dict]) -> None:
    by_path: dict[str, list[dict]] = {"template": [], "llm": []}
    for row in rows:
        key = "template" if row["model_used"] == "template" else "llm"
        by_path[key].append(row)

    print(f"\n{'Path':<10} {'N':>4} {'Facts OK':>10} {'Length OK':>10} {'Avg Readability':>16} {'Avg Time (ms)':>14}")
    for path_name, path_rows in by_path.items():
        if not path_rows:
            continue
        n = len(path_rows)
        facts_pct = 100 * sum(r["facts_ok"] for r in path_rows) / n
        length_pct = 100 * sum(r["length_ok"] for r in path_rows) / n
        avg_read = sum(r["readability_flesch"] for r in path_rows) / n
        avg_time = sum(r["generation_time_ms"] for r in path_rows) / n
        print(f"{path_name:<10} {n:>4} {facts_pct:>9.1f}% {length_pct:>9.1f}% {avg_read:>16.1f} {avg_time:>14.1f}")

    print(f"\nFull results written to {_OUTPUT_CSV}")


if __name__ == "__main__":
    print(f"USE_LLM={os.environ.get('USE_LLM', 'false')}  "
          f"LLM_BACKEND={os.environ.get('LLM_BACKEND', 'remote_http')}")
    results = run_evaluation()
    write_csv(results)
    print_summary(results)
