"""
Extra content formats generated alongside the four core channels.

Each format has a grounded LLM prompt (same fact block and rules as prompts.py) and a
deterministic template fallback, so a run always returns every requested format even
when the model is unavailable.
"""
from __future__ import annotations

from langchain_core.prompts import PromptTemplate

from models import GenerateRequest
from prompts import _GROUNDING_RULES, _TONE_GUIDANCE, _facts_block

EXTRA_LABELS: dict[str, str] = {
    "headlines": "Headline options",
    "facebook_ad": "Facebook ad",
    "sms": "SMS / text blast",
    "flyer": "Open-home flyer",
    "seo": "SEO title & description",
}

_EXTRA_TEMPLATES: dict[str, PromptTemplate] = {
    "headlines": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write FIVE alternative listing HEADLINES for this property in {tone_guidance}. "
        "Each headline must be under 12 words. Number them 1 to 5, one per line.\n\n"
        "Property facts:\n{facts}\n\nHeadlines:"
    ),
    "facebook_ad": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write a FACEBOOK AD for this property in {tone_guidance}. Use exactly these "
        "labelled parts: 'Primary text:' (under 90 words), 'Headline:' (under 8 words), "
        "'Description:' (under 15 words) and 'Call to action:' (2-4 words).\n\n"
        "Property facts:\n{facts}\n\nFacebook ad:"
    ),
    "sms": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write ONE SMS text message announcing this property in {tone_guidance}. It must be "
        "under 160 characters and end with a short call to action. No hashtags or emojis.\n\n"
        "Property facts:\n{facts}\n\nSMS:"
    ),
    "flyer": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write the copy for a one-page OPEN-HOME FLYER for this property in {tone_guidance}: "
        "a headline, a two-sentence introduction, 4 to 6 short bullet points, and a closing "
        "line inviting people to inspect.\n\n"
        "Property facts:\n{facts}\n\nFlyer copy:"
    ),
    "seo": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write search-engine metadata for this property's listing web page. Use exactly two "
        "labelled lines: 'Title:' (under 60 characters) and 'Description:' (under 155 "
        "characters). Write in {tone_guidance}.\n\n"
        "Property facts:\n{facts}\n\nSEO metadata:"
    ),
}

# Output budgets per length (tokens), so longer requests aren't cut off mid-sentence.
_MAX_TOKENS: dict[str, int] = {"short": 250, "medium": 420, "long": 650, "extended": 950}
_EXTRA_MAX_TOKENS: dict[str, int] = {"headlines": 160, "facebook_ad": 260, "sms": 80, "flyer": 380, "seo": 120}


def max_tokens_for(length: str) -> int:
    return _MAX_TOKENS.get(length, 420)


def max_tokens_for_extra(fmt: str) -> int:
    return _EXTRA_MAX_TOKENS.get(fmt, 300)


def build_extra_prompt(fmt: str, request: GenerateRequest) -> str:
    return _EXTRA_TEMPLATES[fmt].format(
        grounding=_GROUNDING_RULES,
        tone_guidance=_TONE_GUIDANCE[request.tone],
        facts=_facts_block(request),
    )


# ─── template fallbacks ───────────────────────────────────────────────────────


def _specs(p: GenerateRequest) -> str:
    parts = []
    if p.bedrooms:
        parts.append(f"{p.bedrooms} bed")
    if p.bathrooms:
        parts.append(f"{p.bathrooms} bath")
    if p.parking:
        parts.append(f"{p.parking} car")
    return " · ".join(parts)


def _features(p: GenerateRequest, limit: int) -> list[str]:
    items = [f.strip().rstrip(".") for f in p.features.replace("\n", ",").split(",")]
    return [f[0].upper() + f[1:] for f in items if f][:limit]


def template_extra(fmt: str, p: GenerateRequest) -> str:
    """Deterministic copy for an extra format, built only from the request's fields."""
    title, location = p.title, p.location
    specs = _specs(p)
    price = p.price
    features = _features(p, 6)

    if fmt == "headlines":
        lead = features[0] if features else "Move-in ready"
        options = [
            f"{title} — {location}",
            f"{lead} in {location}" if features else f"Now available in {location}",
            f"{specs} in {location}" if specs else f"A home to remember in {location}",
            f"{title}{f' · {price}' if price else ''}",
            f"Inspect {title} this week",
        ]
        return "\n".join(f"{i}. {h}" for i, h in enumerate(options, 1))

    if fmt == "facebook_ad":
        highlights = ", ".join(f.lower() for f in features[:3])
        primary = f"{title} in {location}."
        if specs:
            primary += f" {specs}."
        if highlights:
            primary += f" Highlights include {highlights}."
        if price:
            primary += f" {price}."
        return (
            f"Primary text: {primary} Book a private inspection today.\n"
            f"Headline: {title}\n"
            f"Description: {specs + ' in ' if specs else ''}{location}\n"
            f"Call to action: Book inspection"
        )

    if fmt == "sms":
        msg = f"New listing: {title}, {location}"
        if specs:
            msg += f". {specs}"
        if price:
            msg += f". {price}"
        msg += ". Reply YES to book a viewing."
        if len(msg) > 160:
            msg = f"New listing: {title}, {location}. Reply YES to book a viewing."
        return msg[:160]

    if fmt == "flyer":
        bullets = [f"• {f}" for f in features] or ["• Contact us for full details"]
        if specs:
            bullets.insert(0, f"• {specs}")
        intro = f"Welcome to {title} in {location}."
        if p.interior_size:
            intro += f" Around {p.interior_size} of interior living"
            intro += f" on {p.land_size} of land." if p.land_size else "."
        closing = p.agent_notes.strip() or "Inspect by appointment — call us to arrange a time."
        return "\n".join(
            [f"OPEN HOME — {title.upper()}", "", intro, "", *bullets[:7], "", closing]
        )

    if fmt == "seo":
        seo_title = f"{title} | {location}"
        if len(seo_title) > 60:
            seo_title = title[:57].rstrip() + "…"
        desc = f"{title} in {location}."
        if specs:
            desc += f" {specs}."
        if features:
            desc += f" {features[0]}."
        desc += " Book an inspection today."
        if len(desc) > 155:
            desc = desc[:152].rstrip() + "…"
        return f"Title: {seo_title}\nDescription: {desc}"

    raise ValueError(f"unknown extra format: {fmt}")
