"""Fill editable PowerPoint slides while retaining their source design.

The source deck is never modified. Unsupported slides fail explicitly instead of
returning a deck with missing text or silently replacing its design.
"""

from __future__ import annotations

import copy
import io
import math
import re
from typing import Any
from zipfile import ZipFile, BadZipFile

from lxml import etree
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import MSO_AUTO_SIZE
from pptx.oxml.ns import qn


class TemplateIncompatible(Exception):
    def __init__(self, code: str, message: str, slide: int | None = None):
        super().__init__(message)
        self.code = code
        self.slide = slide


MAX_TEMPLATE_BYTES = 15 * 1024 * 1024
MAX_ZIP_ENTRIES = 2500
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_PHYSICAL_SLIDES = 60
MAX_PARTS_PER_SECTION = 3
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def validate_source(data: bytes) -> None:
    if not data or len(data) > MAX_TEMPLATE_BYTES:
        raise TemplateIncompatible("INVALID_TEMPLATE", "The PowerPoint is empty or larger than 15 MB.")
    try:
        with ZipFile(io.BytesIO(data)) as archive:
            names = archive.namelist()
            if len(names) > MAX_ZIP_ENTRIES or sum(i.file_size for i in archive.infolist()) > MAX_UNCOMPRESSED_BYTES:
                raise TemplateIncompatible("INVALID_TEMPLATE", "This PowerPoint exceeds the template processing limit.")
            if "ppt/presentation.xml" not in names or "[Content_Types].xml" not in names:
                raise TemplateIncompatible("INVALID_TEMPLATE", "This file is not a valid editable .pptx.")
            for name in names:
                if name.startswith("/") or ".." in name.replace("\\", "/").split("/"):
                    raise TemplateIncompatible("INVALID_TEMPLATE", "This PowerPoint contains an unsafe file path.")
            if any("vbaProject" in name or "embeddings/" in name for name in names):
                raise TemplateIncompatible("UNSUPPORTED_CONTENT", "This PowerPoint contains macros or embedded files that cannot be safely preserved.")
    except BadZipFile as exc:
        raise TemplateIncompatible("INVALID_TEMPLATE", "This file is not a valid .pptx.") from exc


def _text_shapes(slide):
    return [s for s in slide.shapes if s.has_text_frame and s.width > 0 and s.height > 0]


def _role(shape) -> str | None:
    if not shape.is_placeholder:
        return None
    kind = str(shape.placeholder_format.type).upper()
    if "TITLE" in kind or "CENTER_TITLE" in kind:
        return "title"
    if "BODY" in kind or "SUBTITLE" in kind or "OBJECT" in kind:
        return "body"
    return None


def _editable_slots(slide):
    unsupported = {
        MSO_SHAPE_TYPE.CHART, MSO_SHAPE_TYPE.DIAGRAM,
        MSO_SHAPE_TYPE.EMBEDDED_OLE_OBJECT, MSO_SHAPE_TYPE.GROUP,
        MSO_SHAPE_TYPE.IGX_GRAPHIC, MSO_SHAPE_TYPE.LINKED_OLE_OBJECT,
        MSO_SHAPE_TYPE.MEDIA, MSO_SHAPE_TYPE.TABLE, MSO_SHAPE_TYPE.WEB_VIDEO,
    }
    if any(shape.shape_type in unsupported for shape in slide.shapes):
        raise TemplateIncompatible("UNSUPPORTED_CONTENT", "This slide contains a chart, group, table, video or embedded object that cannot be safely replaced.")
    slide_width = slide.part.package.presentation_part.presentation.slide_width
    slide_height = slide.part.package.presentation_part.presentation.slide_height
    for shape in slide.shapes:
        if shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
            continue
        area_ratio = shape.width * shape.height / (slide_width * slide_height)
        if area_ratio < 0.12 and 0.15 * slide_height < shape.top < 0.8 * slide_height:
            raise TemplateIncompatible("AMBIGUOUS_MAPPING", "This slide has a small lesson picture that cannot be distinguished from its design.")
    shapes = _text_shapes(slide)
    title = next((s for s in shapes if _role(s) == "title"), None)
    body = next((s for s in shapes if _role(s) == "body" and s is not title), None)
    if title is None:
        title_candidates = [s for s in shapes if s.top < slide.part.package.presentation_part.presentation.slide_height * 0.48]
        title = min(title_candidates, key=lambda s: (s.top, -s.width), default=None)
    if body is None:
        candidates = [s for s in shapes if s is not title and s.top < slide.part.package.presentation_part.presentation.slide_height * 0.9]
        body = max(candidates, key=lambda s: s.width * s.height, default=None)
    if title is None or body is None or title is body:
        raise TemplateIncompatible("NO_EDITABLE_CONTENT", "A source slide needs editable title and content text areas.")
    if title.width < 400000 or body.width < 500000 or body.height < 200000:
        raise TemplateIncompatible("NO_EDITABLE_CONTENT", "The editable title or content area is too small.")
    # Other substantial text would leak an old lesson into the new deck. A
    # short footer/label near the bottom is treated as retained branding.
    for shape in shapes:
        if shape is title or shape is body or not shape.text.strip():
            continue
        if shape.top > slide.part.package.presentation_part.presentation.slide_height * 0.85 and len(shape.text.strip()) < 60:
            continue
        raise TemplateIncompatible("AMBIGUOUS_MAPPING", "This slide has extra editable text. Use a simpler template with title and content areas.")
    return title, body


