/**
 * TEMPORARY test endpoint — gated by SUPER_ADMIN_PIN.
 * Generates a lesson plan for a given teaching strategy and returns
 * the content + automated quality scores.
 * DELETE THIS FILE after strategy testing is complete.
 */

import { NextResponse } from "next/server";
import {
  buildDeepseekLessonSystemPrompt,
} from "@/lib/deepseek-lesson-system-prompt";
import {
  buildCurriculumFrameworkSystemAddendum,
  getCurriculumFrameworkLabel,
} from "@/lib/curriculum-framework";
import {
  TEACHER_PACKAGE_BLOCK_MARKERS,
  type LessonPlanResult,
} from "@/lib/lesson-plan";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const TEST_INPUT = {
  curriculumType: "UAE MOE",
  curriculumFramework: "uae-moe",
  grade: "Grade 7",
  subject: "Science",
  chapter: "Plant Biology",
  topic: "Photosynthesis",
  learningObjectives:
    "1. Explain the process of photosynthesis including inputs and outputs.\n" +
    "2. Identify the role of chlorophyll and chloroplasts in energy conversion.\n" +
    "3. Analyse how environmental factors affect the rate of photosynthesis.",
};

const STRATEGY_KEYWORDS: Record<string, string[]> = {
  "Inquiry-Based Learning":                 ["question", "investigat", "discover", "explor", "hypothes"],
  "Design Thinking":                        ["empathi", "define", "ideate", "prototyp", "test"],
  "Case Study-Based Learning":              ["case study", "scenario", "real situation", "analys"],
  "Experiential Learning":                  ["hands-on", "experience", "reflect", "experiment", "lab"],
  "Cooperative and Collaborative Learning": ["group", "team", "collaborat", "together", "peer"],
  "Flipped Classroom":                      ["home", "pre-lesson", "video", "watch", "before class"],
  "Challenge-Based Learning":               ["challenge", "creative", "tackle", "meaningful", "solv"],
  "Discovery Learning":                     ["discover", "explore", "guided", "observ", "find out"],
};

const AUTHENTICITY_CHECKS: Record<string, { test: (content: string) => boolean; label: string }> = {
  "Inquiry-Based Learning": {
    label: "Investigation questions present",
    test: (c) => /\?/.test(c) && /investigat/i.test(c),
  },
  "Design Thinking": {
    label: "Full Empathize→Define→Ideate→Prototype→Test flow",
    test: (c) => /empathi/i.test(c) && /prototyp/i.test(c),
  },
  "Case Study-Based Learning": {
    label: "Real case/scenario present",
    test: (c) => /case study|scenario|real situation/i.test(c),
  },
  "Experiential Learning": {
    label: "Hands-on doing present",
    test: (c) => /hands.on|experiment|lab|observe/i.test(c),
  },
  "Cooperative and Collaborative Learning": {
    label: "Structured group work present",
    test: (c) => /group|team|pair/i.test(c),
  },
  "Flipped Classroom": {
    label: "Pre-lesson home content present",
    test: (c) => /home|pre.lesson|video|watch|before class/i.test(c),
  },
  "Challenge-Based Learning": {
    label: "Meaningful challenge present",
    test: (c) => /challenge/i.test(c),
  },
  "Discovery Learning": {
    label: "Guided discovery/investigation present",
    test: (c) => /discover|explore|guided/i.test(c),
  },
};

function buildStrategyBlock(strategy: string): string {
  return `

===== TEACHING AND LEARNING STRATEGY (MANDATORY — read all five rules) =====
The teacher has selected the following pedagogical strategy: **${strategy}**

RULE 1: The selected teaching strategy must ONLY influence the activities and examples within each lesson phase. It must NOT change the lesson plan structure, add sections, or remove sections.
RULE 2: The lesson plan must still contain ALL standard sections: Learning Objectives, Learning Outcomes, Starter Activity, Main Phase, Differentiated Activity, UAE Real Life Connection, Plenary, Extended Task, Exit Ticket, Success Criteria.
RULE 3: Apply the strategy as follows for each section:
  - Starter Activity: Design the hook activity using the principles of ${strategy}.
  - Main Phase: Structure the I Do / We Do / You Do activities according to ${strategy}.
  - Differentiated Activity: Create differentiated tasks that reflect the ${strategy} approach.
  - Plenary: Design the reflection activity using ${strategy} principles.
  - Extended Task: Create homework that extends the ${strategy} approach.
RULE 4: For PPT Slide Content the same rules apply. The 13-slide structure must remain identical. Only the content delivery style, activities, and examples should reflect ${strategy}. Do NOT add, remove, or rearrange any PPT slides.
RULE 5: If the strategy cannot be naturally applied to a section, use default pedagogy for that section only — do not force it.
===== END STRATEGY RULES =====`;
}

