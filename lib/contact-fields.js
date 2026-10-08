// The shape of the "Work with Marina" form, in one place.
//
// Both the markup (build.js) and the server-side validator
// (lib/contact-validation.js) read this, so the form and the handler cannot
// drift apart about field names, which options are legal, or how long a value
// may be.
//
// Routing lives here too, server-side only: the page never learns which
// address a topic goes to, so nothing a visitor can change picks the recipient.

const TOPICS = [
  "Brand deal / sponsorship",
  "Podcast guest",
  "Speaking / event",
  "Press / interview",
  "Investment",
  "Job / hiring",
  "Something else",
];

// Agreed by the team on 2026-09-29 (edits doc for marinamogilko.co).
// "Partnership" was dropped from the list because it duplicated "Brand deal".
const RECIPIENTS = {
  "Brand deal / sponsorship": "partnerships@marinamogilko.co",
  "Podcast guest": "pr@marinamogilko.co",
  "Speaking / event": "partnerships@marinamogilko.co",
  "Press / interview": "pr@marinamogilko.co",
  "Investment": "marina@marinamogilko.co",
  "Job / hiring": "ks@marinamogilko.co",
  "Something else": "marina@marinamogilko.co",
};

// Where anything unexpected goes, and the address the no-JS fallback shows.
const FALLBACK_RECIPIENT = "pr@marinamogilko.co";

function recipientFor(topic) {
  return RECIPIENTS[topic] || FALLBACK_RECIPIENT;
}

const FIELDS = [
  { name: "name", label: "Your name", type: "text", required: true, max: 200, autocomplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, max: 320, autocomplete: "email" },
  { name: "company", label: "Company (optional)", type: "text", required: false, max: 200, autocomplete: "organization" },
  { name: "topic", label: "What's this about?", type: "select", required: true },
  { name: "budget", label: "Budget or timeline (optional)", type: "text", required: false, max: 200 },
  { name: "details", label: "Details", type: "textarea", required: true, max: 5000, placeholder: "What are you proposing, and why is it a fit?" },
];

module.exports = { TOPICS, FIELDS, RECIPIENTS, FALLBACK_RECIPIENT, recipientFor };
