"""
Template-based real estate content generator.

Produces listing, social, email, and video content from structured property
data. Tone controls vocabulary and sentence style; length controls depth.
No LLM dependency — all content is built from deterministic templates.
"""
from __future__ import annotations

import random
import re
import re as _re

from models import GeneratedBundle, GenerateRequest, RefineRequest

# ─── tone definitions ─────────────────────────────────────────────────────────

_TONES: dict[str, dict] = {
    "formal": {
        "hooks": [
            "We are pleased to present {title}, an outstanding property in {location}.",
            "It is our pleasure to introduce {title}, a refined and well-appointed residence in {location}.",
            "We invite discerning purchasers to consider {title}, positioned in {location}.",
        ],
        "feature_intro": "This distinguished residence offers the following:",
        "lifestyle": "Set in {location}, this residence presents a considered opportunity for discerning purchasers.",
        "cta_listing": (
            "We invite qualified purchasers to arrange a private and confidential "
            "inspection at their earliest convenience."
        ),
        "cta_email": (
            "Please do not hesitate to contact our office to arrange a viewing "
            "at a time that suits you."
        ),
        "cta_video": (
            "For further information or to arrange a private inspection, "
            "please contact our office."
        ),
        "email_greeting": "Dear Client,",
        "sign_off": "Kind regards,\nYour Property Marketing Desk",
        "email_subject_prefix": "Property Opportunity:",
        "social_opener": "Now available: {title}, {location}.",
        "urgency": "We encourage prompt enquiry to avoid disappointment.",
        "adj": ["distinguished", "refined", "exceptional", "premier", "well-appointed", "immaculate"],
        "video_intro": "Welcome. Today we present {title}, a refined property in {location}.",
        "hashtags": ["#RealEstate", "#PropertyForSale", "#HomeForSale", "#Investment", "#OpenHome"],
    },
    "casual": {
        "hooks": [
            "You're going to love {title} in {location}!",
            "Meet your next home — {title} is now available in {location}.",
            "Been searching in {location}? {title} might just be the one.",
        ],
        "feature_intro": "Here's what this place brings to the table:",
        "lifestyle": "If you've had your eye on {location}, this one's well worth a look.",
        "cta_listing": "Message us to book a walk-through — we'd love to show you around!",
        "cta_email": "Flick us a message or give us a call — we're happy to show you around!",
        "cta_video": "Love what you see? Give us a call — we'd love to show you through in person!",
        "email_greeting": "Hey there,",
        "sign_off": "Cheers,\nYour Friendly Property Team",
        "email_subject_prefix": "Check this out:",
        "social_opener": "New on the market! {title} in {location} 🏡",
        "urgency": "Don't sleep on this one — it won't last long!",
        "adj": ["gorgeous", "stunning", "amazing", "fantastic", "beautiful", "awesome"],
        "video_intro": "Hey everyone! Welcome to {title}, located in the great suburb of {location}.",
        "hashtags": ["#NewListing", "#HomeGoals", "#HouseHunting", "#RealEstate", "#DreamHome"],
    },
    "promotional": {
        "hooks": [
            "JUST LISTED: {title} — an unmissable opportunity in {location}!",
            "DO NOT MISS: {title} is now available in {location} — act fast!",
            "RARE FIND ALERT: {title} hits the market in {location}!",
        ],
        "feature_intro": "Standout highlights you cannot afford to overlook:",
        "lifestyle": "Opportunities like this in {location} don't come along every day!",
        "cta_listing": (
            "Act fast — call now to secure your inspection!"
        ),
        "cta_email": "Do not delay — respond TODAY to secure your place on the inspection list!",
        "cta_video": "This property will not last! Call us RIGHT NOW to book your inspection before it is gone!",
        "email_greeting": "Hi there,",
        "sign_off": "Best,\nYour Property Marketing Team",
        "email_subject_prefix": "HOT NEW LISTING:",
        "social_opener": "🔥 JUST LISTED: {title} — {location}!",
        "urgency": "Enquire immediately to book your inspection!",
        "adj": ["outstanding", "premium", "exceptional", "incredible", "unbeatable", "spectacular"],
        "video_intro": (
            "Stop what you're doing — {title} in {location} has just hit the market "
            "and you will NOT want to miss this!"
        ),
        "hashtags": ["#JUSTLISTED", "#HotProperty", "#ActFast", "#NewListing", "#RealEstate"],
    },
    "luxury": {
        "hooks": [
            "Presenting {title} — an exceptional expression of refined living in {location}.",
            "A rare and distinguished opportunity: {title}, crafted for the most discerning purchaser in {location}.",
            "Welcome to {title}, where prestige and possibility converge in the heart of {location}.",
        ],
        "feature_intro": "Among its distinguished appointments and bespoke finishes:",
        "lifestyle": "A residence of this standing in {location} is rarely offered to the market.",
        "cta_listing": "We invite serious purchasers to arrange a discreet private inspection.",
        "cta_email": "We welcome serious purchasers to reach out for an exclusive private viewing.",
        "cta_video": (
            "We welcome serious enquiries from discerning purchasers. "
            "Please contact us to arrange a private and exclusive viewing."
        ),
        "email_greeting": "Dear Discerning Client,",
        "sign_off": "With our warmest regards,\nYour Prestige Property Specialists",
        "email_subject_prefix": "Prestige Listing:",
        "social_opener": "✨ Prestige listing: {title}, {location}.",
        "urgency": "Exclusive access by private appointment only — available to qualified purchasers.",
        "adj": ["prestigious", "exquisite", "bespoke", "opulent", "distinguished", "masterfully crafted"],
        "video_intro": (
            "We invite you to experience {title} — a masterpiece of design and "
            "craftsmanship in the prestigious {location}."
        ),
        "hashtags": [
            "#LuxuryRealEstate", "#PrestigeProperty", "#FineHomes",
            "#ExclusiveListing", "#LuxuryLiving",
        ],
    },
    "concise": {
        "hooks": [
            "{title}. {location}.",
            "{title} — {location}. {price}.",
            "{title} — {location}. Available now.",
        ],
        "feature_intro": "Key features:",
        "lifestyle": "Located in {location}.",
        "cta_listing": "Contact us to inspect.",
        "cta_email": "Reply to arrange an inspection.",
        "cta_video": "Contact us to arrange an inspection.",
        "email_greeting": "Hi,",
        "sign_off": "Regards,\nProperty Desk",
        "email_subject_prefix": "Listing:",
        "social_opener": "{title} | {location} | {price}",
        "urgency": "Enquire now.",
        "adj": ["quality", "well-maintained", "solid", "functional", "modern"],
        "video_intro": "{title}. {location}. Here are the key features.",
        "hashtags": ["#ForSale", "#RealEstate", "#NewListing"],
    },
    "friendly": {
        "hooks": [
            "Welcome to {title}, a wonderful home waiting for its next family in {location}!",
            "Introducing {title} — a warm and inviting property in the heart of {location}.",
            "Looking for a place to truly call home? {title} in {location} just might be the one!",
        ],
        "feature_intro": "Here's what makes this home so special:",
        "lifestyle": "We think you'll feel right at home here in {location}.",
        "cta_listing": "We'd love to show you around — just give us a call or drop us a message!",
        "cta_email": "Give us a call or send us a message — we're always happy to help!",
        "cta_video": "We hope you loved the tour! Give us a call and we'll arrange a visit in person.",
        "email_greeting": "Hi there!",
        "sign_off": "Warmly,\nYour Friendly Property Team",
        "email_subject_prefix": "A Home You'll Love:",
        "social_opener": "What a lovely home! {title} in {location} 😊",
        "urgency": "We'd love to show you this one — reach out today!",
        "adj": ["welcoming", "wonderful", "charming", "lovely", "delightful", "inviting"],
        "video_intro": (
            "Welcome, welcome! Come on in and take a look at {title}, "
            "a truly lovely home in the wonderful suburb of {location}."
        ),
        "hashtags": ["#HomeSweet", "#NewHome", "#RealEstate", "#HouseHunting", "#DreamHome"],
    },
}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _parse_list(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    items = re.split(r"[,;\n]+", text.strip())
    return [i.strip().rstrip(".").strip() for i in items if i.strip()]


def _bullet(items: list[str], symbol: str = "•") -> str:
    return "\n".join(f"{symbol} {i}" for i in items if i)


def _pick(options: list[str]) -> str:
    return random.choice(options)


def _fmt_hook(template: str, p: GenerateRequest) -> str:
    return template.format(
        title=p.title or "This Property",
        location=p.location or "this suburb",
        beds=p.bedrooms or "—",
        baths=p.bathrooms or "—",
        parking=p.parking or "—",
        price=p.price or "price on application",
    )


def _specs_sentence(p: GenerateRequest) -> str:
    """Build a one-line spec summary from the property fields."""
    parts: list[str] = []
    if p.bedrooms:
        label = "bedroom" if p.bedrooms == "1" else "bedrooms"
        parts.append(f"{p.bedrooms} {label}")
    if p.bathrooms:
        label = "bathroom" if p.bathrooms == "1" else "bathrooms"
        parts.append(f"{p.bathrooms} {label}")
    if p.parking:
        label = "car space" if p.parking == "1" else "car spaces"
        parts.append(f"{p.parking} {label}")

    sizes: list[str] = []
    if p.land_size:
        sizes.append(f"land of approximately {p.land_size}")
    if p.interior_size:
        sizes.append(f"interior living of approximately {p.interior_size}")

    if not parts and not sizes:
        return ""

    spec_str = f"Offering {', '.join(parts)}" if parts else ""
    if sizes:
        connector = " across a " if spec_str else "With "
        spec_str += connector + " and ".join(sizes)
    return spec_str.strip() + "."


def _kw_sentence(keywords: str) -> str:
    kws = _parse_list(keywords)
    if not kws:
        return ""
    if len(kws) == 1:
        return f"Key highlight: {kws[0]}."
    if len(kws) == 2:
        return f"Key highlights include {kws[0]} and {kws[1]}."
    return f"Highlights include {', '.join(kws[:-1])}, and {kws[-1]}."


def _join(*parts: str) -> str:
    return "\n\n".join(s for s in parts if s and s.strip())


# ─── per-channel generators ───────────────────────────────────────────────────
#
# Templates only ever state facts that were supplied: missing values are left out
# rather than replaced with filler ("—", "generous"), and there are no generic
# claims about kitchens, gardens or nearby schools that the agent didn't give us.

def _lifestyle(p: GenerateRequest, td: dict) -> str:
    return td["lifestyle"].format(location=p.location or "this area")


def _price_sentence(p: GenerateRequest) -> str:
    return f"Offered at {p.price}." if p.price else ""


def _spec_inline(p: GenerateRequest, sep: str = " · ") -> str:
    """'3 bed · 2 bath · 2 parking' using only the values that were supplied."""
    parts = [
        f"{v} {label}"
        for v, label in ((p.bedrooms, "bed"), (p.bathrooms, "bath"), (p.parking, "parking"))
        if v
    ]
    return sep.join(parts)


def _generate_listing(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    amenities = _parse_list(p.amenities)

    hook = _fmt_hook(_pick(td["hooks"]), p)
    specs = _specs_sentence(p)
    price = _price_sentence(p)

    feat_bullets = _bullet(features) if features else p.features
    amen_bullets = _bullet(amenities) if amenities else p.amenities
    amen_inline = (
        (", ".join(amenities[:4]) + ".") if amenities else (p.amenities or "")
    )
    kw = _kw_sentence(p.keywords)
    lifestyle = _lifestyle(p, td)
    cta = td["cta_listing"]
    notes = p.agent_notes

    if p.length == "short":
        top_feats = _bullet(features[:2]) if features else feat_bullets
        return _join(
            hook,
            specs,
            price,
            f"{td['feature_intro']}\n{top_feats}" if top_feats else "",
            notes,
            cta,
        )

    if p.length == "medium":
        feat_block = f"{td['feature_intro']}\n{feat_bullets}" if feat_bullets else ""
        amen_line = f"Additional appointments include {amen_inline}" if amen_inline else ""
        return _join(hook, specs, price, feat_block, amen_line, lifestyle, notes, kw, cta)

    # long / extended
    adj = _pick(td["adj"])
    overview = f"This {adj} property is now available in {p.location}."
    feat_block = f"{td['feature_intro']}\n{feat_bullets}" if feat_bullets else ""
    amen_block = f"Additional features and appointments:\n{amen_bullets}" if amen_bullets else ""
    return _join(hook, overview, specs, price, feat_block, amen_block, lifestyle, notes, kw, cta)


def _generate_social(p: GenerateRequest, td: dict) -> str:
    from models import PLATFORM_CHAR_LIMITS
    from postprocess import fit_char_limit

    features = _parse_list(p.features)
    opener = td["social_opener"].format(
        title=p.title or "New Listing",
        location=p.location or "Prime Location",
        price=p.price or "POA",
    )
    specs = _spec_inline(p)
    price_line = p.price or "Price on application"
    urgency = td["urgency"]

    loc_tag = ""
    if p.location:
        raw = p.location.split(",")[0].strip()
        loc_tag = "#" + re.sub(r"\s+", "", raw)

    hashtags = td["hashtags"][:]
    if loc_tag:
        hashtags.append(loc_tag)
    # Facebook and LinkedIn posts read better with only a few hashtags.
    max_tags = 3 if p.platform in ("facebook", "linkedin") else len(hashtags)

    if p.length == "short":
        ht = " ".join(hashtags[: min(3, max_tags)])
        body = "\n".join(s for s in [opener, specs, price_line] if s)
    elif p.length == "medium":
        ht = " ".join(hashtags[: min(4, max_tags)])
        top = f"✓ {features[0]}" if features else ""
        body = "\n".join(s for s in [opener, specs, top, price_line] if s)
    else:
        ht = " ".join(hashtags[:max_tags])
        feat_lines = "\n".join(f"✓ {f}" for f in features[:3]) if features else ""
        body = "\n".join(s for s in [opener, specs, feat_lines, price_line, urgency] if s)
    return fit_char_limit(f"{body}\n\n{ht}", PLATFORM_CHAR_LIMITS[p.platform])


def _generate_email(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    amenities = _parse_list(p.amenities)

    subject = f"Subject: {td['email_subject_prefix']} {p.title} — {p.location}"
    greeting = td["email_greeting"]
    intro = _fmt_hook(_pick(td["hooks"]), p)
    sign_off = td["sign_off"]
    cta = td["cta_email"]

    # Build bullet list
    spec_bullets: list[str] = []
    if _spec_inline(p):
        spec_bullets.append(_spec_inline(p, " / "))
    if p.land_size:
        spec_bullets.append(f"Land: {p.land_size}")
    if p.interior_size:
        spec_bullets.append(f"Interior: {p.interior_size}")
    if p.price:
        spec_bullets.append(f"Price: {p.price}")

    feat_bullets = spec_bullets + features[:5] + amenities[:3]
    bullets_text = _bullet(feat_bullets)
    highlights = ["Property highlights:", bullets_text, ""] if bullets_text else []
    lifestyle = _lifestyle(p, td)

    if p.length == "short":
        bullets = [bullets_text, ""] if bullets_text else []
        return "\n".join([subject, "", greeting, "", intro, "", *bullets, cta, "", sign_off])

    if p.length == "medium":
        return "\n".join([subject, "", greeting, "", intro, "", *highlights, lifestyle, "", cta, "", sign_off])

    # long / extended
    kw = _kw_sentence(p.keywords)
    notes = p.agent_notes
    body_parts = [subject, "", greeting, "", intro, "", *highlights, lifestyle, ""]
    for e in (kw, notes):
        if e:
            body_parts += [e, ""]
    body_parts += [cta, "", sign_off]
    return "\n".join(body_parts)


def _generate_video(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    amenities = _parse_list(p.amenities)
    title = p.title or "this property"
    location = p.location or "the area"

    intro = td["video_intro"].format(title=title, location=location)
    facts = " ".join(s for s in [_specs_sentence(p), _price_sentence(p)] if s)
    scenes: list[tuple[str, str]] = [("Introduction", _join(intro, facts).replace("\n\n", "\n"))]

    if p.length == "short":
        if features:
            scenes.append(("Key Features", _bullet(features[:2])))
    elif p.length == "medium":
        if features:
            scenes.append(("Highlights", _bullet(features[:4])))
        if amenities:
            scenes.append(("Appointments", _bullet(amenities[:3])))
    else:
        if p.address:
            scenes.append(("Address", f"You'll find {title} at {p.address}."))
        adj = _pick(td["adj"])
        for feature in features[:4]:
            scenes.append((feature[:40].title(), f"A {adj} highlight: {feature}."))
        if amenities:
            scenes.append(("Appointments", _bullet(amenities)))
        if p.agent_notes:
            scenes.append(("Agent Notes", p.agent_notes))
    scenes.append(("Closing", td["cta_video"]))
    return "\n\n".join(f"[Scene {i} — {name}]\n{text}" for i, (name, text) in enumerate(scenes, 1))


# ─── public entry point ───────────────────────────────────────────────────────

def generate_bundle(request: GenerateRequest) -> GeneratedBundle:
    td = _TONES[request.tone]
    return GeneratedBundle(
        listing=_generate_listing(request, td),
        social=_generate_social(request, td),
        email=_generate_email(request, td),
        video=_generate_video(request, td),
    )


# ─── refine helpers ───────────────────────────────────────────────────────────

_CHANNEL_FNS = {
    "listing": _generate_listing,
    "social": _generate_social,
    "email": _generate_email,
    "video": _generate_video,
}


def refine_tone(req: RefineRequest) -> str:
    """Regenerate the requested channel fresh (new random hook selection)."""
    gen_req = GenerateRequest.model_construct(
        title=req.title or "Property",
        location=req.location or "this suburb",
        price=req.price,
        address=req.address,
        bedrooms=req.bedrooms,
        bathrooms=req.bathrooms,
        parking=req.parking,
        land_size=req.land_size,
        interior_size=req.interior_size,
        features=req.features,
        amenities=req.amenities,
        agent_notes=req.agent_notes,
        content_type=req.channel,
        tone=req.tone,
        length=req.length,
        keywords=req.keywords,
        image_path="",
    )
    td = _TONES[req.tone]
    return _CHANNEL_FNS[req.channel](gen_req, td)


def refine_persuasive(req: RefineRequest) -> str:
    """Append urgency and call-to-action language from the current tone."""
    td = _TONES[req.tone]
    urgency = td["urgency"]
    if req.channel == "email":
        cta = td["cta_email"]
    elif req.channel == "video":
        cta = td["cta_video"]
    else:
        cta = td["cta_listing"]
    return req.content.rstrip() + f"\n\n{urgency}\n\n{cta}"


def refine_shorten(req: RefineRequest) -> str:
    """Condense content to roughly 60% of its words, keeping whole sentences and
    the original paragraph breaks."""
    content = req.content.strip()
    words = content.split()
    target = max(10, int(len(words) * 0.6))
    if len(words) <= target:
        return content

    kept: list[str] = []
    count = 0
    for paragraph in _re.split(r"\n\s*\n", content):
        sentences = _re.split(r"(?<=[.!?])\s+", paragraph.strip())
        taken: list[str] = []
        for sentence in sentences:
            n = len(sentence.split())
            if count + n > target and (kept or taken):
                break
            taken.append(sentence)
            count += n
        if taken:
            kept.append(" ".join(taken))
        if count >= target:
            break
    return "\n\n".join(kept)
