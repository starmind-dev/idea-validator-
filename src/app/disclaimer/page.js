// src/app/disclaimer/page.js
// IdeaLoop Core — AI Disclaimer / How to Read Your Results.
// Product-native content. Keep the "no verdict / readings not measurements / evidence not
// proof" language intact — it is part of what the product is, not boilerplate.

export const metadata = {
  title: 'AI Disclaimer — IdeaLoop Core',
  description: 'What IdeaLoop Core\u2019s output is, what it is not, and how to read it.',
};

const EFFECTIVE_DATE = '2 July 2026'; // update to your actual publish date

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
.ilc-legal strong { color:#1c1c1e; }
.ilc-legal .kicker { font-size:18px; line-height:1.5; color:#1c1c1e; margin:40px 0 0;
  padding-top:24px; border-top:1px solid #ececf0; }
.ilc-legal .footer { margin-top:40px; padding-top:24px; border-top:1px solid #ececf0;
  font-size:14px; color:#8a8a8e; display:flex; gap:20px; flex-wrap:wrap; }
`;

export default function AIDisclaimer() {
  return (
    <div className="ilc-legal-page">
      <style>{css}</style>
      <main className="ilc-legal">
        <div className="topnav"><a href="/">← IdeaLoop Core</a></div>

        <h1>AI Disclaimer &amp; How to Read Your Results</h1>
        <p className="sub">Effective {EFFECTIVE_DATE}</p>

        <h2>What IdeaLoop Core does</h2>
        <p>IdeaLoop Core reads the shape of the evidence around a startup idea and reflects it back to you. It externalizes the thinking you would do yourself if you had the time, the sources, and a disciplined structure to work through. That is the whole of what it does.</p>

        <h2>What it deliberately does not do</h2>
        <p><strong>It does not give you a verdict.</strong> IdeaLoop Core will not tell you an idea is good or bad, will or won&rsquo;t work, should or shouldn&rsquo;t be built. It is built specifically to refuse that. The reading it produces is not a decision, and it is not an instruction. The decision — the closure — belongs to you. That refusal is not a limitation we haven&rsquo;t gotten around to fixing; it is the point of the product.</p>
        <p><strong>Its scores are readings, not measurements.</strong> Where the Service shows a score or a label, that is a structured reflection of the evidence pattern it found — a way of making the shape legible. It is not a prediction of success, a probability, a rating, or a guarantee. Two runs of the same idea can land slightly differently, because the Service is reading a live, ambiguous world, not measuring a fixed quantity. Treat a score as a prompt for your own thinking, not as a number to obey.</p>
        <p><strong>Evidence is grounding, not proof.</strong> The external evidence the Service gathers is there to ground your thinking in something real. It does not prove anything. Absence of evidence is not proof of absence, and presence of evidence is not proof of a market.</p>

        <h2>The output is AI-generated</h2>
        <p>The analysis is produced by artificial intelligence (large language models). AI can be wrong, can miss context, can present confident-sounding statements that are mistaken, and can vary between runs. Nothing the Service produces is verified fact or a professional opinion. You should check anything that matters before you rely on it.</p>

        <h2>Not professional advice</h2>
        <p>IdeaLoop Core is <strong>not</strong> financial, investment, legal, tax, accounting, business, or any other kind of professional advice, and it is not a substitute for a qualified professional. Do not make funding, legal, financial, or major business decisions on the basis of its output alone. If a decision carries real consequences, consult a suitable professional.</p>

        <h2>No reliance, no guarantee</h2>
        <p>You use the Service&rsquo;s output at your own discretion and risk. We do not guarantee that any idea evaluated highly will succeed, or that any idea read as weak would fail. Outcomes in the real world depend on execution, timing, luck, and countless factors the Service cannot see. To the fullest extent permitted by law, we accept no liability for decisions you make in reliance on the Service. This disclaimer is part of, and subject to, our <a href="/terms">Terms of Service</a>.</p>

        <h2>If you export or share your results</h2>
        <p>If you download or share a result (for example, as a PDF or a screenshot), this framing goes with it. A score taken out of context is easy to misread as a verdict — which is exactly what it is not. Whoever reads a shared result should read it the same way you do: as a reflection to think against, never as a judgment to act on blindly.</p>
        <p>The Service&rsquo;s output is AI-generated. Do not present exported results to anyone as human-verified research, professional advice, or a definitive assessment. They are AI-generated analysis and should be identified as such.</p>

        <p className="kicker"><strong>In one line:</strong> IdeaLoop Core shows you the shape of the evidence. What you conclude from it is yours.</p>

        <div className="footer">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/">Home</a>
        </div>
      </main>
    </div>
  );
}