"""
Tests for the evaluation checks in backend/evaluate.py — the scoring logic
itself, not a full run of run_evaluation() (which is exercised manually /
in the report; that's an integration script, not a unit-testable function
in the usual sense since it depends on the configured AI backend).
"""
import evaluate


def test_word_count():
    assert evaluate._word_count("one two three") == 3


def test_flesch_reading_ease_simple_text_scores_high():
    easy = "The cat sat. The dog ran. I like cats."
    score = evaluate._flesch_reading_ease(easy)
    assert score > 60  # short sentences, short words -> easy to read


def test_flesch_reading_ease_empty_text_is_zero():
    assert evaluate._flesch_reading_ease("") == 0.0


def test_facts_check_detects_present_facts():
    prop = {"price": "$500,000", "location": "Testville, VIC", "bedrooms": "3", "bathrooms": "2"}
    text = "This home in Testville has 3 bedrooms, 2 bathrooms, priced at $500,000."
    checks = evaluate._check_facts(text, prop)
    assert checks["price_present"] is True
    assert checks["location_present"] is True
    assert checks["bedrooms_present"] is True
    assert checks["bathrooms_present"] is True
    assert checks["no_invented_bed_bath_count"] is True


def test_facts_check_detects_missing_price():
    prop = {"price": "$500,000", "location": "Testville, VIC"}
    text = "This lovely home in Testville is available now."
    checks = evaluate._check_facts(text, prop)
    assert checks["price_present"] is False


def test_facts_check_detects_invented_bedroom_count():
    prop = {"bedrooms": "3"}
    text = "This stunning 5 bedroom home is a must-see."
    checks = evaluate._check_facts(text, prop)
    assert checks["no_invented_bed_bath_count"] is False


def test_facts_check_does_not_flag_correct_count_mentioned_twice():
    prop = {"bedrooms": "3"}
    text = "A 3 bedroom home. Yes, 3 bedrooms in total."
    checks = evaluate._check_facts(text, prop)
    assert checks["no_invented_bed_bath_count"] is True


def test_evaluate_text_flags_out_of_range_length():
    prop = {}
    short_text = "Too short."
    result = evaluate._evaluate_text(short_text, prop, "listing")
    assert result["length_ok"] is False


def test_evaluate_text_passes_facts_ok_when_no_facts_supplied():
    # No price/location/bedrooms/bathrooms supplied -> nothing to check -> vacuously true.
    result = evaluate._evaluate_text("Any text at all here.", {}, "social")
    assert result["facts_ok"] is True
