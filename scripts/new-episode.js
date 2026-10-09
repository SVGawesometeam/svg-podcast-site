#!/usr/bin/env node
// Bring one new episode into the data layer as a draft and rebuild:
//
//   node scripts/new-episode.js [--report path.json] [--] <videoId>
//
// Adds the id to podcast-video-ids.txt if missing, imports the draft from the
// backend through the same path build.js uses (ads removed, speaker labels
// normalised, transcript-fixes applied, validated before it is written),
// rebuilds the site and writes a small report for the review pull request:
// the title, the guest, what still needs a person's eye. A person reviews the
// preview and merges; nothing here publishes anything.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { importDraft, dataFile, readEpisodeData, loadFix, CONTENT_DIR } = require("../build.js");
const { attention } = require("../lib/review");

const ROOT = path.join(__dirname, "..");
const REGISTRY = path.join(ROOT, "podcast-video-ids.txt");
// Options first, then "--" and the id, so an id that happens to start
// with "-" (the id alphabet allows it) is never read as an option.
const args = process.argv.slice(2);
const dash = args.indexOf("--");
const opts = dash === -1 ? args : args.slice(0, dash);
const positional = dash === -1 ? args.filter((a) => !a.startsWith("--") && a !== opts[opts.indexOf("--report") + 1]) : args.slice(dash + 1);
const reportIdx = opts.indexOf("--report");
const reportPath = reportIdx === -1 ? null : opts[reportIdx + 1];
const videoId = positional[0] || "";

function registry() {
  return fs.readFileSync(REGISTRY, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
}

async function main() {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error(`usage: node scripts/new-episode.js <videoId>; got ${JSON.stringify(videoId)}`);
  const ids = registry();
  const alreadyListed = ids.includes(videoId);
  const alreadyImported = fs.existsSync(dataFile(videoId));
  if (alreadyListed && alreadyImported) {
    console.log(`${videoId} is already published (listed and has content/episodes/${videoId}.json); nothing to do`);
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ videoId, status: "already-published" }, null, 2) + "\n");
    return;
  }

  let d;
  if (alreadyImported) {
    d = readEpisodeData(videoId);
  } else {
    d = await importDraft(videoId, new Set([...ids, videoId]));
  }
  if (!alreadyListed) fs.appendFileSync(REGISTRY, (fs.readFileSync(REGISTRY, "utf8").endsWith("\n") ? "" : "\n") + videoId + "\n");

  execFileSync(process.execPath, ["build.js"], { cwd: ROOT, stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/check-links.js"], { cwd: ROOT, stdio: "inherit" });

  const report = {
    videoId,
    status: "draft",
    title: d.title,
    format: d.format,
    guestName: d.guestName,
    guestTitle: d.guestTitle,
    publishedAt: d.publishedAt,
    duration: d.duration,
    transcriptBlocks: (d.transcript || []).length,
    attention: attention(d, loadFix(videoId)),
    page: `/episode/${videoId}/`,
    dataFile: path.relative(ROOT, dataFile(videoId)),
  };
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
