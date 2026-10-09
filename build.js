const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ICONS, SOCIAL_LINKS, SHARED_HEAD, SHARED_HEADER, SHARED_FOOTER, CHROME_CSS } = require("./lib/chrome");
const { TOPICS, FIELDS } = require("./lib/contact-fields");
const { esc, jsonForScript } = require("./lib/html");
const { renderEpisodePageV2 } = require("./lib/render-episode-v2");
const { renderAboutPage, renderNewsletterPage, renderLegalPage, episodeFor } = require("./lib/pages");
const { FORMAT_LABEL } = require("./lib/cards");
const { SITE_URL, IDS } = require("./lib/site");
const { countsFor, formatCount } = require("./lib/audience");
const { renderTopicPage, renderTopicsIndex, episodesFor } = require("./lib/render-topics");
const { renderEpisodeCard, CARD_CSS } = require("./lib/cards");
const {
  fromApi,
  validate,
  deriveMetaDescription,
  renderSummaryBlock,
  unknownSpeakers,
} = require("./lib/episode-data");

const API_BASE =
  "https://svg-dashboard-production.up.railway.app/api/podcast-page";
const PUBLIC_DIR = path.join(__dirname, "public");
const IDS_FILE = path.join(__dirname, "podcast-video-ids.txt");
const FIXES_DIR = path.join(__dirname, "transcript-fixes");
const CONTENT_DIR = path.join(__dirname, "content", "episodes");

// content/episodes/<id>.json is the reviewed source of truth for a page.
// The build renders every page from it on every run, so a template change
// reaches all pages and a page is never edited by hand. Hand corrections go
// into the JSON (and their reasons into transcript-fixes/<id>.json).
const SITE_FILE = path.join(__dirname, "content", "site.json");
const AUDIENCE_FILE = path.join(__dirname, "content", "audience.json");
const LEGAL_DIR = path.join(__dirname, "content", "legal");
const TOPICS_FILE = path.join(__dirname, "content", "topics.json");
const TOPICS_DIR = path.join(__dirname, "content", "topics");

// The topic hubs; see content/topics.json. Every slug an episode names must
// be one of these, or the build stops rather than linking to a page that
// does not exist.
function readTopics() {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8")).topics;
  const seen = new Set();
  for (const t of topics) {
    // The slug becomes a directory under public/topics/ and a file name
    // under content/topics/, so it is checked before any path is built.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(t.slug))) throw new Error(`content/topics.json: bad slug ${JSON.stringify(t.slug)}`);
    if (seen.has(t.slug)) throw new Error(`content/topics.json: duplicate slug "${t.slug}"`);
    seen.add(t.slug);
    for (const k of ["name", "description", "question"]) if (!t[k]) throw new Error(`content/topics.json: ${t.slug} has no ${k}`);
  }
  return topics;
}
const TOPIC_HUBS = readTopics();
const TOPIC_BY_SLUG = Object.fromEntries(TOPIC_HUBS.map((t) => [t.slug, t]));
function topicsOf(d) {
  return (d.topics || []).map((slug) => {
    const t = TOPIC_BY_SLUG[slug];
    if (!t) throw new Error(`${d.videoId}: topic "${slug}" is not in content/topics.json`);
    return { slug: t.slug, name: t.name };
  });
}

// Facts about Marina and the show; see content/site.json for what is in it
// and where it comes from. /about/, llms.txt and the JSON-LD all read this.
// The audience counts come from content/audience.json, written weekly by
// the dashboard job, and are never typed into site.json.
function readSite() {
  const site = JSON.parse(fs.readFileSync(SITE_FILE, "utf8"));
  site.audience = fs.existsSync(AUDIENCE_FILE) ? JSON.parse(fs.readFileSync(AUDIENCE_FILE, "utf8")) : null;
  site.counts = countsFor(site.audience);
  site.topics = TOPIC_HUBS;
  return site;
}

function dataFile(videoId) {
  return path.join(CONTENT_DIR, `${videoId}.json`);
}

function readEpisodeData(videoId) {
  return JSON.parse(fs.readFileSync(dataFile(videoId), "utf8"));
}

// The ID decides the file name, so it is checked here, before any write, and
// the resolved path must stay inside content/episodes/ whatever the ID holds.
function writeEpisodeData(d) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(d.videoId))) {
    throw new Error(`refusing to write episode data for an invalid videoId: ${JSON.stringify(d.videoId)}`);
  }
  const file = path.resolve(dataFile(d.videoId));
  if (!file.startsWith(path.resolve(CONTENT_DIR) + path.sep)) {
    throw new Error(`refusing to write outside content/episodes: ${file}`);
  }
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
}

