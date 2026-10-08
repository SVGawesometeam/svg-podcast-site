#!/usr/bin/env node
// Prove that a change did not alter any transcript.
//
// For every public/episode/<id>/index.html, the transcript text is extracted
// from the working tree and from a git ref (default: HEAD), normalised, and
// compared. Any difference, or any page present in the ref but missing now,
// fails the run. This is the gate every release has to pass before it is
// pushed; it is what lets templates change while the transcripts cannot.
//
//   node scripts/verify-transcripts.js            # working tree vs HEAD
//   node scripts/verify-transcripts.js origin/main
//   node scripts/verify-transcripts.js HEAD --allow ael24TrS0ws,KEAYPqQG2-M
//
// --allow lists episode IDs whose transcript change is intended for this
// release; they are reported, not failed. Use it only with a note in the
// release's transcript-fixes/<id>.json explaining what changed and why.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith("--")) || "HEAD";
const allowIdx = args.indexOf("--allow");
const allowed = new Set(allowIdx === -1 ? [] : (args[allowIdx + 1] || "").split(",").filter(Boolean));

// The transcript panel in the current template, or the <section> that will
// replace it. Either way: the block whose class is "transcript".
function transcriptText(html) {
  const m = html.match(/<div class="transcript">([\s\S]*?)<\/div>\s*<\/div>\s*<section/) ||
    html.match(/<(?:div|section)[^>]*class="transcript"[^>]*>([\s\S]*?)<\/(?:div|section)>/);
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fromRef(file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

const listed = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "public/episode"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter((f) => f.endsWith("/index.html"));

let failed = 0, changedAllowed = 0, same = 0, added = 0;

for (const file of listed) {
  const before = transcriptText(fromRef(file) || "");
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.error(`MISSING  ${file} exists in ${ref} but not in the working tree`);
    failed++;
    continue;
  }
  const after = transcriptText(fs.readFileSync(abs, "utf8"));
  const id = file.split("/")[2];
  if (before === null && after === null) continue;
  if (before === after) { same++; continue; }
  if (allowed.has(id)) {
    console.log(`CHANGED  ${id} (allowed for this release)`);
    changedAllowed++;
    continue;
  }
  const where = firstDiff(before || "", after || "");
  console.error(`DIFF     ${id} transcript differs from ${ref} near: …${where}…`);
  failed++;
}

// Pages that exist now but not in the ref are new episodes; fine.
const now = fs.existsSync(path.join(ROOT, "public/episode"))
  ? fs.readdirSync(path.join(ROOT, "public/episode")).filter((d) => fs.existsSync(path.join(ROOT, "public/episode", d, "index.html")))
  : [];
const listedIds = new Set(listed.map((f) => f.split("/")[2]));
for (const id of now) if (!listedIds.has(id)) added++;

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `${a.slice(Math.max(0, i - 40), i)}▸${a.slice(i, i + 40)}▮ vs ▸${b.slice(i, i + 40)}`;
}

console.log(`Transcripts vs ${ref}: ${same} unchanged, ${changedAllowed} changed (allowed), ${added} new pages, ${failed} problems`);
process.exit(failed ? 1 : 0);
