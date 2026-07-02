// src/app/privacy/page.js
// IdeaLoop Core — Privacy Policy route.
// Pre-filled with real values. Before public launch, verify:
//   - EFFECTIVE_DATE below matches your actual publish date
//   - the KVKK cross-border paragraph (Section 7) once the görüş names the exact basis
//   - retention period in Section 8 (currently 90 days)
// Contact address must be live and monitored before this page is linked.

export const metadata = {
  title: 'Privacy Policy — IdeaLoop Core',
  description: 'How IdeaLoop Core collects, uses, and protects your personal data.',
};

const EFFECTIVE_DATE = '2 July 2026'; // update to your actual publish date
const CONTACT_EMAIL = 'privacy@idealoopcore.com';
const CONTROLLER = 'Emre Yıldız, operating IdeaLoop Core';

const css = `
.ilc-legal-page { background:#fff; min-height:100vh; }
.ilc-legal { max-width:720px; margin:0 auto; padding:64px 24px 96px; color:#1c1c1e;
  font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
.ilc-legal a { color:#6f66b8; text-decoration:none; }
.ilc-legal a:hover { text-decoration:underline; }
.ilc-legal .topnav { margin-bottom:40px; font-size:14px; }
.ilc-legal h1 { font-size:28px; line-height:1.25; margin:0 0 6px; letter-spacing:-0.01em; }
.ilc-legal .sub { color:#8a8a8e; font-size:14px; margin:0 0 40px; }
.ilc-legal h2 { font-size:18px; margin:40px 0 12px; letter-spacing:-0.01em; }
.ilc-legal p, .ilc-legal li { color:#333; }
.ilc-legal ul { padding-left:20px; margin:12px 0; }
.ilc-legal li { margin:6px 0; }
.ilc-legal strong { color:#1c1c1e; }
.ilc-legal table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
.ilc-legal th, .ilc-legal td { text-align:left; padding:10px 12px; border-bottom:1px solid #ececf0; vertical-align:top; }
.ilc-legal th { color:#6b6b70; font-weight:600; }
.ilc-legal .footer { margin-top:56px; padding-top:24px; border-top:1px solid #ececf0;
  font-size:14px; color:#8a8a8e; display:flex; gap:20px; flex-wrap:wrap; }
`;

