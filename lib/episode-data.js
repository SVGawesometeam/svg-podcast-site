// The episode data layer.
//
// One JSON file per episode in content/episodes/<videoId>.json is the source of
// truth for everything the site renders about that episode. This module knows
// three things about that shape:
//
//   parseEpisodePage(html)  — read an already-built page back into the shape
//                              (the one-time migration, re-runnable)
//   fromApi(ep, fix)        — turn a backend draft into the shape, applying
//                              the clean-up heuristics that used to live in the
//                              renderer and the reviewed transcript-fixes
//   validate(data)          — what a file must contain before it can render
//
// The shape:
// {
//   videoId, title,
//   format: "interview" | "solo" | "compilation",
//   guestName, guestTitle, aboutGuest,
//   performer: { alternateName? }        // extra JSON-LD Person keys, rare
//   publishedAt (ISO), duration ("24 MIN"), coverArt, thumbnail,
//   metaDescription?,                     // only when it differs from the derived one
//   summary,                              // the episode summary, no template prefix
//   summaryHtml?,                         // only when the summary block is not prefix+summary
//   keyTakeaways: [string],
//   timestamps: [{ time, seconds, title }],
//   transcript: [ { speaker: string|null, text } | { html } ],
//   relatedVideos: [{ videoId, title, thumbnail }],
//   relatedHeading?,                      // only when a page uses its own heading
//   platformLinks?: { apple?, spotify? }  // this episode's own page on each platform
//   template?: "v2"                       // opt in to the Release 3 page template
//   topics: [slug]                        // filled in from Release 6
// }
//
// Text fields hold plain text (not HTML-escaped). The renderer escapes.

const { esc, unesc } = require("./html");

const SITE_URL = "https://marinamogilko.co";
const SOLO_NAME = "Marina Mogilko";
const SOLO_TITLE = "Host, Silicon Valley Girl Podcast";

// ---------------------------------------------------------------------------
// Reading a built page
// ---------------------------------------------------------------------------

function one(html, re, name) {
  const m = html.match(re);
  if (!m) throw new Error(`could not find ${name}`);
  return m[1];
}

function formatFor(guestName) {
  if (!guestName || guestName === SOLO_NAME) return "solo";
  if (guestName.includes(",")) return "compilation";
  return "interview";
}

// An old patch script replaced the transcript with a replacement string that
// JavaScript interpreted: "$1" became capture group 1 (the panel's opening
// markup) and "$2" became group 2 (its closing markup). So "$100 per hour"
// reads "<div id="panel-transcript" ...><div class="transcript">00 per hour"
// on twelve live pages. Reverse exactly that and nothing else.
const CORRUPT_OPEN = /<div id="panel-transcript" class="tab-panel" role="tabpanel">\s*<div class="transcript">/g;
const CORRUPT_CLOSE = /<\/div>\s*<\/div>/g;

function repairDollarAmounts(innerHtml) {
  let repairs = 0;
  const out = innerHtml
    .replace(CORRUPT_OPEN, () => { repairs++; return "$1"; })
    .replace(CORRUPT_CLOSE, () => { repairs++; return "$2"; });
  return { html: out, repairs };
}

function parseTranscriptBlocks(innerHtml) {
  // The transcript body is a sequence of <p>…</p>, separated by the
  // template's indentation. Anything that is not a plain paragraph is kept
  // verbatim as {html} so nothing hand-made is lost.
  const blocks = [];
  const re = /<p>([\s\S]*?)<\/p>|([^\s][\s\S]*?)(?=\n\s*<p>|$)/g;
  const trimmed = innerHtml.trim();
  let m;
  while ((m = re.exec(trimmed)) !== null) {
    if (m[1] !== undefined) {
      const inner = m[1];
      const sp = inner.match(/^<strong class="(speaker|speaker-marina)">([\s\S]*?):<\/strong> ([\s\S]*)$/);
      if (sp && !/<[a-z]/.test(sp[3])) {
        blocks.push({ speaker: unesc(sp[2]), text: unesc(sp[3]) });
      } else if (!/<[a-z]/i.test(inner)) {
        blocks.push({ speaker: null, text: unesc(inner) });
      } else {
        blocks.push({ html: `<p>${inner}</p>` });
      }
    } else if (m[2] && m[2].trim()) {
      blocks.push({ html: m[2].trim() });
    }
  }
  return blocks;
}

