import io
import json
import os
import struct
import unittest
import zlib
from zipfile import ZipFile
from unittest.mock import patch

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches

from template_engine import TemplateIncompatible, render_template


def source_deck():
    deck = Presentation()
    slide = deck.slides.add_slide(deck.slide_layouts[1])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = RGBColor(244, 245, 230)
    slide.shapes.title.text = "Old title"
    slide.placeholders[1].text = "Old lesson content"
    brand = slide.shapes.add_shape(1, Inches(0.1), Inches(0.1), Inches(0.2), Inches(0.2))
    brand.fill.solid()
    brand.fill.fore_color.rgb = RGBColor(20, 90, 150)
    output = io.BytesIO()
    deck.save(output)
    return output.getvalue()


def png(red: int, green: int, blue: int):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress((b"\x00" + bytes((red, green, blue)) * 2) * 2))
        + chunk(b"IEND", b"")
    )


class UploadedTemplateTests(unittest.TestCase):
    def test_completed_source_reused_for_full_lesson_without_old_text(self):
        slides = [{"title": f"Lesson {n}", "content": f"New content {n}", "speakerNotes": "Teacher note"} for n in range(13)]
        source = source_deck()
        rendered = render_template(source, slides)
        with ZipFile(io.BytesIO(source)) as before, ZipFile(io.BytesIO(rendered)) as after:
            self.assertEqual(before.read("ppt/theme/theme1.xml"), after.read("ppt/theme/theme1.xml"))
        result = Presentation(io.BytesIO(rendered))
        self.assertEqual(len(result.slides), 13)
        self.assertEqual(result.slides[-1].shapes.title.text, "Lesson 12")
        self.assertEqual(result.slides[-1].placeholders[1].text, "New content 12")
        self.assertEqual(result.slides[0].notes_slide.notes_text_frame.text, "Teacher note")
        all_text = " ".join(shape.text for slide in result.slides for shape in slide.shapes if shape.has_text_frame)
        self.assertNotIn("Old lesson content", all_text)
        self.assertEqual(result.slides[0].shapes[-1].fill.fore_color.rgb, RGBColor(20, 90, 150))
        self.assertEqual(result.slides[0].background.fill.fore_color.rgb, RGBColor(244, 245, 230))

    def test_very_dense_content_returns_fit_warning(self):
        with self.assertRaises(TemplateIncompatible) as raised:
            render_template(source_deck(), [{"title": "Dense lesson", "content": "example " * 5000}])
        self.assertEqual(raised.exception.code, "TEXT_OVERFLOW")
        self.assertEqual(raised.exception.slide, 1)

    def test_extra_old_lesson_text_is_rejected(self):
        deck = Presentation(io.BytesIO(source_deck()))
        deck.slides[0].shapes.add_textbox(Inches(1), Inches(2), Inches(3), Inches(1)).text = "Old lesson that could leak"
        output = io.BytesIO()
        deck.save(output)
        with self.assertRaises(TemplateIncompatible) as raised:
            render_template(output.getvalue(), [{"title": "New", "content": "Content"}])
        self.assertEqual(raised.exception.code, "AMBIGUOUS_MAPPING")

    def test_lesson_picture_replaces_old_picture_and_keeps_branding(self):
        deck = Presentation(io.BytesIO(source_deck()))
        deck.slides[0].shapes.add_picture(io.BytesIO(png(255, 0, 0)), Inches(7), Inches(1.5), width=Inches(4), height=Inches(3))
        source = io.BytesIO()
        deck.save(source)
        result = Presentation(io.BytesIO(render_template(source.getvalue(), [{"title": "New", "content": "Content"}], {0: png(0, 0, 255)})))
        self.assertEqual(result.slides[0].shapes[-1].image.blob, png(0, 0, 255))
        self.assertEqual(result.slides[0].shapes[-2].fill.fore_color.rgb, RGBColor(20, 90, 150))

    def test_generated_image_without_template_frame_returns_warning(self):
        with self.assertRaises(TemplateIncompatible) as raised:
            render_template(source_deck(), [{"title": "New", "content": "Content"}], {0: png(0, 0, 255)})
        self.assertEqual(raised.exception.code, "REQUIRED_IMAGE_SLOT_MISSING")

    def test_uses_another_source_slide_when_first_design_is_ambiguous(self):
        deck = Presentation(io.BytesIO(source_deck()))
        deck.slides[0].shapes.add_textbox(Inches(1), Inches(2), Inches(3), Inches(1)).text = "Old extra content"
        second = deck.slides.add_slide(deck.slide_layouts[1])
        second.shapes.title.text = "Other old title"
        second.placeholders[1].text = "Other old content"
        output = io.BytesIO()
        deck.save(output)
        result = Presentation(io.BytesIO(render_template(output.getvalue(), [{"title": "New title", "content": "New content"}])))
        self.assertEqual(result.slides[0].shapes.title.text, "New title")
        self.assertEqual(result.slides[0].placeholders[1].text, "New content")

    def test_service_requires_secret_and_returns_structured_fit_issue(self):
        from main import app

        client = app.test_client()
        with patch.dict(os.environ, {"PPT_TEMPLATE_SERVICE_SECRET": "test-secret"}):
            unauthenticated = client.post("/render-uploaded-template")
            self.assertEqual(unauthenticated.status_code, 401)
            response = client.post(
                "/render-uploaded-template",
                headers={"X-Template-Service-Secret": "test-secret"},
                data={
                    "template": (io.BytesIO(source_deck()), "example.pptx"),
                    "slides": json.dumps([{"title": "Dense", "content": "many words " * 5000}]),
                },
            )
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json["code"], "TEXT_OVERFLOW")
            self.assertEqual(response.json["slide"], 1)


if __name__ == "__main__":
    unittest.main()
