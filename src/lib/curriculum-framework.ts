/**
 * Optional national / jurisdictional framework layer on top of "Curriculum type"
 * (CBSE, British, etc.). Empty value = standard generation with no extra framework.
 */

export const CURRICULUM_FRAMEWORK_OPTIONS = [
  { value: "", label: "None - Standard Lesson Plan" },
  {
    value: "uae_moe_khda_spea",
    label: "UAE Framework - UAE MOE, KHDA and SPEA Standards",
  },
  { value: "uk_ofsted", label: "UK Framework - Ofsted Standards" },
  { value: "usa_common_core", label: "USA Framework - Common Core Standards" },
  {
    value: "australia_acara",
    label: "Australia Framework - ACARA Australian Curriculum",
  },
  {
    value: "singapore_moe",
    label: "Singapore Framework - Singapore MOE Standards",
  },
  {
    value: "finland_nccf",
    label: "Finland Framework - Finnish National Core Curriculum",
  },
  { value: "india_cbse_nep", label: "India Framework - CBSE and NEP 2020" },
] as const;

const ALLOWED = new Set<string>(CURRICULUM_FRAMEWORK_OPTIONS.map((o) => o.value));

export function isValidCurriculumFramework(value: string): boolean {
  return ALLOWED.has(value.trim());
}

export function getCurriculumFrameworkLabel(value: string): string {
  const v = value.trim();
  const opt = CURRICULUM_FRAMEWORK_OPTIONS.find((o) => o.value === v);
  return opt?.label ?? v;
}

/** True when the teacher selected UAE MOE / KHDA / SPEA framework (slide 8 uses UAE connection mode). */
export function isUaeCurriculumFramework(value: string): boolean {
  return value.trim() === "uae_moe_khda_spea";
}

const UAE_FOCUS_AREAS = `Assessment-related topics (weave where relevant): Assessment for Learning (AfL), Assessment as Learning, Assessment of Learning, formative assessment, summative assessment, diagnostic assessment, peer assessment, self-assessment, success criteria, learning objectives, differentiated assessment, rubrics and marking schemes, feedback and feedforward, data analysis, progress tracking, questioning techniques, higher-order thinking skills (HOTS), Bloom's taxonomy, critical thinking, student reflection, exit tickets, retrieval practice, plenary assessment, mini-plenary, adaptive teaching, target setting, moderation of assessment, standardization, baseline assessment.

Teaching and learning topics: student-centred learning, active learning, collaborative learning, inquiry-based learning, project-based learning, experiential learning, differentiation, personalized learning, engagement strategies, classroom management, metacognition, scaffolding, visible learning, cross-curricular learning, competency-based learning, 21st-century skills, innovation in education, digital learning, AI in education, gamification.

UAE inspection and quality focus areas: students' achievement, students' progress, teaching for effective learning, curriculum design, curriculum adaptation, inclusion and SEND, innovation skills, reading literacy, moral education, UAE national identity, wellbeing, student voice, leadership and management, professional development, parental engagement, use of assessment data, learning environment, innovation and creativity, digital competency.

Modern educational focus topics: AI-powered learning, competency mapping, STEAM education, future skills, entrepreneurship education, media literacy, coding and computational thinking, Sustainable Development Goals (SDGs), global citizenship, emotional intelligence in education.`;

function addendumUae(): string {
  return `## Mandatory educational framework (UAE — MOE, KHDA, SPEA)
The teacher selected UAE national expectations. Treat this as a binding quality layer on top of the stated curriculum type, grade, subject, chapter, topic, and learning objectives.

Let UAE MOE, KHDA, and SPEA expectations quietly shape **every** generated field you output (Full Lesson Plan, PPT Slide Content, Worksheet, Assessment Questions, Homework Task, Teacher Notes): inspection-quality teaching and learning, assessment design, inclusion, digital and innovation literacy where appropriate, and moral / national identity / wellbeing threads where they fit the subject matter—without inventing school-specific policies.

Naturally embed priorities from these domains (do not dump them as a checklist unless a section genuinely benefits from a compact rubric or criteria list):

${UAE_FOCUS_AREAS}

Write for a UAE classroom audience (Arabic/English bilingual awareness where the subject is language-related; otherwise clear international English). Keep tone professional and inspection-ready while remaining practical for teachers.`;
}

function addendumUk(): string {
  return `## Mandatory educational framework (UK — Ofsted)
Align all outputs with England’s Ofsted Education Inspection Framework (EIF) expectations: quality of education (intent, implementation, impact), behaviour and attitudes, personal development, and leadership and management—translated into concrete lesson resources. Reflect age-related suitability, literacy/numeracy across the curriculum where relevant, safeguarding-aware wording, sensible assessment of knowledge and skills, and clear progression within the lesson. Apply British English spelling where it differs from US English.`;
}