function loadFix(videoId) {
  const f = path.join(FIXES_DIR, `${videoId}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

async function fetchEpisode(videoId, fetchImpl = fetch) {
  const res = await fetchImpl(`${API_BASE}/${videoId}`, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`API returned ${res.status} for ${videoId}`);
  return res.json();
}

// A draft for one episode from the backend: the registry id is enforced,
// related episodes are limited to ones on the site, ads and generic speaker
// labels are handled by fromApi(), transcript-fixes are applied, and the
// draft is validated before it is written. Used by build.js for ids that
// have no data yet and by scripts/new-episode.js for the review workflow.
async function importDraft(videoId, idSet, { fetchImpl = fetch } = {}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error(`bad videoId ${JSON.stringify(videoId)}`);
  const ep = await fetchEpisode(videoId, fetchImpl);
  // The registry ID is the one we asked for; the backend does not get
  // to rename the episode (or the file it is written to).
  if (ep.videoId && ep.videoId !== videoId) {
    throw new Error(`backend returned videoId ${JSON.stringify(ep.videoId)} for ${videoId}`);
  }
  ep.videoId = videoId;
  // Only link related episodes that are actually on the site.
  ep.relatedVideos = (ep.relatedVideos || []).filter(v => idSet.has(v.videoId));
  const d = fromApi(ep, loadFix(videoId));
  const draftProblems = validate(d);
  if (draftProblems.length) {
    throw new Error(`draft rejected: ${draftProblems.join("; ")}`);
  }
  writeEpisodeData(d);
  return d;
}

// What the homepage, the directory, the sitemap and llms.txt need to know
// about an episode.
function summaryFor(d) {
  return {
    videoId: d.videoId,
    title: d.title,
    format: d.format,
    thumbnail: d.coverArt,
    publishedAt: d.publishedAt,
    guestName: d.guestName,
    guestTitle: d.guestTitle,
    duration: d.duration,
    description: d.metaDescription || deriveMetaDescription(d),
    topics: d.topics || [],
  };
}

async function build() {
  const videoIds = fs.readFileSync(IDS_FILE, "utf8")
    .split("\n").map(l => l.trim()).filter(Boolean);
  const idSet = new Set(videoIds);

  console.log(`Found ${videoIds.length} video IDs`);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const allEpisodes = [];
  let imported = 0, rendered = 0, failed = 0;

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    let d;

    if (fs.existsSync(dataFile(videoId))) {
      d = readEpisodeData(videoId);
    } else {
      // No reviewed data yet: import a draft from the backend and write it.
      // The draft is what the producer reviews before it is committed. That
      // review happens on a person's machine; a build on CI (the weekly
      // audience job commits public/ to main) must never publish a draft.
      if (process.env.CI) {
        throw new Error(`${videoId} has no content/episodes/${videoId}.json; a CI build does not import drafts`);
      }
      console.log(`[${i + 1}/${videoIds.length}] Importing ${videoId} from the backend...`);
      try {
        d = await importDraft(videoId, idSet);
        imported++;
        console.log(`   DRAFT -> content/episodes/${videoId}.json (review before committing)`);
      } catch (e) {
        console.error(`   FAILED ${videoId}: ${e.message}`);
        failed++;
        continue;
      }
    }

    const problems = validate(d);
    if (problems.length) {
      throw new Error(`content/episodes/${videoId}.json: ${problems.join("; ")}`);
    }
    topicsOf(d); // throws on a slug with no hub
    const unknown = unknownSpeakers(d, loadFix(videoId));
    if (unknown.length) {
      console.warn(`   WARN ${videoId}: speaker label(s) not in the known list: ${unknown.map(u => `"${u}"`).join(", ")}`);
    }

    const epDir = path.join(PUBLIC_DIR, "episode", videoId);
    fs.mkdirSync(epDir, { recursive: true });
    fs.writeFileSync(path.join(epDir, "index.html"), renderEpisodePage(d));
    rendered++;
    allEpisodes.push(summaryFor(d));
  }

  // Data files for episodes not in the registry are not rendered; say so.
  for (const f of fs.readdirSync(CONTENT_DIR)) {
    const id = f.replace(/\.json$/, "");
    if (f.endsWith(".json") && !idSet.has(id)) {
      console.warn(`   WARN content/episodes/${f} is not listed in podcast-video-ids.txt and was not rendered`);
    }
  }

  allEpisodes.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const site = readSite();
  fs.writeFileSync(path.join(PUBLIC_DIR, "index.html"), renderHomePage(allEpisodes, site));
  console.log("Written public/index.html");

  const episodesDir = path.join(PUBLIC_DIR, "episodes");
  fs.mkdirSync(episodesDir, { recursive: true });
  fs.writeFileSync(path.join(episodesDir, "index.html"), renderEpisodesPage(allEpisodes));
  console.log("Written public/episodes/index.html");

  const staticPages = {
    "about": renderAboutPage(site, allEpisodes),
    "newsletter": renderNewsletterPage(site),
    "privacy": renderLegalPage(fs.readFileSync(path.join(LEGAL_DIR, "privacy.md"), "utf8"),
      { path: "/privacy/", description: "How marinamogilko.co and Linguamarina, Inc. handle the information visitors share, what is collected, and how to ask for it to be reviewed or deleted." }),
    "terms": renderLegalPage(fs.readFileSync(path.join(LEGAL_DIR, "terms.md"), "utf8"),
      { path: "/terms/", description: "The terms under which marinamogilko.co and its content are offered by Linguamarina, Inc., including the refund policy and how to raise a copyright notice." }),
  };
  const topicsDir = path.join(PUBLIC_DIR, "topics");
  fs.mkdirSync(topicsDir, { recursive: true });
  fs.writeFileSync(path.join(topicsDir, "index.html"), renderTopicsIndex(TOPIC_HUBS, allEpisodes));
  for (const topic of TOPIC_HUBS) {
    const editorialFile = path.join(TOPICS_DIR, `${topic.slug}.md`);
    const editorial = fs.existsSync(editorialFile) ? fs.readFileSync(editorialFile, "utf8") : null;
    const dir = path.join(topicsDir, topic.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderTopicPage(topic, allEpisodes, TOPIC_HUBS, { editorial, newsletterCta }));
  }
  console.log(`Written public/topics/ (${TOPIC_HUBS.length} hubs)`);

  for (const [slug, html] of Object.entries(staticPages)) {
    const dir = path.join(PUBLIC_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    console.log(`Written public/${slug}/index.html`);
  }

  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), renderSitemap(allEpisodes));
  console.log("Written public/sitemap.xml");

  writeLlmsTxt(allEpisodes, site);

  console.log(`\nImported: ${imported}  Rendered: ${rendered}  Failed: ${failed}  Total: ${allEpisodes.length}`);
  if (failed && process.env.CI) {
    throw new Error(`${failed} episode(s) failed to build; a CI build does not publish a site with pages missing`);
  }
}

// lastmod has to mean "the page changed", not "the episode came out", or every
// build hands Google the same dates and the edits we make to old pages never
// register. Keyed on a hash of the rendered page so it survives a fresh clone,
// which mtime would not.
// What a reader or a machine gets from a page: its text, its links and its
// structured data. Markup, CSS and scripts are not part of it.
// The shared header and footer are not part of it either: a nav label or a
// footer link changes on all 123 pages at once, and telling Google that every
// episode changed that day would bury the dates of the pages that did.
function contentFingerprint(html) {
  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [, ""])[1];
  const page = html
    .replace(/<header class="site-header">[\s\S]*?<\/header>/, " ")
    .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  const links = [...page.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]).join("\n");
  const text = page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return `${text}\n${links}\n${ld}`;
}

// Bumped whenever contentFingerprint() changes what it hashes. On the first
// build after a bump every page adopts its new hash and keeps its date, so
// changing the formula never re-dates the whole site.
const FINGERPRINT_BASIS = "content-v2";

function lastmodFor(episodes) {
  const cacheFile = path.join(__dirname, "sitemap-lastmod.json");
  const cache = fs.existsSync(cacheFile)
    ? JSON.parse(fs.readFileSync(cacheFile, "utf8"))
    : seedLastmodFromSitemap();
  const today = new Date().toISOString().split("T")[0];
  const out = {};

  for (const ep of episodes) {
    // The hash is over what a visitor can see on the rendered page (text,
    // links, structured data), so neither a CSS-only template change nor a
    // data field that is not rendered yet announces the page as updated.
    const hash = fs.existsSync(dataFile(ep.videoId))
      ? crypto.createHash("sha1").update(contentFingerprint(renderEpisodePage(readEpisodeData(ep.videoId)))).digest("hex")
      : "";
    const prev = cache[ep.videoId];
    let date;
    if (!prev) {
      // A page we have never seen is dated by publication, not by today.
      date = new Date(ep.publishedAt).toISOString().split("T")[0];
    } else if (prev.basis !== FINGERPRINT_BASIS) {
      // First run on this basis: keep the date, adopt the hash.
      date = prev.date;
    } else {
      date = prev.hash !== hash ? today : prev.date;
    }
    out[ep.videoId] = { hash, date, basis: FINGERPRINT_BASIS };
  }

  fs.writeFileSync(cacheFile, JSON.stringify(out, null, 2) + "\n");
  return out;
}

// No cache yet means this is the first build since lastmod started being
// tracked. Take the dates already published in sitemap.xml rather than
// resetting them to publication dates and throwing away a real crawl signal.
function seedLastmodFromSitemap() {
  const file = path.join(PUBLIC_DIR, "sitemap.xml");
  if (!fs.existsSync(file)) return {};
  const seeded = {};
  const re = /<loc>[^<]*\/episode\/([^/]+)\/<\/loc><lastmod>([^<]+)<\/lastmod>/g;
  const xml = fs.readFileSync(file, "utf8");
  let m;
  while ((m = re.exec(xml)) !== null) {
    // No hash: the date stands until the page's content actually changes.
    seeded[m[1]] = { hash: "", date: m[2] };
  }
  return seeded;
}

function renderSitemap(episodes) {
  const lastmod = lastmodFor(episodes);
  const urls = [
    `  <url><loc>${SITE_URL}/</loc><priority>1.0</priority></url>`,
    `  <url><loc>${SITE_URL}/episodes/</loc><priority>0.8</priority></url>`,
    `  <url><loc>${SITE_URL}/topics/</loc><priority>0.8</priority></url>`,
    ...TOPIC_HUBS.map((t) => `  <url><loc>${SITE_URL}/topics/${t.slug}/</loc><priority>0.7</priority></url>`),
    `  <url><loc>${SITE_URL}/about/</loc><priority>0.8</priority></url>`,
    `  <url><loc>${SITE_URL}/newsletter/</loc><priority>0.6</priority></url>`,
    `  <url><loc>${SITE_URL}/privacy/</loc><priority>0.2</priority></url>`,
    `  <url><loc>${SITE_URL}/terms/</loc><priority>0.2</priority></url>`,
    ...episodes.map(ep =>
      `  <url><loc>${SITE_URL}/episode/${ep.videoId}/</loc><lastmod>${lastmod[ep.videoId].date}</lastmod></url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// llms.txt is what AI crawlers read, so the guest index in it has to list every
// guest episode with a link. The prose above and below is hand-written, so only
// the one section is regenerated — everything else in the file is left alone.
const LLMS_HEADING = "## Podcast Guests and Their Episodes";

function renderLlmsGuestSection(episodes) {
  const lines = episodes
    // Solo episodes have Marina as the performer, compilations list several
    // guests at once. Neither belongs in a guest -> page index.
    .filter(ep => ep.guestName && ep.guestName !== "Marina Mogilko" && !ep.guestName.includes(","))
    .map(ep => {
      const role = (ep.guestTitle || "").replace(/\s*·\s*/g, ", ");
      const year = new Date(ep.publishedAt).getFullYear();
      return `- ${ep.guestName} — ${role} (${year}): ${SITE_URL}/episode/${ep.videoId}/`;
    });

  return [
    LLMS_HEADING,
    "Every guest interview on the Silicon Valley Girl podcast, newest first. " +
      "Each line is the guest, their role, the year, and the page with the full transcript.",
    ...lines,
    "",
    "",
  ].join("\n");
}

// The About section of llms.txt is the fact list from content/site.json, the
// same one the About page shows, so an AI crawler and a reader get the same
// claims. Counts appear only once the dashboard job has written them.
const LLMS_ABOUT_HEADING = "## About Marina Mogilko";

function renderLlmsAboutSection(site) {
  const lines = (site.facts || []).map((f) => `- ${f.text}${f.source ? ` (source: ${f.source})` : ""}`);
  const counts = site.counts && site.counts.items ? site.counts.items : [];
  if (counts.length) {
    lines.push(`- Audience (as of ${site.counts.updatedAt}, rounded down, audiences overlap): ${counts.map((c) => `${c.value} ${c.label}`).join("; ")}`);
  }
  lines.push(`- Based in ${site.person.location}`);
  lines.push(`- Full profile, speaking and press: ${SITE_URL}/about/`);
  return [LLMS_ABOUT_HEADING, ...lines, "", ""].join("\n");
}

const LLMS_TOPICS_HEADING = "## Topics Covered on Silicon Valley Girl";

// One line per hub: the question it answers, the count and the page.
function renderLlmsTopicsSection(topics, episodes) {
  const lines = topics.map((t) => {
    const { primary, secondary } = episodesFor(t.slug, episodes);
    return `- ${t.name}: ${t.question} ${primary.length + secondary.length} episodes: ${SITE_URL}/topics/${t.slug}/`;
  });
  return [LLMS_TOPICS_HEADING, ...lines, "", ""].join("\n");
}

// Replace the section that starts at `heading` and runs to the next "## ".
function replaceSection(txt, heading, section) {
  const start = txt.indexOf(heading);
  if (start === -1) return null;
  const after = txt.indexOf("\n## ", start + heading.length);
  const end = after === -1 ? txt.length : after + 1;
  return txt.slice(0, start) + section + txt.slice(end);
}

function writeLlmsTxt(episodes, site) {
  const file = path.join(PUBLIC_DIR, "llms.txt");
  if (!fs.existsSync(file)) {
    console.log("Skipped public/llms.txt (file missing)");
    return;
  }
  let txt = fs.readFileSync(file, "utf8");
  const guests = renderLlmsGuestSection(episodes);
  const withGuests = replaceSection(txt, LLMS_HEADING, guests);
  if (withGuests === null) {
    console.log(`Skipped public/llms.txt (no "${LLMS_HEADING}" section)`);
    return;
  }
  txt = withGuests;
  if (site) {
    const withAbout = replaceSection(txt, LLMS_ABOUT_HEADING, renderLlmsAboutSection(site));
    if (withAbout === null) console.log(`Note: public/llms.txt has no "${LLMS_ABOUT_HEADING}" section`);
    else txt = withAbout;
  }
  const withTopics = replaceSection(txt, LLMS_TOPICS_HEADING, renderLlmsTopicsSection(TOPIC_HUBS, episodes));
  if (withTopics === null) console.log(`Note: public/llms.txt has no "${LLMS_TOPICS_HEADING}" section`);
  else txt = withTopics;
  fs.writeFileSync(file, txt);
  console.log(`Written public/llms.txt (${guests.split("\n").length - 4} guests)`);
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------


function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// timeZone is pinned because publishedAt is a UTC instant and six episodes go
// out between 20:40 and 21:07 UTC. Without it the rendered day comes from
// whichever machine ran the build, so those six flip a day east of UTC and the
// build stops being reproducible. UTC also reproduces the dates already
// published: no episode goes out before 12:00 UTC, so the UTC day and the US
// publishing day are always the same one.
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Home Page
// ---------------------------------------------------------------------------

// Short form for the cover-story meta line ("SEP 8 2026"). UTC-pinned for the
// same reason as formatDate — see the comment there.
function formatDateShort(dateStr) {
  return new Date(dateStr)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .replace(",", "")
    .toUpperCase();
}

// Compilations list several guests (comma-separated). Everywhere on the home
// page we show Marina as the host instead of the guest list: a montage should
// not compete with each guest's own episode for a "[name] podcast" query.
function displayGuest(ep) {
  const isCompilation = !!(ep.guestName && ep.guestName.includes(","));
  return isCompilation || !ep.guestName ? "Marina Mogilko" : ep.guestName;
}

// Built from lib/contact-fields.js so the markup and the server-side validator
// can never disagree about names, options or limits. Every control gets a real
// <label for> — the mock's uppercase field names are styling, not placeholders,
// and a placeholder disappears the moment someone starts typing.
function renderFormFields() {
  return FIELDS.map((f) => {
    const id = `f-${f.name}`;
    const req = f.required ? " required" : "";
    const cap = f.max ? ` maxlength="${f.max}"` : "";
    const auto = f.autocomplete ? ` autocomplete="${f.autocomplete}"` : "";
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";

    let control;
    if (f.type === "select") {
      const options = TOPICS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("\n            ");
      control = `<select id="${id}" name="${f.name}"${req}>\n            ${options}\n          </select>`;
    } else if (f.type === "textarea") {
      control = `<textarea id="${id}" name="${f.name}" rows="6"${req}${cap}${ph}></textarea>`;
    } else {
      control = `<input type="${f.type}" id="${id}" name="${f.name}"${req}${cap}${auto}${ph}>`;
    }

    return `        <div class="field field-${f.name}">
          <label for="${id}">${esc(f.label)}</label>
          ${control}
        </div>`;
  }).join("\n");
}

// Pin a specific episode to the top of the homepage. Set to null (or a
// videoId no longer on the site) and the newest episode takes the slot again,
// which is what the page does by default.
const FEATURED_VIDEO_ID = "qy8Gr27yLMk";


// Every episode on one page, linked from the homepage archive. Separate from
// the homepage because revealing 110 cards in place buried everything below
// them — the form included — behind an endless scroll.
// The directory: every episode in the HTML, newest first, with a search box
// and format and topic filters that work on the page itself. Without
// JavaScript the toolbar stays hidden and the full list is simply there; the
// filters never change the URL, so there is one page to index, not hundreds.
function renderEpisodesPage(episodes, topics = TOPIC_HUBS) {
  const cards = episodes.map((ep) => renderEpisodeCard(ep)).join("\n");
  const topicOptions = topics
    .map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`)
    .join("\n            ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All episodes — Silicon Valley Girl Podcast</title>
  <meta name="description" content="Every episode of the Silicon Valley Girl Podcast with Marina Mogilko: ${episodes.length} conversations with the founders and scientists building AI, each with a full transcript. Search by guest or title, filter by format and topic.">
  <link rel="canonical" href="${SITE_URL}/episodes/">
  <meta property="og:title" content="All episodes — Silicon Valley Girl Podcast">
  <meta property="og:description" content="Every episode of the Silicon Valley Girl Podcast with Marina Mogilko.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/episodes/">
  <meta property="og:image" content="${SITE_URL}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  ${SHARED_HEAD}
  <style>
    /* CHROME-START */${CHROME_CSS}
    /* CHROME-END */

    body {
      font-family: var(--body); background: var(--ground); color: var(--ink);
      line-height: 1.55; margin: 0; -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    h1, h3 { margin: 0; font-weight: 400; }
    p { margin: 0; }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
    .archive-page { padding: clamp(2rem, 3.5vw, 3rem) 0 clamp(3rem, 5vw, 4rem); }
    .archive-page h1 {
      font-family: var(--display); text-transform: uppercase;
      font-size: clamp(2.25rem, 5vw, 3.75rem); line-height: 1; margin-bottom: 0.5rem;
    }
    .archive-count {
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(23, 21, 17, 0.55); margin-bottom: 2rem;
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.25rem 0 2rem; }
    .toolbar[hidden] { display: none; }
    .toolbar label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(23, 21, 17, 0.6); }
    .toolbar input, .toolbar select {
      font: inherit; font-size: 1rem; color: var(--ink); background: var(--card);
      border: 1.5px solid var(--rule); border-radius: 8px; padding: 0.6rem 0.8rem; min-height: 44px;
    }
    .toolbar input { min-width: 16rem; }
    .toolbar input:focus, .toolbar select:focus { outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--ink); }
    .toolbar .reset { align-self: flex-end; font: inherit; font-weight: 600; background: none; border: 1.5px solid var(--ink); border-radius: 8px; padding: 0.6rem 1rem; min-height: 44px; cursor: pointer; }
    .toolbar .reset:hover { background: var(--ink); color: var(--ground); }
    .no-results { display: none; padding: 2rem 0; font-size: 1.05rem; }
    .no-results.show { display: block; }
    ${CARD_CSS}
    .back-home {
      display: inline-block; margin-top: 2.5rem; font-size: 0.95rem;
      font-weight: 600; text-decoration: none; border-bottom: 2px solid var(--accent);
      padding-bottom: 2px;
    }
    @media (max-width: 640px) {
      .wrap { padding: 0 1rem; }
      .toolbar input { min-width: 0; width: 100%; }
      .toolbar label { width: 100%; }
    }
  </style>
</head>
<body>

  ${SHARED_HEADER}

  <main class="archive-page">
    <div class="wrap">
      <h1>All episodes</h1>
      <p class="archive-count" id="count" aria-live="polite">${episodes.length} episodes</p>
      <form class="toolbar" id="filters" hidden autocomplete="off">
        <label>Search
          <input type="search" id="q" placeholder="Guest, company or title">
        </label>
        <label>Format
          <select id="format">
            <option value="">All formats</option>
            <option value="interview">Interviews</option>
            <option value="solo">Solo episodes</option>
            <option value="compilation">Compilations</option>
          </select>
        </label>
        <label>Topic
          <select id="topic">
            <option value="">All topics</option>
            ${topicOptions}
          </select>
        </label>
        <button type="reset" class="reset">Clear</button>
      </form>
      <div class="ep-grid" id="grid">
${cards}
      </div>
      <p class="no-results" id="none">No episodes match. <a href="/episodes/">Clear the filters</a> or try another word.</p>
      <a class="back-home" href="/">&larr; Back to the homepage</a>
    </div>
  </main>

  ${SHARED_FOOTER}

  <script>
  (function () {
    var form = document.getElementById("filters"), q = document.getElementById("q"),
        fmt = document.getElementById("format"), topic = document.getElementById("topic"),
        cards = Array.prototype.slice.call(document.querySelectorAll("#grid .ep-card")),
        count = document.getElementById("count"), none = document.getElementById("none"),
        total = cards.length;
    function apply() {
      var words = q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean), f = fmt.value, tp = topic.value, shown = 0;
      cards.forEach(function (c) {
        var s = c.getAttribute("data-search") || "", ok = true, i;
        for (i = 0; i < words.length; i++) if (s.indexOf(words[i]) === -1) { ok = false; break; }
        if (ok && f && c.getAttribute("data-format") !== f) ok = false;
        if (ok && tp && (" " + (c.getAttribute("data-topics") || "") + " ").indexOf(" " + tp + " ") === -1) ok = false;
        c.hidden = !ok; if (ok) shown++;
      });
      count.textContent = shown === total ? total + " episodes" : shown + " of " + total + " episodes";
      none.className = shown ? "no-results" : "no-results show";
    }
    form.hidden = false;
    q.addEventListener("input", apply); fmt.addEventListener("change", apply); topic.addEventListener("change", apply);
    form.addEventListener("reset", function () { setTimeout(apply, 0); });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
  })();
  </script>

</body>
</html>`;
}

function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": IDS.person,
        name: "Marina Mogilko",
        url: `${SITE_URL}/about/`,
        image: `${SITE_URL}/marina-mogilko.jpg`,
        jobTitle: "Host, Silicon Valley Girl Podcast",
        description:
          "Entrepreneur and creator based in Silicon Valley. Host of Silicon Valley Girl, an AI, tech and career podcast, and author of the Future Proof newsletter.",
        worksFor: { "@id": IDS.org },
        knowsAbout: ["Artificial intelligence", "Careers", "Entrepreneurship", "Creator economy"],
        sameAs: [
          "https://www.youtube.com/@SiliconValleyGirl",
          "https://www.youtube.com/@linguamarina",
          "https://www.instagram.com/siliconvalleygirl/",
          "https://www.instagram.com/siliconvalleygirlpodcast/",
          "https://www.linkedin.com/in/marinamogilko/",
          "https://x.com/siliconvalleymm",
          "https://www.tiktok.com/@linguamarina",
        ],
      },
      {
        "@type": "PodcastSeries",
        "@id": IDS.podcast,
        name: "Silicon Valley Girl Podcast",
        url: `${SITE_URL}/`,
        description:
          "Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and the future.",
        inLanguage: "en",
        author: { "@id": IDS.person },
        publisher: { "@id": IDS.org },
        sameAs: [
          "https://www.youtube.com/@SiliconValleyGirl",
          "https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY",
          "https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545",
        ],
      },
      {
        "@type": "Organization",
        "@id": IDS.org,
        name: "Linguamarina, Inc.",
        url: `${SITE_URL}/`,
        founder: { "@id": IDS.person },
      },
      {
        "@type": "WebSite",
        "@id": IDS.website,
        name: "Silicon Valley Girl Podcast",
        url: `${SITE_URL}/`,
        publisher: { "@id": IDS.org },
      },
    ],
  };
}

function renderHomePage(episodes, site = null) {
  const audienceTotal = site && site.audience ? formatCount(site.audience.total) : "";
  const newest = episodes[0];
  const pinned = FEATURED_VIDEO_ID
    ? episodes.find((e) => e.videoId === FEATURED_VIDEO_ID)
    : null;
  if (FEATURED_VIDEO_ID && !pinned) {
    console.log(`Note: featured episode ${FEATURED_VIDEO_ID} is not on the site — falling back to the newest.`);
  }
  // Two distinct slots. The hero carries whatever is pinned — an editorial
  // pick, with no "latest" wording anywhere near it. The cover story below is
  // always the genuinely newest episode, so "This week's cover story" stays
  // true no matter what is pinned above it.
  const hero = pinned || newest;
  const cover = newest;
  const shown = new Set([hero.videoId, cover.videoId]);
  const rest = episodes.filter((e) => !shown.has(e.videoId));

  // Six cards show; the rest stay in the markup but hidden, and "All episodes"
  // reveals them. Keeping every episode in the DOM preserves the internal
  // linking the archive is worth to search — moving 110 of them behind a
  // separate page would cost that for a purely visual gain.
  const ARCHIVE_VISIBLE = 6;
  const archive = episodes.filter((e) => !new Set([hero.videoId, cover.videoId]).has(e.videoId));
  const archiveHtml = rest
    .slice(0, ARCHIVE_VISIBLE)
    .map(
      (ep) => `
          <a href="/episode/${ep.videoId}/" class="ep-card">
            <img src="${esc(ep.thumbnail)}" alt="${esc(ep.title)}" loading="lazy" width="480" height="270">
            <div class="ep-card-body">
              <p class="ep-card-meta">${esc(displayGuest(ep))} &middot; ${esc(ep.duration)}</p>
              <h3 class="ep-card-title">${esc(ep.title)}</h3>
            </div>
          </a>`
    )
    .join("\n");
  const moreCount = Math.max(0, rest.length - ARCHIVE_VISIBLE);

  // Six guests, each linking to their interview (the thumbnail stands in for
  // a portrait until there are portraits), and four of Marina's own videos
  // with the format on the card. Both come from the data; both are left out
  // when the site facts are not supplied (unit renders).
  const guestRow = site && site.featuredGuests
    ? site.featuredGuests
        .map((name) => ({ name, ep: episodeFor(name, episodes) }))
        .filter((g) => g.ep)
        .slice(0, 6)
    : [];
  const guestsHtml = guestRow.map(({ name, ep }) => `
          <a href="/episode/${ep.videoId}/" class="guest-tile">
            <img src="${esc(ep.thumbnail)}" alt="${esc(name)} on the Silicon Valley Girl Podcast" loading="lazy" width="480" height="270">
            <span class="guest-name">${esc(name)}</span>
            <span class="guest-role">${esc(ep.guestTitle || "")}</span>
          </a>`).join("");
  const practical = site
    ? episodes.filter((e) => (e.format === "solo" || e.format === "compilation") && !shown.has(e.videoId)).slice(0, 4)
    : [];
  const practicalHtml = practical.map((ep) => `
          <a href="/episode/${ep.videoId}/" class="ep-card">
            <img src="${esc(ep.thumbnail)}" alt="${esc(ep.title)}" loading="lazy" width="480" height="270">
            <div class="ep-card-body">
              <p class="ep-card-meta">${esc(ep.duration)} <span class="ep-format">${FORMAT_LABEL[ep.format]}</span></p>
              <h3 class="ep-card-title">${esc(ep.title)}</h3>
            </div>
          </a>`).join("");
  const counts = site && site.counts && site.counts.items.length ? site.counts : null;
  const positioning = site && site.person ? site.person.positioning : "";

  // A portrait of Marina if one has been dropped into public/ under any of
  // these names; otherwise two recent stills, so a missing file degrades to
  // something reasonable instead of a broken image.
  // Read the directory rather than probing names with existsSync. On macOS
  // existsSync("host.jpg") is true for a file actually called host.JPG, so the
  // markup would reference a spelling that does not exist and 404 on Vercel's
  // case-sensitive filesystem. Taking the name from readdirSync means the src
  // is always exactly what is on disk, whatever case it was saved in.
  const HOST_PHOTO_EXT = /^host\.(jpe?g|png|webp)$/i;
  const hostPhotoFile = fs
    .readdirSync(PUBLIC_DIR)
    .filter((n) => HOST_PHOTO_EXT.test(n))
    .sort()[0];
  const hostStills = hostPhotoFile
    ? `<img src="/${hostPhotoFile}" alt="Marina Mogilko" class="host-photo" loading="lazy" width="640" height="800">`
    : rest
        .slice(0, 2)
        .map(
          (ep) =>
            `<img src="${esc(ep.thumbnail)}" alt="${esc(ep.title)}" loading="lazy" width="480" height="270">`
        )
        .join("\n          ");
  if (!hostPhotoFile) {
    console.log("Note: no host photo found — drop one at public/host.jpg to replace the episode stills.");
  }

  // Same list the header icons come from, rendered here with labels.
  const followLinks = SOCIAL_LINKS.map(
    (s) =>
      `<a href="${s.url}" target="_blank" rel="noopener" class="follow-btn">${s.icon}<span>${s.label}</span></a>`
  ).join("\n            ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Silicon Valley Girl Podcast — Marina Mogilko</title>
  <meta name="description" content="Silicon Valley Girl Podcast hosted by Marina Mogilko. Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and the future.">
  <meta property="og:title" content="Silicon Valley Girl Podcast">
  <meta property="og:description" content="Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and the future.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://marinamogilko.co">
  <meta property="og:image" content="https://marinamogilko.co/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Silicon Valley Girl Podcast">
  <meta name="twitter:description" content="Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and the future.">
  <meta name="twitter:image" content="https://marinamogilko.co/og-image.png">
  <link rel="canonical" href="${SITE_URL}/">
  <script type="application/ld+json">${jsonForScript(homeJsonLd())}</script>
  ${SHARED_HEAD}
  <style>
    /* CHROME-START */${CHROME_CSS}
    /* CHROME-END */

    body {
      font-family: var(--body);
      background: var(--ground);
      color: var(--ink);
      line-height: 1.55;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    h1, h2, h3 { margin: 0; font-weight: 400; }
    p { margin: 0; }

    .wrap { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }

    .eyebrow {
      font-size: 0.82rem; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 0.9rem;
    }
    .section-title {
      font-family: var(--display); text-transform: uppercase; font-size: clamp(1.9rem, 4vw, 2.9rem);
      letter-spacing: 0.01em; line-height: 1; margin-bottom: 1.8rem;
    }
    .accent { color: var(--accent); }

    /* Three button styles, as the mock uses: accent for the primary watch
       action, ink for secondary actions, outlined for the tertiary one. */
    .btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.8rem 1.35rem; border: 2px solid var(--ink);
      font-size: 0.95rem; font-weight: 600; border-radius: 8px;
      text-decoration: none; background: transparent; color: var(--ink);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn:hover { background: var(--ink); color: var(--ground); }
    .btn-accent { background: var(--accent); border-color: var(--accent); color: var(--ground); }
    .btn-accent:hover { background: #c41210; border-color: #c41210; color: var(--ground); }
    .btn-ink { background: var(--ink); border-color: var(--ink); color: var(--ground); }
    .btn-ink:hover { background: var(--accent); border-color: var(--accent); color: var(--ground); }
    .btn-text {
      font-size: 0.95rem; font-weight: 600; text-decoration: none;
      border-bottom: 2px solid var(--accent); padding-bottom: 2px; align-self: center;
    }
    .btn-text:hover { color: var(--accent); }

    /* The mock sets section eyebrows as red pills, not plain red text. */
    .pill-label {
      display: inline-block; background: var(--accent); color: var(--ground);
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; padding: 0.3rem 0.7rem; border-radius: 999px;
      margin-right: 0.8rem; vertical-align: middle;
    }

    /* ---- Hero ---- */
    .hero { padding: clamp(1.75rem, 3.5vw, 3rem) 0 clamp(1.75rem, 3.5vw, 3rem); }
    .hero-inner {
      display: grid; grid-template-columns: 1.25fr 0.95fr;
      gap: clamp(1.5rem, 3vw, 2.5rem); align-items: end;
    }
    .hero h1 {
      font-family: var(--display); text-transform: uppercase;
      font-size: clamp(2.5rem, 7vw, 6rem);
      line-height: 0.82; letter-spacing: -0.01em;
      margin-bottom: 1.1rem;
    }
    .hero-dek {
      font-size: clamp(1rem, 1.5vw, 1.12rem); max-width: 34rem;
      color: rgba(23, 21, 17, 0.8); margin-bottom: 1.3rem;
    }
    .hero-cta { display: flex; flex-wrap: wrap; gap: 0.7rem; }
    .hero-media { position: relative; }
    .hero-media img { width: 100%; height: auto; display: block; border-radius: 8px; }
    .hero-badge {
      position: absolute; bottom: -0.9rem; right: -0.6rem;
      background: var(--accent); color: #fff;
      font-size: 0.66rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; padding: 0.6rem 0.9rem;
    }

    /* ---- Cover story ---- */
    .cover { padding: clamp(2rem, 3.5vw, 3rem) 0; border-top: 1px solid var(--rule); }
    .cover-card {
      display: grid; grid-template-columns: 0.9fr 1.1fr;
      gap: clamp(1.5rem, 3vw, 2.5rem); align-items: center;
      background: var(--card); padding: clamp(1.25rem, 2.5vw, 2rem);
    }
    .cover-card img { width: 100%; height: auto; display: block; border-radius: 8px; }
    .cover-meta {
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.13em;
      text-transform: uppercase; color: rgba(23, 21, 17, 0.55); margin-bottom: 0.8rem;
    }
    .cover-title {
      font-family: var(--display); text-transform: uppercase; font-size: clamp(1.6rem, 3.2vw, 2.6rem);
      line-height: 1.02; margin-bottom: 0.9rem;
    }
    .cover-title a { text-decoration: none; }
    .cover-title a:hover { color: var(--accent); }
    .cover-dek { color: rgba(23, 21, 17, 0.78); margin-bottom: 1.4rem; }
    .cover-cta { display: flex; flex-wrap: wrap; gap: 0.7rem; }

    /* ---- About ---- */
    .about { padding: clamp(2rem, 3.5vw, 3rem) 0; border-top: 1px solid var(--rule); }
    .about-inner { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(1.5rem, 4vw, 3rem); }
    .about-body p { margin-bottom: 1.1rem; max-width: 46rem; color: rgba(23, 21, 17, 0.85); }
    .about-body p:last-child { margin-bottom: 0; }

    /* ---- Archive ---- */
    .archive { padding: clamp(2rem, 3.5vw, 3rem) 0; border-top: 1px solid var(--rule); }
    .archive-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.6rem 1.4rem;
    }
    .ep-card { text-decoration: none; display: block; }
    .ep-card img { width: 100%; height: auto; display: block; border-radius: 8px; }
    .ep-card-body { padding-top: 0.75rem; }
    .ep-card-meta {
      font-size: 0.64rem; font-weight: 700; letter-spacing: 0.13em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 0.4rem;
    }
    .ep-card-title {
      font-family: var(--display); font-size: 1.22rem; line-height: 1.08;
      letter-spacing: 0.01em; text-transform: uppercase;
    }
    .ep-card:hover .ep-card-title { color: var(--accent); }
    .archive-head {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 1rem; flex-wrap: wrap;
    }
    .archive-head .section-title { margin-bottom: 1.8rem; }
    .topics { padding: clamp(2rem, 4vw, 3rem) 0; }
    .topic-chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .topic-chips a { display: inline-flex; align-items: center; min-height: 44px; padding: 0.4rem 1rem; border: 1.5px solid var(--ink); border-radius: 999px; text-decoration: none; font-weight: 500; font-size: 0.92rem; }
    .topic-chips a:hover, .topic-chips a.all { background: var(--ink); color: var(--ground); }
    .topic-chips a.all:hover { background: var(--accent); }
    .archive-more {
      background: none; border: none; border-bottom: 2px solid var(--accent);
      font-family: var(--body); cursor: pointer; padding: 0 0 2px;
      color: rgba(23, 21, 17, 0.62);
    }

    /* ---- Host ---- */
    .host { background: var(--ink); color: var(--ground); padding: clamp(3rem, 6vw, 4.5rem) 0; }
    .host .section-title { color: var(--ground); }
    .host-inner { display: grid; grid-template-columns: 0.65fr 1.35fr; gap: clamp(1.5rem, 4vw, 3rem); align-items: start; }
    .host-stills { display: grid; gap: 0.8rem; }
    .host-stills img { width: 100%; height: auto; display: block; border-radius: 8px; }
    .host-photo { object-fit: cover; aspect-ratio: 4 / 5; }
    .host-name {
      font-family: var(--display); text-transform: uppercase; font-size: clamp(2rem, 4.5vw, 3.2rem);
      line-height: 1; margin-bottom: 1.1rem;
    }
    .host-bio { color: rgba(255, 253, 246, 0.82); max-width: 44rem; margin-bottom: 2rem; }
    .host-stats { display: flex; flex-wrap: wrap; gap: clamp(2rem, 6vw, 4.5rem); }
    .stat-value { font-family: var(--display); font-size: 1.8rem; line-height: 1; display: block; }
    .stat-label {
      font-size: 0.62rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--muted); display: block; margin-top: 0.35rem;
    }

    .host-positioning { font-size: 1.15rem; line-height: 1.5; max-width: 44rem; margin-bottom: 1rem; }
    .host-more { margin-top: 2rem; }
    .btn-ghost { border: 2px solid var(--ground); color: var(--ground); background: transparent; }
    .btn-ghost:hover { background: var(--ground); color: var(--ink); }

    /* ---- Guests and practical rows ---- */
    .guests, .practical { padding: clamp(2.5rem, 5vw, 4rem) 0; border-top: 1px solid var(--rule); }
    .section-dek { max-width: 40rem; margin: -1rem 0 1.8rem; color: rgba(23, 21, 17, 0.7); }
    .guest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 1.4rem 1.2rem; }
    .guest-tile { text-decoration: none; display: block; }
    .guest-tile img { width: 100%; height: auto; display: block; border-radius: 8px; aspect-ratio: 16 / 9; object-fit: cover; margin-bottom: 0.6rem; }
    .guest-name { display: block; font-family: var(--display); font-size: 1.25rem; line-height: 1; text-transform: uppercase; }
    .guest-tile:hover .guest-name { color: var(--accent); }
    .guest-role { display: block; font-size: 0.78rem; color: rgba(23, 21, 17, 0.65); margin-top: 0.3rem; line-height: 1.35; }
    .ep-format {
      display: inline-block; margin-left: 0.4rem; padding: 0.1rem 0.45rem; border-radius: 999px;
      border: 1px solid var(--rule); color: rgba(23, 21, 17, 0.6); letter-spacing: 0.08em;
    }

    /* ---- Partnerships ---- */
    .partnerships { padding: clamp(2.5rem, 5vw, 3.5rem) 0; border-bottom: 1px solid var(--rule); }
    .partnerships-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.2rem; }
    .partnerships h2 { font-family: var(--display); text-transform: uppercase; font-size: clamp(1.6rem, 3.4vw, 2.4rem); line-height: 1; }
    .pill {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: var(--accent); color: #fff; text-decoration: none;
      padding: 0.75rem 1.2rem; font-size: 0.82rem; font-weight: 600;
    }
    .pill:hover { background: #c41210; }

    /* ---- Newsletter + follow ---- */
    .newsletter { padding: clamp(2rem, 3.5vw, 3rem) 0; }
    .newsletter-inner { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(2rem, 5vw, 4rem); align-items: start; }
    .newsletter h2 { font-family: var(--display); text-transform: uppercase; font-size: clamp(2rem, 4.5vw, 3.2rem); line-height: 0.95; margin-bottom: 1rem; }
    .newsletter p { color: rgba(23, 21, 17, 0.8); margin-bottom: 1.5rem; max-width: 30rem; }
    .follow-links { display: flex; flex-wrap: wrap; gap: 0.55rem; }
    .follow-btn {
      display: inline-flex; align-items: center; gap: 0.45rem;
      border: 1px solid var(--rule); background: var(--card);
      padding: 0.6rem 0.9rem; font-size: 0.78rem; font-weight: 600;
      text-decoration: none; transition: border-color 0.15s;
    }
    .follow-btn:hover { border-color: var(--ink); }

    /* ---- Work with Marina ---- */
    .work { padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(3rem, 6vw, 4.5rem); border-top: 1px solid var(--rule); }
    .work-inner { max-width: 760px; }
    .work-dek { color: rgba(23, 21, 17, 0.8); margin-bottom: 2rem; }
    .pitch-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem 1.4rem; }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-budget, .field-details { grid-column: 1 / -1; }
    .field label {
      font-size: 0.64rem; font-weight: 700; letter-spacing: 0.13em;
      text-transform: uppercase; color: rgba(23, 21, 17, 0.62);
    }
    .field input, .field select, .field textarea {
      font-family: var(--body); font-size: 0.95rem; color: var(--ink);
      background: var(--card); border: 1px solid var(--rule);
      padding: 0.7rem 0.8rem; width: 100%; border-radius: 0;
    }
    .field textarea { resize: vertical; min-height: 8rem; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--ink); }
    .form-submit { grid-column: 1 / -1; justify-self: start; border: none; cursor: pointer; }
    .form-submit[disabled] { opacity: 0.6; cursor: default; }
    .form-error {
      grid-column: 1 / -1; background: #FDECEC; border-left: 3px solid var(--accent);
      padding: 0.75rem 0.9rem; font-size: 0.9rem;
    }
    .form-done {
      background: var(--card); border-left: 3px solid var(--accent);
      padding: 1rem 1.1rem; font-size: 1rem;
    }
    /* Off-screen rather than display:none — some bots skip hidden fields. */
    .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

    @media (max-width: 900px) {
      .hero-inner, .cover-card, .about-inner, .host-inner, .newsletter-inner {
        grid-template-columns: 1fr;
      }
      .hero-media { order: -1; }
      .hero-badge { right: 0.5rem; bottom: 0.5rem; }
    }
    @media (max-width: 640px) {
      .wrap { padding: 0 1rem; }

      /* Labels and meta sit near 10px at desktop sizes, which is too small to
         read comfortably on a phone. */
      .eyebrow, .ep-card-meta, .cover-meta, .stat-label, .field label { font-size: 0.75rem; }

      /* 16px is the threshold below which iOS Safari zooms the page when a
         field is focused, throwing the layout around mid-typing. */
      .field input, .field select, .field textarea { font-size: 16px; }

      /* The badge sits over the still at desktop widths. On a phone the image
         is far smaller and the badge covers the thumbnail's own caption, so it
         drops below the image instead. */
      .hero-badge {
        position: static; display: inline-block; margin-top: 0.6rem;
      }

      /* Comfortable tap targets. */
      .btn, .form-submit { padding: 0.85rem 1.35rem; }
      .archive-more { min-height: 44px; display: inline-flex; align-items: center; }
      .follow-btn { padding: 0.7rem 0.95rem; }
      .archive-grid { grid-template-columns: 1fr; }
      .host-stills { grid-template-columns: 1fr 1fr; }
      .pitch-form { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  ${SHARED_HEADER}

  <section class="hero">
    <div class="wrap hero-inner">
      <div class="hero-copy">
        <p class="eyebrow">The podcast that decodes the valley</p>
        <h1>What AI means for<br><span class="accent">your</span> day</h1>
        <p class="hero-dek">Marina Mogilko interviews the founders and scientists building AI, then asks them the only question that matters: what can I actually do with this today?</p>
        <div class="hero-cta">
          <a class="btn btn-accent" href="https://www.youtube.com/@SiliconValleyGirl" target="_blank" rel="noopener">Watch on YouTube</a>
          <a class="btn btn-ink" href="https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY" target="_blank" rel="noopener">Spotify</a>
          <a class="btn" href="https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545" target="_blank" rel="noopener">Apple</a>
        </div>
      </div>
      <div class="hero-media">
        <a href="/episode/${hero.videoId}/"><img src="${esc(hero.thumbnail)}" alt="${esc(hero.title)}" width="640" height="360"></a>
        <span class="hero-badge">New episode weekly</span>
      </div>
    </div>
  </section>

  <section class="cover">
    <div class="wrap">
      <h2 class="section-title"><span class="pill-label">Latest</span>This week&rsquo;s cover story</h2>
      <div class="cover-card">
        <a href="/episode/${cover.videoId}/"><img src="${esc(cover.thumbnail)}" alt="${esc(cover.title)}" loading="lazy" width="480" height="270"></a>
        <div>
          <p class="cover-meta">${formatDateShort(cover.publishedAt)} &middot; ${esc(cover.duration)} &middot; With ${esc(displayGuest(cover))}</p>
          <h3 class="cover-title"><a href="/episode/${cover.videoId}/">${esc(cover.title)}</a></h3>
          ${cover.description ? `<p class="cover-dek">${esc(cover.description)}</p>` : ""}
          <div class="cover-cta">
            <a class="btn btn-ink" href="https://youtube.com/watch?v=${cover.videoId}" target="_blank" rel="noopener">Play on YouTube</a>
            <a class="btn" href="https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY" target="_blank" rel="noopener">Spotify</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="about">
    <div class="wrap about-inner">
      <h2 class="section-title">About the show</h2>
      <div class="about-body">
        <p>Silicon Valley Girl is a weekly interview podcast hosted by Marina Mogilko, an entrepreneur and creator based in Silicon Valley. Each episode she sits down with the founders and scientists building AI and asks them one question: what can a normal person actually do with this today?</p>
        <p>Episodes run roughly 35 to 60 minutes and cover AI tools for building a business faster, running a household, learning, health and creative work. Past guests include Andrew Ng, Fei-Fei Li, Sal Khan, Anne Wojcicki and Shishir Mehrotra.</p>
        <p>You can watch on YouTube or listen on Spotify and Apple Podcasts. New episodes come out every week.</p>
      </div>
    </div>
  </section>

  <section id="episodes" class="archive">
    <div class="wrap">
      <div class="archive-head">
        <h2 class="section-title">The archive</h2>
        ${moreCount ? `<a class="btn-text archive-more" href="/episodes/">All episodes &rarr;</a>` : ""}
      </div>
      <div class="archive-grid">
${archiveHtml}
      </div>
    </div>
  </section>

  <section id="topics" class="topics">
    <div class="wrap">
      <h2 class="section-title">Explore by topic</h2>
      <ul class="topic-chips">
        ${(site && site.topics ? site.topics : TOPIC_HUBS).map((t) => `<li><a href="/topics/${esc(t.slug)}/">${esc(t.name)}</a></li>`).join("\n        ")}
        <li><a href="/topics/" class="all">All topics &rarr;</a></li>
      </ul>
    </div>
  </section>

${guestRow.length ? `
  <section id="guests" class="guests">
    <div class="wrap">
      <div class="archive-head">
        <h2 class="section-title">Guests on the show</h2>
        <a class="btn-text archive-more" href="/about/#guests">Who else has been on &rarr;</a>
      </div>
      <div class="guest-grid">${guestsHtml}
      </div>
    </div>
  </section>
` : ""}${practical.length ? `
  <section id="practical" class="practical">
    <div class="wrap">
      <div class="archive-head">
        <h2 class="section-title">Practical AI with Marina</h2>
        <a class="btn-text archive-more" href="/topics/ai-tools-and-workflows/">More how-to episodes &rarr;</a>
      </div>
      <p class="section-dek">Solo episodes and compilations: one tool, one idea or one career move, in about twenty minutes.</p>
      <div class="archive-grid">${practicalHtml}
      </div>
    </div>
  </section>
` : ""}
  <section id="host" class="host">
    <div class="wrap">
      <h2 class="section-title">Meet the host</h2>
      <div class="host-inner">
        <div class="host-stills">
          ${hostStills}
        </div>
        <div>
          <h3 class="host-name">Marina Mogilko</h3>
          ${positioning ? `<p class="host-positioning">${esc(positioning)}</p>` : ""}
          <p class="host-bio">For a lot of people the valley is where weird stuff happens &mdash; AI, robots, whatever comes next. Marina sits down with the people building it and brings back the part that changes your Tuesday: faster work if you&rsquo;re a founder, a lighter household if you&rsquo;re a parent, a whole production line if you make things.</p>
          <div class="host-stats">
            <div><span class="stat-value">Weekly</span><span class="stat-label">New episodes</span></div>
            <div><span class="stat-value">${audienceTotal || "Millions"}</span><span class="stat-label">Following along${counts ? ` &middot; ${esc(counts.updatedAt)}` : ""}</span></div>
            <div><span class="stat-value">${episodes.length}</span><span class="stat-label">Episodes with transcripts</span></div>
          </div>
          <a class="btn btn-ghost host-more" href="/about/">About Marina, speaking and press &rarr;</a>
        </div>
      </div>
    </div>
  </section>

  <section id="contact" class="partnerships">
    <div class="wrap partnerships-inner">
      <div>
        <p class="eyebrow">Partnerships</p>
        <h2>Want your brand on the podcast?</h2>
      </div>
      <a class="pill" href="mailto:partnerships@marinamogilko.co">${ICONS.mail} partnerships@marinamogilko.co</a>
    </div>
  </section>

  <section id="work" class="work">
    <div class="wrap work-inner">
      <h2 class="section-title">Pitch Marina anything</h2>
      <p class="work-dek">Brand deals, podcast guests, speaking, press, partnerships &mdash; anything at all. Tell us what you have in mind and the team will get back to you.</p>

      <form id="pitch-form" class="pitch-form" novalidate>
        <p id="form-error" class="form-error" role="alert" hidden></p>
${renderFormFields()}
        <div class="hp" aria-hidden="true">
          <label for="f-website">Leave this blank</label>
          <input type="text" id="f-website" name="website" tabindex="-1" autocomplete="off">
        </div>
        <input type="hidden" name="rendered" value="">
        <button type="submit" class="btn btn-accent form-submit">Send opportunity</button>
      </form>

      <p id="form-done" class="form-done" role="status" hidden>Thank you &mdash; that&rsquo;s with the team. You&rsquo;ll hear back at the address you gave.</p>

      <noscript>
        <p class="work-dek">This form needs JavaScript. Email <a href="mailto:pr@marinamogilko.co">pr@marinamogilko.co</a> instead and we&rsquo;ll pick it up just the same.</p>
      </noscript>
    </div>
  </section>

  <section id="subscribe" class="newsletter">
    <div class="wrap newsletter-inner">
      <div>
        <h2>Get the<br>weekly brief</h2>
        <p>One email a week: the AI idea worth your attention, and exactly what to try with it.</p>
        <a class="btn btn-accent" href="https://siliconvalleygirl.beehiiv.com/subscribe?utm_source=marinamogilkoco&amp;utm_medium=transcripts&amp;utm_campaign=futureproof-sub" target="_blank" rel="noopener">Subscribe to the newsletter</a>
      </div>
      <div>
        <p class="eyebrow">Follow along</p>
        <div class="follow-links">
            ${followLinks}
        </div>
      </div>
    </div>
  </section>

  ${SHARED_FOOTER}

  <script>
    (function () {
      var form = document.getElementById('pitch-form');
      if (!form) return;
      var errorBox = document.getElementById('form-error');
      var done = document.getElementById('form-done');
      var button = form.querySelector('button[type="submit"]');
      var label = button.textContent;

      // Stamped on load, not at build time. Baking it into the HTML would make
      // every build produce a different index.html, and would measure the age
      // of the deploy rather than how long this visitor spent on the page.
      var stamp = form.querySelector('input[name="rendered"]');
      if (stamp) stamp.value = String(Date.now());

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        errorBox.hidden = true;
        button.disabled = true;
        button.textContent = 'Sending…';

        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });

        fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
              return { ok: res.ok, body: body };
            });
          })
          .then(function (result) {
            if (result.ok) {
              form.hidden = true;
              done.hidden = false;
              done.scrollIntoView({ block: 'center', behavior: 'smooth' });
              return;
            }
            fail(result.body.error || 'Something went wrong. Please try again.');
          })
          .catch(function () {
            fail('Could not reach the server. Please try again, or email pr@marinamogilko.co.');
          });
      });

      // Never clears the form: whatever they typed stays exactly where it is.
      function fail(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        button.disabled = false;
        button.textContent = label;
        errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    })();
  </script>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Episode Page