function parseEpisodePage(html) {
  const videoId = one(html, /<link rel="canonical" href="https:\/\/marinamogilko\.co\/episode\/([^/"]+)\/">/, "canonical");
  const title = unesc(one(html, /<title>([\s\S]*?) — Silicon Valley Girl Podcast<\/title>/, "title"));
  const metaDescription = unesc(one(html, /<meta name="description" content="([^"]*)">/, "meta description"));
  const coverArt = unesc(one(html, /<meta property="og:image" content="([^"]*)">/, "og:image"));
  const ld = JSON.parse(one(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/, "JSON-LD"));

  const main = one(html, /<main class="container">([\s\S]*?)<\/main>/, "main");
  const guestName = unesc(one(main, /<div class="guest-name">([^<]*)<\/div>/, "guest name"));
  const guestTitle = unesc(one(main, /<div class="guest-title">([^<]*)<\/div>/, "guest title"));
  const aboutGuest = unesc(one(main, /<p class="guest-bio">([\s\S]*?)<\/p>/, "guest bio"));
  const duration = one(main, /<div class="episode-meta">[\s\S]*?<span>([^<]*)<\/span>\s*<\/div>/, "duration");

  const format = formatFor(guestName);
  const summary = ld.description || "";
  const summaryBlock = one(main, /<div class="summary">([\s\S]*?)<\/div>/, "summary");
  const expectedSummary = renderSummaryBlock({ format, guestName, guestTitle, summary });
  const summaryHtml = summaryBlock === expectedSummary ? undefined : summaryBlock;

  const takeawaysBlock = one(main, /<div class="takeaways">[\s\S]*?<ul>([\s\S]*?)<\/ul>/, "takeaways");
  const keyTakeaways = [...takeawaysBlock.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => unesc(m[1]));

  const tsBlock = one(main, /<div class="timestamps-list">([\s\S]*?)<\/div>\s*<\/div>\s*<div id="panel-transcript"/, "timestamps");
  const timestamps = [...tsBlock.matchAll(
    /<a href="https:\/\/youtube\.com\/watch\?v=[^&"]+&t=(\d+)s" class="timestamp-link"[^>]*>\s*<span class="ts-time">([^<]*)<\/span>\s*(?:<span class="ts-dash">[^<]*<\/span>\s*)?<span class="ts-title">([\s\S]*?)<\/span>\s*<\/a>/g
  )].map((m) => ({ time: unesc(m[2]), seconds: Number(m[1]), title: unesc(m[3]) }));

  const trBlock = one(main, /<div class="transcript">([\s\S]*?)<\/div>\s*<\/div>\s*(?:<section class="related-section">|$)/, "transcript");
  const repaired = repairDollarAmounts(trBlock);
  const transcript = parseTranscriptBlocks(repaired.html);

  const relatedBlock = (main.match(/<div class="related-grid">([\s\S]*?)<\/div>\s*<\/section>/) || [, ""])[1];
  const relatedVideos = [...relatedBlock.matchAll(
    /<a href="\/episode\/([^/"]+)\/" class="related-card">\s*<img src="([^"]*)" alt="[^"]*" loading="lazy">\s*<span class="related-title">([\s\S]*?)<\/span>\s*<\/a>/g
  )].map((m) => ({ videoId: m[1], thumbnail: unesc(m[2]), title: unesc(m[3]) }));

  const performer = {};
  for (const k of Object.keys(ld.performer || {})) {
    if (!["@type", "name", "jobTitle"].includes(k)) performer[k] = ld.performer[k];
  }

  const data = {
    videoId,
    title,
    format,
    guestName,
    guestTitle,
    aboutGuest,
    publishedAt: ld.datePublished,
    duration,
    coverArt,
    thumbnail: ld.associatedMedia?.thumbnailUrl || coverArt,
    summary,
    keyTakeaways,
    timestamps,
    transcript,
    relatedVideos,
    topics: [],
  };
  if (Object.keys(performer).length) data.performer = performer;
  const relatedHeading = (main.match(/<section class="related-section">\s*<h2>([\s\S]*?)<\/h2>/) || [])[1];
  if (relatedHeading && unesc(relatedHeading) !== "More from Silicon Valley Girl Podcast") data.relatedHeading = unesc(relatedHeading);
  if (summaryHtml !== undefined) data.summaryHtml = summaryHtml;
  // The same replace-pattern bug that hit transcripts also hit the meta
  // description of pages whose title contains "$1…": the stored value then
  // carries a chunk of the tag it was meant to sit in. The derived value is
  // the correct one, so no override is kept for those.
  const derivedMeta = deriveMetaDescription(data);
  const metaCorrupted = /property=|content=/.test(metaDescription);
  if (metaDescription !== derivedMeta && !metaCorrupted) data.metaDescription = metaDescription;

  return { data, repairs: repaired.repairs };
}

