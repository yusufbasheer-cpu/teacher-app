/**
 * AFL (Assessment for Learning) tool catalog — 87 tools across six lesson phases.
 * Each tool includes how it works, classroom use, and purpose for full AI implementation.
 */

export const AFL_PHASE_IDS = [
  "starter",
  "main",
  "differentiation",
  "plenary",
  "exitTicket",
  "successCriteria",
] as const;

export type AflPhaseId = (typeof AFL_PHASE_IDS)[number];

/** When selected, starter slide may receive a dedicated FLUX image (Picture Prompt). */
export const PICTURE_PROMPT_AFL_TOOL_ID = "st-picture-prompt" as const;

/** @deprecated Use PICTURE_PROMPT_AFL_TOOL_ID */
export const PICTURE_IN_TIME_AFL_TOOL_ID = PICTURE_PROMPT_AFL_TOOL_ID;

export type AflToolDefinition = {
  id: string;
  label: string;
  howItWorks: string;
  classroomUse: string;
  purpose: string;
  /** Combined line for UI subtitles and compact prompts */
  howToUse: string;
};

export type AflPhaseGroup = {
  phase: AflPhaseId;
  title: string;
  tools: readonly AflToolDefinition[];
};

function tool(
  id: string,
  label: string,
  howItWorks: string,
  classroomUse: string,
  purpose: string,
): AflToolDefinition {
  const howToUse = `${howItWorks} ${classroomUse} Purpose: ${purpose}`;
  return { id, label, howItWorks, classroomUse, purpose, howToUse };
}

