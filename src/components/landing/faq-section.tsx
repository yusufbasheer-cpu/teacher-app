import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/marketing/section-label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { PLANS } from "@/lib/plans";

const FAQS = [
  {
    q: "Which curriculums does Layah support?",
    a: "CBSE, ICSE, IB, Cambridge, UAE MOE, British and American curricula, and 15+ more. Pick your curriculum when you generate and every resource is aligned to it.",
  },
  {
    q: "Is there a free plan?",
    a: `Yes — the free plan includes ${PLANS.free.generationsLimit} lesson plan generations every month, forever, with no credit card required.`,
  },
  {
    q: "Are resources KHDA and SPEA aligned for UAE schools?",
    a: "Yes. UAE schools can generate lesson plans and PPTs structured to meet KHDA and SPEA inspection requirements out of the box.",
  },
  {
    q: "Is my data private?",
    a: "Your lesson plans, uploads, and personal information are stored securely and never shared with or sold to third parties.",
  },
  {
    q: "How does generation actually work?",
    a: "Enter a subject, grade, and topic (or upload a textbook page), pick your curriculum and any AFL tools you want, and Layah generates a complete lesson package — plan, PPT, worksheets, and assessments — in seconds.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, anytime, from your account settings — no contracts, no long-term commitment.",
  },
] as const;

export function FaqSection() {
  return (
    <section className="border-t border-line py-[72px]">
      <Container>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <SectionLabel className="flex justify-center">FAQ</SectionLabel>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Questions teachers ask
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            Can&apos;t find what you&apos;re looking for?{" "}
            <Link href="/faq" className="text-brand-text underline-offset-4 hover:underline">
              Visit the full help center
            </Link>
            .
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <Accordion>
            {FAQS.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  );
}
