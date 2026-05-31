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

from models import GenerateRequest, GeneratedBundle, RefineRequest


# ─── tone definitions ─────────────────────────────────────────────────────────

_TONES: dict[str, dict] = {
    "formal": {
        "hooks": [
            "We are pleased to present {title}, an outstanding property in {location}.",
            "It is our pleasure to introduce {title}, a refined and well-appointed residence in {location}.",
            "We invite discerning purchasers to consider {title}, positioned in the sought-after precinct of {location}.",
        ],
        "feature_intro": "This distinguished residence offers the following:",
        "lifestyle": (
            "Ideally situated within convenient proximity to reputable schools, "
            "efficient public transport, and a variety of retail and dining options,"
        ),
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
        "lifestyle": (
            "You'll love being just moments from great cafes, parks, schools, "
            "and local shops —"
        ),
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
        "lifestyle": "Positioned in one of the most sought-after locations available today,",
        "cta_listing": (
            "Act fast — this property is attracting significant interest. "
            "Call now to secure your inspection!"
        ),
        "cta_email": "Do not delay — respond TODAY to secure your place on the inspection list!",
        "cta_video": "This property will not last! Call us RIGHT NOW to book your inspection before it is gone!",
        "email_greeting": "Hi there,",
        "sign_off": "Best,\nYour Property Marketing Team",
        "email_subject_prefix": "HOT NEW LISTING:",
        "social_opener": "🔥 JUST LISTED: {title} — {location}!",
        "urgency": "Enquire immediately — strong buyer interest confirmed!",
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
        "lifestyle": "Positioned within one of the most coveted addresses this precinct has to offer,",
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
            "{beds}BR / {baths}BA in {location}. {title}.",
            "{title}. {location}. {beds} bed · {baths} bath · {parking} parking.",
            "{title} — {location}. Available now.",
        ],
        "feature_intro": "Key features:",
        "lifestyle": "Well-located near transport, schools, and amenities.",
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
        "lifestyle": (
            "The local community has so much to offer, from great schools and "
            "friendly neighbours to parks and cafes —"
        ),
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

def _generate_listing(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    amenities = _parse_list(p.amenities)

    hook = _fmt_hook(_pick(td["hooks"]), p)
    specs = _specs_sentence(p)
    adj = _pick(td["adj"])

    feat_bullets = _bullet(features) if features else p.features
    amen_bullets = _bullet(amenities) if amenities else p.amenities
    amen_inline = (
        (", ".join(amenities[:4]) + ".") if amenities else (p.amenities or "")
    )
    kw = _kw_sentence(p.keywords)
    lifestyle = td["lifestyle"]
    cta = td["cta_listing"]
    notes = p.agent_notes

    if p.length == "short":
        top_feats = _bullet(features[:2]) if features else feat_bullets
        return _join(
            hook,
            specs,
            f"{td['feature_intro']}\n{top_feats}" if top_feats else "",
            notes,
            cta,
        )

    if p.length == "medium":
        feat_block = f"{td['feature_intro']}\n{feat_bullets}" if feat_bullets else ""
        amen_line = f"Additional appointments include {amen_inline}" if amen_inline else ""
        return _join(hook, specs, feat_block, amen_line, lifestyle, notes, cta)

    # long
    overview = (
        f"This {adj} property presents a rare opportunity for buyers seeking "
        f"quality and comfort in {p.location}."
    )
    feat_block = f"{td['feature_intro']}\n{feat_bullets}" if feat_bullets else ""
    amen_block = f"Additional features and appointments:\n{amen_bullets}" if amen_bullets else ""
    lifestyle_sentence = (
        lifestyle.rstrip(",")
        + " this property offers an outstanding lifestyle opportunity."
    )
    return _join(hook, overview, specs, feat_block, amen_block, lifestyle_sentence, notes, kw, cta)


def _generate_social(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    opener = td["social_opener"].format(
        title=p.title or "New Listing",
        location=p.location or "Prime Location",
        price=p.price or "POA",
        beds=p.bedrooms or "—",
        baths=p.bathrooms or "—",
        parking=p.parking or "—",
    )
    specs = (
        f"{p.bedrooms} bed · {p.bathrooms} bath · {p.parking} parking"
        if p.bedrooms
        else ""
    )
    price_line = p.price or "Price on application"
    urgency = td["urgency"]

    loc_tag = ""
    if p.location:
        raw = p.location.split(",")[0].strip()
        loc_tag = "#" + re.sub(r"\s+", "", raw)

    hashtags = td["hashtags"][:]
    if loc_tag:
        hashtags.append(loc_tag)

    if p.length == "short":
        ht = " ".join(hashtags[:3])
        body = "\n".join(s for s in [opener, specs, price_line] if s)
        return f"{body}\n\n{ht}"

    if p.length == "medium":
        ht = " ".join(hashtags[:4])
        top = f"✓ {features[0]}" if features else ""
        body = "\n".join(s for s in [opener, specs, top, price_line] if s)
        return f"{body}\n\n{ht}"

    # long
    ht = " ".join(hashtags)
    feat_lines = "\n".join(f"✓ {f}" for f in features[:3]) if features else ""
    body = "\n".join(s for s in [opener, specs, feat_lines, price_line, urgency] if s)
    return f"{body}\n\n{ht}"


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
    if p.bedrooms:
        spec_bullets.append(f"{p.bedrooms} bed / {p.bathrooms} bath / {p.parking} parking")
    if p.land_size:
        spec_bullets.append(f"Land: {p.land_size}")
    if p.interior_size:
        spec_bullets.append(f"Interior: {p.interior_size}")
    if p.price:
        spec_bullets.append(f"Price: {p.price}")

    feat_bullets = spec_bullets + features[:5] + amenities[:3]
    bullets_text = _bullet(feat_bullets)

    lifestyle_close = (
        td["lifestyle"].rstrip(",")
        + " this property ticks every box."
    )

    if p.length == "short":
        return "\n".join([
            subject, "",
            greeting, "",
            intro, "",
            bullets_text, "",
            cta, "",
            sign_off,
        ])

    if p.length == "medium":
        return "\n".join([
            subject, "",
            greeting, "",
            intro, "",
            "Property highlights:",
            bullets_text, "",
            lifestyle_close, "",
            cta, "",
            sign_off,
        ])

    # long
    kw = _kw_sentence(p.keywords)
    notes = p.agent_notes
    long_lifestyle = (
        td["lifestyle"].rstrip(",")
        + " this property presents an outstanding opportunity for buyers seeking "
        "quality and lifestyle in one complete package."
    )
    extra = [s for s in [kw, notes] if s]
    body_parts = [
        subject, "",
        greeting, "",
        intro, "",
        "Property highlights:",
        bullets_text, "",
        long_lifestyle, "",
    ]
    for e in extra:
        body_parts += [e, ""]
    body_parts += [cta, "", sign_off]
    return "\n".join(body_parts)


def _generate_video(p: GenerateRequest, td: dict) -> str:
    features = _parse_list(p.features)
    amenities = _parse_list(p.amenities)
    title = p.title or "this property"
    location = p.location or "the area"
    adj = _pick(td["adj"])

    intro_narration = td["video_intro"].format(title=title, location=location)
    cta = td["cta_video"]

    feat_line = lambda i: features[i] if len(features) > i else "quality finishes throughout"
    amen_str = ", ".join(amenities[:3]) if amenities else (p.amenities or "quality throughout")

    if p.length == "short":
        feat_block = _bullet(features[:2]) if features else "Quality features throughout."
        scenes = [
            (
                "[Scene 1 — Introduction]\n"
                + intro_narration
                + f"\nPriced at {p.price or 'price on application'}, "
                f"offering {p.bedrooms} bedrooms and {p.bathrooms} bathrooms."
            ),
            (
                f"[Scene 2 — Key Features]\n{feat_block}"
            ),
            (
                f"[Scene 3 — Closing]\n{cta}"
            ),
        ]
        return "\n\n".join(scenes)

    if p.length == "medium":
        scenes = [
            (
                "[Scene 1 — Introduction]\n"
                + intro_narration
                + f"\nPriced at {p.price or 'price on application'}, this property offers "
                f"{p.bedrooms} bedrooms and {p.bathrooms} bathrooms across "
                f"approximately {p.interior_size or 'generous'} of interior space."
            ),
            (
                f"[Scene 2 — Living Areas & Kitchen]\n"
                f"The open-plan living and dining areas are {adj}, perfect for both "
                f"everyday living and entertaining. The kitchen features {feat_line(0)} "
                f"and {feat_line(1)}."
            ),
            (
                f"[Scene 3 — Bedrooms & Bathrooms]\n"
                f"The property offers {p.bedrooms or 'multiple'} well-appointed bedrooms "
                f"and {p.bathrooms or 'generous'} bathrooms. {feat_line(2).capitalize()}."
            ),
            (
                f"[Scene 4 — Outdoor & Parking]\n"
                f"The outdoor areas are ideal for entertaining, with "
                f"{p.parking or 'secure'} parking and a land size of "
                f"{p.land_size or 'generous proportions'}."
            ),
            (
                f"[Scene 5 — Closing]\n{cta}"
            ),
        ]
        return "\n\n".join(scenes)

    # long
    scenes = [
        (
            f"[Scene 1 — Title Card & Introduction]\n"
            + intro_narration
            + f"\nAddress: {p.address or 'available on request'}. "
            f"Price: {p.price or 'price on application'}."
        ),
        (
            f"[Scene 2 — Living Areas]\n"
            f"Step inside to discover {adj} open-plan living and dining areas, "
            f"designed for both relaxed daily living and seamless entertaining. "
            f"Natural light fills the space, creating a warm and welcoming atmosphere."
        ),
        (
            f"[Scene 3 — Kitchen]\n"
            f"The kitchen is the heart of this home, featuring {feat_line(0)} "
            f"and {feat_line(1)}. {feat_line(2).capitalize()}."
        ),
        (
            f"[Scene 4 — Bedrooms]\n"
            f"The property offers {p.bedrooms or 'multiple'} generously proportioned "
            f"bedrooms. {feat_line(3).capitalize()}. "
            f"Each bedroom is designed with comfort and functionality in mind."
        ),
        (
            f"[Scene 5 — Outdoor Areas]\n"
            f"Outdoor living is equally impressive, with a {adj} alfresco area "
            f"perfect for year-round entertaining. "
            f"Set on {p.land_size or 'a generous block'}, "
            f"the property also includes {p.parking or 'secure'} parking."
        ),
        (
            f"[Scene 6 — Amenities & Closing]\n"
            f"Among the additional features: {amen_str}.\n\n"
            + cta
        ),
    ]
    return "\n\n".join(scenes)


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
    """Condense content to approximately 60% of the original word count."""
    content = req.content.strip()
    words = content.split()
    target = max(10, int(len(words) * 0.6))
    if len(words) <= target:
        return content

    chunks = _re.split(r'(?<=[.!?])\s+|\n\n', content)
    result: list[str] = []
    count = 0
    for chunk in chunks:
        chunk_words = len(chunk.split())
        if count + chunk_words <= target or not result:
            result.append(chunk)
            count += chunk_words
        else:
            break

    sep = "\n\n" if "\n\n" in content else " "
    return sep.join(result)
