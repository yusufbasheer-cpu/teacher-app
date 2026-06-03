/**
 * Individual slide content generators — each function makes its own isolated DeepSeek API call
 * for ONE specific slide. No shared lesson-plan context is passed, making it physically
 * impossible for content to bleed from one slide into another.
 */

import {
  sanitizeSlide7DifferentiatedBody,
  sanitizeSlide10ExtendedBody,
  stripSlideTitleEchoFromBody,
} from "@/lib/ppt-slide-by-slide";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_ATTEMPTS = 3;
const SLIDE_MAX_TOKENS = 1400;

export type SlideGenParams = {
  topic: string;
  subject: string;
  grade: string;
  chapter?: string;
  curriculumType?: string;
  learningObjectives?: string;
  /** Formatted AFL description for the Starter slide (slide 2). */
  starterAflBlock?: string;
  /** Formatted AFL description for the Main Phase slide (slide 6). */
  mainAflBlock?: string;
  /** Formatted AFL description for the Plenary slide (slide 9). */
  plenaryAflBlock?: string;
  uaeFrameworkEnabled: boolean;
  dateStr?: string;
};

export type SlideGenResult = { body: string; notices: string[] };

type DSMessage = { role: "system" | "user"; content: string };

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildIsolatedSystemPrompt(slideName: string): string {
  return `You are a professional teacher creating a PowerPoint presentation slide. You are generating content for ONE specific slide ONLY.

SLIDE: ${slideName}

STRICT ISOLATION RULES:
1. Generate content ONLY for the slide named above. Do NOT include content for any other slide.
2. Do NOT repeat the slide title "${slideName}" inside the content body.
3. Do NOT use markdown headers (#, ##), bold (**text**), or italic (*text*).
4. Do NOT use bullet symbols (-, *, •) — use numbered lists or plain paragraph lines.
5. Return clean plain text that is classroom-ready and professional.
6. Content must be specific to the actual topic being taught.
7. Do NOT reference what came before or what comes after this slide.`;
}

function cleanBody(body: string, slideName: string): string {
  let s = body
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .trim();
  s = stripSlideTitleEchoFromBody(s, slideName);
  return s.replace(/\n{4,}/g, "\n\n\n").trim();
}