function addendumUsa(): string {
  return `## Mandatory educational framework (USA — Common Core)
Align lesson plan, slide outline, worksheet, assessments, homework, and teacher notes with Common Core State Standards expectations for the grade and subject: focus on college- and career-ready skills, coherence of standards within the lesson, appropriate rigor, mathematical practices (for mathematics), ELA anchor standards (for English language arts), and discipline-specific practices for science/social studies when applicable. Use US English and terminology familiar to US teachers.`;
}

function addendumAustralia(): string {
  return `## Mandatory educational framework (Australia — ACARA)
Align all materials with the Australian Curriculum (ACARA): achievement standards and content descriptors implied by the topic and grade band, general capabilities (literacy, numeracy, ICT, critical and creative thinking, personal and social capability, ethical understanding, intercultural understanding), and cross-curriculum priorities (Aboriginal and Torres Strait Islander histories and cultures, Asia and Australia’s engagement with Asia, sustainability) where they genuinely connect to the lesson—without forced tokenism. Use Australian English.`;
}

function addendumSingapore(): string {
  return `## Mandatory educational framework (Singapore — MOE)
Align resources with Singapore Ministry of Education priorities: rigour, mastery, and clarity of learning outcomes; development of 21st-century competencies and student self-directedness; appropriate use of ICT-enabled learning; formative assessment integrated into instruction; and high expectations with concrete scaffolding. Reflect Singapore schooling norms and terminology where helpful.`;
}

function addendumFinland(): string {
  return `## Mandatory educational framework (Finland — National Core Curriculum)
Align outputs with Finnish national curricular emphases: transversal competencies (thinking and learning-to-learn, cultural literacy, interaction and expression, multiliteracy, participation and building a sustainable future), learner agency, phenomenon- and inquiry-friendly tasks where suitable, wellbeing and a supportive learning culture, and assessment that supports growth. Keep resources calm, clear, and professionally grounded.`;
}

function addendumIndia(): string {
  return `## Mandatory educational framework (India — CBSE & NEP 2020)
Align all sections with CBSE-style learning outcomes and assessment patterns where applicable, and with NEP 2020 directions: holistic development, competency-based progression, integration of skills, formative and summative balance, experiential and collaborative elements, multilingual sensitivity (without requiring a specific medium of instruction beyond the teacher’s context), and use of higher-order outcomes where appropriate to the grade and subject.`;
}

/**
 * Applies to every framework: the framework is a silent content-shaping layer, not a
 * script the model should recite. Keeps the "curriculum guides content, not becomes
 * the content" invariant consistent across all consumers of the addendum.
 */
function silentApplicationGuidance(): string {
  return `## How to apply this framework
Use the framework above to silently shape objectives, terminology, grade-appropriateness, pedagogical structure, and relevant local/contextual examples. Do NOT insert explicit statements such as "this aligns with...", "this meets...", "according to [framework]...", or "this supports curriculum standards..." into ordinary sections — that reads as narration, not teaching content, and is not something this application formally verifies. Only name the framework or its bodies explicitly inside a section whose deliberate purpose is to report curriculum/standards connections (for example a dedicated real-life/curriculum-connection slide) — never as a claim sprinkled through the rest of the content.`;
}

/**
 * Returns extra system-prompt text appended when a framework is selected; `null` if none.
 */
export function buildCurriculumFrameworkSystemAddendum(
  frameworkValue: string,
): string | null {
  const v = frameworkValue.trim();
  if (!v) return null;

  const base = ((): string | null => {
    switch (v) {
      case "uae_moe_khda_spea":
        return addendumUae();
      case "uk_ofsted":
        return addendumUk();
      case "usa_common_core":
        return addendumUsa();
      case "australia_acara":
        return addendumAustralia();
      case "singapore_moe":
        return addendumSingapore();
      case "finland_nccf":
        return addendumFinland();
      case "india_cbse_nep":
        return addendumIndia();
      default:
        return null;
    }
  })();

  if (!base) return null;
  return `${base}\n\n${silentApplicationGuidance()}`;
}

/** Short line for image prompts (FLUX / PPT slide images). */
export function buildCurriculumFrameworkImageHint(frameworkValue: string): string | null {
  const v = frameworkValue.trim();
  if (!v) return null;
  const label = getCurriculumFrameworkLabel(v);
  return `Educational standards context: align visual metaphors and diagram style with ${label} (symbols and diagrams only, no text in image).`;
}
