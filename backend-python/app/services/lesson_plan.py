from __future__ import annotations

import json
from typing import Any

from app.auth.dependencies import AuthenticatedUser
from app.integrations.supabase import SupabaseRestClient
from app.models import LessonPlanSaveRequest


def build_lesson_plan_payload(request: LessonPlanSaveRequest, user_id: str) -> dict[str, Any]:
    merged_plan = dict(request.lesson_plan)
    if isinstance(request.section_images, dict) and request.section_images:
        merged_plan["__sectionImageUrls"] = json.dumps(
            request.section_images, separators=(",", ":")
        )
    if isinstance(request.ppt_slide_image_urls, list) and request.ppt_slide_image_urls:
        merged_plan["__pptSlideImageUrls"] = json.dumps(
            request.ppt_slide_image_urls, separators=(",", ":")
        )
    return {
        "user_id": user_id,
        "curriculum_type": request.form.curriculum_type,
        "curriculum_framework": request.form.curriculum_framework.strip() or "",
        "subject": request.form.subject,
        "grade": request.form.grade,
        "chapter": request.form.chapter.strip(),
        "topic": request.form.topic.strip(),
        "learning_objectives": request.form.learning_objectives,
        "lesson_plan": merged_plan,
    }


async def save_lesson_plan(
    request: LessonPlanSaveRequest,
    user: AuthenticatedUser,
    persistence: SupabaseRestClient,
) -> dict[str, str]:
    payload = build_lesson_plan_payload(request, user.user_id)
    if request.active_plan_id:
        await persistence.update_lesson_plan(
            payload, user.access_token, request.active_plan_id, user.user_id
        )
        return {"action": "updated", "id": request.active_plan_id}
    plan_id = await persistence.insert_lesson_plan(payload, user.access_token)
    return {"action": "inserted", "id": plan_id}