export default function PrivacyPolicy() {
  return (
    <div className="ilc-legal-page">
      <style>{css}</style>
      <main className="ilc-legal">
        <div className="topnav"><a href="/">← IdeaLoop Core</a></div>

        <h1>Privacy Policy</h1>
        <p className="sub">Effective {EFFECTIVE_DATE} · Last updated {EFFECTIVE_DATE}</p>

        <h2>1. Who we are</h2>
        <p>IdeaLoop Core (&ldquo;IdeaLoop Core&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the website and application at idealoopcore.com (the &ldquo;Service&rdquo;), an AI-assisted tool that helps founders examine and reflect on startup ideas.</p>
        <p>The data controller responsible for your personal data is <strong>{CONTROLLER}</strong>. If you have any question about this policy or wish to exercise your rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

        <h2>2. Scope</h2>
        <p>This policy applies to everyone who uses the Service, wherever they are located. It is drafted around a GDPR-grade privacy baseline, because the EU/UK General Data Protection Regulation is one of the strictest privacy regimes broadly relevant to an international service. This baseline does not resolve every country-specific rule. Local laws — including Türkiye&rsquo;s Personal Data Protection Law (KVKK, Law No. 6698), the California Consumer Privacy Act (CCPA/CPRA), Canada&rsquo;s PIPEDA, Japan&rsquo;s APPI, and Brazil&rsquo;s LGPD — have their own triggers, notices, transfer mechanisms, and consumer rights that overlap with, but are not fully contained by, GDPR. Where local law grants you additional rights, we honor those rights as applicable. Jurisdiction-specific rights are set out in Section 11.</p>
        <p>The Service is not specifically directed to users in jurisdictions where our current infrastructure or data-transfer model would require additional local registration, data localization, security assessment, or regulatory filing before the Service could lawfully be provided. We may restrict or suspend access where required by law.</p>

        <h2>3. What personal data we collect</h2>
        <p><strong>a. Account data.</strong> When you create an account, we collect your email address and authentication identifiers. If you sign in with Google, we receive your email address and basic profile information from Google; we do not receive your Google password.</p>
        <p><strong>b. Content you provide.</strong> The idea descriptions, founder-profile inputs, evaluations, explorations, branches, comparisons, and any feedback you submit through the Service. This content may itself contain personal data if you choose to include it.</p>
        <p><strong>c. Usage and technical data.</strong> Log data generated when you use the Service, including IP address, browser and device type, pages viewed, actions taken, timestamps, and error diagnostics. We use this for security, debugging, and understanding how the Service is used.</p>
        <p><strong>d. Search-derived data.</strong> To provide evaluations, the Service may generate search terms derived from your idea text and send those terms to third-party search and retrieval providers (see Section 6). We aim to send search terms, not your full account identity.</p>
        <p><strong>e. Payment data (from a later date).</strong> During the current free beta we do not collect payment information. When paid features launch, payments will be handled by a Merchant of Record (Polar). We will receive limited transaction metadata (such as a transaction reference and plan status) but not your full card details, which are handled by the Merchant of Record and its payment processors.</p>
        <p>We do not intentionally collect special-category data (such as health, religion, or political views). Please do not enter such data into idea fields.</p>

        <h2>4. How we use your data and our legal bases</h2>
        <p>Under GDPR we must have a legal basis for each use. We rely on:</p>
        <table>
          <thead><tr><th>Purpose</th><th>Legal basis (GDPR Art. 6)</th></tr></thead>
          <tbody>
            <tr><td>Creating and maintaining your account; authenticating you</td><td>Performance of a contract</td></tr>
            <tr><td>Running evaluations, explorations, comparisons, and saving your ideas</td><td>Performance of a contract</td></tr>
            <tr><td>Securing the Service, preventing abuse, debugging</td><td>Legitimate interests</td></tr>
            <tr><td>Understanding and improving how the Service works</td><td>Legitimate interests</td></tr>
            <tr><td>Responding to your feedback and support requests</td><td>Legitimate interests / performance of a contract</td></tr>
            <tr><td>Processing payments (from a later date)</td><td>Performance of a contract</td></tr>
            <tr><td>Any optional marketing communications</td><td>Consent (which you may withdraw at any time)</td></tr>
            <tr><td>Complying with legal obligations</td><td>Legal obligation</td></tr>
          </tbody>
        </table>
        <p>Where we rely on legitimate interests, we have balanced those interests against your rights and will provide our reasoning on request.</p>

        <h2>5. Automated processing — no automated decisions with legal or significant effect</h2>
        <p>The Service uses artificial intelligence to analyze the content you submit. By design, the Service does <strong>not</strong> produce verdicts, approvals, rejections, or automated decisions that have legal effects on you or that similarly significantly affect you within the meaning of GDPR Article 22. It produces structured analysis and reflections that you interpret and act on yourself. The decision always remains yours. See the <a href="/disclaimer">AI Disclaimer</a> for the full explanation of what the Service&rsquo;s output is and is not.</p>

        <h2>6. Who we share data with</h2>
        <p>We do not sell your personal data. We share it only with third-party providers as needed to run the Service. Depending on the role each performs, these are service providers, processors, sub-processors, or independent third-party providers acting as controllers for their own account, security, fraud-prevention, payment, or platform obligations (for example, a sign-in or payment provider). Each processes data under its own agreement, and, where a provider acts as our processor, under our instructions:</p>
        <table>
          <thead><tr><th>Provider</th><th>Purpose</th><th>Processing location</th></tr></thead>
          <tbody>
            <tr><td>Supabase</td><td>Database, authentication, storage</td><td>European Union (Ireland)</td></tr>
            <tr><td>Vercel</td><td>Application hosting and delivery</td><td>United States</td></tr>
            <tr><td>Anthropic</td><td>AI model processing of submitted content</td><td>United States</td></tr>
            <tr><td>Google</td><td>Sign-in (OAuth), if you choose it</td><td>United States / global</td></tr>
            <tr><td>Search / retrieval providers (e.g. Tavily, Exa, Serper, GitHub)</td><td>Returning external evidence for evaluations</td><td>United States / global</td></tr>
            <tr><td>Polar (from a later date)</td><td>Merchant of Record for payments</td><td>United States / EU</td></tr>
          </tbody>
        </table>
        <p>Each provider processes data only as described in its own agreement. We may add or change providers; we will update this list when we do. We may also disclose data where required by law, to enforce our terms, or to protect the rights, safety, or property of users or the public.</p>

        <h2>7. International data transfers</h2>
        <p>The Service is operated from Türkiye, and your data is processed both in the European Union (Ireland) and the United States by the providers listed above. This means personal data may be transferred across borders.</p>
        {/* NOTE (Emre): confirm the exact KVKK cross-border transfer basis with the advisor after the görüş, then refine this paragraph. */}
        <p>For transfers out of the EU/UK, we rely on the transfer mechanisms offered by our providers, principally the Standard Contractual Clauses incorporated into their data-processing agreements, together with the additional safeguards those providers maintain. For transfers subject to Türkiye&rsquo;s KVKK, we rely on the transfer mechanisms available under KVKK, including appropriate safeguards, standard contracts, or another lawful basis available under the law. You may request more information about the safeguards in place by contacting us.</p>

        <h2>8. How long we keep your data</h2>
        <p>We keep your account data and content for as long as your account is active. If you delete your account, we delete or irreversibly anonymize your personal data across our systems, subject to any limited retention we are legally required to keep (for example, transaction records once payments launch). Backups are overwritten on a rolling basis. Usage logs are retained for 90 days for security and debugging and are then deleted or aggregated.</p>

        <h2>9. How we protect your data</h2>
        <p>We apply technical and organizational measures appropriate to the risk, including encryption of data in transit, row-level access controls on our database, restricted administrative access, and reliance on providers that maintain recognized security standards. No system is perfectly secure, and we cannot guarantee absolute security, but we work to protect your data and to respond promptly to any incident.</p>

        <h2>10. Cookies and local storage</h2>
        <p>We use only the cookies and local storage necessary to run the Service — principally to keep you signed in and to maintain your session. We do not use advertising or cross-site tracking cookies. If this changes, we will update this policy and, where required, ask for your consent.</p>

        <h2>11. Your rights</h2>
        <p><strong>Everyone.</strong> You may ask us to access the personal data we hold about you and receive a copy; rectify data that is inaccurate or incomplete; erase your data; restrict or object to certain processing; port your data to another service in a machine-readable format; and withdraw consent at any time where we relied on consent.</p>
        <p>To exercise any right, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within the time required by applicable law (under GDPR, within one month). We may need to verify your identity first. Exercising these rights is free unless a request is manifestly unfounded or excessive.</p>
        <p><strong>EU/UK residents.</strong> You have the right to lodge a complaint with your local data protection authority.</p>
        <p><strong>Türkiye residents.</strong> Under KVKK Article 11 you have the rights listed above and may apply to us using the method in our Aydınlatma Metni, and may complain to the Personal Data Protection Authority (Kişisel Verileri Koruma Kurumu).</p>
        <p><strong>California residents.</strong> Under CCPA/CPRA you have the right to know what personal information we collect and how we use it, to request deletion, to correct inaccurate information, and to opt out of the &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information. <strong>We do not sell or share your personal information</strong> as those terms are defined by the CCPA. We will not discriminate against you for exercising your rights.</p>
        <p><strong>Other regions.</strong> If your local law grants you data rights (for example, Canada&rsquo;s PIPEDA, Japan&rsquo;s APPI, Brazil&rsquo;s LGPD), you may exercise them by contacting us at the address above.</p>

        <h2>12. Children</h2>
        <p>The Service is intended for users aged <strong>18 and over</strong>. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it.</p>

        <h2>13. Changes to this policy</h2>
        <p>We may update this policy as the Service evolves or the law changes. We will post the updated version here with a new &ldquo;Last updated&rdquo; date and, for material changes, take reasonable steps to notify you.</p>

        <h2>14. Contact</h2>
        <p>Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br/>Controller: {CONTROLLER}</p>

        <div className="footer">
          <a href="/terms">Terms of Service</a>
          <a href="/disclaimer">AI Disclaimer</a>
          <a href="/">Home</a>
        </div>
      </main>
    </div>
  );
}