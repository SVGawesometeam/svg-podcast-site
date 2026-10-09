// What a reviewer should look at first on a new draft. Each line is a fact
// about the data, not a judgement; the checklist in the pull request is the
// judgement. Used by scripts/new-episode.js.
const { unknownSpeakers } = require("./episode-data");

const WALL = 2500;          // characters; the workflow's limit for one paragraph
const MIN_WORDS_PER_MIN = 80; // below this a transcript is probably truncated

function attention(d, fix) {
  const notes = [];
  const unknown = unknownSpeakers(d, fix);
  if (unknown.length) notes.push(`Speaker labels not among the known participants: ${unknown.map((u) => `"${u}"`).join(", ")}`);
  if (!d.summary) notes.push("No summary");
  if (!(d.keyTakeaways || []).length) notes.push("No key takeaways");
  if (!(d.timestamps || []).length) notes.push("No chapters");
  if (!(d.topics || []).length) notes.push("No topics assigned (add one to three slugs from content/topics.json)");
  const longest = Math.max(0, ...(d.transcript || []).map((b) => (b.text || "").length));
  if (longest > WALL) notes.push(`A transcript paragraph is ${longest} characters long; split long monologues`);
  const words = (d.transcript || []).reduce((n, b) => n + (b.text || "").trim().split(/\s+/).filter(Boolean).length, 0);
  const minutes = parseInt(String(d.duration), 10);
  if (minutes && words / minutes < MIN_WORDS_PER_MIN) notes.push(`Transcript looks short: ${words} words for ${minutes} minutes`);
  if (/special guest|speaker \d/i.test(`${d.guestName} ${d.guestTitle}`)) notes.push("Placeholder guest name or title");
  return notes;
}

module.exports = { attention, WALL, MIN_WORDS_PER_MIN };
