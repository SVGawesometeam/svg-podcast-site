// Validation and bot detection for the contact form, kept as pure functions so
// they can be unit-tested without a network or a serverless runtime.
// api/contact.js is the thin HTTP + Resend wrapper around them.

const { TOPICS, FIELDS } = require("./contact-fields");

// Deliberately loose. The job is to catch a typo and an obviously-bogus entry,
// not to adjudicate RFC 5322 — an over-strict pattern rejects real addresses,
// and the real proof of an address is whether the reply arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MIN_SECONDS_ON_PAGE = 3;

function validate(body) {
  const src = body && typeof body === "object" ? body : {};
  const data = {};

  for (const field of FIELDS) {
    const raw = src[field.name];
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

    if (field.required && !value) {
      return { ok: false, error: `Please fill in: ${field.label.replace(/ \(optional\)$/, "")}` };
    }
    if (field.max && value.length > field.max) {
      return { ok: false, error: `${field.label} is too long (max ${field.max} characters).` };
    }
    if (field.name === "email" && value && !EMAIL.test(value)) {
      return { ok: false, error: "That email address does not look right." };
    }
    if (field.type === "select" && value && !TOPICS.includes(value)) {
      return { ok: false, error: "Please choose one of the listed topic options." };
    }

    data[field.name] = value;
  }

  // Only the declared fields are copied across, so nothing a caller invents
  // reaches the email body.
  return { ok: true, data };
}

function isBot(body) {
  const src = body && typeof body === "object" ? body : {};

  // 1. Honeypot: a field no human sees, so anything in it came from a script.
  if (typeof src.website === "string" && src.website.trim()) return true;

  // 2. Time on page. A missing or unreadable stamp is NOT a bot: a cached
  //    page, a stripped hidden field or a script error would otherwise
  //    silently swallow a real enquiry, which is much worse than spam.
  const stamp = Number(src.rendered);
  if (Number.isFinite(stamp) && stamp > 0) {
    const seconds = (Date.now() - stamp) / 1000;
    if (seconds >= 0 && seconds < MIN_SECONDS_ON_PAGE) return true;
  }

  return false;
}

module.exports = { validate, isBot, MIN_SECONDS_ON_PAGE };