async function callDeepSeek(messages: DSMessage[]): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { content: "", error: "Missing DEEPSEEK_API_KEY" };

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.5,
        max_tokens: SLIDE_MAX_TOKENS,
        messages,
      }),
    });
  } catch (err) {
    return { content: "", error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const raw = await res.text();
  if (!res.ok) return { content: "", error: `HTTP ${res.status}: ${raw.slice(0, 200)}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { content: "", error: "Invalid JSON from DeepSeek" };
  }

  const content =
    (parsed as { choices?: [{ message?: { content?: string } }] })
      ?.choices?.[0]?.message?.content ?? "";
  return { content };
}

async function generateWithRetries(
  slideName: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<SlideGenResult> {
  const notices: string[] = [];
  let body = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptHint =
      attempt > 1
        ? `\n\n(Attempt ${attempt}: ensure the content is complete, specific to the topic, and strictly follows all isolation rules.)`
        : "";
    const { content, error } = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: `${userPrompt}${attemptHint}` },
    ]);

    if (error) {
      notices.push(`${slideName} attempt ${attempt}: ${error}`);
      continue;
    }

    body = content.trim();
    if (body.length >= 30) break;

    notices.push(`${slideName} attempt ${attempt}: response too short (${body.length} chars)`);
    body = "";
  }

  if (!body) {
    body = `_(${slideName} could not be generated — please regenerate this slide.)_`;
  }

  return { body, notices };
}

// ── Slide generators ──────────────────────────────────────────────────────────

/** Slide 1: programmatic — subject is in the deck slide title; body is grade + date only. */
export function generateSlide1Body(params: SlideGenParams): SlideGenResult {
  const dateStr =
    params.dateStr ??
    new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const body = [params.grade.trim(), dateStr].filter(Boolean).join("\n");
  return { body, notices: [] };
}

/** Slide 2: Starter Activity — engaging hook using the selected AFL starter tool. */
export async function generateSlide2(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, starterAflBlock } = params;
  const slideName = "Starter Activity";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate a Starter Activity for a ${grade} ${subject} lesson.
Topic: ${topic}
${starterAflBlock ? `AFL Starter Tool: ${starterAflBlock}` : "Choose an appropriate engaging starter AFL tool."}

Requirements:
- Engaging, interactive, and directly relevant to the topic: ${topic}
- Step-by-step classroom instructions with timing for each step (total 5-10 minutes)
- Hook students through prediction, curiosity, inquiry, or a surprising fact about ${topic}
- Do NOT include learning objectives or outcomes
- Do NOT reveal the full lesson structure
- Do NOT mention differentiation, UAE content, homework, or plenary
- Return only the starter activity content`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 3: Chapter, Topic, and SDG Goal — three items only. */
export async function generateSlide3(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, chapter } = params;
  const slideName = "Chapter, Topic and SDG Goal";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate exactly THREE items for a ${grade} ${subject} lesson on: ${topic}

Item 1 — Chapter: ${chapter ? chapter : `The most appropriate chapter or unit that contains "${topic}"`}
Item 2 — Topic: ${topic}
Item 3 — SDG Goal: The single most relevant Sustainable Development Goal for ${topic} — include the goal number and full official title

Rules:
- Write ONLY these three items, each on its own line
- Do NOT add explanations, descriptions, objectives, or activities
- Do NOT add any other content`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 4: programmatic — teacher's exact objectives, verbatim. */
export function generateSlide4Body(params: SlideGenParams): SlideGenResult {
  const raw = (params.learningObjectives ?? "").trim();
  const body = stripSlideTitleEchoFromBody(
    raw || "(Learning objectives not provided)",
    "Learning Objectives",
  );
  return { body, notices: [] };
}

/** Slide 5: Learning Outcomes — Bloom's verbs, aligned 1:1 to teacher objectives. */
export async function generateSlide5(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, learningObjectives } = params;
  const slideName = "Learning Outcomes";
  const system = buildIsolatedSystemPrompt(slideName);
  const objectiveLines = (learningObjectives ?? "")
    .split("\n")
    .filter((l) => l.trim()).length;
  const count = Math.max(1, objectiveLines);
  const user = `Generate Learning Outcomes for a ${grade} ${subject} lesson on: ${topic}

Teacher's learning objectives (must align to these exactly):
${learningObjectives || "(Write appropriate outcomes for the topic)"}

Requirements:
- Write EXACTLY ${count} outcome(s) — one per objective, in the same order
- Use Bloom's Taxonomy action verbs (e.g. identify, describe, explain, compare, evaluate, design)
- Use Must / Should / Could format OR clear numbered list
- Each outcome must be measurable and observable in the classroom
- Do NOT copy objectives verbatim — paraphrase into student learning outcomes
- Do NOT include activities or teaching instructions`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 6: Main Phase Core Teaching — I Do / We Do / You Do with AFL main tool. */
export async function generateSlide6(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, curriculumType, mainAflBlock } = params;
  const slideName = "Main Phase Core Teaching";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate the Main Phase Core Teaching content for a ${grade} ${subject} lesson.
Topic: ${topic}
${curriculumType ? `Curriculum: ${curriculumType}` : ""}
${mainAflBlock ? `AFL Main Phase Tool: ${mainAflBlock}` : ""}

Structure (I Do / We Do / You Do):

I Do — Teacher Explanation:
Full teaching content including key vocabulary, concepts, clear explanation, and worked examples specific to ${topic} at ${grade} level.

We Do — Guided Practice:
Teacher and students work through examples together. Fully implement the AFL tool above with step-by-step classroom instructions.

You Do — Independent Practice:
Students practise independently. Clear task instructions specific to ${topic}.

Requirements:
- Rich, detailed, classroom-ready content throughout
- All content specific to ${topic}
- Do NOT include differentiation tasks (separate slide)
- Do NOT include plenary or reflection (separate slide)
- Do NOT include UAE-specific real-world links (separate slide)
- Do NOT include homework (separate slide)`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 7: Differentiated Activity and Mini Plenary — three tiers + quick check. */
export async function generateSlide7(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade } = params;
  const slideName = "Differentiated Activity and Mini Plenary";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate differentiated activities for a ${grade} ${subject} lesson on: ${topic}

Write EXACTLY FOUR sections in this precise order:

Higher Achievers task
[A challenging extension task for ${topic} that requires analysis, evaluation, or creation — goes beyond the lesson objective]

Middle Achievers task
[A standard task for ${topic} that directly practises the main learning objective — clear numbered instructions]

Lower Achievers task
[A scaffolded task for ${topic} with sentence starters, word banks, or guided step-by-step prompts]

Mini Plenary
[ONE brief question to check whole-class understanding of ${topic} — maximum one sentence]

STRICT RULES:
- Write ONLY the four sections above — nothing else
- Do NOT include UAE content, real-world connections, or cross-curricular links
- Do NOT include a full plenary activity
- Do NOT include homework or extended tasks`;

  const result = await generateWithRetries(slideName, system, user);
  const cleaned = cleanBody(result.body, slideName);
  result.body = sanitizeSlide7DifferentiatedBody(cleaned, topic);
  return result;
}

/** Slide 8: UAE Real Life / Cross Curricular Connection — switches based on UAE framework flag. */
export async function generateSlide8(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, uaeFrameworkEnabled } = params;
  const slideName = uaeFrameworkEnabled
    ? "UAE Real Life and Cross Curricular Connection"
    : "Real Life and Cross Curricular Connection";
  const system = buildIsolatedSystemPrompt(slideName);

  const user = uaeFrameworkEnabled
    ? `Generate UAE Real Life and Cross Curricular Connection content for a ${grade} ${subject} lesson on: ${topic}

Include ALL four of the following:
1. UAE Real-Life Connection: A specific UAE example directly related to ${topic}. Choose the most relevant from: UAE national tree (Ghaf), mangroves, desert ecosystems, UAE Vision 2031, Masdar City, EXPO 2020 legacy, UAE sustainability goals, Emirates wildlife — only what genuinely connects to ${topic}.
2. Cross-Curricular Link: How ${topic} connects to another school subject taught in UAE schools — give a specific classroom example.
3. UAE MOE Alignment: How teaching ${topic} supports UAE Ministry of Education curriculum goals and KHDA/SPEA inspection quality standards.
4. SDG in UAE Context: The most relevant SDG goal number and title, and how the UAE is actively working toward it in relation to ${topic}.

Requirements:
- All content must be SPECIFIC to ${topic}, not generic
- Inspection-ready quality for KHDA and SPEA
- Do NOT include differentiation tasks
- Do NOT include plenary activities
- Do NOT include homework`
    : `Generate Real Life and Cross Curricular Connection content for a ${grade} ${subject} lesson on: ${topic}

Choose ONE connection type that BEST fits ${topic} and develop it fully with specific details:
A) Real-life application: a concrete, specific example of how ${topic} is used in everyday life
B) Cross-curricular link: how ${topic} connects to another school subject with a specific classroom example
C) Career connection: 2-3 specific careers that use knowledge of ${topic} and exactly how they apply it

