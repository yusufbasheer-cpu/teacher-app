import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/legal-page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | Layah.ai",
  description:
    "How Layah.ai collects, uses, and protects your data when you use our AI lesson planning tools for teachers.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="May 24, 2026">
      <p>
        Layah.ai (&quot;Layah,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides AI-powered
        lesson planning and classroom resource tools for educators. This Privacy Policy explains how we
        collect, use, disclose, and safeguard information when you use our website and services at{" "}
        <a href="https://layah.in" className="font-medium underline" style={{ color: "#00C6A7" }}>
          layah.in
        </a>{" "}
        and related applications (collectively, the &quot;Service&quot;).
      </p>

      <LegalSection title="1. Information we collect">
        <p>
          <strong className="text-[#0A1628]">Account information.</strong> When you register, we collect
          your email address, authentication details, and profile information you provide (such as your
          name or school affiliation, if optional fields are completed).
        </p>
        <p>
          <strong className="text-[#0A1628]">Content you submit.</strong> We process lesson topics,
          curriculum details, uploaded documents (PDFs, images), generated lesson plans, worksheets,
          question papers, and other materials you create or upload through the Service.
        </p>
        <p>
          <strong className="text-[#0A1628]">Usage and technical data.</strong> We may collect log data,
          device type, browser, IP address, pages visited, feature usage, and error reports to operate and
          improve the Service.
        </p>
        <p>
          <strong className="text-[#0A1628]">Payment information.</strong> If you purchase a paid plan,
          payment processing is handled by our payment provider. We do not store full card numbers on our
          servers.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve the Service</li>
          <li>Generate AI-assisted lesson plans, presentations, assessments, and related outputs you request</li>
          <li>Authenticate users and enforce one-session security policies</li>
          <li>Save and sync your lesson plans and generated content to your account</li>
          <li>Respond to support requests and communicate about your account</li>
          <li>Monitor usage, prevent abuse, and protect the security of our systems</li>
          <li>Comply with legal obligations</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. AI processing">
        <p>
          Layah uses third-party AI and infrastructure providers to process your inputs and produce
          outputs. Content you submit may be transmitted to these providers solely to deliver the
          features you request. We do not sell your lesson content to third parties for advertising
          purposes.
        </p>
        <p>
          AI-generated content may contain errors. You are responsible for reviewing all outputs before
          use in the classroom.
        </p>
      </LegalSection>

      <LegalSection title="4. How we share information">
        <p>We may share information with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-[#0A1628]">Service providers</strong> (hosting, authentication,
            analytics, AI APIs, email) who process data on our behalf under contractual obligations
          </li>
          <li>
            <strong className="text-[#0A1628]">Legal authorities</strong> when required by law or to
            protect rights, safety, and security
          </li>
          <li>
            <strong className="text-[#0A1628]">Business transfers</strong> in connection with a merger,
            acquisition, or sale of assets, with notice where required
          </li>
        </ul>
        <p>We do not sell personal information.</p>
      </LegalSection>

      <LegalSection title="5. Cookies and similar technologies">
        <p>
          We use cookies and local storage to keep you signed in, remember preferences (such as pricing
          currency), and understand how the Service is used. You can control cookies through your browser
          settings; some features may not work if cookies are disabled.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          We retain account and lesson data for as long as your account is active or as needed to provide
          the Service. You may request deletion of your account and associated content by contacting us.
          We may retain certain information as required for legal, security, or backup purposes.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We implement reasonable technical and organizational measures to protect your information,
          including encryption in transit, access controls, and session security. No method of
          transmission or storage is completely secure; we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="8. Children and schools">
        <p>
          The Service is intended for educators and educational institutions. If you use Layah on behalf
          of a school, you represent that you have authority to submit content in compliance with your
          institution&apos;s policies. Do not upload student personal data unless your school permits it
          and you have a lawful basis to do so.
        </p>
      </LegalSection>

      <LegalSection title="9. International users">
        <p>
          Layah may process and store information in countries other than your own. By using the Service,
          you consent to such processing where permitted by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or restrict
          processing of your personal data, and to object to certain processing or request portability.
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:support@layah.in"
            className="font-medium underline"
            style={{ color: "#00C6A7" }}
          >
            support@layah.in
          </a>
          . We will respond within a reasonable timeframe as required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the revised version on this
          page and update the &quot;Last updated&quot; date. Continued use of the Service after changes
          constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact us">
        <p>
          Questions about this Privacy Policy or our data practices? Email{" "}
          <a
            href="mailto:support@layah.in"
            className="font-medium underline"
            style={{ color: "#00C6A7" }}
          >
            support@layah.in
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
