from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

Tone = Literal["formal", "casual", "promotional", "luxury", "concise", "friendly"]
ContentType = Literal["listing", "social", "email", "video"]
Length = Literal["short", "medium", "long", "extended"]
# Extra formats generated alongside the four core channels (streaming endpoint only).
ExtraFormat = Literal["headlines", "facebook_ad", "sms", "flyer", "seo"]
ExportFormat = Literal["txt", "pdf", "docx"]
Platform = Literal["instagram", "facebook", "linkedin"]
PropertyType = Literal["", "house", "apartment", "townhouse", "unit", "villa", "land", "acreage", "other"]
ChannelSource = Literal["ai", "template"]

# Character limits we target per social platform (the post body including hashtags).
# Instagram and LinkedIn allow far more, but posts are cut off ("...more") around these
# lengths, so we keep generated posts inside them.
PLATFORM_CHAR_LIMITS: dict[str, int] = {
    "instagram": 2200,
    "facebook": 500,
    "linkedin": 1300,
}

# Input length limits. Every free-text field is capped so a single request can't
# send megabytes into the prompt, the database or the PDF/DOCX builders.
Tiny = Annotated[str, Field(max_length=50)]        # price, sizes, counts
Short = Annotated[str, Field(max_length=200)]      # title, location, keywords
Medium = Annotated[str, Field(max_length=500)]     # address, image path
Long = Annotated[str, Field(max_length=2000)]      # features, amenities, notes
Content = Annotated[str, Field(max_length=20000)]  # generated / edited copy
ExtrasMap = Annotated[dict[Short, Content], Field(max_length=20)]

# Free-text fields go into the LLM prompt, so they are checked for prompt-injection
# attempts (OWASP LLM01) and links (phishing via generated copy). This is a heuristic
# first line of defence; the prompt rules and the output guard in postprocess.py
# back it up.
_FREE_TEXT_FIELDS = (
    "title", "location", "address", "features", "amenities", "agent_notes", "keywords",
)
_URL_IN_INPUT = re.compile(
    r"(https?://|www\.)\S"
    r"|\b[\w.-]+\.(com|net|org|io|xyz|ru|info|biz|example)(/|\b)",
    re.I,
)
_INJECTION = re.compile(
    r"\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,60}\b(instructions?|rules?|prompts?|directions?|guidelines)\b"
    r"|\b(ignore|disregard|forget)\s+(all|everything|the)\s+(above|previous|prior|earlier)"
    r"|\b(system|hidden|initial|original)\s+prompt\b"
    r"|\b(repeat|reveal|print|show|output|tell me)\b[^.\n]{0,40}\b(your|the)\s+(rules|instructions|prompt)\b"
    r"|\bnote\s+to\s+(the\s+)?(ai|assistant|model|llm|chatbot|gpt)\b"
    r"|\b(you are now|act as an?|pretend to be|from now on,? you)\b"
    r"|\bnew (task|instructions?|role)\b"
    r"|\binstead of (an?|the|this) (advert|ad|listing|post|email|script|copy)\b"
    r"|\bwrite (a|an) (poem|story|song|essay|joke|limerick)\b"
    r"|\bdescribe (it|the property|the home|the house|this) as (a|an)\b"
    r"|\b(everything|all) (you were|you've been|you have been|you are) (told|given)\b"
    r"|\b(also\s+)?(say|claim|state|write|mention)\s+(that\s+)?(the\s+)?"
    r"(property|home|house|apartment|it)\s+(has|is|includes|comes with)\b",
    re.I,
)


def check_free_text(value: str) -> str:
    """Reject links and instruction-like text in a field that is sent to the model."""
    if _URL_IN_INPUT.search(value):
        raise ValueError("web links aren't allowed in property details")
    if _INJECTION.search(value):
        raise ValueError("property details can't contain instructions to the AI")
    return value


_COUNT_FIELDS = ("bedrooms", "bathrooms")
_NUMBER = re.compile(r"^\d{1,2}(\.5)?$")