def _font_size(shape, default: float) -> float:
    for paragraph in shape.text_frame.paragraphs:
        for run in paragraph.runs:
            if run.font.size:
                return run.font.size.pt
        if paragraph.font.size:
            return paragraph.font.size.pt
    return default


def _capacity(shape, default_size: float) -> tuple[int, int, int] | None:
    """Conservative character budget, with wrapping/paragraph overhead.

    This is a guard, not a claim to reproduce PowerPoint's text layout.
    """
    size = _font_size(shape, default_size)
    width_pt = shape.width / 12700
    height_pt = shape.height / 12700
    tf = shape.text_frame
    width_pt -= (tf.margin_left + tf.margin_right) / 12700
    height_pt -= (tf.margin_top + tf.margin_bottom) / 12700
    if size < 12 or width_pt < 80 or height_pt < size * 1.25:
        return None
    chars_per_line = max(1, int(width_pt / (size * 0.68)))
    lines = max(0, int(height_pt / (size * 1.45)))
    return chars_per_line * lines, chars_per_line, lines


def _split_body(text: str, chars_per_line: int, lines_per_slide: int) -> list[str]:
    if not text.strip():
        return [""]
    paragraphs = [p.strip() for p in text.replace("\r", "").split("\n") if p.strip()]
    chunks: list[list[str]] = [[]]
    used = 0
    for paragraph in paragraphs:
        needed = max(1, math.ceil(len(paragraph) / chars_per_line)) + 1
        if needed > lines_per_slide:
            # Split long paragraphs at word boundaries, retaining every word.
            words = paragraph.split()
            pieces: list[str] = []
            current = ""
            limit = chars_per_line * max(1, lines_per_slide - 1)
            for word in words:
                if len(word) > chars_per_line:
                    raise TemplateIncompatible("TEXT_OVERFLOW", "A word is too long for the template's content area.")
                if current and len(current) + 1 + len(word) > limit:
                    pieces.append(current)
                    current = word
                else:
                    current = f"{current} {word}".strip()
            if current:
                pieces.append(current)
        else:
            pieces = [paragraph]
        for piece in pieces:
            piece_lines = max(1, math.ceil(len(piece) / chars_per_line)) + 1
            if used + piece_lines > lines_per_slide and chunks[-1]:
                chunks.append([])
                used = 0
            chunks[-1].append(piece)
            used += piece_lines
    return ["\n".join(chunk) for chunk in chunks]