Requirements:
- Content must be SPECIFIC to ${topic} — not generic
- Do NOT mention UAE, Emirates, Dubai, Abu Dhabi, MOE UAE, KHDA, or SPEA
- Do NOT include differentiation tasks
- Do NOT include plenary activities
- Do NOT include homework`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 9: Plenary — complete activity using selected AFL plenary tool. */
export async function generateSlide9(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade, plenaryAflBlock } = params;
  const slideName = "Plenary";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate a complete Plenary activity for a ${grade} ${subject} lesson on: ${topic}
${plenaryAflBlock ? `AFL Plenary Tool: ${plenaryAflBlock}` : "Choose the most appropriate plenary AFL tool."}

Include:
1. Activity name (do NOT use "Plenary" as the first word)
2. Clear activity objective linked to today's learning about ${topic}
3. Step-by-step teacher instructions with timing for each step
4. What students do at each step
5. How students reflect on and summarise their learning about ${topic}

Requirements:
- Total duration: 8-10 minutes
- Specific to ${topic} — not generic
- Do NOT start the body with the word "Plenary"
- Do NOT include differentiation tasks (separate slide)
- Do NOT include UAE content (separate slide)
- Do NOT include homework (separate slide)
- Do NOT include new teaching content`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 10: Extended Task / Homework — goes deeper than the lesson. */
export async function generateSlide10(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade } = params;
  const slideName = "Extended Task";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate a Homework or Extended Task for a ${grade} ${subject} lesson on: ${topic}