export const AFL_PHASE_GROUPS: readonly AflPhaseGroup[] = [
  {
    phase: "starter",
    title: "Starter Activity AFL Tools",
    tools: [
      tool(
        "st-think-pair-share",
        "Think Pair Share",
        "Teacher asks a focused question.",
        "Students think individually, discuss with a partner (1–2 minutes), then selected pairs share answers with the class. Allow silent individual thinking time first.",
        "Builds confidence, activates prior knowledge, and encourages participation.",
      ),
      tool(
        "st-kwl-chart",
        "KWL Chart",
        "Students organise thinking into K (what I already know), W (what I want to know), and L (what I learned — completed later).",
        "Before the lesson, students fill K and W columns; after the lesson, complete L during plenary or closure.",
        "Activates prior knowledge and builds curiosity.",
      ),
      tool(
        "st-brain-dump",
        "Brain Dump",
        "Students write everything they know about the topic.",
        "2–5 minutes silent writing, then share ideas with peers or the class.",
        "Quick assessment of prior knowledge.",
      ),
      tool(
        "st-odd-one-out",
        "Odd One Out",
        "Students are given 3–4 items; one is different.",
        "Students identify the odd item and explain their reasoning to a partner or the class.",
        "Develops critical thinking and comparison skills.",
      ),
      tool(
        "st-picture-prompt",
        "Picture Prompt Image Analysis",
        "Teacher shows an image related to the lesson.",
        "Students observe carefully, describe what they see, and predict the lesson topic before the reveal.",
        "Builds curiosity and visual thinking.",
      ),
      tool(
        "st-true-false-challenge",
        "True or False Challenge",
        "Teacher gives statements about the topic.",
        "Students decide true or false and justify their answers (thumbs, cards, or mini whiteboards).",
        "Reveals misconceptions and activates prior knowledge.",
      ),
      tool(
        "st-predict-reveal",
        "Predict and Reveal",
        "Teacher gives hints step by step.",
        "Students predict the topic after each hint; final reveal of the lesson topic.",
        "Builds curiosity and engagement.",
      ),
      tool(
        "st-kahoot-quizizz-warm-up",
        "Kahoot Quizizz Warm Up",
        "Digital quiz-based starter.",
        "Students answer MCQs on a device with instant feedback shown on screen.",
        "Engages students and checks prior knowledge.",
      ),
      tool(
        "st-entry-ticket",
        "Entry Ticket",
        "Short question before the lesson starts.",
        "Students answer 1–2 quick questions on paper or digitally; teacher reviews responses before teaching.",
        "Checks readiness for learning.",
      ),
      tool(
        "st-four-corners",
        "Four Corners",
        "Teacher presents a statement and labels four corners of the room with different opinions or answers.",
        "Students move to the corner that matches their view and explain their reasoning to others in that corner before sharing with the class.",
        "Activates thinking, encourages movement, and reveals different perspectives.",
      ),
      tool(
        "st-silent-debate",
        "Silent Debate",
        "Students respond to a discussion question entirely in writing rather than speaking.",
        "Post the question on paper or whiteboards; students circulate writing comments, agreements, or challenges to each other's ideas in silence.",
        "Encourages deep thinking and allows all students to participate without social pressure.",
      ),
      tool(
        "st-speed-recall",
        "Speed Recall",
        "Students write everything they remember from previous lessons within a strict time limit.",
        "Set a timer (2–3 minutes); students write freely without stopping. Debrief by comparing lists with a partner.",
        "Strengthens retrieval practice and surfaces prior knowledge quickly.",
      ),
      tool(
        "st-vocabulary-splash",
        "Vocabulary Splash",
        "Key vocabulary terms are displayed; students group or connect them before the lesson begins.",
        "Students organise terms into categories, draw connections, or predict meanings. Discuss as a class.",
        "Activates subject-specific language and previews lesson content.",
      ),
      tool(
        "st-prediction-line",
        "Prediction Line",
        "Students make personal predictions about lesson outcomes before learning begins.",
        "Students write or state predictions on a sticky note or card; revisit and compare at the end of the lesson.",
        "Builds curiosity, sets a learning purpose, and encourages metacognition.",
      ),
      tool(
        "st-human-continuum",
        "Human Continuum",
        "Students physically position themselves along a line in the room according to confidence level or opinion.",
        "Label each end of the room (e.g. Strongly Agree / Strongly Disagree); students stand where they feel they belong and explain their position.",
        "Reveals prior understanding, builds confidence, and promotes discussion.",
      ),
      tool(
        "st-find-someone-who",
        "Find Someone Who",
        "Students move around the room finding classmates who can answer different questions or match specific criteria.",
        "Give each student a grid of questions; they must find a different person for each answer. Class reconvenes to discuss findings.",
        "Encourages interaction, activates prior knowledge, and builds class community.",
      ),
      tool(
        "st-question-generator",
        "Question Generator",
        "Students create their own questions they hope to answer during the lesson.",
        "Students write 2–3 questions before teaching begins; display or collect them and revisit at the end of the lesson.",
        "Increases curiosity, ownership, and engagement with the topic.",
      ),
      tool(
        "st-connect-three",
        "Connect Three",
        "Students are given three concepts, images, or words and must explain how all three are connected.",
        "Display three items; students write or share a sentence explaining the link. Pairs compare their reasoning.",
        "Develops analytical thinking and helps teachers gauge existing understanding.",
      ),
      tool(
        "st-this-or-that",
        "This or That",
        "Students choose between two contrasting options and justify their choice.",
        "Present two options on the board; students vote with hands, cards, or movement and explain their reasoning.",
        "Engages students immediately and surfaces prior knowledge through personal opinion.",
      ),
    ],
  },
  {
    phase: "main",
    title: "Main Phase AFL Tools",
    tools: [
      tool(
        "mn-i-do-we-do-you-do",
        "I Do We Do You Do",
        "Gradual release teaching model.",
        "I Do: teacher demonstrates. We Do: teacher and students work together. You Do: students work independently on aligned tasks.",
        "Builds understanding step by step.",
      ),
      tool(
        "mn-jigsaw",
        "Jigsaw Activity",
        "Students become experts on one part of the content.",
        "Group A learns part A, Group B learns part B; students then teach each other in mixed expert groups.",
        "Encourages peer teaching and collaboration.",
      ),
      tool(
        "mn-learning-stations",
        "Learning Stations",
        "Different classroom stations with tasks.",
        "Students rotate between stations; each station has a different activity linked to the same learning goal.",
        "Active learning and engagement.",
      ),
      tool(
        "mn-gallery-walk",
        "Gallery Walk",
        "Students display work around the classroom.",
        "Students move around, observe peer work, and give brief feedback or annotations on sticky notes.",
        "Peer learning and reflection.",
      ),
      tool(
        "mn-concept-mapping",
        "Concept Mapping",
        "Students visually connect ideas.",
        "Create diagrams linking concepts and show relationships between ideas on paper or boards.",
        "Improves understanding of connections.",
      ),
      tool(
        "mn-socratic-questioning",
        "Socratic Questioning",
        "Teacher asks deep thinking questions.",
        "Use open-ended questioning; students justify reasoning and build on each other's answers.",
        "Develops critical thinking.",
      ),
      tool(
        "mn-carousel",
        "Carousel Activity",
        "Groups rotate between stations completing different tasks or answering questions at each station.",
        "Set up 4–6 stations around the room; groups move on a signal every 5–8 minutes completing a different task at each.",
        "Active learning, varied tasks, and collaborative engagement.",
      ),
      tool(
        "mn-learning-detective",
        "Learning Detective",
        "Students investigate clues, evidence, or sources to solve a problem or answer a question.",
        "Provide clue cards, images, or text extracts; students gather evidence and present their findings to the class.",
        "Builds enquiry skills, critical thinking, and deep engagement with content.",
      ),
      tool(
        "mn-fishbowl",
        "Fishbowl Discussion",
        "A small inner group discusses a topic while the outer group observes and evaluates.",
        "4–6 students sit in the centre and discuss; the rest observe, take notes, and may swap in. Debrief together at the end.",
        "Models high-quality academic discussion and develops listening and analytical skills.",
      ),
      tool(
        "mn-socratic-circle",
        "Socratic Circle",
        "Students engage in a structured collaborative inquiry using evidence and questioning to deepen understanding.",
        "Inner circle discusses the text or topic using evidence; outer circle evaluates arguments. Rotate roles.",
        "Develops critical thinking, evidence-based reasoning, and academic discussion skills.",
      ),
      tool(
        "mn-expert-groups",
        "Expert Groups",
        "Students specialise in one area of learning and then teach their expertise to others.",
        "Assign different content sections to groups; students master their section and then share knowledge with peers from other groups.",
        "Encourages deep learning, peer teaching, and accountability.",
      ),
      tool(
        "mn-escape-room",
        "Escape Room Challenge",
        "Students solve subject-related puzzles and challenges to unlock the next stage of learning.",
        "Create a sequence of tasks where completing one correctly reveals the next clue. Work in teams with a time limit.",
        "Builds engagement, teamwork, and application of knowledge under pressure.",
      ),
      tool(
        "mn-error-analysis",
        "Error Analysis",
        "Students identify mistakes in worked examples, explain why they are incorrect, and correct them.",
        "Provide examples with deliberate errors; students annotate mistakes and rewrite the correct version.",
        "Deepens understanding by examining misconceptions and reinforcing correct reasoning.",
      ),
      tool(
        "mn-role-on-wall",
        "Role on the Wall",
        "Students add information, thoughts, feelings, or characteristics around a character or concept outline.",
        "Draw a character silhouette or concept shape; students write internal thoughts inside and external behaviour outside.",
        "Develops empathy, character analysis, and multi-perspective thinking.",
      ),
      tool(
        "mn-living-timeline",
        "Living Timeline",
        "Students arrange themselves or event cards in chronological order and justify their placements.",
        "Give students event cards; they physically position themselves in the correct sequence and explain the reasoning.",
        "Develops sequencing, chronological understanding, and collaborative reasoning.",
      ),
      tool(
        "mn-case-study",
        "Case Study Investigation",
        "Students analyse a real-life situation and apply subject knowledge to solve problems or answer questions.",
        "Provide a real or realistic scenario; students investigate, discuss, and present their analysis or recommendations.",
        "Applies knowledge to authentic contexts and develops critical and analytical skills.",
      ),
      tool(
        "mn-reverse-teaching",
        "Reverse Teaching",
        "Students teach a concept to classmates to consolidate their own understanding.",
        "Assign a concept or section to individuals or pairs; they prepare and deliver a short explanation or mini-lesson.",
        "Strengthens understanding through the act of teaching and builds student confidence.",
      ),
      tool(
        "mn-diamond-ranking",
        "Diamond Ranking",
        "Students prioritise nine statements or ideas into a diamond shape based on importance.",
        "Provide nine cards; students place the most important at the top, least important at the bottom, and discuss their reasoning.",
        "Encourages prioritisation, discussion, and justification of opinions.",
      ),
    ],
  },
  {
    phase: "differentiation",
    title: "Differentiated Activity AFL Tools",
    tools: [
      tool(
        "df-must-should-could",
        "Must Should Could",
        "Three levels of tasks on the same objective.",
        "Must: basic task all students complete. Should: expected level. Could: challenge task for ready learners.",
        "Differentiation by ability.",
      ),
      tool(
        "df-choice-board",
        "Choice Board",
        "Students choose tasks from a grid.",
        "Provide multiple activity options; students pick based on interest while meeting the same learning goal.",
        "Student autonomy and differentiation.",
      ),
      tool(
        "df-tiered-tasks",
        "Tiered Tasks",
        "Same concept at different difficulty levels.",
        "Level 1 basic, Level 2 medium, Level 3 advanced — all aligned to today's objective.",
        "Supports mixed-ability learners.",
      ),
      tool(
        "df-learning-menus",
        "Learning Menus",
        "Students order learning tasks like a menu.",
        "Starter, main, and dessert tasks; student selects their path through the menu.",
        "Engagement and choice-based learning.",
      ),
      tool(
        "df-traffic-light-tasks",
        "Traffic Light Tasks",
        "Activities are organised into green, amber, and red challenge levels.",
        "Green = accessible foundation tasks; Amber = expected level; Red = challenging extension. Students select or are guided to their level.",
        "Differentiates by challenge and helps students work at an appropriate difficulty level.",
      ),
      tool(
        "df-scaffold-ladder",
        "Scaffold Ladder",
        "Learning support is gradually removed as students become more confident and independent.",
        "Begin with full scaffolds (sentence starters, frames, hints); reduce support step by step as students demonstrate readiness.",
        "Builds independence and confidence progressively.",
      ),
      tool(
        "df-support-station",
        "Support Station",
        "A teacher-led small group receives targeted support while others work independently.",
        "Pull a small group to work directly with the teacher on a specific skill or concept while the rest of the class works on independent tasks.",
        "Provides targeted intervention and closes learning gaps efficiently.",
      ),
      tool(
        "df-challenge-zone",
        "Challenge Zone",
        "Extension activities are available for students who complete work early or need greater challenge.",
        "Prepare a set of open-ended, high-order tasks accessible at a designated area; students move to the challenge zone when ready.",
        "Keeps high-achieving students engaged and stretched.",
      ),
      tool(
        "df-learning-pathways",
        "Learning Pathways",
        "Different routes are provided to reach the same learning objective, allowing flexibility.",
        "Design two or three distinct pathways with different approaches, styles, or levels of support; students select or are assigned a pathway.",
        "Accommodates different learning preferences and starting points.",
      ),
      tool(
        "df-flexible-grouping",
        "Flexible Grouping",
        "Students are grouped dynamically according to needs, ability, interests, or learning goals.",
        "Regroup students based on formative assessment data, interest, or task type; groups should change regularly.",
        "Ensures all learners are appropriately challenged and supported.",
      ),
      tool(
        "df-tiered-questions",
        "Tiered Questions",
        "Questions are designed at varying difficulty levels to address different learner needs.",
        "Prepare three tiers of questions: recall-level, application-level, and evaluation-level. Assign or allow student choice.",
        "Ensures every student is challenged at an appropriate level during questioning.",
      ),
      tool(
        "df-support-cards",
        "Support Cards",
        "Students can access hint cards, sentence starters, or guided prompts when needed.",
        "Prepare physical or digital support cards with vocabulary, steps, or clues; make them available on request or at desks.",
        "Provides just-in-time scaffolding without reducing challenge for those who don't need it.",
      ),
    ],
  },
  {
    phase: "plenary",
    title: "Plenary AFL Tools",
    tools: [
      tool(
        "pl-3-2-1-reflection",
        "3-2-1 Reflection",
        "Structured end-of-lesson reflection.",
        "Students record 3 things learned, 2 interesting points, and 1 question they still have.",
        "Structured reflection.",
      ),
      tool(
        "pl-hot-seat",
        "Hot Seat",
        "One student answers class questions.",
        "Class asks quick-fire questions; the student in the hot seat responds — rotate volunteers.",
        "Active recall and engagement.",
      ),
      tool(
        "pl-one-word-summary",
        "One Word Summary",
        "Students summarise the lesson in one word.",
        "Each learner writes one word, then explains their choice in a sentence when called.",
        "Quick reflection.",
      ),
      tool(
        "pl-snowball",
        "Snowball Activity",
        "Students write answers, crumple paper, throw, and discuss.",
        "Write response, crumple, toss to another student, unfold, read, and discuss in pairs.",
        "Fun reflection and participation.",
      ),
      tool(
        "pl-hinge-question",
        "Hinge Question",
        "A carefully designed question checks understanding at a critical decision point in the lesson.",
        "Pose the hinge question mid-lesson; student responses reveal whether the class is ready to progress or needs re-teaching.",
        "Enables real-time teaching decisions and prevents moving on with unresolved misconceptions.",
      ),
      tool(
        "pl-thumbs-up-down",
        "Thumbs Up Side Down",
        "Students use hand signals to indicate their level of understanding instantly.",
        "Teacher poses a question or statement; students show thumbs up (understand), sideways (partially), or down (not yet).",
        "Fast, low-stakes formative check that gives the teacher an immediate class overview.",
      ),
      tool(
        "pl-whiteboard-check",
        "Whiteboard Check",
        "Students write answers on mini whiteboards and display them simultaneously.",
        "Students write their answer and hold up boards on the teacher's signal; teacher scans for correct and incorrect responses.",
        "Provides simultaneous whole-class assessment with immediate feedback.",
      ),
      tool(
        "pl-traffic-light-cards",
        "Traffic Light Cards",
        "Students use coloured cards to signal confidence or understanding levels.",
        "Students display green (confident), amber (partially understand), or red (need support) in response to a question or task.",
        "Allows the teacher to quickly identify who needs support without students feeling singled out.",
      ),
      tool(
        "pl-one-minute-summary",
        "One Minute Summary",
        "Students summarise what they have learned so far in exactly one minute.",
        "Set a timer; students write or say a summary of key learning. Compare with a partner.",
        "Reinforces understanding and surfaces gaps in knowledge.",
      ),
      tool(
        "pl-confidence-scale",
        "Confidence Scale",
        "Students rate their confidence level on a numbered scale and explain their reasoning.",
        "Display a 1–5 scale; students select their number and write one sentence explaining their choice.",
        "Encourages metacognition and helps teachers identify students needing support.",
      ),
      tool(
        "pl-quick-poll",
        "Quick Poll",
        "Students vote on a question, enabling the teacher to instantly assess class understanding.",
        "Ask a multiple-choice question; students vote using hands, cards, or a digital tool. Discuss the spread of answers.",
        "Provides rapid assessment data and opens discussion around different responses.",
      ),
      tool(
        "pl-spot-mistake",
        "Spot the Mistake",
        "Students identify and correct a deliberate mistake presented by the teacher.",
        "Show a worked example, statement, or piece of text with an intentional error; students find and explain the mistake.",
        "Deepens understanding by analysing errors and reinforcing correct knowledge.",
      ),
      tool(
        "pl-explain-partner",
        "Explain to Your Partner",
        "Students briefly teach a concept to a partner to consolidate and reinforce learning.",
        "Students take turns explaining a key idea in their own words; partners listen and add or correct.",
        "Strengthens understanding through peer explanation and active retrieval.",
      ),
      tool(
        "pl-micro-quiz",
        "Micro Quiz",
        "A short 3–5 question quiz provides a quick check of understanding before the lesson continues.",
        "Give students a short written or verbal quiz; mark together immediately and use results to guide next steps.",
        "Identifies gaps before moving on and promotes low-stakes retrieval practice.",
      ),
      tool(
        "pl-tweet-lesson",
        "Tweet the Lesson",
        "Students summarise the lesson in a very limited number of words, as if writing a tweet.",
        "Students write a 20–30 word summary of the key learning; share with a partner or display.",
        "Encourages concise communication and consolidation of learning.",
      ),
      tool(
        "pl-headline-summary",
        "Headline Summary",
        "Students create a newspaper-style headline that captures the main learning of the lesson.",
        "Students write a bold, informative headline summarising the lesson; compare with a partner and discuss.",
        "Promotes synthesis, concise thinking, and reflection on key ideas.",
      ),
      tool(
        "pl-sentence-challenge",
        "Sentence Challenge",
        "Students summarise the entire lesson using a single carefully constructed sentence.",
        "Students write one sentence that captures the main idea; share sentences and identify the most accurate.",
        "Challenges students to distil and communicate complex learning concisely.",
      ),
      tool(
        "pl-learning-journey",
        "Learning Journey Map",
        "Students reflect on the learning process by mapping what they learned and how they learned it.",
        "Students draw or write a brief journey showing starting knowledge, discoveries, challenges, and current understanding.",
        "Builds metacognitive awareness and helps students see their own progress.",
      ),
      tool(
        "pl-teach-teacher",
        "Teach the Teacher",
        "Students explain lesson content back to the teacher as a demonstration of understanding.",
        "Select a student or small group to teach back a key concept; teacher plays the role of learner and asks questions.",
        "Deepens understanding by requiring students to articulate and organise their knowledge.",
      ),
      tool(
        "pl-reflection-wheel",
        "Reflection Wheel",
        "Students evaluate different aspects of their learning using a segmented rating wheel.",
        "Provide a wheel divided into sections (e.g. understanding, effort, participation, questions); students shade each segment and annotate.",
        "Encourages holistic self-evaluation across multiple dimensions of learning.",
      ),
      tool(
        "pl-question-parking-lot",
        "Question Parking Lot",
        "Students leave unanswered questions on a display so the teacher can address them later.",
        "Students write remaining questions on sticky notes and post them on a designated parking lot board; teacher reviews and addresses next lesson.",
        "Ensures student questions are captured and not lost, and informs future planning.",
      ),
      tool(
        "pl-final-challenge",
        "Final Challenge Question",
        "Students independently apply their learning to a final problem or scenario.",
        "Present a challenge question requiring application of the lesson content; students respond individually in silence.",
        "Assesses deeper understanding and the ability to apply learning independently.",
      ),
    ],
  },
  {
    phase: "exitTicket",
    title: "Exit Ticket AFL Tools",
    tools: [
      tool(
        "et-one-minute-paper",
        "One Minute Paper",
        "Students write a quick response at the end of the lesson.",
        "One minute timed write answering a focused prompt on paper or digitally before leaving.",
        "Fast understanding check.",
      ),
      tool(
        "et-muddiest-point",
        "Muddiest Point",
        "Students write what they did not understand.",
        "Each learner names their muddiest point; teacher collects and addresses top themes next lesson.",
        "Identifies confusion.",
      ),
      tool(
        "et-exit-card",
        "Exit Card",
        "1–2 questions at the end of class.",
        "Printed or digital exit card with 1–2 short questions tied to today's objectives.",
        "Quick formative assessment.",
      ),
      tool(
        "et-emoji-scale",
        "Emoji Scale",
        "Students rate understanding using emojis.",
        "Show emoji scale (e.g. confused → confident); students circle or tap their level and optionally add one line why.",
        "Simple self-assessment.",
      ),
    ],
  },
  {
    phase: "successCriteria",
    title: "Success Criteria AFL Tools",
    tools: [
      tool(
        "sc-traffic-light",
        "Traffic Light System",
        "Green = fully understand, Yellow = partially understand, Red = need help.",
        "Students colour or mark traffic light against each success criterion on a checklist.",
        "Self-assessment.",
      ),
      tool(
        "sc-checklist-can-do",
        "Checklist Can Do Statements",
        "Students tick what they can do.",
        "Provide I-can statements aligned to objectives; students tick achieved criteria honestly.",
        "Tracks learning progress.",
      ),
      tool(
        "sc-two-stars-wish",
        "Two Stars and a Wish",
        "Two strengths and one improvement point.",
        "Students write two things they did well and one wish for improvement against the lesson goal.",
        "Feedback and reflection.",
      ),
      tool(
        "sc-rubric-scale",
        "Rubric Scale",
        "Levels of achievement from basic to advanced.",
        "Share rubric descriptors; students place their work or understanding on the scale with brief evidence.",
        "Clear success measurement.",
      ),
      tool(
        "sc-co-creation",
        "Success Criteria Co-Creation",
        "Students help generate the criteria that define successful completion of a task.",
        "Before the task, discuss with students what success looks like; collaboratively build a checklist or set of criteria.",
        "Increases ownership, clarity of expectations, and student commitment to quality.",
      ),
      tool(
        "sc-peer-success-check",
        "Peer Success Check",
        "Students review a partner's work against the agreed success criteria.",
        "In pairs, students read each other's work and mark which criteria have been met, then give verbal or written feedback.",
        "Develops evaluative thinking and provides actionable peer feedback.",
      ),
      tool(
        "sc-criteria-highlighting",
        "Success Criteria Highlighting",
        "Students highlight evidence in their own work showing where each criterion has been met.",
        "Using a colour code, students highlight different sections of their work corresponding to different criteria.",
        "Makes self-assessment concrete and visible, helping students see strengths and gaps.",
      ),
      tool(
        "sc-self-assessment-rubric",
        "Self-Assessment Rubric",
        "Students score their own work using a detailed rubric and identify areas for improvement.",
        "Provide a rubric with clear descriptors; students read their work, select their level for each criterion, and write one target.",
        "Builds honest self-evaluation skills and helps students set focused improvement goals.",
      ),
      tool(
        "sc-www-ebi",
        "WWW and EBI",
        "Students identify what went well and what even better if could improve their work.",
        "Students write WWW (What Went Well) and EBI (Even Better If) against their work or lesson performance.",
        "Structures reflective feedback and encourages positive and constructive self-evaluation.",
      ),
      tool(
        "sc-green-pen",
        "Green Pen Reflection",
        "Students use written feedback to make targeted improvements and show visible evidence of progress.",
        "After receiving teacher or peer feedback, students use a green pen to annotate, correct, or extend their work.",
        "Creates a clear record of growth and embeds a culture of responding to feedback.",
      ),
      tool(
        "sc-success-ladder",
        "Success Ladder",
        "Students identify which rung of the success ladder they have reached and plan their next step.",
        "Display a ladder with labelled rungs representing stages of mastery; students self-place and write one action to climb higher.",
        "Visualises progress and motivates students to set clear next-step targets.",
      ),
      tool(
        "sc-model-comparison",
        "Model Comparison",
        "Students compare their own work with a high-quality example and identify improvements they can make.",
        "Share an annotated model answer; students read it alongside their own work and write two specific improvements.",
        "Builds understanding of quality through exemplar analysis and targeted self-correction.",
      ),
    ],
  },
] as const;

const ALL_BY_ID: Map<string, AflToolDefinition> = new Map();
for (const g of AFL_PHASE_GROUPS) {
  for (const t of g.tools) {
    ALL_BY_ID.set(t.id, t);
  }
}

export function getAflToolById(id: string): AflToolDefinition | undefined {
  return ALL_BY_ID.get(id);
}

export function isValidAflPhaseId(v: string): v is AflPhaseId {
  return (AFL_PHASE_IDS as readonly string[]).includes(v);
}

/** One recommended pick per phase for the “Select Recommended” UI action. */
export const AFL_RECOMMENDED_IDS: Record<AflPhaseId, readonly string[]> = {
  starter: ["st-think-pair-share", "st-kwl-chart", "st-entry-ticket"],
  main: ["mn-i-do-we-do-you-do", "mn-socratic-questioning", "mn-concept-mapping"],
  differentiation: ["df-must-should-could", "df-tiered-tasks"],
  plenary: ["pl-3-2-1-reflection", "pl-one-word-summary"],
  exitTicket: ["et-exit-card", "et-one-minute-paper"],
  successCriteria: ["sc-traffic-light", "sc-checklist-can-do", "sc-two-stars-wish"],
};

/**
 * Mandatory AFL-driven PPT generation rules — injected into DeepSeek system prompts for all PPT work.
 */
export const PPT_AFL_DRIVEN_SYSTEM_RULES = `
### CORE SYSTEM RULE — PPT generation is AFL-driven
The PPT generation system is **driven by AFL tools** from the **AFL tool catalog** (six phases). Each lesson stage — **Starter**, **Main Phase**, **Differentiation**, **Plenary**, **Exit Ticket**, **Success Criteria** — must be **powered by AFL activities** on the matching slide. Understand every tool deeply: **how it works**, **classroom use**, and **purpose**.

### TEACHER CONTROL RULE (mandatory)
- If the teacher **selected** an AFL tool for a phase, you **MUST** use **exactly** that tool — **do NOT** replace it.
- Implement the selected tool as a **full classroom activity** with complete teacher facilitation steps and student tasks.
- If the teacher **did NOT** select a tool, **automatically select** the best tool for that phase based on **subject**, **grade**, **topic**, and **learning objectives** — then implement it fully.

### GENERAL AFL UNDERSTANDING RULE (mandatory)
- **Do NOT** mention a tool name without implementing it.
- Generate **actual classroom instructions**, **student tasks**, **teacher steps**, and **meaningful content** — not labels like “Use Think Pair Share” alone.

### LESSON STAGE AFL RULES (slide map)
| Slide | Stage | AFL rule |
|-------|-------|----------|
| 2 | Starter Activity | Teacher-selected **or** AI-selected **starter** AFL tool. Engaging, interactive, topic-related. **No** objectives, outcomes, or future-slide content. |
| 6 | Main Phase | **First** full core teaching content. **Then** embed **main phase** AFL tool(s) as interactive activities. |
| 7 | Differentiated Activity | **Differentiation** AFL tool — tasks for lower, middle, and higher achievers aligned with lesson content. |
| 8 | Connection (UAE Framework conditional) | **UAE Framework ON:** UAE Real Life and Cross Curricular Connection (landmarks/values, MOE, KHDA/SPEA, national identity, SDG UAE). **OFF:** Real Life and Cross Curricular Connection — **one** of cross-curricular, real life, career, global/SDG, or subject integration — **no UAE** mentions. **No** AFL tool on this slide. |
| 9 | Plenary | **Plenary** AFL tool — real classroom activity, fully implemented. |
| 10 | Extended Task | Homework/extended task content only — **no** AFL tool phase in catalog. |
| 11 | Exit Ticket | **Exit ticket** AFL tool — short focused assessment, immediate understanding check. |
| 12 | Success Criteria | **Success criteria** AFL tool — students assess their own learning. **No** duplication of exit ticket. |

### CRITICAL CONTENT RULES (mandatory — every slide)
1. **No slide** may contain content belonging to **another** slide.
2. **No** duplicated headings inside a slide body.
3. **No** repetition of the same content inside one slide.
4. **No** previewing future slides.
5. **No** mixing lesson components across slides.
6. Each slide must remain **strictly self-contained**.

### FINAL OUTPUT REQUIREMENT
Generate structured PPT slides with **pedagogically correct AFL integration** from the **AFL tool catalog only**. Teacher selections override AI picks. Every AFL-powered slide must be **classroom-ready**, not meta-instructions.
`.trim();

export type PptSlideAflContext = {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
};

type PptSlideAflBinding = {
  selectionPhase: AflPhaseId;
  autoSelectPhase: AflPhaseId;
  autoSelectCandidateIds?: readonly string[];
  stageLabel: string;
};

/** AFL bindings per deck slide (1-based). Slides 8 and 10 have no AFL phase. */
export const PPT_SLIDE_AFL_BINDINGS: Partial<Record<number, PptSlideAflBinding>> = {
  2: { selectionPhase: "starter", autoSelectPhase: "starter", stageLabel: "Starter Activity" },
  6: { selectionPhase: "main", autoSelectPhase: "main", stageLabel: "Main Phase" },
  7: {
    selectionPhase: "differentiation",
    autoSelectPhase: "differentiation",
    stageLabel: "Differentiated Activity",
  },
  9: { selectionPhase: "plenary", autoSelectPhase: "plenary", stageLabel: "Plenary" },
  11: { selectionPhase: "exitTicket", autoSelectPhase: "exitTicket", stageLabel: "Exit Ticket" },
  12: {
    selectionPhase: "successCriteria",
    autoSelectPhase: "successCriteria",
    stageLabel: "Success Criteria and Self Evaluation",
  },
};

function hashPickIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % length;
}

function toolsForPhase(phase: AflPhaseId): readonly AflToolDefinition[] {
  return AFL_PHASE_GROUPS.find((g) => g.phase === phase)?.tools ?? [];
}

function formatToolCatalogLines(tools: readonly AflToolDefinition[]): string {
  return tools
    .map(
      (t) =>
        `- **${t.label}** (\`${t.id}\`)\n  - How it works: ${t.howItWorks}\n  - Classroom use: ${t.classroomUse}\n  - Purpose: ${t.purpose}`,
    )
    .join("\n");
}

function formatToolPromptLine(t: AflToolDefinition): string {
  return `- **${t.label}** (\`${t.id}\`): How it works — ${t.howItWorks} Classroom use — ${t.classroomUse} Purpose — ${t.purpose}`;
}

/** Suggested default tool id when the teacher did not select (deterministic from lesson context). */
export function suggestAutoAflToolId(
  slideNumber1Based: number,
  ctx: PptSlideAflContext,
): string | undefined {
  const binding = PPT_SLIDE_AFL_BINDINGS[slideNumber1Based];
  if (!binding) return undefined;
  const pool =
    binding.autoSelectCandidateIds ??
    AFL_RECOMMENDED_IDS[binding.autoSelectPhase] ??
    toolsForPhase(binding.autoSelectPhase).map((t) => t.id);
  if (!pool.length) return undefined;
  const seed = `${slideNumber1Based}|${ctx.subject}|${ctx.grade}|${ctx.topic}|${ctx.learningObjectives}`;
  return pool[hashPickIndex(seed, pool.length)];
}

/**
 * Same deterministic picks the PPT auto-select prompt suggests for each
 * AFL-bearing slide (2, 6, 7, 9, 11, 12), grouped by phase. Used so that when
 * a teacher generates AFL Activity Sheets without picking specific tools,
 * the sheets match what the PPT was told to use rather than going blank.
 */
export function buildAutoAflSelections(ctx: PptSlideAflContext): AflSelectionsPayload {
  const out: AflSelectionsPayload = {};
  for (const slideNum of [2, 6, 7, 9, 11, 12] as const) {
    const binding = PPT_SLIDE_AFL_BINDINGS[slideNum];
    if (!binding) continue;
    const suggestedId = suggestAutoAflToolId(slideNum, ctx);
    if (!suggestedId) continue;
    const phase = binding.selectionPhase;
    const existing = out[phase] ?? [];
    if (!existing.includes(suggestedId)) out[phase] = [...existing, suggestedId];
  }
  return out;
}

export type AflSelectionsPayload = Partial<Record<AflPhaseId, string[]>>;

/** Keep only known phase keys and tool ids that belong to that phase. */
export function sanitizeAflSelections(raw: unknown): AflSelectionsPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AflSelectionsPayload = {};
  for (const phase of AFL_PHASE_IDS) {
    const arr = (raw as Record<string, unknown>)[phase];
    if (!Array.isArray(arr)) continue;
    const allowed = new Set(
      AFL_PHASE_GROUPS.find((g) => g.phase === phase)?.tools.map((x) => x.id) ?? [],
    );
    const ids = arr
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((id) => allowed.has(id));
    if (ids.length) out[phase] = [...new Set(ids)];
  }
  return out;
}

/** Map deck slide number (1-based) to AFL phase for teacher selections. */
export function getAflPhaseForPptSlideNumber1Based(slideNumber1Based: number): AflPhaseId | undefined {
  return PPT_SLIDE_AFL_BINDINGS[slideNumber1Based]?.selectionPhase;
}

function formatTeacherSelectedAflBlock(binding: PptSlideAflBinding, ids: string[]): string {
  const lines: string[] = [
    `### AFL for THIS slide — ${binding.stageLabel} (MANDATORY — teacher selected)`,
    "The teacher **selected** the AFL tool(s) below. You **MUST** use **exactly** these tools — **do NOT** replace them. Implement each as a **full classroom activity**: how it works, classroom use steps, student tasks, teacher facilitation, timing, and finished learner-facing prompts — **not** a label.",
    "",
  ];
  const group = AFL_PHASE_GROUPS.find((g) => g.phase === binding.selectionPhase);
  lines.push(`**${group?.title ?? binding.selectionPhase}**`);
  for (const id of ids) {
    const t = getAflToolById(id);
    if (!t) continue;
    lines.push(formatToolPromptLine(t));
  }
  return lines.join("\n").trim();
}

function formatAutoSelectAflBlock(
  slideNumber1Based: number,
  binding: PptSlideAflBinding,
  ctx: PptSlideAflContext,
): string {
  const catalogPhase = binding.autoSelectPhase;
  const catalogTools = toolsForPhase(catalogPhase);
  const suggestedId = suggestAutoAflToolId(slideNumber1Based, ctx);
  const suggested = suggestedId ? getAflToolById(suggestedId) : undefined;

  const lines: string[] = [
    `### AFL for THIS slide — ${binding.stageLabel} (AI must auto-select — teacher did not choose)`,
    "The teacher did **not** select an AFL tool. Pick the **most suitable** tool from the catalog below for **subject**, **topic**, **grade**, and **objectives** — implement it **fully** as classroom-ready content.",
  ];
  if (suggested) {
    lines.push("", `**Suggested default:** ${formatToolPromptLine(suggested)}`);
  }
  lines.push(
    "",
    `**Catalog — ${AFL_PHASE_GROUPS.find((g) => g.phase === catalogPhase)?.title ?? catalogPhase}:**`,
    formatToolCatalogLines(catalogTools),
  );

  if (slideNumber1Based === 6) {
    lines.push(
      "",
      "**Main Phase structure (mandatory):** Present **full core teaching content first**, then embed your chosen main-phase AFL tool as interactive activities.",
    );
  }
  if (slideNumber1Based === 7) {
    lines.push(
      "",
      "**Differentiation structure (mandatory):** Use your chosen differentiation AFL tool to set tasks for **lower**, **middle**, and **higher** achievers aligned with the lesson.",
    );
  }
  if (slideNumber1Based === 11) {
    lines.push(
      "",
      "**Exit Ticket rule:** Short, focused assessment only — immediate understanding check. **No** success criteria.",
    );
  }

  return lines.join("\n").trim();
}

/** AFL instructions for one slide-only DeepSeek call. */
export function formatAflForSinglePptSlidePrompt(
  slideNumber1Based: number,
  selections: AflSelectionsPayload,
  ctx?: PptSlideAflContext,
): string {
  const binding = PPT_SLIDE_AFL_BINDINGS[slideNumber1Based];
  if (!binding) return "";

  const teacherIds = selections[binding.selectionPhase];
  if (teacherIds?.length) {
    return formatTeacherSelectedAflBlock(binding, teacherIds);
  }

  if (!ctx) return "";
  return formatAutoSelectAflBlock(slideNumber1Based, binding, ctx);
}

