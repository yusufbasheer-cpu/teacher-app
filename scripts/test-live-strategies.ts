/**
 * Calls /api/test-strategy on the live Vercel deployment for strategies 3-10.
 * Usage: npx tsx scripts/test-live-strategies.ts [BASE_URL]
 *   e.g. npx tsx scripts/test-live-strategies.ts https://layah.in
 */

const BASE_URL = process.argv[2] ?? "https://layah.in";
const PIN = process.env.SUPER_ADMIN_PIN ?? "305777";

const STRATEGIES_3_TO_10 = [
  "Inquiry-Based Learning",
  "Design Thinking",
  "Case Study-Based Learning",
  "Experiential Learning",
  "Cooperative and Collaborative Learning",
  "Flipped Classroom",
  "Challenge-Based Learning",
  "Discovery Learning",
];

type ScoreResult = {
  strategy: string;
  scores: {
    starter: number; mainPhase: number; differentiated: number;
    plenary: number; extendedTask: number;
    strategyAuthentic: boolean; uaeContext: boolean;
    classroomReady: boolean; overallScore: number;
  };
  authenticityLabel: string | null;
  contentLength: number;
  contentPreview: { starter: string; mainPhase: string; plenary: string };
};

async function testOne(strategy: string, idx: number): Promise<ScoreResult | null> {
  console.log(`\n${"═".repeat(72)}`);
  console.log(`[${idx + 3}/10] Testing: ${strategy}`);
  console.log(`${"═".repeat(72)}`);
  console.log(`⏳ Calling ${BASE_URL}/api/test-strategy …`);

  const res = await fetch(`${BASE_URL}/api/test-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy, pin: PIN }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ HTTP ${res.status}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as ScoreResult;
  const s = data.scores;

  const bar = (n: number) => "█".repeat(n) + "░".repeat(10 - n) + ` ${n}/10`;

  console.log(`\n📝 CONTENT QUALITY`);
  console.log(`  Starter Activity    ${bar(s.starter)}`);
  console.log(`  Main Phase          ${bar(s.mainPhase)}`);
  console.log(`  Differentiation     ${bar(s.differentiated)}`);
  console.log(`  Plenary             ${bar(s.plenary)}`);
  console.log(`  Extended Task       ${bar(s.extendedTask)}`);

  console.log(`\n🏫 CLASSROOM READINESS`);
  console.log(`  Specific / classroom-ready:  ${s.classroomReady ? "YES ✅" : "NO ❌"}`);
  console.log(`  UAE context present:         ${s.uaeContext ? "YES ✅" : "NO ❌"}`);
  console.log(`  KHDA standard:               ${s.overallScore >= 7 ? "YES ✅" : "NO ❌"}`);

  if (data.authenticityLabel) {
    console.log(`\n🎯 STRATEGY AUTHENTICITY`);
    console.log(`  ${data.authenticityLabel}: ${s.strategyAuthentic ? "YES ✅" : "NO ❌"}`);
  }

  console.log(`\n⭐ OVERALL SCORE: ${s.overallScore}/10  (content length: ${data.contentLength} chars)`);

  console.log(`\n📄 CONTENT PREVIEW`);
  const sp = data.contentPreview;
  if (sp.starter) {
    console.log(`  STARTER:\n  ${sp.starter.replace(/\n/g, "\n  ").slice(0, 350)}…`);
  }
  if (sp.mainPhase) {
    console.log(`  MAIN PHASE:\n  ${sp.mainPhase.replace(/\n/g, "\n  ").slice(0, 350)}…`);
  }

  if (s.overallScore < 7) {
    console.log(`\n  ⚠️  SCORE BELOW 7 — flagged for immediate fix`);
  }

  return data;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║   TEACHING STRATEGY TEST — Strategies 3-10 via Live API             ║");
  console.log(`║   Target: ${BASE_URL.padEnd(60)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  // Quick health check first
  try {
    const ping = await fetch(`${BASE_URL}/api/test-strategy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "test", pin: "wrong" }),
    });
    if (ping.status === 401) {
      console.log(`\n✅ Endpoint reachable and auth working`);
    } else {
      console.log(`\n⚠️  Unexpected status ${ping.status} on ping — may not be deployed yet`);
    }
  } catch (e) {
    console.error(`\n❌ Cannot reach ${BASE_URL} — check URL or wait for deploy`);
    process.exit(1);
  }

  const results: { strategy: string; score: number; pass: boolean }[] = [];
  const belowThreshold: ScoreResult[] = [];

  for (let i = 0; i < STRATEGIES_3_TO_10.length; i++) {
    const strategy = STRATEGIES_3_TO_10[i]!;
    const result = await testOne(strategy, i);
    if (result) {
      results.push({ strategy, score: result.scores.overallScore, pass: result.scores.overallScore >= 7 });
      if (result.scores.overallScore < 7) belowThreshold.push(result);
    }
    if (i < STRATEGIES_3_TO_10.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`${"═".repeat(72)}`);
  results.forEach((r) => {
    const icon = r.pass ? "✅" : "❌";
    console.log(`  ${icon}  ${r.strategy.padEnd(42)} ${r.score}/10`);
  });

  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1) : "N/A";
  console.log(`\n  Average score: ${avg}/10`);
  console.log(`  Strategies below 7: ${belowThreshold.length === 0 ? "NONE ✅" : belowThreshold.map((r) => r.strategy).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
