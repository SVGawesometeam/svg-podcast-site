// The channel's public Atom feed lists its latest 15 uploads with no API key.
// This picks out the video ids and the titles; everything else in the feed
// is ignored. The feed is XML from YouTube, treated as data: ids are checked
// against the id pattern and titles are plain text with entities decoded.
const FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
}

// [{ videoId, title, publishedAt }] in feed order (newest first).
function parseFeed(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = m[1];
    const id = (entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/) || [, ""])[1].trim();
    if (!ID_RE.test(id)) continue;
    const title = decode((entry.match(/<title>([^<]*)<\/title>/) || [, ""])[1].trim());
    const publishedAt = (entry.match(/<published>([^<]*)<\/published>/) || [, ""])[1].trim();
    out.push({ videoId: id, title, publishedAt });
  }
  return out;
}

// Feed entries whose id is not yet in the registry, oldest first, so the
// earliest unpublished episode is handled before a newer one.
function newVideos(feedEntries, registryIds) {
  const known = new Set(registryIds);
  return feedEntries.filter((e) => !known.has(e.videoId)).reverse();
}

module.exports = { FEED_BASE, ID_RE, parseFeed, newVideos };
