// The shape of the "Work with Marina" form, in one place.
//
// Both the markup (build.js) and the server-side validator
// (lib/contact-validation.js) read this, so the form and the handler cannot
// drift apart about field names, which options are legal, or how long a value
// may be.
//
// "Brand deal / sponsorship" stays in the list on purpose. Brand enquiries
// land in pr@ like everything else and are forwarded by hand; the
// partnerships@ mailto elsewhere on the page remains for anyone who prefers to
// email directly.

const TOPICS = [
  "Brand deal / sponsorship",
  "Podcast guest",
  "Speaking / event",
  "Press / interview",
  "Partnership",
  "Investment",
  "Job / hiring",
  "Something else",
];

const FIELDS = [
  { name: "name", label: "Your name", type: "text", required: true, max: 200, autocomplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, max: 320, autocomplete: "email" },
  { name: "company", label: "Company (optional)", type: "text", required: false, max: 200, autocomplete: "organization" },
  { name: "topic", label: "What's this about?", type: "select", required: true },
  { name: "budget", label: "Budget or timeline (optional)", type: "text", required: false, max: 200 },
  { name: "details", label: "Details", type: "textarea", required: true, max: 5000, placeholder: "What are you proposing, and why is it a fit?" },
];

module.exports = { TOPICS, FIELDS };