// ---------------------------------------------------------------------------
// Derivations shared by the parser and the renderer
// ---------------------------------------------------------------------------

function deriveMetaDescription(d) {
  return d.format === "solo"
    ? `${d.title} — Silicon Valley Girl Podcast`
    : `Marina Mogilko interviews ${d.guestName}, ${d.guestTitle}, on the Silicon Valley Girl Podcast`;
}

function renderSummaryBlock(d) {
  return d.format === "solo"
    ? `In this episode of the Silicon Valley Girl Podcast, Marina Mogilko shares ${esc(d.summary)}`
    : `In this episode of the Silicon Valley Girl Podcast, Marina Mogilko interviews ${esc(d.guestName)}, ${esc(d.guestTitle)}. ${esc(d.summary)}`;
}

// ---------------------------------------------------------------------------
// Importing a backend draft
// ---------------------------------------------------------------------------

// Split the transcript markdown into speaker-labelled turns.
function parseTurns(md) {
  return String(md || "")
    .split(/\n\n+/)
    .map((block) => {
      const m = block.match(/^\*\*(.+?):\*\*\s*([\s\S]*)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: null, text: block.trim() };
    })
    .filter((t) => t.text || t.speaker);
}

function serializeTurns(turns) {
  return turns.map((t) => (t.speaker ? `**${t.speaker}:** ${t.text}` : t.text)).join("\n\n");
}

// Apply a transcript-fixes/<id>.json override to the raw transcript markdown.
function applyTranscriptFix(transcript, fix) {
  if (!fix) return transcript;
  let turns = parseTurns(transcript);

  const splits = [...(fix.splits || [])].sort((a, b) => b.index - a.index);
  for (const sp of splits) {
    const turn = turns[sp.index];
    if (!turn) throw new Error(`split index ${sp.index} out of range`);
    const pieces = [];
    let rest = turn.text;
    sp.parts.forEach((part, i) => {
      if (i === 0) return;
      const at = rest.indexOf(part.startsWith);
      if (at === -1) throw new Error(`split anchor not found at index ${sp.index}: "${part.startsWith.slice(0, 40)}..."`);
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at);
    });
    pieces.push(rest.trim());
    const rebuilt = pieces.map((text, i) => ({ speaker: fix.speakers?.[sp.parts[i].speaker] || sp.parts[i].speaker, text }));
    turns.splice(sp.index, 1, ...rebuilt);
  }
  for (const [idx, role] of Object.entries(fix.assignments || {})) {
    const turn = turns[Number(idx)];
    if (!turn) throw new Error(`assignment index ${idx} out of range`);
    turn.speaker = fix.speakers?.[role] || role;
  }
  for (const t of turns) {
    if (t.speaker && fix.speakerRenames?.[t.speaker]) t.speaker = fix.speakerRenames[t.speaker];
  }
  return serializeTurns(turns);
}

// Every speaker label must be a real person in that recording.
function unknownSpeakers(d, fix) {
  const allowed = new Set();
  const add = (n) => n && String(n).split(/\s*,\s*|\s+and\s+/).forEach((p) => p.trim() && allowed.add(p.trim()));
  add("Marina");
  add(SOLO_NAME);
  add(d.guestName);
  Object.values(fix?.speakers || {}).forEach(add);
  Object.values(fix?.speakerRenames || {}).forEach(add);
  (fix?.knownSpeakers || []).forEach(add);
  const seen = new Set(d.transcript.map((b) => b.speaker).filter(Boolean));
  return [...seen].filter((s) => {
    const parts = s.split(/\s*,\s*|\s+and\s+/).map((p) => p.trim()).filter(Boolean);
    return !parts.every((p) => allowed.has(p));
  });
}

const GENERIC_SPEAKER = /^\*\*(?:Guest|Host|Interviewer|Speaker\s*\d*|.{0,30}?\b(?:VP|CEO|CTO|CFO|COO|Director|Head|President|Manager|Exec|Executive|Founder|Co-founder)\b[^*]*):\*\*/gm;
const AD_PATTERNS = [
  /This part of the video is brought to you by[\s\S]*?(?=\*\*[A-Z]|\n\n\*\*[A-Z]|Okay,? now let'?s|Now,? let'?s get back|Back to)/gi,
  /This episode is sponsored by[\s\S]*?(?=\*\*[A-Z]|\n\n\*\*[A-Z]|Okay,? now let'?s|Now,? let'?s get back|Back to)/gi,
  /This video is sponsored by[\s\S]*?(?=\*\*[A-Z]|\n\n\*\*[A-Z]|Okay,? now let'?s|Now,? let'?s get back|Back to)/gi,
];

