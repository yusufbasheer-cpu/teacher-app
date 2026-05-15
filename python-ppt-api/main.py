"""
Layah.ai – Python PPT Generation API
======================================
Uses python-pptx to open an uploaded school .pptx template, clear its existing
content slides (keeping the slide master + layouts intact), then inject 13
lesson slides with AI-generated content while preserving the school's visual
design (background, colours, logo, fonts).

Endpoints
---------
GET  /health          – liveness check
POST /generate-ppt    – multipart: field "template" (.pptx file) + field "slides" (JSON)
"""

import io
import json
import os
import traceback

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Slide type map ────────────────────────────────────────────────────────────
SLIDE_TYPES = {
    0:  "title",
    1:  "starter",
    2:  "objectives",
    3:  "vocabulary",
    4:  "context",
    5:  "main",
    6:  "main2",
    7:  "activity",
    8:  "plenary",
    9:  "differentiated",
    10: "exit_ticket",
    11: "success_criteria",
    12: "closing",
}

TITLE_SLIDE_INDICES  = {0, 12}
SECTION_SLIDE_INDICES = {2, 3, 4, 11}


# ── Helpers ───────────────────────────────────────────────────────────────────

def remove_all_slides(prs: Presentation) -> None:
    """
    Remove every content slide from a presentation while keeping the
    slide masters and layouts (which carry the template's visual design).
    """
    sld_id_lst = prs.slides._sldIdLst
    for sld_id in list(sld_id_lst):
        r_id = sld_id.get(qn("r:id"))
        try:
            prs.part.drop_rel(r_id)
        except Exception:
            pass
        sld_id_lst.remove(sld_id)
    print(f"[ppt-api] Slides after removal: {len(prs.slides)}")


def find_layout(prs: Presentation, name_hints: list[str]):
    """
    Return the first layout whose name contains any of the hints (case-insensitive).
    Falls back to layout index 1 (usually 'Title and Content') or 0.
    """
    for layout in prs.slide_layouts:
        ln = layout.name.lower()
        for hint in name_hints:
            if hint.lower() in ln:
                return layout
    if len(prs.slide_layouts) > 1:
        return prs.slide_layouts[1]
    return prs.slide_layouts[0]


def get_theme_colors(prs: Presentation) -> dict:
    """
    Extract the first accent / dark colour from the theme so we can use them
    when we need to add explicit text boxes (fallback mode).
    Returns hex strings like '1B3A6B'.
    """
    try:
        theme_el = prs.slide_master.theme_color_map
    except Exception:
        theme_el = None

    # Safe defaults
    return {"dark": "1B1B1B", "accent": "1B3A6B", "light": "FFFFFF"}


def set_placeholder_text(ph, lines: list[str], font_size_pt: int | None = None,
                          bold: bool = False) -> None:
    """Clear a placeholder and fill it with the given lines."""
    tf = ph.text_frame
    tf.clear()
    tf.word_wrap = True
    for i, line in enumerate(lines):
        if i == 0:
            para = tf.paragraphs[0]
        else:
            para = tf.add_paragraph()
        run = para.add_run()
        run.text = line
        if font_size_pt:
            run.font.size = Pt(font_size_pt)
        if bold:
            run.font.bold = True


