"""Generate downloadable files (TXT, PDF, DOCX) from a content bundle."""
from __future__ import annotations

import io
import re

from models import GeneratedBundle

# The PDF uses ReportLab's built-in fonts, which have no emoji glyphs (they print as
# black boxes). Emoji and pictographs are dropped from the PDF only; TXT and DOCX
# keep them. Check marks (✓ ✔) render fine and are kept.
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000026FF\U00002B00-\U00002BFF"
    "\U00002700-\U00002712\U00002715-\U000027BF\uFE0F\u200D\u20E3]"
)


def _pdf_text(line: str) -> str:
    return re.sub(r"[ \t]{2,}", " ", _EMOJI.sub("", line)).strip()

_SECTIONS = [
    ("listing", "Listing Description"),
    ("social", "Social Media Post"),
    ("email", "Email Copy"),
    ("video", "Video Script"),
]


def _sections(bundle: GeneratedBundle, extras: dict[str, str] | None) -> list[tuple[str, str]]:
    """(heading, text) for the four channels, then any extra formats."""
    from extras import EXTRA_LABELS

    items = [(heading, getattr(bundle, key)) for key, heading in _SECTIONS]
    for key, text in (extras or {}).items():
        items.append((EXTRA_LABELS.get(key, key.replace("_", " ").title()), text))
    return [(h, t) for h, t in items if t]


# ─── TXT ──────────────────────────────────────────────────────────────────────

def build_txt(bundle: GeneratedBundle, title: str, tone: str, extras: dict[str, str] | None = None) -> bytes:
    lines: list[str] = [
        "REM CONTENT STUDIO",
        f"Property: {title}",
        f"Tone: {tone.title()}",
        "=" * 60,
    ]
    for heading, text in _sections(bundle, extras):
        lines += ["", f"## {heading}", "", text, "", "-" * 60]
    return "\n".join(lines).encode("utf-8")


# ─── PDF ──────────────────────────────────────────────────────────────────────

def build_pdf(bundle: GeneratedBundle, title: str, tone: str, extras: dict[str, str] | None = None) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
    )
    styles = getSampleStyleSheet()

    # Custom style for body text that handles preformatted lines
    body_style = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=4,
    )
    heading2_style = ParagraphStyle(
        "h2",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=6,
    )

    from xml.sax.saxutils import escape

    # ReportLab's Paragraph reads its text as markup, so every user-supplied string
    # (title, tone, extra-format names) is escaped, not just the body lines.
    story = []
    story.append(Paragraph(escape(f"REM Content Studio — {title}"), styles["Title"]))
    story.append(Paragraph(escape(f"Tone: {tone.title()}"), styles["Italic"]))
    story.append(Spacer(1, 0.6 * cm))

    for heading, text in _sections(bundle, extras):
        story.append(Paragraph(escape(heading), heading2_style))
        for line in text.split("\n"):
            safe = (
                _pdf_text(line)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            if safe.strip():
                story.append(Paragraph(safe, body_style))
            else:
                story.append(Spacer(1, 0.2 * cm))
        story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    return buffer.getvalue()


# ─── DOCX ─────────────────────────────────────────────────────────────────────

def build_docx(bundle: GeneratedBundle, title: str, tone: str, extras: dict[str, str] | None = None) -> bytes:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt

    doc = Document()

    # Title
    t = doc.add_heading(f"REM Content Studio — {title}", level=0)
    t.alignment = WD_ALIGN_PARAGRAPH.LEFT

    sub = doc.add_paragraph(f"Tone: {tone.title()}")
    sub.runs[0].italic = True

    doc.add_paragraph()

    for heading, text in _sections(bundle, extras):
        doc.add_heading(heading, level=1)
        for line in text.split("\n"):
            p = doc.add_paragraph(line)
            p.paragraph_format.space_after = Pt(2)
        doc.add_paragraph()

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