class GenerateRequest(BaseModel):
    # Property fields (snake_case; frontend API client converts from camelCase)
    title: Short
    property_type: PropertyType = ""
    price: Tiny = ""
    location: Short
    address: Medium = ""
    bedrooms: Tiny = ""
    bathrooms: Tiny = ""
    parking: Tiny = ""
    land_size: Tiny = ""
    interior_size: Tiny = ""
    features: Long = ""
    amenities: Long = ""
    agent_notes: Long = ""
    image_path: Medium = ""

    # Content settings
    content_type: ContentType = "listing"
    tone: Tone = "formal"
    length: Length = "medium"
    keywords: Short = ""
    platform: Platform = "instagram"

    # Only used by /api/generate/stream; /api/generate ignores them.
    extra_formats: list[ExtraFormat] = []
    variations: int = 1

    @field_validator(*_FREE_TEXT_FIELDS)
    @classmethod
    def no_prompt_injection(cls, v: str) -> str:
        return check_free_text(v)

    @field_validator("variations")
    @classmethod
    def variations_in_range(cls, v: int) -> int:
        if not 1 <= v <= 3:
            raise ValueError("variations must be between 1 and 3")
        return v

    @field_validator("bedrooms", "bathrooms")
    @classmethod
    def count_is_number(cls, v: str) -> str:
        v = v.strip()
        if v and not _NUMBER.match(v):
            raise ValueError("must be a whole number (or .5), for example 3")
        return v

    @field_validator("price")
    @classmethod
    def price_not_negative(cls, v: str) -> str:
        v = v.strip()
        if v.startswith("-") or re.match(r"^\$?\s*-", v):
            raise ValueError("price can't be negative")
        return v

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title is required")
        return v.strip()

    @field_validator("location")
    @classmethod
    def location_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("location is required")
        return v.strip()


class GeneratedBundle(BaseModel):
    listing: Content
    social: Content
    email: Content
    video: Content


class GenerateResponse(BaseModel):
    id: int
    bundle: GeneratedBundle
    model_used: str
    generation_time_ms: int
    # Which engine wrote each channel: "ai" or "template" (fallback).
    channel_sources: dict[str, ChannelSource] = {}


class LibraryItem(BaseModel):
    id: int
    title: str
    location: str
    content_type: str
    tone: str
    preview: str
    model_used: str
    generation_time_ms: int
    created_at: str


class PropertyFacts(BaseModel):
    """The property details a record was generated from, so it can be reopened and
    regenerated with the same facts."""
    title: Short = ""
    property_type: Tiny = ""
    price: Tiny = ""
    location: Short = ""
    address: Medium = ""
    bedrooms: Tiny = ""
    bathrooms: Tiny = ""
    parking: Tiny = ""
    land_size: Tiny = ""
    interior_size: Tiny = ""
    features: Long = ""
    amenities: Long = ""
    agent_notes: Long = ""
    image_path: Medium = ""


class LibraryDetail(BaseModel):
    id: int
    title: str
    location: str
    content_type: str
    tone: str
    length: str = "medium"
    platform: str = "instagram"
    keywords: str = ""
    property: PropertyFacts = PropertyFacts()
    bundle: GeneratedBundle
    model_used: str
    generation_time_ms: int
    channel_sources: dict[str, str] = {}
    created_at: str
    updated_at: str = ""
    # Present for runs made through /api/generate/stream with extras or variations.
    extras: dict[str, str] = {}
    variants: dict[str, list[str]] = {}


class LibraryUpdate(BaseModel):
    """Edited copy saved back to a library record from the review step."""
    bundle: GeneratedBundle
    extras: ExtrasMap = {}


class ExportRequest(BaseModel):
    bundle: GeneratedBundle
    format: ExportFormat
    title: Short = "Property Content Pack"
    tone: Tiny = "formal"
    # Optional extra formats (headlines, SMS, ...) appended after the four channels.
    extras: ExtrasMap = {}


class RefineRequest(BaseModel):
    content: Content
    channel: ContentType
    tone: Tone
    length: Length = "medium"
    title: Short = "Property"
    price: Tiny = ""
    location: Short = "this suburb"
    address: Medium = ""
    bedrooms: Tiny = ""
    bathrooms: Tiny = ""
    parking: Tiny = ""
    land_size: Tiny = ""
    interior_size: Tiny = ""
    features: Long = ""
    amenities: Long = ""
    agent_notes: Long = ""
    keywords: Short = ""

    @field_validator(*_FREE_TEXT_FIELDS)
    @classmethod
    def no_prompt_injection(cls, v: str) -> str:
        return check_free_text(v)


class RefineResponse(BaseModel):
    refined: str


class RecentActivityItem(BaseModel):
    title: str
    content_type: str
    tone: str
    created_at: str


class StatsResponse(BaseModel):
    total: int
    this_week: int
    by_type: dict[str, int]
    by_tone: dict[str, int]
    recent: list[RecentActivityItem]


# ─── auth ─────────────────────────────────────────────────────────────────────

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    name: Annotated[str, Field(max_length=100)]
    email: Annotated[str, Field(max_length=254)]
    password: Annotated[str, Field(max_length=128)]

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_long_enough(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: Annotated[str, Field(max_length=254)]
    password: Annotated[str, Field(max_length=128)]

    @field_validator("email")
    @classmethod
    def email_lower(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut
