/**
 * Grade 6 Science — Photosynthesis. Deterministic OFFLINE fixture for the five educational-quality fixes.
 *
 * Source: hand-authored on 2026-10-23 for this regression test; no DeepSeek, Gamma or image provider was called.
 * It is shaped exactly like a saved lesson: 13 slide bodies + teacher notes + one structured main-phase activity +
 * the deck-quality trailer (one selected SDG, question sources with expected answers), assembled through the real
 * save format (assembleFullPptFromSlideBodies) and read back through the real export parser.
 *
 * Two deliberate legacy defects prove the export-time safety nets, not just the prompts:
 *  - slide 7 still uses the old "Higher/Middle/Lower Achievers task" headings (a lesson saved before the change);
 *  - slide 8 contains one KHDA compliance sentence, which must leave the student slide for the speaker notes.
 */
import type { DeckQualityMetadata } from "@/lib/ppt-educational-quality";
import type { MainPhaseActivityInstruction } from "@/lib/ppt-main-phase-activity";

export const PHOTOSYNTHESIS_LESSON = {
  subject: "Science",
  grade: "Grade 6",
  topic: "Photosynthesis",
  chapter: "How Plants Make Food",
  curriculumFramework: "uae_moe_khda_spea",
  learningObjectives: "Explain what plants need for photosynthesis and what they produce.\nUse the word equation for photosynthesis.",
};

export const PHOTOSYNTHESIS_BODIES: string[] = [
  // 1 title
  "Science, Grade 6\nGrade 6\nThursday, 23 October 2026",
  // 2 starter
  "Think, Pair, Share: The Two Plants\nLook at the two bean plants. One grew on a sunny windowsill. One grew in a dark cupboard.\nThink: What differences do you notice in colour and size?\nPair: Tell your partner which plant looks healthier and why.\nShare: The plant in the dark is pale and weak because it could not make enough food without light.",
  // 3 chapter, topic, SDG
  "Chapter: How Plants Make Food\nTopic: Photosynthesis\nSDG Goal: SDG 2 — Zero Hunger",
  // 4 objectives
  "Explain what plants need for photosynthesis and what they produce.\nUse the word equation for photosynthesis.",
  // 5 outcomes
  "By the end of this lesson, you will be able to:\nName the three things a plant needs for photosynthesis.\nName the two things photosynthesis produces.\nWrite the word equation for photosynthesis.",
  // 6 main phase (key ideas; the Jigsaw activity is carried as structured metadata below)
  "Key ideas\nPhotosynthesis is how green plants make their own food.\nPlants need light energy, water and carbon dioxide.\nChlorophyll in the leaves traps light energy.\nThe plant makes glucose, a sugar it uses for energy and growth.\nOxygen is released into the air.\nWord equation: carbon dioxide + water → glucose + oxygen (light energy, chlorophyll)",
  // 7 differentiation + mini plenary (legacy ability labels on purpose)
  "Higher Achievers task\nPredict what would happen to a plant kept in light but with no carbon dioxide, and explain why.\nMiddle Achievers task\nDraw a leaf and label where light, water and carbon dioxide go in, and where oxygen comes out.\nLower Achievers task\nComplete the sentence: A plant needs ______, ______ and ______ to make food.\nMini Plenary\nWhich gas do plants release during photosynthesis?",
  // 8 UAE connection (one compliance sentence on purpose)
  "UAE Real-Life Connection: The Ghaf tree survives the UAE desert because its leaves use strong sunlight for photosynthesis.\nCross-Curricular Task: In Mathematics, record how many hours of sunlight Dubai gets in July and in January, and explain which month helps plants make more food.\nThis lesson meets KHDA inspection standards for science teaching.\nSDG in UAE Context: SDG 2 — Zero Hunger. UAE vertical farms grow vegetables under lights so plants can photosynthesise all year.",
  // 9 plenary with a Hot Seat round
  "Hot Seat: Photosynthesis Expert\nOne volunteer sits in the hot seat as a leaf.\nAsk the leaf: What do you need from the air to make food?\nAsk the leaf: Where does your energy come from?\nAsk the leaf: What do you give back to the air?\nThe class gives a thumbs up if they agree with the leaf's answer.",
  // 10 extended task
  "Leaf Detective at Home\n1. Put one small plant on a sunny windowsill and one in a dark cupboard for three days.\n2. Each day, write one sentence about colour and one about size.\n3. On day three, explain the difference using the words light, chlorophyll and food.\nChallenge: Predict what would happen after two weeks.",
  // 11 exit ticket
  "Exit Card\n1. Name the three things a plant needs for photosynthesis.\n2. Complete the word equation: carbon dioxide + ______ → glucose + ______",
  // 12 success criteria
  "Traffic Light: Green = I can do this alone. Yellow = I need a little help. Red = I need help.\nI can name what a plant needs for photosynthesis.\nI can name what photosynthesis produces.\nI can write the word equation.",
  // 13 takeaway
  "Think back to Photosynthesis: plants use light energy to turn carbon dioxide and water into glucose and oxygen.\nWhat question do you still have about how plants make food?",
];

export const PHOTOSYNTHESIS_TEACHER_NOTES: string[] = [
  "Welcome the class and introduce today's topic.",
  "Timing: 5 minutes. Pairs, then a whole-class share. Ask: Why might the plant in the dark look pale? Watch for: students who say plants eat soil; prompt: \"Where does the plant's food come from?\"",
  "Timing: 2 minutes. Read the chapter, topic and SDG aloud.",
  "Timing: 2 minutes. Read the objectives together.",
  "Timing: 2 minutes. Ask students to rate their confidence for each outcome.",
  "Timing: 20 minutes. Explain each key idea with the bean plants from the starter. Model the word equation on the board. Common misconception: plants get their food from the soil; prompt: \"What does the plant make for itself in its leaves?\"",
  "Timing: 10 minutes. Students choose a task and move on when ready. Watch for: students who list light without explaining it as energy.",
  "Timing: 5 minutes. Pairs. Ask: How does the desert sunlight help the Ghaf tree?",
  "Timing: 6 minutes. Choose a confident volunteer first. Watch for: students mixing up oxygen and carbon dioxide; prompt: \"Which gas do we breathe out?\"",
  "Timing: 2 minutes. Explain the home task and the deadline.",
  "Timing: 3 minutes. Individual and silent. Collect the cards at the door.",
  "Timing: 2 minutes. Students colour each statement.",
  "Timing: 1 minute. Close with the reflective question.",
];

export const PHOTOSYNTHESIS_ACTIVITIES: MainPhaseActivityInstruction[] = [
  {
    activityId: "jigsaw-photosynthesis",
    activityName: "Jigsaw: Photosynthesis Experts",
    activityGoal: "become an expert on one part of photosynthesis and teach your group",
    studentInstructions: [
      "Join your expert group at your station card.",
      "Read your station card and underline three key words.",
      "Discuss with your expert group what your card means.",
      "Return to your home group of four.",
      "Teach your home group your station in one minute.",
    ],
    durationMinutes: 12,
    groupSize: "4",
    studentRole: "Expert and teacher",
    requiredMaterials: ["four station cards", "mini whiteboards"],
    expectedOutput: "your home group has a completed photosynthesis diagram",
    teacherNotes: "Set up the four stations before the lesson. Circulate during expert time and check each expert can explain their card in their own words. Watch for: groups that copy the card instead of explaining it.",
    activityContent: "Station 1 — Light: Chlorophyll in the leaves traps light energy.\nStation 2 — Water: Roots take in water, which travels up to the leaves.\nStation 3 — Carbon dioxide: Air enters the leaf through tiny holes called stomata.\nStation 4 — Products: The leaf makes glucose for energy and releases oxygen.",
    activityType: "jigsaw",
    parentElementId: "main-phase",
  },
];

export const PHOTOSYNTHESIS_DECK_QUALITY: DeckQualityMetadata = {
  selectedSdg: { id: 2, name: "Zero Hunger", description: "End hunger; plants are the base of every food chain." },
  questions: [
    { questionId: "q1", questionText: "Which gas do plants release during photosynthesis?", expectedAnswer: "Oxygen.", sourceElementIds: ["main-phase"], learningObjectiveRef: "Explain what plants need for photosynthesis and what they produce.", questionElementId: "differentiation" },
    { questionId: "q2", questionText: "What do you need from the air to make food?", expectedAnswer: "Carbon dioxide, which enters through the stomata.", sourceElementIds: ["main-phase"], learningObjectiveRef: "Explain what plants need for photosynthesis and what they produce.", questionElementId: "plenary" },
    { questionId: "q3", questionText: "Where does your energy come from?", expectedAnswer: "Light energy from the Sun, trapped by chlorophyll.", sourceElementIds: ["main-phase"], learningObjectiveRef: "Explain what plants need for photosynthesis and what they produce.", questionElementId: "plenary" },
    { questionId: "q4", questionText: "What do you give back to the air?", expectedAnswer: "Oxygen.", sourceElementIds: ["main-phase"], learningObjectiveRef: "Explain what plants need for photosynthesis and what they produce.", questionElementId: "plenary" },
    { questionId: "q5", questionText: "Name the three things a plant needs for photosynthesis.", expectedAnswer: "Light energy, water and carbon dioxide.", sourceElementIds: ["main-phase", "starter"], learningObjectiveRef: "Explain what plants need for photosynthesis and what they produce.", questionElementId: "exit-ticket" },
    { questionId: "q6", questionText: "Complete the word equation: carbon dioxide + ______ → glucose + ______", expectedAnswer: "water; oxygen.", sourceElementIds: ["main-phase"], learningObjectiveRef: "Use the word equation for photosynthesis.", questionElementId: "exit-ticket" },
  ],
};
