// Episode page, template v2 (Release 3).
//
// What changed against v1 and why:
// - The H1 is the title alone (the site name is in <title> and the header).
// - Summary, takeaways, chapters and transcript are visible sections with
//   real H2 headings and anchors, reached from an in-page nav. The v1
//   tabs hid the transcript behind JavaScript and gave machines no headings.
// - Episode-level Apple Podcasts and Spotify links when the data has them;
//   show-level links, labelled as such, otherwise.
// - JSON-LD: ISO 8601 duration, one Person per guest, Clip entries for the
//   chapters, and the site's shared @id entities for the host and the show.
//
// Reads the same content/episodes/<id>.json as v1. A page opts in with
// "template": "v2"; everything else keeps rendering with v1 byte for byte.

const { SHARED_HEAD, SHARED_HEADER, SHARED_FOOTER, CHROME_CSS } = require("./chrome");
const { esc, jsonForScript } = require("./html");
const { deriveMetaDescription, SITE_URL } = require("./episode-data");

const SHOW_LINKS = {
  youtube: "https://www.youtube.com/@SiliconValleyGirl",
  apple: "https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545",
  spotify: "https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY",
};

const IDS = {
  person: `${SITE_URL}/#marina`,
  podcast: `${SITE_URL}/#podcast`,
};

const FORMAT_LABEL = { interview: "Interview", solo: "Solo video", compilation: "Compilation" };

// "24 MIN" -> "PT24M"; "75 MIN" -> "PT1H15M". Anything else is left out of
// the schema rather than published wrong.
function isoDuration(label) {
  const m = String(label || "").match(/^(\d+)\s*MIN$/i);
  if (!m) return null;
  const mins = Number(m[1]);
  return mins >= 60 ? `PT${Math.floor(mins / 60)}H${mins % 60 ? `${mins % 60}M` : ""}` : `PT${mins}M`;
}

function durationText(label) {
  const m = String(label || "").match(/^(\d+)\s*MIN$/i);
  return m ? `${Number(m[1])} min` : String(label || "");
}

