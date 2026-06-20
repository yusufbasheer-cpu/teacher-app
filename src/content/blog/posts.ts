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
    slug: "how-much-time-teachers-spend-lesson-planning",
    title: "How Much Time Do Teachers Really Spend on Lesson Planning? (And How to Get It Back)",
    excerpt:
      "Teachers spend an average of 7–12 hours per week on lesson planning alone. Here's what that time really costs you — and how to reclaim it without sacrificing quality.",
    author: "Mohammed Yusuf",
    publishedAt: "2026-06-20",
    readTime: 5,
    coverGradient: "linear-gradient(135deg, #0A1628 0%, #0891b2 100%)",
    content: [
      {
        type: "p",
        text: "Ask any teacher what their Sunday evening looks like and you will probably get the same answer: a laptop open on the kitchen table, a cold cup of tea, and a growing pile of lesson plans that still need finishing before Monday morning. The classroom hours are only part of the job. The planning, the preparation, the differentiation, the assessments — that is where the hidden shift begins.",
      },
      {
        type: "h2",
        text: "The Numbers Don't Lie",
      },
      {
        type: "p",
        text: "Research consistently shows that the average teacher works well beyond their contracted hours. In the UK, a 2023 Teacher Wellbeing Index found that teachers worked an average of 47 hours per week — nearly 12 hours more than their paid time. In the UAE, similar patterns emerge, with many teachers reporting that lesson planning and resource creation alone consume between 7 and 12 hours of their personal time each week.",
      },
      {
        type: "ul",
        items: [
          "7–12 hours per week on lesson planning and resource creation",
          "3–5 hours per week on marking and assessment",
          "2–4 hours per week on admin, emails, and data entry",
          "Up to 50% of this work happens outside contracted school hours",
          "Early-career teachers spend significantly more — often double these figures",
        ],
      },
      {
        type: "p",
        text: "These are not just numbers on a spreadsheet. They represent evenings taken from families, weekends that never quite feel like weekends, and a quiet erosion of the energy that teachers need to actually show up well for their students.",
      },
      {
        type: "h2",
        text: "What That Time Is Actually Costing You",
      },
      {
        type: "p",
        text: "The most obvious cost is personal time — but burnout runs deeper than that. When teachers are spending their evenings and weekends on planning, they arrive in the classroom tired. The creativity, the patience, the ability to read the room and respond to a student who is struggling — all of that requires energy that has already been spent. The irony is that teachers who overplan outside the classroom often underperform inside it, not because they are not talented, but because they are exhausted.",
      },
      {
        type: "quote",
        text: "We did not go into teaching to spend our lives making PowerPoints. We went into it for the moments when something clicks for a student. But by Friday, I barely have enough left in the tank to notice those moments.",
      },
      {
        type: "p",
        text: "Beyond burnout, there is a longer-term mental health cost. Teacher anxiety rates are significantly higher than the general population. The constant pressure to produce high-quality resources, hit curriculum standards, differentiate for every learner, and satisfy inspection frameworks — all while managing a classroom of real human beings — is genuinely unsustainable for many educators.",
      },
      {
        type: "h2",
        text: "Why Lesson Planning Takes So Long",
      },
      {
        type: "p",
        text: "It is worth being honest about why this takes as long as it does. A properly built lesson plan is not just a list of activities. It requires several distinct thinking tasks that each demand focused attention.",
      },
      {
        type: "ol",
        items: [
          "Researching curriculum standards and mapping learning objectives",
          "Designing a lesson sequence with clear phase transitions",
          "Choosing and writing AFL (Assessment for Learning) strategies",
          "Building differentiated tasks for high, mid, and lower-ability students",
          "Creating a presentation with visual structure and accurate content",
          "Writing worksheets, question papers, or activity sheets to accompany the lesson",
          "Cross-referencing school and inspection framework requirements",
        ],
      },
      {
        type: "p",
        text: "Done properly, this is two to three hours of work per lesson. For a teacher with five different lessons to plan each week, the mathematics are brutal.",
      },
      {
        type: "h2",
        text: "The Real Problem Is Not the Hours",
      },
      {
        type: "p",
        text: "Here is something that rarely gets said clearly: the problem is not that teachers are not working hard enough. The problem is that a significant portion of what teachers do outside the classroom is mechanical work that does not require their professional expertise. Typing out lesson objectives, formatting a PowerPoint, writing the same differentiation scaffolds they have written a hundred times before — none of this needs a qualified, experienced educator. It just needs time. And time is the one thing teachers do not have.",
      },
      {
        type: "h2",
        text: "How AI Is Changing the Equation",
      },
      {
        type: "p",
        text: "In the last two years, AI tools have quietly started to change what is possible for educators. Not by replacing the professional judgement that makes a great teacher, but by absorbing the mechanical layer of the job. Generating a first draft of a lesson plan structure, building a differentiated worksheet, producing a slide deck from a topic and learning objective — these are tasks that AI can now do in seconds.",
      },
      {
        type: "p",
        text: "Globally, schools that are embracing these tools are reporting something interesting: teachers are not becoming lazier. They are becoming more reflective. With the mechanical work handled, teachers spend their preparation time editing, refining, and adding the contextual knowledge that only they have — the specific needs of their class, the running jokes that make a hook land, the student who needs a slightly different scaffold. The quality of planning goes up, not down.",
      },
      {
        type: "h2",
        text: "Where Layah Fits In",
      },
      {
        type: "p",
        text: "Layah was built specifically for this gap. It is a platform that generates complete, curriculum-aligned lesson plans — including the PowerPoint presentation, differentiated worksheets, question papers, and AFL activity sheets — from a single topic input. The output takes minutes, not hours, and is structured to meet KHDA and SPEA inspection frameworks for teachers in the UAE.",
      },
      {
        type: "ul",
        items: [
          "Complete lesson plans with phase-by-phase structure",
          "PowerPoint presentations with built-in AFL tool integration",
          "Differentiated activity sheets for support, core, and extension groups",
          "Question papers with mark schemes",
          "31 AFL tool activity sheets ready to print and use",
        ],
      },
      {
        type: "p",
        text: "The goal was never to replace the teacher. It was to give the Sunday evening back.",
      },
      {
        type: "h2",
        text: "A Different Kind of Sunday Evening",
      },
      {
        type: "p",
        text: "Imagine finishing your lesson planning by 11am on a Sunday. Not because you cut corners — because you used the first two hours to generate solid drafts and spent the next hour making them yours. The rest of the day is yours. The week ahead feels lighter. You walk into Monday with something that teachers rarely get to feel: genuine readiness.",
      },
      {
        type: "p",
        text: "That is what we are building towards at Layah. Not just a faster way to make resources, but a sustainable way to teach — one where the energy you pour into the job actually makes it back to the classroom, and to the students who need it most.",
      },
      {
        type: "p",
        text: "If you have never tried Layah, your first lesson plan is free. No credit card, no commitment — just a glimpse of what Sunday evenings could look like when the planning takes care of itself.",
      },
    ],
  },
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
