#!/usr/bin/env node
// One-off: copy the topic assignments from content/topics-proposal.json into
// each episode's `topics` field (primary first). Re-runnable; only the
// `topics` field changes. After the team confirms, the proposal file is the
// record of why, and the episode files are the truth.
const fs = require("fs");
const path = require("path");
const { validate } = require("../lib/episode-data");

const ROOT = path.join(__dirname, "..");
const proposal = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "topics-proposal.json"), "utf8"));
const known = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "topics.json"), "utf8")).topics.map((t) => t.slug));

let changed = 0;
for (const [id, entry] of Object.entries(proposal.episodes)) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error(`bad episode id ${JSON.stringify(id)}`);
  if (!Array.isArray(entry.topics)) throw new Error(`${id}: topics must be an array`);
  const file = path.join(ROOT, "content", "episodes", `${id}.json`);
  if (!fs.existsSync(file)) { console.warn(`no episode file for ${id}`); continue; }
  const unknown = entry.topics.filter((t) => !known.has(t));
  if (unknown.length) throw new Error(`${id}: unknown topic(s) ${unknown.join(", ")}`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (JSON.stringify(d.topics || []) === JSON.stringify(entry.topics)) continue;
  d.topics = entry.topics;
  const problems = validate(d);
  if (problems.length) throw new Error(`${id}: ${problems.join("; ")}`);
  fs.writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
  changed++;
}
console.log(`topics written on ${changed} episode(s)`);