def _set_text_preserving_style(shape, text: str) -> None:
    frame = shape.text_frame
    samples = [copy.deepcopy(paragraph._p) for paragraph in frame.paragraphs]
    for paragraph in list(frame.paragraphs):
        paragraph._p.getparent().remove(paragraph._p)
    lines = text.split("\n") or [""]
    for index, line in enumerate(lines):
        sample = samples[min(index, len(samples) - 1)]
        p = copy.deepcopy(sample)
        for child in list(p):
            if child.tag != qn("a:pPr") and child.tag != qn("a:endParaRPr"):
                p.remove(child)
        r = etree.Element(qn("a:r"))
        source_run = sample.find(qn("a:r"))
        if source_run is not None and source_run.find(qn("a:rPr")) is not None:
            r.append(copy.deepcopy(source_run.find(qn("a:rPr"))))
        t = etree.SubElement(r, qn("a:t"))
        t.text = line
        p.insert(1 if len(p) and p[0].tag == qn("a:pPr") else 0, r)
        frame._txBody.append(p)
    frame.word_wrap = True
    frame.auto_size = MSO_AUTO_SIZE.NONE


def _clone_slide(prs, source):
    target = prs.slides.add_slide(source.slide_layout)
    target._element.attrib.clear()
    target._element.attrib.update(source._element.attrib)
    for element in list(target._element):
        target._element.remove(element)
    for element in source._element:
        target._element.append(copy.deepcopy(element))
    # python-pptx caches its shape collection when add_slide creates default
    # placeholders. Point it at the copied slide tree instead.
    target.__dict__.pop("shapes", None)
    id_map = {}
    for rel in source.part.rels.values():
        if rel.reltype.endswith("/slideLayout") or rel.reltype.endswith("/notesSlide"):
            continue
        new_id = target.part.relate_to(rel.target_ref if rel.is_external else rel.target_part, rel.reltype, is_external=rel.is_external)
        id_map[rel.rId] = new_id
    for element in target._element.iter():
        for name, value in list(element.attrib.items()):
            if name.startswith("{" + REL_NS + "}") and value in id_map:
                element.set(name, id_map[value])
    return target


def _remove_slide(prs, index: int):
    slide_id = prs.slides._sldIdLst[index]
    prs.part.drop_rel(slide_id.rId)
    prs.slides._sldIdLst.remove(slide_id)


def _replace_picture(slide, image_bytes: bytes | None):
    slide_area = slide.part.package.presentation_part.presentation.slide_width * slide.part.package.presentation_part.presentation.slide_height
    pictures = [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE and 0.12 < s.width * s.height / slide_area < 0.75]
    if not pictures:
        if image_bytes:
            placeholders = [
                s for s in slide.placeholders
                if "PICTURE" in str(s.placeholder_format.type).upper()
                and s.width * s.height > slide.part.package.presentation_part.presentation.slide_width * slide.part.package.presentation_part.presentation.slide_height * 0.12
            ]
            if len(placeholders) == 1:
                placeholders[0].insert_picture(io.BytesIO(image_bytes))
                return True
            raise TemplateIncompatible("REQUIRED_IMAGE_SLOT_MISSING", "The lesson includes an image, but this slide design has no clear place for it.")
        return False
    if len(pictures) > 1:
        raise TemplateIncompatible("AMBIGUOUS_MAPPING", "This slide has multiple large pictures, so the lesson image destination is unclear.")
    picture = pictures[0]
    if image_bytes:
        part, rid = slide.part.get_or_add_image_part(io.BytesIO(image_bytes))
        picture._element.blipFill.blip.set(qn("r:embed"), rid)
    else:
        picture._element.getparent().remove(picture._element)
    return True


def _set_notes(slide, text: str):
    if text:
        slide.notes_slide.notes_text_frame.text = text


