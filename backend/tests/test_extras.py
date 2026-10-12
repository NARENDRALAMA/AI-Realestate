"""Tests for extra formats (backend/extras.py) and extras in exports."""
import pytest

import export_utils
from extras import EXTRA_LABELS, build_extra_prompt, template_extra
from models import GeneratedBundle, GenerateRequest


def _request(**overrides) -> GenerateRequest:
    defaults = dict(
        title="Sunlit Terrace", location="Richmond, VIC", price="$1,250,000", bedrooms="3",
        bathrooms="2", parking="2", land_size="320 m²", interior_size="142 m²",
        features="North-facing living, oak floors, SMEG kitchen", tone="formal",
    )
    defaults.update(overrides)
    return GenerateRequest(**defaults)


@pytest.mark.parametrize("fmt", list(EXTRA_LABELS))
def test_every_format_has_grounded_prompt_and_template(fmt):
    req = _request()
    prompt = build_extra_prompt(fmt, req)
    assert "Use ONLY the facts" in prompt
    assert "Richmond, VIC" in prompt
    assert template_extra(fmt, req).strip()


def test_templates_use_only_supplied_facts():
    req = _request(price="", features="")
    for fmt in EXTRA_LABELS:
        text = template_extra(fmt, req)
        assert "$" not in text  # no invented price when none was given


def test_sms_fits_one_message_even_with_long_title():
    assert len(template_extra("sms", _request(title="A" * 200))) <= 160


def test_seo_respects_length_limits():
    title_line, desc_line = template_extra("seo", _request(title="Very long title " * 10)).split("\n")
    assert len(title_line.removeprefix("Title: ")) <= 60
    assert len(desc_line.removeprefix("Description: ")) <= 155


def test_headlines_are_five_numbered_lines():
    lines = template_extra("headlines", _request()).split("\n")
    assert len(lines) == 5 and lines[0].startswith("1. ")


def test_export_includes_extras_after_channels():
    bundle = GeneratedBundle(listing="L", social="S", email="E", video="V")
    txt = export_utils.build_txt(bundle, "Title", "formal", {"sms": "Text me"}).decode()
    assert txt.index("## Listing Description") < txt.index("## SMS / text blast")
    assert "Text me" in txt
    assert export_utils.build_pdf(bundle, "Title", "formal", {"sms": "Text me"})[:4] == b"%PDF"
    assert export_utils.build_docx(bundle, "Title", "formal", {"seo": "Title: x"})[:2] == b"PK"


def test_export_without_extras_is_unchanged():
    bundle = GeneratedBundle(listing="L", social="S", email="E", video="V")
    assert "SMS" not in export_utils.build_txt(bundle, "Title", "formal").decode()
