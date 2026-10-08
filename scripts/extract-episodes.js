#!/usr/bin/env node
// Migrate built pages into the data layer: public/episode/<id>/index.html ->
// content/episodes/<id>.json. Re-runnable; existing JSON files are left alone
// unless --force is given, so a page added by the old flow after the migration
// can be picked up by running this again.
//
//   node scripts/extract-episodes.js            # only pages without JSON
//   node scripts/extract-episodes.js --force    # rewrite every JSON from HTML
//   node scripts/extract-episodes.js <videoId>  # one page

const fs = require("fs");
const path = require("path");
const { parseEpisodePage } = require("../lib/episode-data");

const ROOT = path.join(__dirname, "..");
const EPI_DIR = path.join(ROOT, "public", "episode");
const OUT_DIR = path.join(ROOT, "content", "episodes");
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find((a) => !a.startsWith("--"));

fs.mkdirSync(OUT_DIR, { recursive: true });
const ids = (only ? [only] : fs.readdirSync(EPI_DIR)).filter((id) =>
  fs.existsSync(path.join(EPI_DIR, id, "index.html"))
);

let written = 0, skipped = 0, failed = 0, repairedPages = [];
for (const id of ids.sort()) {
  const out = path.join(OUT_DIR, `${id}.json`);
  if (fs.existsSync(out) && !force) { skipped++; continue; }
  try {
    const { data, repairs } = parseEpisodePage(fs.readFileSync(path.join(EPI_DIR, id, "index.html"), "utf8"));
    if (data.videoId !== id) throw new Error(`canonical says ${data.videoId}, directory says ${id}`);
    fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
    written++;
    if (repairs) repairedPages.push(`${id} (${repairs} dollar amounts restored)`);
  } catch (e) {
    console.error(`FAILED ${id}: ${e.message}`);
    failed++;
  }
}

console.log(`Extracted: ${written}  Skipped (JSON exists): ${skipped}  Failed: ${failed}`);
if (repairedPages.length) {
  console.log(`Repaired corrupted "$1xx"/"$2xx" amounts on ${repairedPages.length} pages:\n  ${repairedPages.join("\n  ")}`);
}
process.exit(failed ? 1 : 0);
