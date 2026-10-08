// POST /api/contact — the "Work with Marina" form.
//
// Vercel serverless function. Each submission is emailed to the address the
// topic routes to (lib/contact-fields.js), with the sender as Reply-To. Uses
// Resend's REST API over the built-in fetch rather than the SDK, so the site
// adds no npm dependency.
//
// Required environment variable: RESEND_API_KEY (set in the Vercel project,
// never committed).

const { validate, isBot } = require("../lib/contact-validation");
const { recipientFor, FALLBACK_RECIPIENT } = require("../lib/contact-fields");

// Resend's shared sending domain, which needs no DNS setup at all. The From
// address is cosmetic here: this mail only ever goes to our own inboxes, and
// reply_to below is set to whoever filled the form, so hitting reply answers
// them rather than this address.
//
// Verifying a domain would let this read forms@marinamogilko.co and would
// improve deliverability. It was skipped deliberately — marinamogilko.co
// already has one SPF record covering Google Workspace, Mailgun and Brevo, and
// a domain may only have one, so touching it risks the business mail for a
// cosmetic gain. A Gmail filter handles the spam risk instead.
const FROM = "Silicon Valley Girl <onboarding@resend.dev>";

// Anything bigger than this is not a form submission. The largest legal
// payload (every field at its cap) is well under 8 KB.
const MAX_BODY_BYTES = 32 * 1024;

// Best-effort rate limit: this many submissions per IP per window. Serverless
// instances do not share memory, so a determined sender can exceed it across
// instances; it still stops the common case of one script hammering one
// warm function, at zero cost and with no new dependency.
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const recent = new Map(); // ip -> [timestamps]

function clientIp(req) {
  const h = req.headers || {};
  const fwd = typeof h["x-forwarded-for"] === "string" ? h["x-forwarded-for"] : "";
  return (fwd.split(",")[0] || h["x-real-ip"] || "unknown").toString().trim();
}

function tooMany(ip, now = Date.now()) {
  const cutoff = now - RATE_LIMIT.windowMs;
  const hits = (recent.get(ip) || []).filter((t) => t > cutoff);
  hits.push(now);
  recent.set(ip, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (recent.size > 5000) {
    for (const [k, v] of recent) if (!v.some((t) => t > cutoff)) recent.delete(k);
  }
  return hits.length > RATE_LIMIT.max;
}

// Subject lines are one line. Resend takes JSON, so a newline could not inject
// a header anyway, but a subject that wraps is confusing in the inbox.
function oneLine(s) {
  return String(s || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "That submission is too large." });
    }
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Could not read that submission." });
    }
  } else if (body && typeof body === "object") {
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "That submission is too large." });
    }
  }

  // A bot gets a 200 and nothing else happens. Telling it why it failed just
  // teaches whoever wrote it how to get past the check next time.
  if (isBot(body)) return res.status(200).json({ ok: true });

  if (tooMany(clientIp(req))) {
    return res.status(429).json({
      error: `Too many messages from this connection. Please wait a few minutes, or email ${FALLBACK_RECIPIENT} directly.`,
    });
  }

  const result = validate(body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const d = result.data;
  const to = recipientFor(d.topic);

  if (!process.env.RESEND_API_KEY) {
    console.error(
      "RESEND_API_KEY is not set on this deployment. Add it in Vercel " +
        "(Settings -> Environment Variables, ticking both Production and Preview) " +
        "and redeploy — a new variable does not reach an existing deployment."
    );
    return res.status(500).json({
      error: `Could not send right now. Please email ${FALLBACK_RECIPIENT} directly.`,
      detail: "mail service not configured",
    });
  }

  const subject = oneLine(
    `[SVG site] ${d.topic} — ${d.name}${d.company ? `, ${d.company}` : ""}`
  );
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
      body: JSON.stringify({ from: FROM, to: [to], reply_to: d.email, subject, text }),
    });
  } catch (e) {
    console.error("Could not reach Resend:", e.message);
    return res.status(502).json({ error: `Could not send right now. Please email ${FALLBACK_RECIPIENT} directly.` });
  }

  if (!response.ok) {
    // Resend's own message, which is what actually says WHY — most usefully
    // "You can only send testing emails to your own email address" when the
    // account has no verified domain. Only the message field is logged, never
    // the whole body, and never the request headers that carry the key.
    let reason = "";
    try {
      const body = await response.json();
      reason = String(body?.message || body?.error?.message || "").slice(0, 300);
    } catch {
      /* non-JSON error body; the status alone will have to do */
    }
    console.error(`Resend rejected the send: HTTP ${response.status}${reason ? ` — ${reason}` : ""}`);

    // 403 with no verified domain is the one failure the person filling the
    // form can do nothing about but which we can name precisely for ourselves.
    return res.status(502).json({
      error: `Could not send right now. Please email ${FALLBACK_RECIPIENT} directly.`,
      // Not shown by the form; visible in the network tab when debugging.
      detail: `provider returned ${response.status}`,
    });
  }

  return res.status(200).json({ ok: true });
};

module.exports.RATE_LIMIT = RATE_LIMIT;
