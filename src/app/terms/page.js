// src/app/terms/page.js
// IdeaLoop Core — Terms of Service route.
// Pre-filled with real values. Before public launch, verify EFFECTIVE_DATE and the
// governing-law city. Contact address must be live and monitored before this page is linked.

export const metadata = {
  title: 'Terms of Service — IdeaLoop Core',
  description: 'The terms that govern your use of IdeaLoop Core.',
};

const EFFECTIVE_DATE = '2 July 2026'; // update to your actual publish date
const CONTACT_EMAIL = 'privacy@idealoopcore.com';
const CONTROLLER = 'Emre Yıldız, operating IdeaLoop Core';
const GOVERNING_CITY = 'İstanbul';

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
.ilc-legal .footer { margin-top:56px; padding-top:24px; border-top:1px solid #ececf0;
  font-size:14px; color:#8a8a8e; display:flex; gap:20px; flex-wrap:wrap; }
`;

export default function TermsOfService() {
  return (
    <div className="ilc-legal-page">
      <style>{css}</style>
      <main className="ilc-legal">
        <div className="topnav"><a href="/">← IdeaLoop Core</a></div>

        <h1>Terms of Service</h1>
        <p className="sub">Effective {EFFECTIVE_DATE} · Last updated {EFFECTIVE_DATE}</p>

        <h2>1. Agreement to these terms</h2>
        <p>These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the website and application at idealoopcore.com (the &ldquo;Service&rdquo;), operated by {CONTROLLER} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an account or using the Service, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a> and <a href="/disclaimer">AI Disclaimer</a>, which are incorporated by reference. If you do not agree, do not use the Service.</p>

        <h2>2. What the Service is</h2>
        <p>IdeaLoop Core is an AI-assisted analytical tool. It helps you examine and reflect on startup ideas by producing structured analysis, evidence readings, and reflections. <strong>It does not provide advice, verdicts, recommendations, predictions, or guarantees of any kind.</strong> The output is information for you to interpret; every decision remains yours. This is a defining feature of the Service, described fully in the <a href="/disclaimer">AI Disclaimer</a>.</p>
        <p>The Service is <strong>not</strong> financial, investment, legal, tax, accounting, or professional advice, and must not be relied upon as such.</p>

        <h2>3. Eligibility</h2>
        <p>You must be at least <strong>18 years old</strong> and able to form a binding contract to use the Service. By using it you confirm that you meet these requirements.</p>

        <h2>4. Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account and for all activity under it. Provide accurate information, keep it current, and notify us promptly of any unauthorized use. We may suspend or close accounts that violate these Terms.</p>

        <h2>5. Beta status</h2>
        <p>The Service is currently offered as a <strong>free beta</strong>. During the beta:</p>
        <ul>
          <li>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, may change, break, or be unavailable, and may be modified or discontinued at any time;</li>
          <li>Features, limits, and behavior may change without notice;</li>
          <li>We do not charge for use and do not guarantee any particular level of availability, performance, or data retention.</li>
        </ul>
        <p>We will give reasonable notice before the beta ends or before paid features are introduced.</p>
        <p>We may limit or withhold the Service in any jurisdiction where providing it would require local registration, data localization, security assessment, or regulatory filing beyond our current setup.</p>

        <h2>6. Your content and your ideas</h2>
        <p><strong>You own your ideas.</strong> You retain all rights to the idea descriptions, profile inputs, and other content you submit (&ldquo;Your Content&rdquo;). We do not claim ownership of your ideas. We do not intentionally use Your Content to train our own or third-party AI models. Where we use commercial AI API providers to process Your Content, their handling of that content is governed by their commercial/API terms; based on our current provider setup, content submitted through those commercial APIs is not used to train their models by default.</p>
        <p><strong>License to operate the Service.</strong> You grant us a limited, non-exclusive license to store, process, transmit, and display Your Content solely to operate and provide the Service to you (including sending relevant portions to the providers listed in our Privacy Policy). This license ends when you delete the content or your account, except for content already processed and for limited backups that are overwritten on a rolling basis.</p>
        <p><strong>Responsibility for content.</strong> You are responsible for Your Content and confirm you have the right to submit it. Do not submit content that is unlawful, infringes others&rsquo; rights, or contains others&rsquo; personal or confidential data without authority.</p>

        <h2>7. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of these Terms;</li>
          <li>Attempt to reverse-engineer, scrape, overload, or interfere with the Service or its infrastructure;</li>
          <li>Circumvent usage limits, authentication, or security measures;</li>
          <li>Resell, sublicense, or commercially exploit the Service without our written permission;</li>
          <li>Use the Service to generate content that is illegal, harmful, or that violates the rights of others.</li>
        </ul>
        <p>We may limit, suspend, or terminate access for violations.</p>

        <h2>8. AI output — no warranty, no reliance</h2>
        <p>AI systems can be wrong, incomplete, or inconsistent, and the same input may yield different output at different times. You acknowledge that the Service&rsquo;s output is generated by AI, is not verified fact, may contain errors, and does not represent a professional opinion or a prediction of outcome. You agree not to treat the output as advice or as a substitute for your own judgment or for qualified professional counsel. The Service identifies its analysis as AI-generated; you must not present exported or shared results to others as human-verified research, professional advice, or a definitive assessment. See the <a href="/disclaimer">AI Disclaimer</a> for full detail.</p>

        <h2>9. Our intellectual property</h2>
        <p>The Service itself — including its software, design, scoring architecture, text, and branding — is owned by us or our licensors and is protected by law. These Terms grant you a limited, personal, non-transferable right to use the Service; they do not transfer any of our intellectual property to you. &ldquo;IdeaLoop Core&rdquo; and associated marks are ours.</p>

        <h2>10. Payments (from a later date)</h2>
        <p>The beta is free. When paid features launch, additional payment terms will apply and will be presented to you before you are charged. Payments will be processed by a <strong>Merchant of Record (Polar)</strong>, which will act as the seller of record for transactions and will handle payment processing, applicable taxes, and related consumer disclosures. Your statutory consumer rights, where they apply, are not affected by these Terms.</p>

        <h2>11. Disclaimers</h2>
        <p>To the fullest extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, secure, or that its output will be accurate, complete, or suitable for any purpose.</p>

        <h2>12. Limitation of liability</h2>
        <p>To the fullest extent permitted by law, we will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any loss of profits, revenue, data, business, or goodwill, arising from or related to your use of the Service. Our total aggregate liability arising out of or related to the Service will not exceed the greater of the amount you paid us in the twelve months before the claim or one hundred euros (€100). Nothing in these Terms excludes liability that cannot be excluded by law, including your mandatory statutory rights as a consumer.</p>

        <h2>13. Indemnification</h2>
        <p>You agree to indemnify and hold us harmless from claims, damages, and expenses (including reasonable legal fees) arising from Your Content, your use of the Service, or your breach of these Terms, to the extent permitted by law.</p>

        <h2>14. Termination</h2>
        <p>You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you breach these Terms or if we discontinue the Service. On termination, the provisions that by their nature should survive (including Sections 6, 8, 9, 11, 12, and 13) will survive.</p>

        <h2>15. Governing law and disputes</h2>
        <p>These Terms are governed by the laws of the Republic of Türkiye, without regard to conflict-of-laws rules, and the courts of {GOVERNING_CITY}, Türkiye will have jurisdiction. If you are a consumer resident in the EU/UK or another jurisdiction with mandatory consumer-protection law, you retain the protection of the mandatory provisions of the law of your country of residence, and this clause does not deprive you of the right to bring proceedings where that law allows.</p>

        <h2>16. Changes to these terms</h2>
        <p>We may update these Terms as the Service evolves or the law changes. We will post the updated version with a new &ldquo;Last updated&rdquo; date and, for material changes, take reasonable steps to notify you. Continued use after changes take effect means you accept them.</p>

        <h2>17. Contact</h2>
        <p>Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br/>{CONTROLLER}</p>

        <div className="footer">
          <a href="/privacy">Privacy Policy</a>
          <a href="/disclaimer">AI Disclaimer</a>
          <a href="/">Home</a>
        </div>
      </main>
    </div>
  );
}