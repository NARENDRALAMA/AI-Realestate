"""
Clean-up applied to model output before it's shown or saved.

  - Placeholder removal: instruct models often sign emails with "[Your Name]",
    "[Your Contact Information]" or greet "[Recipient's Name]". Those lines are
    removed (or the greeting made generic) so copy is usable as-is. Scene labels
    such as "[Scene 2 - Kitchen]" are kept.
  - Social character limits: posts are trimmed to the selected platform's limit
    at a sentence boundary, keeping the hashtag line when there's room.
"""
from __future__ import annotations

import re

from models import PLATFORM_CHAR_LIMITS

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


def clean_channel(channel: str, text: str, platform: str = "instagram") -> str:
    text = remove_placeholders(text)
    if channel == "social":
        text = fit_char_limit(text, PLATFORM_CHAR_LIMITS.get(platform, 2200))
    return text