def _choose_source(sources, index: int, total: int, title: str, body: str):
    if len(sources) >= total:
        alternatives = sources[1:-1] if len(sources) > 2 else sources
        candidates = [sources[index]] + [source for source in alternatives if source is not sources[index]]
    elif index == 0:
        candidates = [sources[0]]
    elif index == total - 1 and len(sources) > 2:
        candidates = [sources[-1]]
    else:
        content_sources = sources[1:-1] if len(sources) > 2 else sources
        offset = (index - 1) % len(content_sources)
        candidates = content_sources[offset:] + content_sources[:offset]
    last_error = None
    for candidate in candidates:
        try:
            title_shape, body_shape = _editable_slots(candidate)
            title_capacity = _capacity(title_shape, 30)
            body_capacity = _capacity(body_shape, 18)
            if not title_capacity or not body_capacity or len(title) > title_capacity[0]:
                raise TemplateIncompatible("TEXT_OVERFLOW", "The title or content area is too small.")
            parts = _split_body(body, body_capacity[1], body_capacity[2])
            if len(parts) > MAX_PARTS_PER_SECTION:
                raise TemplateIncompatible("TEXT_OVERFLOW", "The lesson section needs more than three slides in this design.")
            if len(parts) > 1 and len(f"{title} (continued)") > title_capacity[0]:
                raise TemplateIncompatible("TEXT_OVERFLOW", "The continuation title is too long for this design.")
            return candidate, title_shape, body_shape, parts
        except TemplateIncompatible as exc:
            last_error = exc
    raise last_error or TemplateIncompatible("NO_EDITABLE_CONTENT", "No suitable slide design was found.")


def render_template(data: bytes, slides: list[dict[str, Any]], images: dict[int, bytes] | None = None) -> bytes:
    validate_source(data)
    if not slides or len(slides) > 30:
        raise TemplateIncompatible("INVALID_CONTENT", "The lesson has an invalid number of slides.")
    try:
        prs = Presentation(io.BytesIO(data))
    except Exception as exc:
        raise TemplateIncompatible("INVALID_TEMPLATE", "This PowerPoint could not be opened.") from exc
    sources = list(prs.slides)
    if not sources:
        raise TemplateIncompatible("NO_EDITABLE_CONTENT", "The PowerPoint has no example slides. Add editable title and content slides, then upload it again.")
    if len(sources) > 30:
        raise TemplateIncompatible("INVALID_TEMPLATE", "Use a PowerPoint with at most 30 example slides.")
    images = images or {}
    generated = 0
    expected_bodies: list[tuple[int, str]] = []
    for index, item in enumerate(slides):
        try:
            title = str(item.get("title", "")).strip()
            body = str(item.get("content", "")).strip()
            source, src_title, src_body, parts = _choose_source(sources, index, len(slides), title, body)
            if re.sub(r"\s+", " ", " ".join(parts)).strip() != re.sub(r"\s+", " ", body).strip():
                raise TemplateIncompatible("VALIDATION_FAILED", "A lesson section could not be divided without losing content.")
            for part_index, part_text in enumerate(parts):
                if generated >= MAX_PHYSICAL_SLIDES:
                    raise TemplateIncompatible("TEXT_OVERFLOW", "This template would need too many slides.")
                target = _clone_slide(prs, source)
                target_title = next(s for s in target.shapes if s.shape_id == src_title.shape_id)
                target_body = next(s for s in target.shapes if s.shape_id == src_body.shape_id)
                part_title = title if part_index == 0 else f"{title} (continued)"
                _set_text_preserving_style(target_title, part_title)
                _set_text_preserving_style(target_body, part_text)
                expected_bodies.append((target_body.shape_id, part_text))
                _replace_picture(target, images.get(index) if part_index == 0 else None)
                _set_notes(target, str(item.get("speakerNotes", "")) if part_index == 0 else "")
                generated += 1
        except TemplateIncompatible as exc:
            exc.slide = index + 1
            raise
    for index in range(len(sources) - 1, -1, -1):
        _remove_slide(prs, index)
    result = io.BytesIO()
    prs.save(result)
    output = result.getvalue()
    # The package must be reopenable and all logical text must survive export.
    check = Presentation(io.BytesIO(output))
    if len(check.slides) != generated:
        raise TemplateIncompatible("VALIDATION_FAILED", "The exported PowerPoint failed validation.")
    for slide, (shape_id, expected_text) in zip(check.slides, expected_bodies):
        actual = next((shape.text for shape in slide.shapes if shape.shape_id == shape_id), None)
        if actual != expected_text:
            raise TemplateIncompatible("VALIDATION_FAILED", "Some lesson content is missing from the exported PowerPoint.")
    return output