// ---------------------------------------------------------------------------

// Future Proof newsletter CTA — a single block placed right after the
// About the Guest card on every episode page. Kept in sync with the one-off
// backfill in scripts/inject-newsletter-cta.js.
function newsletterCta() {
  const url =
    "https://siliconvalleygirl.beehiiv.com/subscribe" +
    "?utm_source=marinamogilkoco&amp;utm_medium=transcripts&amp;utm_campaign=futureproof-sub";
  return `      <aside class="newsletter-cta" aria-label="Subscribe to Marina's newsletter" style="margin:2.5rem 0;padding:1.75rem;background:#fafafa;border:1px solid #ededed;border-radius:10px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1.1rem;">
        <p style="margin:0;font-size:1.05rem;font-weight:600;line-height:1.35;color:#1a1a1a;max-width:34rem;">Get the AI tools, workflows and career moves in Marina&#39;s weekly newsletter</p>
        <a href="${url}" target="_blank" rel="noopener" style="background:#e00;color:#fff;font-weight:700;font-size:0.95rem;line-height:1;padding:0.8rem 1.5rem;border-radius:8px;text-decoration:none;white-space:nowrap;">Subscribe free</a>
      </aside>`;
}

function renderEpisodePage(d) {
  // Template v2 (Release 3) is opt-in per page; see lib/render-episode-v2.js.
  if (d.template === "v2") return renderEpisodePageV2(d, { newsletterCta, formatDate, topics: topicsOf(d) });
  const published = formatDate(d.publishedAt);
  const isoDate = new Date(d.publishedAt).toISOString();
  const isSolo = d.format === "solo";

  const takeawaysHtml = d.keyTakeaways
    .map((t) => `<li>${esc(t)}</li>`)
    .join("\n              ");

  // Every page renders the same chapter separator, in its own span between
  // the time and the title, so the flex gap centres it.
  const TS_DASH = "–";
  // Width of the widest time on this page, in characters. `ch` is the advance
  // width of "0", so in a monospace face the column fits the time exactly
  // whatever font the visitor actually has — a rem guess would leave slack.
  const tsWidth = Math.max(4, ...d.timestamps.map((t) => String(t.time).length));

  const timestampsHtml = d.timestamps.length
    ? d.timestamps
        .map(
          (t) =>
            `<a href="https://youtube.com/watch?v=${d.videoId}&t=${t.seconds}s" class="timestamp-link" target="_blank" rel="noopener">
                <span class="ts-time">${esc(t.time)}</span>
                <span class="ts-dash">${TS_DASH}</span>
                <span class="ts-title">${esc(t.title)}</span>
              </a>`
        )
        .join("\n              ")
    : `<p style="color:#999">No timestamps available for this episode.</p>`;

  // Transcript blocks are reviewed data: a labelled or unlabelled paragraph,
  // or a hand-made block kept verbatim. No heuristics run here.
  const transcriptHtml = d.transcript
    .map((b) => {
      if (b.html !== undefined) return b.html;
      if (b.speaker) {
        const cls = b.speaker.toLowerCase().includes("marina") ? ' class="speaker-marina"' : ' class="speaker"';
        return `<p><strong${cls}>${esc(b.speaker)}:</strong> ${esc(b.text)}</p>`;
      }
      return `<p>${esc(b.text)}</p>`;
    })
    .join("\n            ");

  // Newsletter CTA — right after the About the Guest card.
  const ctaTop = newsletterCta() + "\n\n    ";

  const relatedHtml = d.relatedVideos
    .map(
      (v) => `
              <a href="/episode/${v.videoId}/" class="related-card">
                <img src="${esc(v.thumbnail)}" alt="${esc(v.title)}" loading="lazy">
                <span class="related-title">${esc(v.title)}</span>
              </a>`
    )
    .join("\n");

  const thumbAlt = isSolo
    ? "Marina Mogilko, host of the Silicon Valley Girl Podcast"
    : `${esc(d.guestName)}, ${esc(d.guestTitle)}, interviewed by Marina Mogilko on the Silicon Valley Girl Podcast`;
  const metaDescription = d.metaDescription || deriveMetaDescription(d);
  const summaryBlock = d.summaryHtml !== undefined ? d.summaryHtml : renderSummaryBlock(d);
  const canonicalUrl = `https://marinamogilko.co/episode/${d.videoId}/`;


  const jsonLd = jsonForScript({
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: d.title,
    url: canonicalUrl,
    datePublished: isoDate,
    description: d.summary,
    duration: d.duration,
    associatedMedia: {
      "@type": "VideoObject",
      name: d.title,
      description: (d.summary || "").slice(0, 200),
      uploadDate: new Date(d.publishedAt).toISOString().split("T")[0],
      embedUrl: `https://www.youtube.com/embed/${d.videoId}`,
      thumbnailUrl: d.thumbnail,
    },
    partOfSeries: {
      "@type": "PodcastSeries",
      name: "Silicon Valley Girl Podcast",
      url: "https://marinamogilko.co",
    },
    performer: {
      "@type": "Person",
      name: d.guestName,
      ...(d.performer || {}),
      jobTitle: d.guestTitle,
    },
    host: {
      "@type": "Person",
      name: "Marina Mogilko",
      url: "https://marinamogilko.co",
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(d.title)} — Silicon Valley Girl Podcast</title>
  <meta name="description" content="${esc(metaDescription)}">
  <meta property="og:title" content="${esc(d.title)}">
  <meta property="og:description" content="${esc(metaDescription)}">
  <meta property="og:image" content="${esc(d.coverArt)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(d.title)}">
  <meta name="twitter:description" content="${esc(metaDescription)}">
  <meta name="twitter:image" content="${esc(d.coverArt)}">
  <link rel="canonical" href="${canonicalUrl}">
  <script type="application/ld+json">${jsonLd}</script>
  ${SHARED_HEAD}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7; color: #1a1a1a; background: #fff;
    }
    a { color: inherit; }

    /* CHROME-START */${CHROME_CSS}
    /* CHROME-END */

    .breadcrumb {
      max-width: 800px; margin: 1.5rem auto 0; padding: 0 2rem;
      font-size: 0.8rem; color: #999;
    }
    .breadcrumb a { color: #999; text-decoration: none; }
    .breadcrumb a:hover { color: #1a1a1a; }
    .breadcrumb .sep { margin: 0 0.4rem; }

    .container { max-width: 800px; margin: 0 auto; padding: 2rem 2rem 4rem; }

    .episode-header { margin-bottom: 2.5rem; }
    .episode-header h1 {
      font-size: 2rem; font-weight: 700; line-height: 1.3;
      margin-bottom: 1rem; letter-spacing: -0.02em;
    }
    .episode-meta {
      display: flex; gap: 1rem; font-size: 0.85rem; color: #666;
      margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .episode-meta span + span::before { content: "\\00b7"; margin-right: 1rem; }

    .video-thumb {
      position: relative; display: block; width: 100%;
      border-radius: 8px; overflow: hidden; margin-bottom: 1.5rem;
    }
    .video-thumb img { width: 100%; display: block; }
    .video-thumb .play-btn {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 68px; height: 48px; background: rgba(0,0,0,0.75);
      border-radius: 12px; pointer-events: none;
    }
    .video-thumb .play-btn::after {
      content: ""; position: absolute; top: 50%; left: 54%;
      transform: translate(-50%, -50%);
      border-style: solid; border-width: 10px 0 10px 18px;
      border-color: transparent transparent transparent #fff;
    }
    .video-thumb:hover .play-btn { background: #e00; }

    .guest-card {
      background: #fafafa; border: 1px solid #eee; border-radius: 8px;
      padding: 1.5rem; margin-bottom: 2.5rem;
    }
    .guest-card h3 {
      font-size: 0.75rem; text-transform: uppercase;
      letter-spacing: 0.08em; color: #999; margin-bottom: 0.75rem;
    }
    .guest-name { font-size: 1.1rem; font-weight: 600; }
    .guest-title { font-size: 0.9rem; color: #666; margin-bottom: 0.5rem; }
    .guest-bio { font-size: 0.9rem; color: #444; line-height: 1.6; }

    .tabs { border-bottom: 2px solid #eee; display: flex; gap: 0; margin-bottom: 2rem; }
    .tab-btn {
      background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; padding: 0.75rem 1.5rem;
      font-size: 0.9rem; font-weight: 500; color: #999;
      cursor: pointer; font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-btn:hover { color: #1a1a1a; }
    .tab-btn.active { color: #1a1a1a; border-bottom-color: #1a1a1a; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .summary { font-size: 1rem; color: #333; margin-bottom: 2rem; line-height: 1.8; }
    .takeaways h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
    .takeaways ul { padding-left: 1.25rem; color: #333; }
    .takeaways li { margin-bottom: 0.6rem; font-size: 0.95rem; line-height: 1.6; }

    .timestamps-list { display: flex; flex-direction: column; gap: 0; }
    .timestamp-link {
      display: flex; align-items: baseline; gap: 0.85rem;
      padding: 0.6rem 0; text-decoration: none;
      border-bottom: 1px solid #f0f0f0; transition: background 0.1s;
    }
    .timestamp-link:hover { background: #fafafa; }
    .ts-time {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85rem; color: #2563eb; min-width: ${tsWidth}ch;
      text-align: right; font-weight: 500;
    }
    .ts-dash { color: #999; flex: none; }
    .ts-title { font-size: 0.95rem; color: #333; }

    .transcript p { margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.8; color: #333; }
    .speaker { font-weight: 600; color: #1a1a1a; }
    .speaker-marina { font-weight: 600; color: #2563eb; }

    .related-section { margin-top: 4rem; padding-top: 2.5rem; border-top: 1px solid #eee; }
    .related-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; }
    .related-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem;
    }
    .related-card { text-decoration: none; color: inherit; transition: opacity 0.15s; }
    .related-card:hover { opacity: 0.8; }
    .related-card img { width: 100%; border-radius: 6px; display: block; margin-bottom: 0.5rem; }
    .related-title {
      font-size: 0.85rem; font-weight: 500; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }

    @media (max-width: 640px) {
      .breadcrumb { padding: 0 1rem; }
      .container { padding: 1.5rem 1rem 3rem; }
      .episode-header h1 { font-size: 1.5rem; }
      .tab-btn { padding: 0.6rem 1rem; font-size: 0.85rem; }
      .related-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    }
  </style>
</head>
<body>

  ${SHARED_HEADER}

  <nav class="breadcrumb">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/#episodes">Podcast</a><span class="sep">/</span>
    <span>${esc(d.guestName || "Episode")}</span>
  </nav>

  <main class="container">
    <article class="episode-header">
      <h1>${esc(d.title)} — Silicon Valley Girl Podcast</h1>
      <div class="episode-meta">
        <span>${esc(d.guestName || "Special Guest")}</span>
        <span>${published}</span>
        <span>${esc(d.duration)}</span>
      </div>
      <a href="https://www.youtube.com/watch?v=${d.videoId}" class="video-thumb" target="_blank" rel="noopener">
        <img src="${esc(d.coverArt)}" alt="${thumbAlt}">
        <span class="play-btn"></span>
      </a>
    </article>

    <div class="guest-card">
      <h3>${isSolo ? "About the Host" : "About the Guest"}</h3>
      <div class="guest-name">${esc(d.guestName || "Special Guest")}</div>
      <div class="guest-title">${esc(d.guestTitle)}</div>
      <p class="guest-bio">${esc(d.aboutGuest)}</p>
    </div>

    ${ctaTop}<div class="tabs" role="tablist">
      <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="panel-notes" onclick="switchTab('notes')">Show Notes</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-timestamps" onclick="switchTab('timestamps')">Timestamps</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-transcript" onclick="switchTab('transcript')">Transcript</button>
    </div>

    <div id="panel-notes" class="tab-panel active" role="tabpanel">
      <div class="summary">${summaryBlock}</div>
      <div class="takeaways">
        <h3>Key Takeaways</h3>
        <ul>
          ${takeawaysHtml}
        </ul>
      </div>
    </div>

    <div id="panel-timestamps" class="tab-panel" role="tabpanel">
      <div class="timestamps-list">
        ${timestampsHtml}
      </div>
    </div>

    <div id="panel-transcript" class="tab-panel" role="tabpanel">
      <div class="transcript">
        ${transcriptHtml}
      </div>
    </div>

    <section class="related-section">
      <h2>${esc(d.relatedHeading || "More from Silicon Valley Girl Podcast")}</h2>
      <div class="related-grid">
        ${relatedHtml}
      </div>
    </section>
  </main>

  ${SHARED_FOOTER}

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[aria-controls="panel-' + tab + '"]').classList.add('active');
      document.querySelector('[aria-controls="panel-' + tab + '"]').setAttribute('aria-selected', 'true');
      document.getElementById('panel-' + tab).classList.add('active');
    }
  </script>
</body>
</html>`;
}


module.exports = { renderHomePage, renderEpisodePage, renderEpisodesPage, formatDate, summaryFor, writeEpisodeData, importDraft, dataFile, readEpisodeData, loadFix, API_BASE, CONTENT_DIR, TOPIC_HUBS, topicsOf };

// Guarded so the tests can require the renderers without kicking off a build.
if (require.main === module) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
