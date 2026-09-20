"""
Tests for the prompt engineering module (backend/prompts.py).

These check the grounding contract that everything else depends on: the
prompt must state the "don't invent facts" rule, include exactly the facts
that were supplied, and never mention a fact that wasn't supplied.
"""
from models import GenerateRequest
from prompts import build_prompt

CONTENT_TYPES = ["listing", "social", "email", "video"]


def _request(**overrides) -> GenerateRequest:
    defaults = dict(
        title="Test House",
        location="Testville",
        tone="formal",
        length="medium",
        content_type="listing",
    )
    defaults.update(overrides)
    return GenerateRequest(**defaults)


def test_all_content_types_build_a_prompt():
    request = _request(bedrooms="3", bathrooms="2", price="$500,000")
    for content_type in CONTENT_TYPES:
        prompt = build_prompt(content_type, request)
        assert isinstance(prompt, str)
        assert len(prompt) > 0


def test_prompt_states_grounding_rule():
    request = _request()
    prompt = build_prompt("listing", request)
    assert "use only the facts" in prompt.lower()
    assert "do not invent" in prompt.lower() or "never make one up" in prompt.lower()


def test_prompt_includes_every_supplied_fact():
    request = _request(
        bedrooms="4",
        bathrooms="3",
        price="$999,000",
        features="Pool, solar panels",
    )
    prompt = build_prompt("listing", request)
    assert "Bedrooms: 4" in prompt
    assert "Bathrooms: 3" in prompt
    assert "Price: $999,000" in prompt
    assert "Features: Pool, solar panels" in prompt


def test_prompt_omits_fields_that_were_not_supplied():
    # No bedrooms/bathrooms/price given at all.
    request = _request()
    prompt = build_prompt("listing", request)
    assert "Bedrooms:" not in prompt
    assert "Bathrooms:" not in prompt
    assert "Price:" not in prompt


def test_each_content_type_gets_a_distinct_instruction():
    request = _request()
    prompts = {ct: build_prompt(ct, request) for ct in CONTENT_TYPES}
    assert "LISTING DESCRIPTION" in prompts["listing"]
    assert "SOCIAL MEDIA POST" in prompts["social"]
    assert "hashtags" in prompts["social"].lower()
    assert "EMAIL" in prompts["email"]
    assert "subject line" in prompts["email"].lower()
    assert "VIDEO WALKTHROUGH SCRIPT" in prompts["video"]
    assert "Scene 1" in prompts["video"]


def test_tone_and_length_are_reflected_in_the_prompt():
    request = _request(tone="luxury", length="short")
    prompt = build_prompt("listing", request)
    assert "luxury" in prompt.lower()
    assert "60-90 words" in prompt
