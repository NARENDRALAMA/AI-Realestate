from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, field_validator

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

_COUNT_FIELDS = ("bedrooms", "bathrooms")
_NUMBER = re.compile(r"^\d{1,2}(\.5)?$")


class GenerateRequest(BaseModel):
    # Property fields (snake_case; frontend API client converts from camelCase)
    title: str
    property_type: PropertyType = ""
    price: str = ""
    location: str
    address: str = ""
    bedrooms: str = ""
    bathrooms: str = ""
    parking: str = ""
    land_size: str = ""
    interior_size: str = ""
    features: str = ""
    amenities: str = ""
    agent_notes: str = ""
    image_path: str = ""

    # Content settings
    content_type: ContentType = "listing"
    tone: Tone = "formal"
    length: Length = "medium"
    keywords: str = ""
    platform: Platform = "instagram"

    # Only used by /api/generate/stream; /api/generate ignores them.
    extra_formats: list[ExtraFormat] = []
    variations: int = 1

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
    listing: str
    social: str
    email: str
    video: str


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
    title: str = ""
    property_type: str = ""
    price: str = ""
    location: str = ""
    address: str = ""
    bedrooms: str = ""
    bathrooms: str = ""
    parking: str = ""
    land_size: str = ""
    interior_size: str = ""
    features: str = ""
    amenities: str = ""
    agent_notes: str = ""
    image_path: str = ""


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
    extras: dict[str, str] = {}


class ExportRequest(BaseModel):
    bundle: GeneratedBundle
    format: ExportFormat
    title: str = "Property Content Pack"
    tone: str = "formal"
    # Optional extra formats (headlines, SMS, ...) appended after the four channels.
    extras: dict[str, str] = {}


class RefineRequest(BaseModel):
    content: str
    channel: ContentType
    tone: Tone
    length: Length = "medium"
    title: str = "Property"
    price: str = ""
    location: str = "this suburb"
    address: str = ""
    bedrooms: str = ""
    bathrooms: str = ""
    parking: str = ""
    land_size: str = ""
    interior_size: str = ""
    features: str = ""
    amenities: str = ""
    agent_notes: str = ""
    keywords: str = ""


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
    name: str
    email: str
    password: str

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
    email: str
    password: str

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