def add_text_box(slide, text: str, left, top, width, height,
                 font_size_pt: int = 18, bold: bool = False,
                 align=PP_ALIGN.LEFT) -> None:
    """Add a manual text box – used as fallback when no placeholder exists."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if i == 0:
            para = tf.paragraphs[0]
        else:
            para = tf.add_paragraph()
        para.alignment = align
        run = para.add_run()
        run.text = line
        run.font.size = Pt(font_size_pt)
        run.font.bold = bold


def build_slide(prs: Presentation, layout, slide_idx: int, slide_data: dict,
                slide_w: Emu, slide_h: Emu) -> None:
    """Add one lesson slide to the presentation."""
    title_text   = slide_data.get("title",   "").strip()
    content_text = slide_data.get("content", "").strip()
    slide_type   = SLIDE_TYPES.get(slide_idx, "content")

    print(f"[ppt-api] Slide {slide_idx + 1}/{len(prs.slides) + 1} ({slide_type}): {title_text[:50]!r}")

    slide = prs.slides.add_slide(layout)

    # ── Try to fill placeholder 0 (title) and 1 (body) ───────────────────────
    placed_title   = False
    placed_content = False

    for ph in slide.placeholders:
        idx = ph.placeholder_format.idx
        print(f"  └─ placeholder idx={idx} type={ph.placeholder_format.type} name={ph.name!r}")

        if idx == 0 and not placed_title and title_text:
            set_placeholder_text(ph, [title_text], bold=True)
            placed_title = True

        elif idx in (1, 2, 13, 14, 15) and not placed_content and content_text:
            lines = [l for l in content_text.split("\n") if l.strip()]
            set_placeholder_text(ph, lines)
            placed_content = True

    # ── Fallback: add explicit text boxes if placeholders were missing ────────
    margin = Inches(0.45)
    body_top = Inches(1.6)

    if not placed_title and title_text:
        print(f"  └─ Adding fallback title text box")
        add_text_box(
            slide, title_text,
            left=margin, top=margin,
            width=slide_w - 2 * margin, height=Inches(1.1),
            font_size_pt=32, bold=True,
        )

    if not placed_content and content_text:
        print(f"  └─ Adding fallback content text box")
        lines = [l for l in content_text.split("\n") if l.strip()]
        add_text_box(
            slide, "\n".join(lines),
            left=margin, top=body_top,
            width=slide_w - 2 * margin,
            height=slide_h - body_top - margin,
            font_size_pt=18,
        )

    # ── Speaker notes ─────────────────────────────────────────────────────────
    notes_text = slide_data.get("speakerNotes", "").strip()
    if notes_text:
        try:
            notes_slide = slide.notes_slide
            tf = notes_slide.notes_text_frame
            tf.text = notes_text
        except Exception:
            pass


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Layah PPT API is running"})


@app.route("/generate-ppt", methods=["POST"])
def generate_ppt():
    # ── Validate inputs ───────────────────────────────────────────────────────
    template_file = request.files.get("template")
    slides_json   = request.form.get("slides")

    if not template_file:
        return jsonify({"error": "Missing 'template' file in multipart form."}), 400
    if not slides_json:
        return jsonify({"error": "Missing 'slides' JSON field in form data."}), 400

    try:
        payload = json.loads(slides_json)
    except json.JSONDecodeError as exc:
        return jsonify({"error": f"Invalid JSON in 'slides': {exc}"}), 400

    slides_list = payload.get("slides", [])
    if not slides_list:
        return jsonify({"error": "'slides' array is empty."}), 400

    topic       = payload.get("topic",       "Lesson")
    subject     = payload.get("subject",     "")
    grade       = payload.get("grade",       "")
    teacher     = payload.get("teacherName", "Teacher")

    print(f"[ppt-api] ══ generate-ppt request: topic={topic!r}, slides={len(slides_list)} ══")

    try:
        # ── Load the school template ──────────────────────────────────────────
        template_bytes = io.BytesIO(template_file.read())
        prs = Presentation(template_bytes)

        print(f"[ppt-api] Template loaded:")
        print(f"  Existing slides  : {len(prs.slides)}")
        print(f"  Slide masters    : {len(prs.slide_masters)}")
        print(f"  Slide layouts    : {len(prs.slide_layouts)}")
        print(f"  Slide size       : {prs.slide_width} x {prs.slide_height}")

        for i, layout in enumerate(prs.slide_layouts):
            print(f"  Layout [{i}]: {layout.name!r}")

        # ── Strip existing content slides (keep masters + layouts) ────────────
        remove_all_slides(prs)

        slide_w = prs.slide_width
        slide_h = prs.slide_height

        # ── Choose layouts ────────────────────────────────────────────────────
        title_layout   = find_layout(prs, ["title slide", "title,", "cover"])
        content_layout = find_layout(prs, ["title and content", "title, content", "content"])
        blank_layout   = find_layout(prs, ["blank"])

        print(f"[ppt-api] Title layout  : {title_layout.name!r}")
        print(f"[ppt-api] Content layout: {content_layout.name!r}")

        # ── Generate the 13 lesson slides ─────────────────────────────────────
        for idx, slide_data in enumerate(slides_list):
            slide_type = SLIDE_TYPES.get(idx, "content")
            if slide_type in ("title", "closing"):
                layout = title_layout
            else:
                layout = content_layout
            build_slide(prs, layout, idx, slide_data, slide_w, slide_h)

        print(f"[ppt-api] Final slide count: {len(prs.slides)}")

        # ── Serialise and return ──────────────────────────────────────────────
        output = io.BytesIO()
        prs.save(output)
        output.seek(0)

        print(f"[ppt-api] ══ PPT generated successfully ({output.getbuffer().nbytes} bytes) ══")

        return send_file(
            output,
            as_attachment=True,
            download_name="lesson-presentation.pptx",
            mimetype=(
                "application/vnd.openxmlformats-officedocument"
                ".presentationml.presentation"
            ),
        )

    except Exception as exc:
        print(f"[ppt-api] ERROR: {exc}")
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print(f"[ppt-api] Starting on port {port} (debug={debug})")
    app.run(host="0.0.0.0", port=port, debug=debug)