// "Sal Khan, Alex Mashrabov" / "Fei-Fei Li and David Rogier" -> people.
function splitGuests(d) {
  if (d.format === "solo") return [];
  return String(d.guestName)
    .split(/\s*,\s*|\s+and\s+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

function performers(d) {
  const names = splitGuests(d);
  if (names.length === 0) return { "@id": IDS.person };
  if (names.length === 1) {
    return { "@type": "Person", name: names[0], ...(d.performer || {}), jobTitle: d.guestTitle };
  }
  // A compilation's guestTitle is one combined string; no per-person role.
  return names.map((name) => ({ "@type": "Person", name }));
}

function clips(d) {
  const ts = d.timestamps || [];
  return ts.map((t, i) => {
    const clip = {
      "@type": "Clip",
      name: t.title,
      startOffset: t.seconds,
      url: `https://www.youtube.com/watch?v=${d.videoId}&t=${t.seconds}s`,
    };
    if (ts[i + 1]) clip.endOffset = ts[i + 1].seconds;
    return clip;
  });
}

function jsonLd(d, canonicalUrl) {
  const iso = isoDuration(d.duration);
  const uploadDate = new Date(d.publishedAt).toISOString().split("T")[0];
  const video = {
    "@type": "VideoObject",
    "@id": `${canonicalUrl}#video`,
    name: d.title,
    description: (d.summary || "").slice(0, 200),
    uploadDate,
    embedUrl: `https://www.youtube.com/embed/${d.videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${d.videoId}`,
    thumbnailUrl: d.thumbnail,
  };
  if (iso) video.duration = iso;
  if ((d.timestamps || []).length) video.hasPart = clips(d);

  const episode = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "@id": `${canonicalUrl}#episode`,
    name: d.title,
    url: canonicalUrl,
    datePublished: new Date(d.publishedAt).toISOString(),
    description: d.summary,
    inLanguage: "en",
    isAccessibleForFree: true,
    partOfSeries: {
      "@type": "PodcastSeries",
      "@id": IDS.podcast,
      name: "Silicon Valley Girl Podcast",
      url: `${SITE_URL}/`,
    },
    performer: performers(d),
    host: { "@type": "Person", "@id": IDS.person, name: "Marina Mogilko", url: `${SITE_URL}/` },
    associatedMedia: video,
  };
  if (iso) episode.duration = iso;
  const sameAs = [d.platformLinks?.apple, d.platformLinks?.spotify].filter(Boolean);
  if (sameAs.length) episode.sameAs = sameAs;
  return episode;
}

const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7; color: #1a1a1a; background: #fff;
    }
    a { color: inherit; }

    /* CHROME-START */${CHROME_CSS}
    /* CHROME-END */

    .breadcrumb { max-width: 800px; margin: 1.5rem auto 0; padding: 0 2rem; font-size: 0.8rem; color: #777; }
    .breadcrumb a { color: #777; text-decoration: none; }
    .breadcrumb a:hover { color: #1a1a1a; }
    .breadcrumb .sep { margin: 0 0.4rem; }

    .container { max-width: 800px; margin: 0 auto; padding: 1.5rem 2rem 4rem; }

    .ep-eyebrow { font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; color: #666; margin-bottom: 0.75rem; }
    .ep-eyebrow .format { color: var(--accent); font-weight: 600; }
    .ep-eyebrow .dot { margin: 0 0.5rem; color: #bbb; }
    h1 { font-size: 2rem; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 1.25rem; }

    .video-thumb { position: relative; display: block; border-radius: 10px; overflow: hidden; background: #000; }
    .video-thumb img { width: 100%; height: auto; display: block; aspect-ratio: 16 / 9; object-fit: cover; }
    .play-btn {
      position: absolute; top: 50%; left: 50%; width: 68px; height: 48px; transform: translate(-50%, -50%);
      background: rgba(223, 22, 21, 0.92); border-radius: 12px;
    }
    .play-btn::after {
      content: ""; position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%);
      border-style: solid; border-width: 10px 0 10px 18px; border-color: transparent transparent transparent #fff;
    }

    .listen { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1rem 0 0; }
    .listen a {
      display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.95rem; border-radius: 999px;
      border: 1px solid #ddd; font-size: 0.9rem; font-weight: 600; text-decoration: none; background: #fff;
    }
    .listen a.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .listen a:hover { border-color: #1a1a1a; }
    .listen .show-level { font-weight: 400; color: #777; }

    /* Not sticky: the site header is already sticky and its height changes with
       the viewport, so a second sticky bar would slide underneath it. */
    .section-nav {
      display: flex; gap: 1.25rem; overflow-x: auto; margin: 1.75rem 0 0; padding: 0.7rem 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;
      font-size: 0.85rem; font-weight: 600; white-space: nowrap;
    }
    .section-nav a { text-decoration: none; color: #555; }
    .section-nav a:hover { color: var(--accent); }

    section.block { padding-top: 2.25rem; scroll-margin-top: 4.5rem; }
    section.block h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.9rem; }
    .summary { font-size: 1.05rem; line-height: 1.75; }
    .takeaways ul { padding-left: 1.3rem; }
    .takeaways li { margin-bottom: 0.6rem; }

    .guest-card { background: #f7f7f5; border-radius: 10px; padding: 1.5rem; margin-top: 2.25rem; }
    .guest-card h2 { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #777; margin-bottom: 0.6rem; }
    .guest-name { font-size: 1.15rem; font-weight: 700; }
    .guest-title { color: #555; font-size: 0.95rem; margin-bottom: 0.75rem; }
    .guest-title .when { color: #999; }
    .guest-bio { font-size: 0.95rem; color: #333; }

    .chapters ol { list-style: none; }
    .chapters li { border-bottom: 1px solid #f0f0f0; }
    .chapters a { display: flex; gap: 1rem; align-items: baseline; padding: 0.55rem 0; text-decoration: none; }
    .chapters a:hover .ch-title { color: var(--accent); }
    .ch-time { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; color: #2563eb; min-width: 4.5ch; text-align: right; flex: none; }
    .ch-title { font-size: 0.95rem; }

    .transcript p { margin-bottom: 1.1rem; font-size: 1rem; line-height: 1.8; }
    .transcript strong.speaker { color: #1a1a1a; }
    .transcript strong.speaker-marina { color: var(--accent); }

    .related-section { margin-top: 3.5rem; padding-top: 2.5rem; border-top: 1px solid #eee; }
    .related-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
    .related-card { text-decoration: none; color: inherit; transition: opacity 0.15s; }
    .related-card:hover { opacity: 0.8; }
    .related-card img { width: 100%; height: auto; border-radius: 6px; display: block; margin-bottom: 0.5rem; aspect-ratio: 16 / 9; object-fit: cover; }
    .related-title { font-size: 0.85rem; font-weight: 500; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    @media (max-width: 640px) {
      .breadcrumb { padding: 0 1rem; }
      .container { padding: 1rem 1rem 3rem; }
      h1 { font-size: 1.5rem; }
      .listen a { padding: 0.5rem 0.8rem; font-size: 0.85rem; }
      .section-nav { gap: 1rem; margin-left: -1rem; margin-right: -1rem; padding-left: 1rem; padding-right: 1rem; }
      .related-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    }
`;

function renderEpisodePageV2(d, { newsletterCta, formatDate }) {
  const canonicalUrl = `${SITE_URL}/episode/${d.videoId}/`;
  const isSolo = d.format === "solo";
  const metaDescription = d.metaDescription || deriveMetaDescription(d);
  const published = formatDate(d.publishedAt);
  const guests = splitGuests(d);
  const guestLine = isSolo ? "Marina Mogilko" : d.guestName;

  const thumbAlt = isSolo
    ? "Marina Mogilko, host of the Silicon Valley Girl Podcast"
    : `${esc(d.guestName)}, ${esc(d.guestTitle)}, interviewed by Marina Mogilko on the Silicon Valley Girl Podcast`;

  const pl = d.platformLinks || {};
  const listen = [
    `<a class="primary" href="https://www.youtube.com/watch?v=${d.videoId}" target="_blank" rel="noopener">Watch on YouTube</a>`,
    pl.apple
      ? `<a href="${esc(pl.apple)}" target="_blank" rel="noopener">Apple Podcasts</a>`
      : `<a href="${SHOW_LINKS.apple}" target="_blank" rel="noopener">Apple Podcasts <span class="show-level">(show)</span></a>`,
    pl.spotify
      ? `<a href="${esc(pl.spotify)}" target="_blank" rel="noopener">Spotify</a>`
      : `<a href="${SHOW_LINKS.spotify}" target="_blank" rel="noopener">Spotify <span class="show-level">(show)</span></a>`,
  ].join("\n          ");

  const summaryHtml = d.summaryHtml !== undefined ? d.summaryHtml : esc(d.summary);
  const takeawaysHtml = (d.keyTakeaways || []).map((t) => `<li>${esc(t)}</li>`).join("\n            ");

  const chaptersHtml = (d.timestamps || []).length
    ? `<ol>
            ${d.timestamps
              .map(
                (t) => `<li><a href="https://www.youtube.com/watch?v=${d.videoId}&t=${t.seconds}s" target="_blank" rel="noopener"><span class="ch-time">${esc(t.time)}</span><span class="ch-title">${esc(t.title)}</span></a></li>`
              )
              .join("\n            ")}
          </ol>`
    : `<p class="muted">No chapters for this episode.</p>`;

  const transcriptHtml = d.transcript
    .map((b) => {
      if (b.html !== undefined) return b.html;
      if (b.speaker) {
        const cls = b.speaker.toLowerCase().includes("marina") ? "speaker-marina" : "speaker";
        return `<p><strong class="${cls}">${esc(b.speaker)}:</strong> ${esc(b.text)}</p>`;
      }
      return `<p>${esc(b.text)}</p>`;
    })
    .join("\n            ");

  const relatedHtml = (d.relatedVideos || [])
    .map(
      (v) => `
              <a href="/episode/${v.videoId}/" class="related-card">
                <img src="${esc(v.thumbnail)}" alt="${esc(v.title)}" loading="lazy" width="480" height="270">
                <span class="related-title">${esc(v.title)}</span>
              </a>`
    )
    .join("\n");

  const guestCard = isSolo
    ? `<aside class="guest-card">
        <h2>About the host</h2>
        <div class="guest-name">Marina Mogilko</div>
        <div class="guest-title">${esc(d.guestTitle)}</div>
        <p class="guest-bio">${esc(d.aboutGuest)}</p>
      </aside>`
    : `<aside class="guest-card">
        <h2>${guests.length > 1 ? "About the guests" : "About the guest"}</h2>
        <div class="guest-name">${esc(d.guestName)}</div>
        <div class="guest-title">${esc(d.guestTitle)} <span class="when">(at the time of recording)</span></div>
        <p class="guest-bio">${esc(d.aboutGuest)}</p>
      </aside>`;

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
  <script type="application/ld+json">${jsonForScript(jsonLd(d, canonicalUrl))}</script>
  ${SHARED_HEAD}
  <style>${CSS}  </style>
</head>
<body>

  ${SHARED_HEADER}

  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/episodes/">Episodes</a><span class="sep">/</span>
    <span>${esc(guestLine)}</span>
  </nav>

  <main class="container">
    <article class="episode">
      <header class="episode-header">
        <p class="ep-eyebrow"><span class="format">${FORMAT_LABEL[d.format] || "Episode"}</span><span class="dot">·</span>${published}<span class="dot">·</span>${esc(durationText(d.duration))}</p>
        <h1>${esc(d.title)}</h1>
        <a href="https://www.youtube.com/watch?v=${d.videoId}" class="video-thumb" target="_blank" rel="noopener">
          <img src="${esc(d.coverArt)}" alt="${thumbAlt}" width="1280" height="720">
          <span class="play-btn" aria-hidden="true"></span>
        </a>
        <div class="listen" aria-label="Listen or watch">
          ${listen}
        </div>
      </header>

      <nav class="section-nav" aria-label="On this page">
        <a href="#summary">Summary</a>
        <a href="#takeaways">Takeaways</a>
        <a href="#chapters">Chapters</a>
        <a href="#transcript">Transcript</a>
      </nav>

      <section id="summary" class="block">
        <h2>In this episode</h2>
        <p class="summary">${summaryHtml}</p>
      </section>

      <section id="takeaways" class="block takeaways">
        <h2>Key takeaways</h2>
        <ul>
            ${takeawaysHtml}
        </ul>
      </section>

      ${guestCard}

${newsletterCta()}

      <section id="chapters" class="block chapters">
        <h2>Chapters</h2>
        ${chaptersHtml}
      </section>

      <section id="transcript" class="block">
        <h2>Transcript</h2>
        <div class="transcript">
            ${transcriptHtml}
        </div>
      </section>

      <section class="related-section">
        <h2>${esc(d.relatedHeading || "More from Silicon Valley Girl Podcast")}</h2>
        <div class="related-grid">
          ${relatedHtml}
        </div>
      </section>
    </article>
  </main>

  ${SHARED_FOOTER}
</body>
</html>`;
}

module.exports = { renderEpisodePageV2, isoDuration, splitGuests, performers, clips };