// A backend draft -> the data shape. The heuristics here used to run inside
// the renderer on every build; now they run once, at import, and the result
// is what the producer reviews.
function fromApi(ep, fix) {
  const guestName = (ep.guestName || "").trim();
  const isSolo = !guestName;

  let md = String(ep.transcript || "");
  for (const pat of AD_PATTERNS) md = md.replace(pat, "");
  if (!isSolo) md = md.replace(GENERIC_SPEAKER, () => `**${guestName}:**`);
  if (isSolo && !/^\s*\*\*/.test(md)) md = `**${SOLO_NAME}:** ${md.trimStart()}`;
  md = applyTranscriptFix(md, fix);

  const transcript = parseTurns(md).map((t) => ({ speaker: t.speaker, text: t.text }));

  // Chapter titles arrive with a separator glued to the front ("– Intro");
  // drop it only when every chapter carries the same one.
  const leading = (ep.timestamps || []).map((t) => (String(t.title).match(/^\s*([–—-])/) || [])[1]);
  const glyphs = new Set(leading.filter(Boolean));
  const strip = leading.length && leading.every(Boolean) && glyphs.size === 1
    ? new RegExp(`^\\s*[${[...glyphs].join("")}]\\s*`)
    : null;

  const data = {
    videoId: ep.videoId,
    title: ep.title,
    format: isSolo ? "solo" : formatFor(guestName),
    guestName: isSolo ? SOLO_NAME : guestName,
    guestTitle: isSolo ? SOLO_TITLE : ep.guestTitle || "",
    aboutGuest: ep.aboutGuest || "",
    publishedAt: new Date(ep.publishedAt).toISOString(),
    duration: ep.duration || "",
    coverArt: ep.coverArt || ep.thumbnail,
    thumbnail: ep.thumbnail || ep.coverArt,
    summary: ep.episodeSummary || "",
    keyTakeaways: ep.keyTakeaways || [],
    timestamps: (ep.timestamps || []).map((t) => ({
      time: String(t.time),
      seconds: Number(t.seconds),
      title: strip ? String(t.title).replace(strip, "") : String(t.title).trim(),
    })),
    transcript,
    relatedVideos: (ep.relatedVideos || []).map((v) => ({ videoId: v.videoId, title: v.title, thumbnail: v.thumbnail })),
    topics: [],
  };
  return data;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(d) {
  const problems = [];
  const need = (k) => { if (d[k] === undefined || d[k] === null || d[k] === "") problems.push(`missing ${k}`); };
  ["videoId", "title", "format", "guestName", "guestTitle", "publishedAt", "duration", "coverArt", "thumbnail"].forEach(need);
  if (!["interview", "solo", "compilation"].includes(d.format)) problems.push(`bad format "${d.format}"`);
  if (!/^[A-Za-z0-9_-]{11}$/.test(d.videoId || "")) problems.push(`bad videoId "${d.videoId}"`);
  if (Number.isNaN(Date.parse(d.publishedAt))) problems.push("publishedAt is not a date");
  if (!Array.isArray(d.transcript) || !d.transcript.length) problems.push("empty transcript");
  if (!Array.isArray(d.keyTakeaways)) problems.push("keyTakeaways must be an array");
  if (!Array.isArray(d.timestamps)) problems.push("timestamps must be an array");
  if (/special guest/i.test(`${d.guestName} ${d.guestTitle}`)) problems.push("placeholder guest");
  if (/, ,/.test(d.metaDescription || deriveMetaDescription(d))) problems.push("empty field in meta description");
  // Platform links must point at this show's own episode pages, nowhere else.
  const pl = d.platformLinks || {};
  if (pl.apple && !/^https:\/\/podcasts\.apple\.com\/us\/podcast\/[a-z0-9%-]+\/id1819090545\?i=\d+$/.test(pl.apple)) problems.push("bad apple link");
  if (pl.spotify && !/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/.test(pl.spotify)) problems.push("bad spotify link");
  for (const k of Object.keys(pl)) if (!["apple", "spotify"].includes(k)) problems.push(`unknown platform ${k}`);
  if (d.template !== undefined && d.template !== "v2") problems.push(`unknown template "${d.template}"`);
  return problems;
}

module.exports = {
  SITE_URL,
  SOLO_NAME,
  SOLO_TITLE,
  parseEpisodePage,
  parseTranscriptBlocks,
  repairDollarAmounts,
  deriveMetaDescription,
  renderSummaryBlock,
  fromApi,
  parseTurns,
  serializeTurns,
  applyTranscriptFix,
  unknownSpeakers,
  validate,
};
