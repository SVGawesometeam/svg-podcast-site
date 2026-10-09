#!/usr/bin/env node
// Prints, one per line, the ids of videos in the channel's feed that are not
// in podcast-video-ids.txt (oldest first). Needs YOUTUBE_CHANNEL_ID in the
// environment (a repository variable on GitHub). Exits 0 with no output when
// there is nothing new, and with a note (still exit 0) when the variable is
// not set, so the scheduled run is quiet until the team sets it.
const fs = require("fs");
const path = require("path");
const { FEED_BASE, parseFeed, newVideos } = require("../lib/youtube-feed");

const ROOT = path.join(__dirname, "..");
const channel = (process.env.YOUTUBE_CHANNEL_ID || "").trim();

async function main() {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channel)) {
    console.error("YOUTUBE_CHANNEL_ID is not set (or not a channel id starting with UC); nothing polled");
    return;
  }
  const res = await fetch(`${FEED_BASE}${encodeURIComponent(channel)}`, { redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`feed returned HTTP ${res.status}`);
  const entries = parseFeed(await res.text());
  if (!entries.length) throw new Error("the feed had no entries; wrong channel id?");
  const registry = fs.readFileSync(path.join(ROOT, "podcast-video-ids.txt"), "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const v of newVideos(entries, registry)) console.log(v.videoId);
}

main().catch((e) => { console.error(e); process.exit(1); });
