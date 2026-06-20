export type ContentBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  readTime: number;
  coverGradient: string;
  content: ContentBlock[];
};

export const posts: BlogPost[] = [
  {
    slug: "how-ai-is-changing-lesson-planning",
    title: "How AI Is Changing Lesson Planning for Teachers in 2025",
    excerpt:
      "Discover how AI tools like Layah are helping teachers save hours each week by automating the most time-consuming parts of lesson planning.",
    author: "Mohammed Yusuf",
    publishedAt: "2026-06-10",
    readTime: 5,
    coverGradient: "linear-gradient(135deg, #0A1628 0%, #00C6A7 100%)",
    content: [
      {
        type: "p",
        text: "Lesson planning has always been one of the most time-intensive parts of a teacher's week. Studies suggest that teachers in the UAE and UK spend anywhere from 5 to 10 hours per week preparing lessons, writing assessments, and building classroom resources.",
      },
      {
        type: "h2",
        text: "The Traditional Lesson Planning Problem",
      },
      {
        type: "p",
        text: "Traditional lesson planning requires teachers to research curriculum standards, design learning objectives, create engaging activities, prepare materials, and think about differentiation — all before the school day even begins. This cognitive load is one of the leading causes of teacher burnout.",
      },
      {
        type: "h2",
        text: "Where AI Tools Fit In",
      },
      {
        type: "p",
        text: "AI tools like Layah don't replace the teacher — they remove the mechanical, repetitive work. A teacher who knows their students, their learning gaps, and what needs to happen in Monday's lesson can now generate a full lesson plan structure, complete with AFL tools, PowerPoint slides, and differentiated worksheets in a matter of minutes.",
      },
      {
        type: "ul",
        items: [
          "Lesson plans aligned to KHDA and SPEA frameworks",
          "PowerPoint presentations with structured lesson phases",
          "Differentiated worksheets for varied ability groups",
          "Question papers with mark schemes",
          "Activity sheets for 31 different AFL tools",
        ],
      },
      {
        type: "h2",
        text: "What Teachers Are Saying",
      },
      {
        type: "quote",
        text: "I used to spend my Sunday evenings dreading the week ahead. Now I use Layah to generate a draft in 10 minutes and spend the rest of my time refining it. It changed how I feel about Monday mornings.",
      },
      {
        type: "h2",
        text: "The Future of Teaching Prep",
      },
      {
        type: "p",
        text: "We are only at the beginning of what AI-assisted teaching looks like. The teachers who embrace these tools now will have more energy, more creativity, and more time to do what no AI can replace — build genuine relationships with their students and respond to the human moments in the classroom.",
      },
      {
        type: "p",
        text: "Layah is built by teachers, for teachers. Every feature in the platform started with a real conversation with a real educator. That's the foundation we're building on.",
      },
    ],
  },
  {
    slug: "khda-lesson-plan-guide",
    title: "A Teacher's Guide to Writing KHDA-Aligned Lesson Plans",
    excerpt:
      "Everything you need to know about writing lesson plans that meet KHDA inspection standards in Dubai schools, with practical tips on differentiation and AFL.",
    author: "Mohammed Yusuf",
    publishedAt: "2026-06-15",
    readTime: 7,
    coverGradient: "linear-gradient(135deg, #1a2a4a 0%, #00a88e 100%)",
    content: [
      {
        type: "p",
        text: "The Knowledge and Human Development Authority (KHDA) sets the inspection framework for private schools in Dubai. For teachers new to the UAE, understanding what KHDA inspectors look for in a lesson plan can feel overwhelming.",
      },
      {
        type: "h2",
        text: "What KHDA Inspectors Look For",
      },
      {
        type: "p",
        text: "KHDA inspections assess the quality of teaching and learning across six broad areas. Your lesson plans should demonstrate clear evidence of planning in each of these dimensions.",
      },
      {
        type: "ul",
        items: [
          "Clear learning objectives linked to curriculum standards",
          "Evidence of differentiation for high, mid, and lower-ability students",
          "AFL (Assessment for Learning) strategies embedded throughout the lesson",
          "Progression in student understanding from starter to plenary",
          "Cross-curricular links and real-world connections",
          "Student voice and collaborative learning opportunities",
        ],
      },
      {
        type: "h2",
        text: "The 5-Phase Lesson Structure",
      },
      {
        type: "p",
        text: "Most KHDA-aligned lessons follow a five-phase structure. This isn't rigid, but inspectors expect to see each phase clearly thought out in your planning.",
      },
      {
        type: "ol",
        items: [
          "Starter / Hook — Activate prior knowledge and engage curiosity",
          "Learning Objectives — Share goals with students, not just teachers",
          "Main Teaching — Direct instruction, modelling, guided practice",
          "Student Activity — Independent or collaborative task with AFL embedded",
          "Plenary — Consolidate learning, assess understanding, preview next lesson",
        ],
      },
      {
        type: "h2",
        text: "Differentiation Without Doubling Your Workload",
      },
      {
        type: "p",
        text: "One of the most common struggles teachers face is writing meaningful differentiation that goes beyond 'support, core, extension worksheets'. KHDA inspectors want to see differentiation woven into the fabric of the lesson, not bolted on as an afterthought.",
      },
      {
        type: "quote",
        text: "Differentiation is about adjusting pace, scaffolding, questioning depth, and expected output — not just giving different worksheets.",
      },
      {
        type: "h2",
        text: "Using Layah for KHDA-Ready Plans",
      },
      {
        type: "p",
        text: "Layah generates lesson plans specifically structured for KHDA and SPEA inspection frameworks. Every output includes phase-by-phase planning, embedded AFL tools, and differentiated activities — ready to print or present. It's the fastest way to go from a topic to a compliant, high-quality lesson plan.",
      },
    ],
  },
  {
    slug: "save-time-as-a-teacher",
    title: "10 Ways to Save Time as a Teacher Without Cutting Corners",
    excerpt:
      "Practical strategies that experienced teachers use to reclaim their evenings and weekends while still delivering excellent lessons every day.",
    author: "Mohammed Yusuf",
    publishedAt: "2026-06-18",
    readTime: 6,
    coverGradient: "linear-gradient(135deg, #0A1628 0%, #2563eb 100%)",
    content: [
      {
        type: "p",
        text: "Teacher workload is one of the defining issues in education right now. In the UAE, UK, and across the world, schools are struggling with retention precisely because the job expands to fill every available hour. Here are ten strategies that experienced teachers use to work smarter.",
      },
      {
        type: "h2",
        text: "1. Plan in Units, Not Individual Lessons",
      },
      {
        type: "p",
        text: "Spend one focused planning session mapping out a full unit before the term begins. When you know where the unit ends, each lesson writes itself faster. You can also reuse assessments, resources, and activity types across the unit.",
      },
      {
        type: "h2",
        text: "2. Use AI to Generate First Drafts",
      },
      {
        type: "p",
        text: "Tools like Layah can produce a complete lesson plan, PPT, and differentiated worksheets in minutes. Use the output as a starting point, then edit to fit your class. A 10-minute refinement of an AI draft beats 90 minutes of blank-page planning.",
      },
      {
        type: "h2",
        text: "3. Build a Resource Library",
      },
      {
        type: "p",
        text: "Every resource you create is an asset. Organise them by topic and year group, and you will naturally build a library you can draw from each year. After three years of teaching the same subject, your prep time drops dramatically.",
      },
      {
        type: "h2",
        text: "4. Batch Your Marking",
      },
      {
        type: "p",
        text: "Spreading marking across the week keeps it constantly on your mind. Instead, designate two or three marking sessions per week and leave the rest of your time clean for planning, rest, and recovery.",
      },
      {
        type: "h2",
        text: "5. Use AFL Instead of Summative Marking",
      },
      {
        type: "p",
        text: "Assessment for Learning (AFL) strategies — exit tickets, mini-whiteboards, peer assessment, traffic light self-marking — give you instant insight into student understanding without a marking pile. Embed them in every lesson and reduce the volume of work you take home.",
      },
      {
        type: "ul",
        items: [
          "Exit tickets take 5 minutes to review for a class of 30",
          "Peer marking with mark schemes teaches students metacognition",
          "Traffic light self-assessment identifies who needs support immediately",
          "Layah generates AFL activity sheets for 31 different tools",
        ],
      },
      {
        type: "h2",
        text: "6. Collaborate With Your Department",
      },
      {
        type: "p",
        text: "Split planning across your team. If there are four teachers in your department, each person plans one unit deeply and shares with the group. You each get four units for the work of one.",
      },
      {
        type: "h2",
        text: "7. Say No to Unnecessary Meetings",
      },
      {
        type: "p",
        text: "This one requires courage. Not every meeting needs your presence. Politely ask for meeting summaries where possible. Guard your planning time like it belongs to your students.",
      },
      {
        type: "h2",
        text: "8. Template Everything",
      },
      {
        type: "p",
        text: "Create templates for lesson plans, parent emails, report comments, and meeting agendas. Fill-in-the-blank is always faster than starting from scratch.",
      },
      {
        type: "h2",
        text: "9. Set a Hard Stop Time",
      },
      {
        type: "p",
        text: "Decide the time you will stop working each evening — and honour it. Work expands to fill the time you give it. A constraint forces prioritisation and protects your energy for the next day.",
      },
      {
        type: "h2",
        text: "10. Invest in the Right Tools",
      },
      {
        type: "p",
        text: "A carpenter doesn't use a hand saw when a power saw does the job in a tenth of the time. Teaching in 2025 means using AI tools, automation, and collaborative platforms to handle the mechanical parts of the job. Tools like Layah exist precisely for this.",
      },
      {
        type: "quote",
        text: "The best teachers aren't the ones who work the most hours. They're the ones who protect enough energy to actually be present with their students.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