function scoreContent(content: string, strategy: string): {
  starter: number; mainPhase: number; differentiated: number;
  plenary: number; extendedTask: number; strategyAuthentic: boolean;
  uaeContext: boolean; classroomReady: boolean; overallScore: number;
} {
  const lower = content.toLowerCase();
  const keywords = STRATEGY_KEYWORDS[strategy] ?? [];

  const starterSection   = content.match(/Starter Activity[\s\S]*?(?=Main Phase|Main Teaching|MAIN|$)/i)?.[0] ?? content.slice(0, 600);
  const mainSection      = content.match(/Main Phase[\s\S]*?(?=Differentiat|DIFFERENTIAT|$)/i)?.[0] ?? "";
  const diffSection      = content.match(/Differentiat[\s\S]*?(?=Plenary|PLENARY|$)/i)?.[0] ?? "";
  const plenarySection   = content.match(/Plenary[\s\S]*?(?=Extended Task|EXTENDED|$)/i)?.[0] ?? "";
  const extendedSection  = content.match(/Extended Task[\s\S]*/i)?.[0] ?? "";

  const scoreSection = (section: string): number => {
    let score = 5;
    if (section.length > 300) score += 1;
    if (section.length > 700) score += 1;
    if (/\d+\s*min/i.test(section)) score += 0.5;
    if (/step|stage|instruct|task/i.test(section)) score += 0.5;
    const hits = keywords.filter((kw) => section.toLowerCase().includes(kw)).length;
    if (hits >= 1) score += 1;
    if (hits >= 2) score += 1;
    return Math.min(10, Math.round(score));
  };

  const starter      = scoreSection(starterSection);
  const mainPhase    = scoreSection(mainSection);
  const differentiated = scoreSection(diffSection);
  const plenary      = scoreSection(plenarySection);
  const extendedTask = scoreSection(extendedSection);

  const authCheck = AUTHENTICITY_CHECKS[strategy];
  const strategyAuthentic = authCheck ? authCheck.test(content) : keywords.some((kw) => lower.includes(kw));
  const uaeContext = /uae|dubai|abu dhabi|emirates|emirati|masdar|khda/i.test(content);
  const classroomReady = content.length > 1500 && /\d+\s*min/i.test(content);

  const sectionAvg = (starter + mainPhase + differentiated + plenary + extendedTask) / 5;
  const overallScore = Math.round(
    sectionAvg * 0.5 +
    (strategyAuthentic ? 10 : 4) * 0.3 +
    (uaeContext ? 10 : 5) * 0.1 +
    (classroomReady ? 10 : 5) * 0.1,
  );

  return { starter, mainPhase, differentiated, plenary, extendedTask, strategyAuthentic, uaeContext, classroomReady, overallScore };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { strategy?: string; pin?: string } | null;
  const pin = process.env.SUPER_ADMIN_PIN?.trim();

  if (!pin || body?.pin !== pin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const strategy = body?.strategy?.trim();
  if (!strategy) {
    return NextResponse.json({ error: "strategy is required" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) return NextResponse.json({ error: "DEEPSEEK_API_KEY not set" }, { status: 500 });

  const sections = ["Full Lesson Plan"] as const;
  const frameworkAddendum = buildCurriculumFrameworkSystemAddendum(TEST_INPUT.curriculumFramework);
  const [startMarker, endMarker] = TEACHER_PACKAGE_BLOCK_MARKERS["Full Lesson Plan"];

  const messages = [
    {
      role: "system" as const,
      content: buildDeepseekLessonSystemPrompt(["Full Lesson Plan"], {
        curriculumFrameworkAddendum: frameworkAddendum,
        subject: TEST_INPUT.subject,
      }),
    },
    {
      role: "user" as const,
      content: `
Use this class context. Produce only the following teacher-package section wrapped in its START/END marker.

- **Full Lesson Plan**: wrap between:
  ${startMarker}
  …your content…
  ${endMarker}

- Curriculum: ${TEST_INPUT.curriculumType}
- Grade: ${TEST_INPUT.grade}
- Subject: ${TEST_INPUT.subject}
- Chapter: ${TEST_INPUT.chapter}
- Topic: ${TEST_INPUT.topic}
- Learning objectives: ${TEST_INPUT.learningObjectives}
- **Curriculum framework (mandatory alignment):** UAE MOE — apply UAE framework rules to every field.

Each section must be classroom-ready with timings, student tasks, and differentiation.
${buildStrategyBlock(strategy)}
      `.trim(),
    },
  ];

  const dsRes = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "deepseek-chat", messages, max_tokens: 6000, temperature: 0.7 }),
  });

  if (!dsRes.ok) {
    const err = await dsRes.text();
    return NextResponse.json({ error: `DeepSeek ${dsRes.status}: ${err.slice(0, 400)}` }, { status: 500 });
  }

  const dsBody = await dsRes.json() as { choices: [{ message: { content: string } }] };
  const content = dsBody.choices[0]?.message.content ?? "";

  const scores = scoreContent(content, strategy);
  const authCheck = AUTHENTICITY_CHECKS[strategy];

  return NextResponse.json({
    strategy,
    scores,
    authenticityLabel: authCheck?.label ?? null,
    contentLength: content.length,
    contentPreview: {
      starter:   (content.match(/Starter Activity[\s\S]*?(?=Main Phase|MAIN|$)/i)?.[0] ?? "").slice(0, 500),
      mainPhase: (content.match(/Main Phase[\s\S]*?(?=Differentiat|DIFFERENTIAT|$)/i)?.[0] ?? "").slice(0, 500),
      plenary:   (content.match(/Plenary[\s\S]*?(?=Extended Task|EXTENDED|$)/i)?.[0] ?? "").slice(0, 300),
    },
  });
}
