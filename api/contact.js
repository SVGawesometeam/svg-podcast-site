// POST /api/contact — the "Work with Marina" form.
//
// Vercel serverless function. Every submission is emailed to pr@; brand deals
// included (they are forwarded by hand). Uses Resend's REST API over the
// built-in fetch rather than the SDK, so the site adds no npm dependency.
//
// Required environment variable: RESEND_API_KEY (set in the Vercel project,
// never committed).

const { validate, isBot } = require("../lib/contact-validation");

const TO = "pr@marinamogilko.co";
const FROM = "Silicon Valley Girl <forms@marinamogilko.co>";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Could not read that submission." });
    }
  }

  // A bot gets a 200 and nothing else happens. Telling it why it failed just
  // teaches whoever wrote it how to get past the check next time.
  if (isBot(body)) return res.status(200).json({ ok: true });

  const result = validate(body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const d = result.data;

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set; cannot send the enquiry.");
    return res.status(500).json({
      error: `Could not send right now. Please email ${TO} directly.`,
    });
  }

  const subject = `[SVG site] ${d.topic} — ${d.name}${d.company ? `, ${d.company}` : ""}`;
  const text = [
    `Name:    ${d.name}`,
    `Email:   ${d.email}`,
    `Company: ${d.company || "—"}`,
    `Topic:   ${d.topic}`,
    `Budget:  ${d.budget || "—"}`,
    "",
    d.details,
    "",
    `Sent ${new Date().toISOString()} from marinamogilko.co`,
  ].join("\n");

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      // reply_to is the whole point: hitting reply in the inbox answers the
      // person who filled the form, not the sending domain.
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: d.email, subject, text }),
    });
  } catch (e) {
    console.error("Could not reach Resend:", e.message);
    return res.status(502).json({ error: `Could not send right now. Please email ${TO} directly.` });
  }

  if (!response.ok) {
    // Status only. The provider's response body can echo the credential, and
    // this runs in a log a lot of people can read.
    console.error("Resend rejected the send:", response.status);
    return res.status(502).json({ error: `Could not send right now. Please email ${TO} directly.` });
  }

  return res.status(200).json({ ok: true });
};