export function formatAflForAiPrompt(
  selections: AflSelectionsPayload,
  ctx?: PptSlideAflContext,
): string {
  const hasTeacherPicks = AFL_PHASE_IDS.some((p) => (selections[p]?.length ?? 0) > 0);
  const lines: string[] = [PPT_AFL_DRIVEN_SYSTEM_RULES, ""];

  if (hasTeacherPicks) {
    lines.push(
      "### Teacher-selected AFL tools (MANDATORY — override AI selection)",
      "Use **exactly** the teacher's picks — **do NOT** substitute. Implement each as **full classroom activities** with teacher instructions and student tasks for this topic, grade, and subject.",
      "",
      "**PPT Slide Content:** Embed tools on slide **2** Starter, **6** Main Phase (after teaching), **7** Differentiation, **9** Plenary, **11** Exit Ticket, **12** Success Criteria. Slide **8** = one connection only (no AFL phase). Slide **10** = extended task only (no AFL phase).",
      "",
      "**Picture Prompt Image Analysis (if selected):** Write the exact observation and prediction prompts for the starter image.",
      "",
      "**Teacher selections (implement fully):**",
      "",
    );
    let listedAny = false;
    for (const group of AFL_PHASE_GROUPS) {
      const ids = selections[group.phase];
      if (!ids?.length) continue;
      listedAny = true;
      lines.push(`**${group.title}**`);
      for (const id of ids) {
        const t = getAflToolById(id);
        if (!t) continue;
        lines.push(formatToolPromptLine(t));
      }
      lines.push("");
    }
    if (!listedAny) return "";
    return lines.join("\n").trim();
  }

  if (!ctx) return "";

  lines.push(
    "### No teacher AFL selections — AI must auto-select per AFL-powered slide",
    "Auto-select the best tool per phase for slides **2, 6, 7, 9, 11, 12** and implement fully.",
    "",
    "**Per-slide guidance:**",
  );

  for (const slideNum of [2, 6, 7, 9, 11, 12] as const) {
    const binding = PPT_SLIDE_AFL_BINDINGS[slideNum];
    if (!binding) continue;
    const suggestedId = suggestAutoAflToolId(slideNum, ctx);
    const suggested = suggestedId ? getAflToolById(suggestedId) : undefined;
    lines.push(
      `- Slide **${slideNum}** (${binding.stageLabel}): auto-select from **${binding.autoSelectPhase}**${
        suggested ? ` — suggested: **${suggested.label}**` : ""
      }`,
    );
  }

  lines.push("", "**Full 87-tool catalog:**", "");
  for (const group of AFL_PHASE_GROUPS) {
    lines.push(`**${group.title}**`);
    lines.push(formatToolCatalogLines(group.tools));
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** One short classroom line for slide bullets (name + purpose). */
export function briefHowToUseForSlide(howToUse: string, maxLen = 160): string {
  const t = howToUse.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const purposeIdx = t.toLowerCase().indexOf("purpose:");
  const slice = purposeIdx > 0 ? t.slice(purposeIdx) : t;
  return slice.length > maxLen ? `${slice.slice(0, maxLen - 1).trim()}…` : slice;
}

export function formatToolsBlockForSlide(phase: AflPhaseId, selectedIds: string[] | undefined): string {
  if (!selectedIds?.length) return "";
  const parts: string[] = ["\n\nSelected AFL for this part of the lesson\n"];
  for (const id of selectedIds) {
    const t = getAflToolById(id);
    if (!t) continue;
    parts.push(`• ${t.label}: ${t.purpose}`);
  }
  return parts.length > 1 ? parts.join("\n") : "";
}

/** Split tool ids across N slides (round-robin). */
export function distributeIds(ids: string[], buckets: number): string[][] {
  if (buckets <= 0) return [];
  const out: string[][] = Array.from({ length: buckets }, () => [] as string[]);
  ids.forEach((id, i) => {
    out[i % buckets]!.push(id);
  });
  return out;
}

export function formatDocxAflAppendix(selections: AflSelectionsPayload): string {
  const lines: string[] = [
    "",
    "────────────────────────────────────────",
    "Selected AFL tools (teacher checklist)",
    "────────────────────────────────────────",
    "",
  ];
  let any = false;
  for (const group of AFL_PHASE_GROUPS) {
    const ids = selections[group.phase];
    if (!ids?.length) continue;
    any = true;
    lines.push(group.title);
    for (const id of ids) {
      const t = getAflToolById(id);
      if (!t) continue;
      lines.push(`• ${t.label}`);
      lines.push(`  How it works: ${t.howItWorks}`);
      lines.push(`  Classroom use: ${t.classroomUse}`);
      lines.push(`  Purpose: ${t.purpose}`);
    }
    lines.push("");
  }
  return any ? lines.join("\n") : "";
}

/**
 * Builds a focused DeepSeek user-message that generates AFL Activity Sheets.
 * One printable student-facing sheet per selected AFL tool.
 */
export function buildAflActivitySheetsUserMessage(params: {
  input: { subject: string; grade: string; topic: string; chapter: string; curriculumType: string };
  selections: AflSelectionsPayload;
  sourceMaterialBlock?: string;
}): string | null {
  const { input, selections, sourceMaterialBlock } = params;
  const selectedTools: AflToolDefinition[] = [];
  for (const group of AFL_PHASE_GROUPS) {
    const ids = selections[group.phase] ?? [];
    for (const id of ids) {
      const t = getAflToolById(id);
      if (t) selectedTools.push(t);
    }
  }
  if (!selectedTools.length) return null;

  const toolList = selectedTools
    .map(
      (t, i) =>
        `${i + 1}. **${t.label}** — How it works: ${t.howItWorks} Classroom use: ${t.classroomUse}`,
    )
    .join("\n");

  const chapterLine = input.chapter.trim()
    ? `Chapter / unit: ${input.chapter.trim()}`
    : "Chapter / unit: not specified";

  return `
Generate a complete set of **printable AFL Activity Sheets** — one sheet per AFL tool listed below.

### Lesson context
- Curriculum: ${input.curriculumType}
- Grade / Year group: ${input.grade}
- Subject: ${input.subject}
- ${chapterLine}
- Topic: ${input.topic}
${sourceMaterialBlock ?? ""}

### Selected AFL tools (generate one sheet per tool in this order)
${toolList}

### Rules for EVERY sheet
- **Heading:** AFL tool name + topic (e.g. "Learning Stations — Photosynthesis")
- **Student instructions:** clear, grade-appropriate, written directly to the student (second person). No teacher instructions on the sheet.
- **Full activity content** — generate the complete content the student interacts with:
  - **Learning Stations** → 3 to 4 numbered station cards, each with a clear heading and 2–3 tasks or questions the student completes at that station.
  - **KWL Chart** → a 3-column table (K: What I Know | W: What I Want to Know | L: What I Learned) with 5–6 blank row prompts in each column described as "_______________".
  - **Think Pair Share** → the exact focus question written out, then "My thinking (individual): _______________", "My partner's ideas: _______________", "What we will share: _______________".
  - **Jigsaw Activity** → separate expert group cards (Group A, B, C, D) each with their specific content section and 2 comprehension questions.
  - **Gallery Walk** → an observation sheet with rows for each display item: "Display __: I notice… | My feedback…".
  - **Concept Mapping** → the central concept pre-filled, 4–6 surrounding node labels, connecting prompts: "connects to ___ because ___".
  - **Socratic Questioning** → a discussion record sheet with the central question, 4–5 sub-questions for the student to answer in writing.
  - **Must Should Could** → three clearly labelled task boxes (Must / Should / Could) each with a full task written out.
  - **Choice Board** → a 3×3 grid of fully written activity options the student circles or ticks.
  - **Tiered Tasks** → Level 1 (Basic), Level 2 (Expected), Level 3 (Challenge) each with fully written tasks.
  - **Learning Menus** → Starter task, Main task, Dessert (extension) task — each fully written.
  - **3-2-1 Reflection** → "3 things I learned: 1.___ 2.___ 3.___", "2 interesting points: 1.___ 2.___", "1 question I still have: ___".
  - **Hot Seat** → a question card set: 5–6 questions the class will ask, space for the hot-seat student to write quick answers.
  - **One Word Summary** → "My one word: _______ Because: _______________".
  - **Snowball Activity** → the response prompt + "Write your answer, crumple, toss, unfold, read, and discuss with the person who caught it."
  - **One Minute Paper** → a timed-write prompt with "Your answer (write for 1 minute): _______________".
  - **Muddiest Point** → "The muddiest (least clear) thing from today's lesson is: _______________".
  - **Exit Card** → 2 focused questions written out with answer space.
  - **Emoji Scale** → the emoji scale drawn in ASCII (e.g. 😕  😐  🙂  😊  🤩) with "Circle your level:" + "One sentence about why: ___".
  - **Traffic Light System** → a checklist of 4–5 I-can statements each with 🔴 🟡 🟢 tick boxes described in text.
  - **Checklist Can Do Statements** → 5–6 "I can…" statements the student ticks.
  - **Two Stars and a Wish** → "⭐ Star 1: ___ ⭐ Star 2: ___ 🌟 Wish: ___".
  - **Rubric Scale** → a 4-level rubric table (Beginning / Developing / Achieving / Excelling) with 2–3 criteria rows fully written.
- Separate each sheet with: ─────────────────────────────────────────────
- Use plain text only — no markdown code fences. Use 1. 2. 3. or simple lines for lists.
- All content must be specific to the **topic**, **subject**, and **grade** — not generic placeholders.

Wrap the entire output between:
AFL ACTIVITY SHEETS START
…all sheets…
AFL ACTIVITY SHEETS END
`.trim();
}

