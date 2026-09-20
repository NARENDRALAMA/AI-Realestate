"""
Prompt Engineering Module.

One LangChain PromptTemplate per content type (listing, social, email, video).
Every prompt is assembled the same way: list out the property's validated
fields as plain facts, then instruct the model to use ONLY those facts and
never invent a bedroom count, a price, a feature, or a location that wasn't
given. This grounding instruction is the main defence against hallucination —
these are open-source instruct models with no real-world knowledge of the
actual property, so they must be told explicitly not to make things up.

The orchestrator (backend/orchestrator.py) calls build_prompt() once per
channel and sends the result straight to the configured AI backend.
"""
from __future__ import annotations

from langchain_core.prompts import PromptTemplate

from models import GenerateRequest

_GROUNDING_RULES = (
    "Rules:\n"
    "- Use ONLY the facts listed below. Do not invent or guess any detail that "
    "is not explicitly given — this includes bedrooms, bathrooms, price, sizes, "
    "features, amenities, and location.\n"
    "- If a fact is missing from the list, simply omit it. Never make one up.\n"
    "- Do not add disclaimers, meta-commentary, or notes about what you did.\n"
    "- Output only the marketing copy itself, nothing else."
)

_TONE_GUIDANCE: dict[str, str] = {
    "formal": "a formal, professional real estate tone",
    "casual": "a relaxed, casual, conversational tone",
    "promotional": "an energetic, urgent, promotional tone",
    "luxury": "a refined, prestige, luxury real estate tone",
    "concise": "a short, plain, no-frills tone",
    "friendly": "a warm, friendly, welcoming tone",
}

# Roughly matches the word counts the template engine already targets per length.
_LENGTH_WORDS: dict[str, str] = {
    "short": "60-90 words",
    "medium": "120-180 words",
    "long": "220-320 words",
}

_TEMPLATES: dict[str, PromptTemplate] = {
    "listing": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write a real estate LISTING DESCRIPTION in {tone_guidance}, {length_words} long.\n\n"
        "Property facts:\n{facts}\n\nListing description:"
    ),
    "social": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write a SOCIAL MEDIA POST advertising this property in {tone_guidance}, "
        "{length_words} long, suitable for Instagram/Facebook, including a few "
        "relevant hashtags.\n\n"
        "Property facts:\n{facts}\n\nSocial media post:"
    ),
    "email": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write a MARKETING EMAIL for this property in {tone_guidance}, "
        "{length_words} long. Include a subject line, a greeting, the body, "
        "and a sign-off.\n\n"
        "Property facts:\n{facts}\n\nEmail:"
    ),
    "video": PromptTemplate.from_template(
        "{grounding}\n\n"
        "Write a VIDEO WALKTHROUGH SCRIPT for this property in {tone_guidance}, "
        "{length_words} long, broken into labelled scenes "
        "(e.g. [Scene 1 - Introduction]).\n\n"
        "Property facts:\n{facts}\n\nVideo script:"
    ),
}

# Fields listed in the facts block, in a sensible reading order.
_FACT_FIELDS: list[tuple[str, str]] = [
    ("title", "Title"),
    ("price", "Price"),
    ("location", "Location"),
    ("address", "Address"),
    ("bedrooms", "Bedrooms"),
    ("bathrooms", "Bathrooms"),
    ("parking", "Parking"),
    ("land_size", "Land size"),
    ("interior_size", "Interior size"),
    ("features", "Features"),
    ("amenities", "Amenities"),
    ("agent_notes", "Agent notes"),
    ("keywords", "Keywords to emphasise"),
]


def _facts_block(request: GenerateRequest) -> str:
    """Turn the validated request fields into a plain bullet list of facts."""
    lines = [
        f"- {label}: {value}"
        for field, label in _FACT_FIELDS
        if (value := getattr(request, field))
    ]
    return "\n".join(lines) if lines else "- (no additional details supplied)"


def build_prompt(content_type: str, request: GenerateRequest) -> str:
    """Build the final prompt string for one content type from a validated request."""
    template = _TEMPLATES[content_type]
    return template.format(
        grounding=_GROUNDING_RULES,
        tone_guidance=_TONE_GUIDANCE[request.tone],
        length_words=_LENGTH_WORDS[request.length],
        facts=_facts_block(request),
    )
