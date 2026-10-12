"""Regression tests for the audit findings: template price/claims, placeholder
clean-up, social character limits, PDF emoji, shortening, and per-channel sources."""

import io

import pytest

import orchestrator
from ai_service.interface import AIBackend, AIBackendError
from export_utils import build_pdf
from generator import generate_bundle, refine_shorten
from models import PLATFORM_CHAR_LIMITS, GeneratedBundle, GenerateRequest, RefineRequest
from postprocess import clean_channel, fit_char_limit, remove_placeholders


def _req(**kw):
    base = dict(
        title="Test House",
        location="Ryde, NSW",
        price="$900,000",
        bedrooms="3",
        bathrooms="2",
        features="pool, deck, solar panels",
    )
    return GenerateRequest(**{**base, **kw})


@pytest.mark.parametrize("length", ["short", "medium", "long", "extended"])
def test_template_listing_includes_price_at_every_length(length):
    for _ in range(10):  # hooks are random; the price must not depend on them
        assert "$900,000" in generate_bundle(_req(length=length)).listing


def test_template_absent_price_not_invented():
    bundle = generate_bundle(_req(price=""))
    assert "$" not in bundle.listing and "$" not in bundle.email


@pytest.mark.parametrize("tone", ["formal", "casual", "promotional", "luxury", "concise", "friendly"])
def test_templates_make_no_unsupplied_neighbourhood_or_room_claims(tone):
    for length in ("short", "medium", "long"):
        text = " ".join(generate_bundle(_req(tone=tone, length=length)).model_dump().values()).lower()
        for claim in ("school", "transport", "cafe", "kitchen", "alfresco", "natural light", "significant interest"):
            assert claim not in text, (tone, length, claim)


def test_sparse_input_has_no_filler_values():
    bundle = generate_bundle(GenerateRequest(title="T", location="Ryde", length="medium"))
    text = " ".join(bundle.model_dump().values())
    assert "—BR" not in text and " bed · " not in text and "None" not in text and "  bedrooms" not in text


def test_placeholders_removed_but_scene_labels_kept():
    email = (
        "Subject: Hi\n\nDear [Recipient's Name],\n\nGreat home.\n\n"
        "Warm regards,\n[Your Name]\n[Your Contact Information]"
    )
    cleaned = remove_placeholders(email)
    assert "[" not in cleaned and cleaned.startswith("Subject: Hi") and "Dear there," in cleaned
    assert "Warm regards," in cleaned
    video = "[Scene 1 - Intro]\nWelcome.\n\n[Scene 2 - Kitchen]\nCall [Agent Name] today."
    assert remove_placeholders(video) == "[Scene 1 - Intro]\nWelcome.\n\n[Scene 2 - Kitchen]\nCall today."


@pytest.mark.parametrize("platform", ["facebook", "linkedin", "instagram"])
def test_social_posts_fit_platform_limit(platform):
    long_post = ("A lovely sentence about this home. " * 120) + "\n\n#One #Two #Three"
    out = clean_channel("social", long_post, platform)
    assert len(out) <= PLATFORM_CHAR_LIMITS[platform]
    assert out.endswith("#One #Two #Three")
    assert len(generate_bundle(_req(platform=platform, length="extended")).social) <= PLATFORM_CHAR_LIMITS[platform]


def test_fit_char_limit_leaves_short_text_alone():
    assert fit_char_limit("short post\n\n#tag", 500) == "short post\n\n#tag"


def test_pdf_has_no_emoji_boxes():
    from pypdf import PdfReader  # noqa: F401  (dev dependency)

    bundle = GeneratedBundle(
        listing="Lovely 🏡 home ✨", social="🔥 Just listed! ✓ pool", email="Hi 👋", video="[Scene 1]\n🎬"
    )
    text = " ".join(p.extract_text() for p in PdfReader(io.BytesIO(build_pdf(bundle, "T", "casual"))).pages)
    assert "■" not in text and "Lovely home" in text and "✓ pool" in text


def test_shorten_keeps_paragraphs_and_whole_sentences():
    content = "First sentence here. Second one too.\n\nThird paragraph sentence. Fourth.\n\nFifth paragraph is here."
    out = refine_shorten(RefineRequest(content=content, channel="email", tone="casual"))
    assert out.startswith("First sentence here.") and "\n\n" in out and len(out.split()) < len(content.split())


class _PartlyFailing(AIBackend):
    model_name = "stub"

    def generate(self, prompt: str, max_new_tokens: int = 400) -> str:
        if "EMAIL" in prompt:
            raise AIBackendError("boom")
        return "Model copy. Regards,\n[Your Name]"


def test_channel_sources_record_which_channels_fell_back(monkeypatch):
    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setattr(orchestrator, "get_backend", lambda: _PartlyFailing())
    bundle, model_used, _ms, sources = orchestrator.generate_with_sources(_req())
    assert model_used == "stub (partial)"
    assert sources == {"listing": "ai", "social": "ai", "email": "template", "video": "ai"}
    assert "[Your Name]" not in bundle.listing  # model output is cleaned
