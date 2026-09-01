from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

CURRICULUM_TYPES = {
    "CBSE/NCERT", "ICSE", "Cambridge CAIE", "Edexcel", "IGCSE", "A Levels",
    "IB (International Baccalaureate)", "AP (American Advanced Placement)",
    "British National Curriculum", "GCSE", "A Levels UK", "UAE MOE", "MOE Saudi Arabia",
    "MOE Qatar", "MOE Kuwait", "MOE Bahrain", "MOE Oman", "American Common Core",
    "US State Standards", "Indian State Board", "Pakistani Board", "Bangladesh Board",
    "Singapore MOE", "Australian ACARA", "Finnish National Core Curriculum",
    "French National Curriculum", "German Curriculum", "Other Custom Curriculum",
}
GRADE_OPTIONS = {f"Grade {n}" for n in range(1, 13)}
SUBJECTS = {
    "Math", "Science", "English", "Islamic Studies", "Social Science", "ICT", "Computer Science",
    "Robotics", "STEM", "Art", "PE", "Other", "Hindi", "Urdu", "Malayalam", "Tamil", "Telugu",
    "Kannada", "Bengali", "Punjabi", "Gujarati", "Marathi", "Spanish", "French", "German",
    "Mandarin Chinese", "Japanese", "Korean", "Portuguese", "Italian", "Russian", "Arabic",
}
FRAMEWORKS = {
    "",
    "uae_moe_khda_spea",
    "uk_ofsted",
    "usa_common_core",
    "australia_acara",
    "singapore_moe",
    "finland_nccf",
    "india_cbse_nep",
}


class LessonPlanForm(BaseModel):
    model_config = ConfigDict(extra="ignore")

    curriculum_type: str = Field(alias="curriculumType")
    curriculum_framework: str = Field(alias="curriculumFramework")
    grade: str
    subject: str
    chapter: str
    topic: str
    learning_objectives: str = Field(alias="learningObjectives")

    @field_validator("curriculum_type", "grade", "subject", "curriculum_framework")
    @classmethod
    def validate_options(cls, value: str, info):
        if info.field_name == "curriculum_type" and value.strip() not in CURRICULUM_TYPES:
            raise ValueError("invalid curriculum type")
        if info.field_name == "grade" and value.strip() not in GRADE_OPTIONS:
            raise ValueError("invalid grade")
        if info.field_name == "subject" and value.strip() not in SUBJECTS:
            raise ValueError("invalid subject")
        if info.field_name == "curriculum_framework" and value.strip() not in FRAMEWORKS:
            raise ValueError("invalid curriculum framework")
        return value


class LessonPlanSaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    active_plan_id: str | None = Field(default=None, alias="activePlanId")
    form: LessonPlanForm
    lesson_plan: dict[str, Any] = Field(alias="lessonPlan")
    section_images: Any = Field(default=None, alias="sectionImages")
    ppt_slide_image_urls: Any = Field(default=None, alias="pptSlideImageUrls")
