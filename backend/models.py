from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, field_validator


Tone = Literal["formal", "casual", "promotional", "luxury", "concise", "friendly"]
ContentType = Literal["listing", "social", "email", "video"]
Length = Literal["short", "medium", "long"]
ExportFormat = Literal["txt", "pdf", "docx"]


class GenerateRequest(BaseModel):
    # Property fields (snake_case; frontend API client converts from camelCase)
    title: str
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


class LibraryItem(BaseModel):
    id: int
    title: str
    location: str
    content_type: str
    tone: str
    preview: str
    created_at: str


class LibraryDetail(BaseModel):
    id: int
    title: str
    location: str
    content_type: str
    tone: str
    bundle: GeneratedBundle
    created_at: str


class ExportRequest(BaseModel):
    bundle: GeneratedBundle
    format: ExportFormat
    title: str = "Property Content Pack"
    tone: str = "formal"


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