Include:
1. Task name (NOT "Extended Task" or "Homework" alone — give it a descriptive title)
2. Numbered step-by-step student instructions (what to do, how, and by when)
3. Expected output (what the finished work should look like)
4. Challenge extension for early finishers
5. How this task connects to future learning about ${topic}

Requirements:
- Task must go DEEPER than the lesson — choose from: research task, investigative task, creative project, or design challenge
- Specific to ${topic}
- Do NOT include success criteria or I can statements (separate slide)
- Do NOT include exit ticket questions (separate slide)
- Do NOT include plenary activities
- Do NOT repeat the slide title inside the content`;

  const result = await generateWithRetries(slideName, system, user);
  const cleaned = cleanBody(result.body, slideName);
  result.body = sanitizeSlide10ExtendedBody(cleaned, slideName);
  return result;
}

/** Slide 11: Exit Ticket — 2–3 focused comprehension questions. */
export async function generateSlide11(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade } = params;
  const slideName = "Exit Ticket";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate 2-3 Exit Ticket questions for a ${grade} ${subject} lesson on: ${topic}

Requirements:
- EXACTLY 2 to 3 questions — no more, no fewer
- Each question checks understanding of a key concept from today's lesson on ${topic}
- Short and clear — answerable in 2-3 minutes total
- Questions should progress from recall to application
- Do NOT include homework instructions
- Do NOT include success criteria or self-evaluation prompts
- Do NOT include new teaching content`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 12: Success Criteria and Self Evaluation — I can statements + reflection. */
export async function generateSlide12(params: SlideGenParams): Promise<SlideGenResult> {
  const { topic, subject, grade } = params;
  const slideName = "Success Criteria and Self Evaluation";
  const system = buildIsolatedSystemPrompt(slideName);
  const user = `Generate Success Criteria and Self Evaluation for a ${grade} ${subject} lesson on: ${topic}

Section 1 — Success Criteria:
Write 4-6 "I can..." statements that describe what a successful student can do after today's lesson on ${topic}. Each statement must be specific to ${topic} and measurable.

Section 2 — Self Evaluation:
Write 2-3 reflection prompts that help students honestly assess their own learning about ${topic} today.

Requirements:
- All statements must be specific to ${topic} — not generic
- Do NOT repeat the slide title inside the content
- Do NOT include exit ticket questions (separate slide)
- Do NOT include new teaching content`;

  const result = await generateWithRetries(slideName, system, user);
  result.body = cleanBody(result.body, slideName);
  return result;
}

/** Slide 13: Thank You — brief positive closing, no other content. */
export function generateSlide13Body(_params: SlideGenParams): SlideGenResult {
  return {
    body: "Thank you for your focus, effort, and enthusiasm throughout today's lesson.\nYou have worked hard — keep building on what you have learned today.",
    notices: [],
  };
}
