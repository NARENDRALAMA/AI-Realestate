"""
Clean-up applied to model output before it's shown or saved.

  - Unsupported claims: a 7B model still adds things nobody told it ("modern
    appliances", "steps from cafes and shops") even when the prompt forbids it —
    and naming the forbidden words in the prompt makes it worse. So after
    generation, any clause that mentions one of UNSUPPORTED_TERMS which does not
    appear in the supplied facts is removed (the whole sentence if nothing useful
    is left).
  - Key facts: if the supplied price, bedrooms or bathrooms are missing from a
    channel, a short facts line is added so every channel states them.

  - Placeholder removal: instruct models often sign emails with "[Your Name]",
    "[Your Contact Information]" or greet "[Recipient's Name]". Those lines are
    removed (or the greeting made generic) so copy is usable as-is. Scene labels
    such as "[Scene 2 - Kitchen]" are kept.
  - Social character limits: posts are trimmed to the selected platform's limit
    at a sentence boundary, keeping the hashtag line when there's room.
"""
from __future__ import annotations

import re

from models import PLATFORM_CHAR_LIMITS, GenerateRequest

# Claims a model tends to invent about a property or its surroundings. A term is only
# removed when it isn't part of the supplied facts (e.g. "views" stays if the agent
# listed "city views").
UNSUPPORTED_TERMS = [
    "school", "transport", "train", "tram", "shop", "cafe", "café", "restaurant",
    "appliance", "landscap", "dishwasher", "air condition", "natural light",
    "storage", "ensuite", "balcony", "garden", "pool", "gym", "views", "beach",
]

NUMBER_WORDS = {
    "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
    "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
}

_FACT_FIELDS = (
    "title", "property_type", "price", "location", "address", "bedrooms", "bathrooms", "parking",
    "land_size", "interior_size", "features", "amenities", "agent_notes", "keywords",
)

_PLACEHOLDER = re.compile(r"\[(?!\s*scene\b)[^\]\n]{2,60}\]", re.IGNORECASE)
_GREETING = re.compile(r"^(dear|hi|hello|hey)\s+\[[^\]]+\]\s*([,!]?)", re.IGNORECASE | re.MULTILINE)


def remove_placeholders(text: str) -> str:
    text = _GREETING.sub(lambda m: f"{m.group(1)} there{m.group(2) or ','}", text)
    lines = []
    for line in text.split("\n"):
        stripped = _PLACEHOLDER.sub("", line)
        if line.strip() and not stripped.strip(" ,.-|:"):
            continue  # the whole line was a placeholder, e.g. "[Your Name]"
        lines.append(re.sub(r" {2,}", " ", stripped).rstrip() if _PLACEHOLDER.search(line) else line)
    cleaned = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def fit_char_limit(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    lines = text.rstrip().split("\n")
    hashtags = ""
    if lines and lines[-1].lstrip().startswith("#"):
        hashtags = lines.pop().strip()
    body = "\n".join(lines).rstrip()
    room = limit - (len(hashtags) + 2 if hashtags else 0)
    if room < limit // 2:  # hashtags would crowd out the post: drop them
        hashtags, room = "", limit
    if len(body) > room:
        cut = body[:room]
        end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "), cut.rfind("\n"))
        body = (cut[: end + 1] if end > room // 2 else cut[: cut.rfind(" ")] + "…").rstrip()
    return f"{body}\n\n{hashtags}" if hashtags else body


def supplied_text(request: GenerateRequest) -> str:
    return " ".join(str(getattr(request, f, "") or "") for f in _FACT_FIELDS).lower()


def unsupported_in(text: str, supplied: str) -> list[str]:
    lower = text.lower()
    return [t for t in UNSUPPORTED_TERMS if t in lower and t not in supplied]


_CLAUSE_SPLIT = re.compile(r"(,\s+|\s+[—–-]\s+|;\s+)")


def _trim_sentence(sentence: str, supplied: str) -> str:
    """Drop the clauses of one sentence that make unsupported claims."""
    if not unsupported_in(sentence, supplied):
        return sentence
    end = sentence.rstrip()[-1:] if sentence.rstrip()[-1:] in ".!?" else "."
    parts = _CLAUSE_SPLIT.split(sentence.rstrip().rstrip(".!?"))
    kept: list[str] = []
    dropped_since_last = False
    for i in range(0, len(parts), 2):
        clause = parts[i]
        if unsupported_in(clause, supplied):
            dropped_since_last = True
            continue
        if kept:
            # "A, <removed>, C" was a parenthetical: rejoin A and C with a space.
            kept.append(" " if dropped_since_last and parts[i - 1].strip() == "," else parts[i - 1])
        kept.append(clause)
        dropped_since_last = False
    result = "".join(kept).strip(" ,;—–-")
    if len(result.split()) < 3:
        return ""
    return result[0].upper() + result[1:] + end


def remove_unsupported_claims(text: str, request: GenerateRequest) -> str:
    supplied = supplied_text(request)
    out_lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.lower().startswith(("[scene", "subject:")):
            out_lines.append(line)
            continue
        sentences = re.split(r"(?<=[.!?])\s+", stripped)
        trimmed = [t for t in (_trim_sentence(s, supplied) for s in sentences) if t]
        if trimmed or not unsupported_in(stripped, supplied):
            out_lines.append(" ".join(trimmed) if trimmed else line)
    cleaned = "\n".join(out_lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def fact_present(text: str, value: str) -> bool:
    """True if a count (digits or spelled out, e.g. 3 / three) or a price appears in text."""
    lower = text.lower()
    if value.isdigit():
        word = NUMBER_WORDS.get(value, value)
        return bool(re.search(rf"\b({re.escape(value)}|{word})\b", lower))
    return value.lower() in lower


def ensure_key_facts(channel: str, text: str, request: GenerateRequest) -> str:
    """Add the supplied price / bedrooms / bathrooms if the model left any out."""
    missing = [
        (field, getattr(request, field))
        for field in ("bedrooms", "bathrooms", "price")
        if getattr(request, field) and not fact_present(text, getattr(request, field))
    ]
    if not missing:
        return text
    parts = []
    if request.bedrooms:
        parts.append(f"{request.bedrooms} bed")
    if request.bathrooms:
        parts.append(f"{request.bathrooms} bath")
    if request.price:
        parts.append(request.price)
    line = " · ".join(parts)
    paragraphs = text.rstrip().split("\n\n")
    if channel == "social" and paragraphs[-1].lstrip().startswith("#"):
        paragraphs.insert(len(paragraphs) - 1, line)
    elif channel in ("email", "video") and len(paragraphs) > 1:
        paragraphs.insert(len(paragraphs) - 1, f"Key details: {line}.")
    else:
        paragraphs.append(f"Key details: {line}.")
    return "\n\n".join(paragraphs)


def clean_channel(channel: str, text: str, request: GenerateRequest) -> str:
    text = remove_placeholders(text)
    text = remove_unsupported_claims(text, request)
    text = ensure_key_facts(channel, text, request)
    if channel == "social":
        text = fit_char_limit(text, PLATFORM_CHAR_LIMITS.get(request.platform, 2200))
    return text
