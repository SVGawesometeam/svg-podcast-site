const fs = require("fs");
const path = require("path");

const API_BASE =
  "https://svg-dashboard-production.up.railway.app/api/podcast-page";

const VIDEO_IDS = [
  "PTZ5iN9nDkY",
  "E0Q96IKXx6Q",
  "4vIIeCqHYXA",
  "KF_uNAxPFFA",
];

async function fetchEpisode(videoId) {
  const res = await fetch(`${API_BASE}/${videoId}`);
  if (!res.ok) throw new Error(`API returned ${res.status} for ${videoId}`);
  return res.json();
}

async function build() {
  console.log("Fetching podcast data...");
  const episodes = await Promise.all(VIDEO_IDS.map(fetchEpisode));
  episodes.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const outDir = path.join(__dirname, "public");

  // Home page
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), renderHomePage(episodes));
  console.log("Written public/index.html");

  // Episode pages
  for (const ep of episodes) {
    const epDir = path.join(outDir, "episode", ep.videoId);
    fs.mkdirSync(epDir, { recursive: true });
    fs.writeFileSync(path.join(epDir, "index.html"), renderEpisodePage(ep));
    console.log(`Written public/episode/${ep.videoId}/index.html`);
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const ICONS = {
  youtube: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#FF0000" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81z"/><path fill="#fff" d="M9.55 15.57V8.43L15.82 12z"/></svg>`,
  spotify: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-.99-.12-1.14-.6-.12-.48.12-.99.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.2-1.26 11.28-.96 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>`,
  apple: `<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ap" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#F452FF"/><stop offset="100%" stop-color="#832BC1"/></linearGradient></defs><rect width="24" height="24" rx="5.4" fill="url(#ap)"/><path fill="#fff" d="M15.48 6.5c-.25 0-.68.08-1.18.34-.42.22-.78.5-1.05.82a3.6 3.6 0 0 0-.75 1.52c.05 0 .12.01.2.01.42 0 .88-.14 1.3-.38.42-.24.76-.54 1-.9.35-.5.5-.97.48-1.41zm1.24 3.82c-.62 0-1.2.22-1.7.42-.38.16-.7.28-.98.28-.3 0-.6-.12-.98-.28-.44-.18-.94-.38-1.54-.38-1.68 0-3.42 1.36-3.42 4.1 0 1.7.64 3.48 1.44 4.62.68.96 1.26 1.56 2.1 1.56.4 0 .72-.14 1.1-.3.42-.18.9-.38 1.56-.38.68 0 1.12.2 1.52.36.38.16.7.3 1.14.3.92 0 1.52-.7 2.1-1.52.5-.72.84-1.42 1-1.82-.06-.02-2.1-.84-2.12-2.82-.02-1.64 1.26-2.5 1.38-2.56-.78-1.14-1.96-1.58-2.6-1.58z"/></svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><path fill="#fff" d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 7.92a3.12 3.12 0 1 1 0-6.24 3.12 3.12 0 0 1 0 6.24zm5-8.12a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0zM19.94 8.13c-.05-1.14-.3-2.15-.6-2.46a4.44 4.44 0 0 0-1.57-1.57c-.76-.39-1.52-.55-2.46-.6C14.26 3.44 13.7 3.42 12 3.42s-2.26.02-3.31.08c-.94.05-1.7.21-2.46.6a4.44 4.44 0 0 0-1.57 1.57c-.39.76-.55 1.52-.6 2.46-.06 1.05-.08 1.61-.08 3.31s.02 2.26.08 3.31c.05.94.21 1.7.6 2.46.34.66.8 1.2 1.57 1.57.76.39 1.52.55 2.46.6 1.05.06 1.61.08 3.31.08s2.26-.02 3.31-.08c.94-.05 1.7-.21 2.46-.6a4.44 4.44 0 0 0 1.57-1.57c.39-.76.55-1.52.6-2.46.06-1.05.08-1.61.08-3.31s-.02-2.26-.08-3.31zm-1.54 6.52c-.04.82-.2 1.26-.34 1.56-.18.44-.4.76-.74 1.1-.34.34-.66.56-1.1.74-.3.14-.74.3-1.56.34-.88.04-1.15.05-3.38.05s-2.5-.01-3.38-.05c-.82-.04-1.26-.2-1.56-.34a2.98 2.98 0 0 1-1.1-.74 2.98 2.98 0 0 1-.74-1.1c-.14-.3-.3-.74-.34-1.56C5.12 13.77 5.1 13.5 5.1 12s.02-1.77.06-2.65c.04-.82.2-1.26.34-1.56.18-.44.4-.76.74-1.1.34-.34.66-.56 1.1-.74.3-.14.74-.3 1.56-.34C9.78 5.57 10.05 5.55 12 5.55s2.22.02 3.1.06c.82.04 1.26.2 1.56.34.44.18.76.4 1.1.74.34.34.56.66.74 1.1.14.3.3.74.34 1.56.04.88.06 1.15.06 2.65s-.02 1.77-.06 2.65z"/></svg>`,
  linkedin: `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.17 10.06H9.7v8.38H7.17v-8.38zM8.44 6.56a1.47 1.47 0 1 1 0 2.94 1.47 1.47 0 0 1 0-2.94zM10.95 10.06h2.42v1.14h.04c.34-.64 1.16-1.3 2.38-1.3 2.54 0 3.01 1.68 3.01 3.86v4.68h-2.52v-4.14c0-.98-.02-2.26-1.38-2.26-1.38 0-1.58 1.08-1.58 2.18v4.22h-2.52v-8.38z"/></svg>`,
};

const SHARED_HEAD = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const SHARED_HEADER = `
  <header class="site-header">
    <a href="/" class="logo">Silicon Valley Girl Podcast</a>
    <nav class="header-links">
      <a href="https://www.youtube.com/@SiliconValleyGirl" target="_blank" rel="noopener" title="YouTube">${ICONS.youtube}</a>
      <a href="https://open.spotify.com/show/1uvTQ1Jy2rBcipKjHvTHMU" target="_blank" rel="noopener" title="Spotify">${ICONS.spotify}</a>
      <a href="https://podcasts.apple.com/us/podcast/silicon-valley-girl/id1455186950" target="_blank" rel="noopener" title="Apple Podcasts">${ICONS.apple}</a>
    </nav>
  </header>`;

const SHARED_FOOTER = `
  <footer class="site-footer">&copy; 2026 Silicon Valley Girl Podcast &middot; Marina Mogilko</footer>`;

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Home Page
// ---------------------------------------------------------------------------

function renderHomePage(episodes) {
  const episodeListHtml = episodes
    .map((ep) => {
      const date = formatDate(ep.publishedAt);
      const guest = ep.guestName || "Special Guest";
      return `
            <a href="/episode/${ep.videoId}/" class="episode-row">
              <img src="${esc(ep.thumbnail)}" alt="${esc(ep.title)}" loading="lazy">
              <div class="episode-row-info">
                <div class="episode-row-title">${esc(ep.title)}</div>
                <div class="episode-row-meta">
                  <span>${esc(guest)}</span>
                  <span>${date}</span>
                  <span>${esc(ep.duration)}</span>
                </div>
              </div>
            </a>`;
    })
    .join("\n");

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
  <meta property="og:url" content="https://podcast.marinamogilko.co">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    name: "Silicon Valley Girl Podcast",
    description: "Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and the future.",
    url: "https://podcast.marinamogilko.co",
    author: { "@type": "Person", name: "Marina Mogilko" },
  })}</script>
  ${SHARED_HEAD}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
    }
    a { color: inherit; }

    /* ---- Header ---- */
    .site-header {
      border-bottom: 1px solid #e5e5e5;
      padding: 1rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
      max-width: 900px; margin: 0 auto;
    }
    .site-header .logo { font-weight: 700; font-size: 1.1rem; text-decoration: none; color: #1a1a1a; }
    .header-links { display: flex; gap: 1.25rem; align-items: center; }
    .header-links a { color: #999; text-decoration: none; display: flex; align-items: center; transition: color 0.15s; }
    .header-links a:hover { color: #1a1a1a; }

    /* ---- Container ---- */
    .container { max-width: 800px; margin: 0 auto; padding: 3rem 2rem 4rem; }

    /* ---- Hero ---- */
    .hero { margin-bottom: 3rem; }
    .hero h1 {
      font-size: 2.5rem; font-weight: 700; line-height: 1.2;
      letter-spacing: -0.03em; margin-bottom: 1rem;
    }
    .hero p {
      font-size: 1.1rem; color: #555; line-height: 1.8; max-width: 600px;
    }
    .listen-links {
      display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap;
    }
    .listen-links a {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      border: 1px solid #ddd; border-radius: 6px;
      font-size: 0.85rem; font-weight: 500; text-decoration: none; color: #1a1a1a;
      transition: border-color 0.15s, background 0.15s;
    }
    .listen-links a:hover { border-color: #1a1a1a; background: #fafafa; }
    .listen-links a svg { flex-shrink: 0; }

    /* ---- About Host ---- */
    .host-card {
      background: #fafafa; border: 1px solid #eee; border-radius: 10px;
      padding: 2rem; margin-bottom: 3rem;
    }
    .host-card h2 {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
      color: #999; margin-bottom: 1rem;
    }
    .host-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; }
    .host-bio {
      font-size: 0.95rem; color: #444; line-height: 1.7; margin-bottom: 1rem;
    }
    .host-links { display: flex; gap: 1rem; }
    .host-links a {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.85rem; color: #2563eb; text-decoration: none; font-weight: 500;
    }
    .host-links a:hover { text-decoration: underline; }
    .host-links a svg { flex-shrink: 0; }

    /* ---- Episodes List ---- */
    .episodes-section h2 {
      font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }
    .episode-row {
      display: flex; gap: 1.25rem; padding: 1.25rem 0;
      border-bottom: 1px solid #f0f0f0; text-decoration: none; color: inherit;
      transition: background 0.1s; align-items: center;
    }
    .episode-row:first-child { border-top: 1px solid #f0f0f0; }
    .episode-row:hover { background: #fafafa; }
    .episode-row img {
      width: 180px; min-width: 180px; height: auto;
      border-radius: 6px; object-fit: cover;
    }
    .episode-row-info { flex: 1; min-width: 0; }
    .episode-row-title {
      font-size: 1rem; font-weight: 600; line-height: 1.4;
      margin-bottom: 0.4rem;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
    .episode-row-meta {
      font-size: 0.8rem; color: #999;
      display: flex; gap: 0.5rem; flex-wrap: wrap;
    }
    .episode-row-meta span + span::before {
      content: "\\00b7"; margin-right: 0.5rem;
    }

    /* ---- Footer ---- */
    .site-footer {
      max-width: 800px; margin: 0 auto; padding: 2rem;
      text-align: center; font-size: 0.8rem; color: #999;
      border-top: 1px solid #eee;
    }

    /* ---- Responsive ---- */
    @media (max-width: 640px) {
      .site-header { padding: 0.75rem 1rem; }
      .container { padding: 2rem 1rem 3rem; }
      .hero h1 { font-size: 1.75rem; }
      .episode-row { flex-direction: column; gap: 0.75rem; }
      .episode-row img { width: 100%; min-width: 0; }
    }
  </style>
</head>
<body>

  ${SHARED_HEADER}

  <main class="container">
    <section class="hero">
      <h1>Silicon Valley Girl Podcast</h1>
      <p>Conversations with tech leaders, entrepreneurs, and innovators about AI, careers, and building the future. Hosted by Marina Mogilko.</p>
      <div class="listen-links">
        <a href="https://www.youtube.com/@SiliconValleyGirl" target="_blank" rel="noopener" title="YouTube">${ICONS.youtube} YouTube</a>
        <a href="https://open.spotify.com/show/1uvTQ1Jy2rBcipKjHvTHMU" target="_blank" rel="noopener" title="Spotify">${ICONS.spotify} Spotify</a>
        <a href="https://podcasts.apple.com/us/podcast/silicon-valley-girl/id1455186950" target="_blank" rel="noopener" title="Apple Podcasts">${ICONS.apple} Apple Podcasts</a>
      </div>
    </section>

    <section class="host-card">
      <h2>Your Host</h2>
      <div class="host-name">Marina Mogilko</div>
      <p class="host-bio">Entrepreneur, content creator, and founder based in Silicon Valley. Marina interviews the world's top tech leaders, investors, and innovators to uncover the trends, strategies, and mindsets shaping the future. With millions of followers across platforms, she brings a unique perspective on technology, business, and personal growth.</p>
      <div class="host-links">
        <a href="https://www.instagram.com/linguamarina/" target="_blank" rel="noopener" title="Instagram">${ICONS.instagram} Instagram</a>
        <a href="https://www.linkedin.com/in/marinamogilko/" target="_blank" rel="noopener" title="LinkedIn">${ICONS.linkedin} LinkedIn</a>
      </div>
    </section>

    <section class="episodes-section">
      <h2>Episodes</h2>
      ${episodeListHtml}
    </section>
  </main>

  ${SHARED_FOOTER}

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Episode Page
// ---------------------------------------------------------------------------

function renderEpisodePage(d) {
  const published = formatDate(d.publishedAt);
  const isoDate = new Date(d.publishedAt).toISOString();

  const takeawaysHtml = d.keyTakeaways
    .map((t) => `<li>${esc(t)}</li>`)
    .join("\n              ");

  const timestampsHtml = d.timestamps
    .map(
      (t) =>
        `<a href="https://youtube.com/watch?v=${d.videoId}&t=${t.seconds}s" class="timestamp-link" target="_blank" rel="noopener">
                <span class="ts-time">${esc(t.time)}</span>
                <span class="ts-title">${esc(t.title)}</span>
              </a>`
    )
    .join("\n              ");

  // Replace generic speaker labels with the actual guest name
  const genericSpeakerRe = /^\*\*(?:Guest|Host|Interviewer|Speaker\s*\d*|.{0,30}?\b(?:VP|CEO|CTO|CFO|COO|Director|Head|President|Manager|Exec|Executive|Founder|Co-founder)\b[^*]*):\*\*/gm;
  const cleanedTranscript = d.transcript.replace(genericSpeakerRe, `**${d.guestName}:**`);

  const transcriptHtml = cleanedTranscript
    .split(/\n\n+/)
    .map((para) => {
      const speakerMatch = para.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
      if (speakerMatch) {
        const name = speakerMatch[1];
        const isMarina = name.toLowerCase().includes("marina");
        const cls = isMarina ? ' class="speaker-marina"' : ' class="speaker"';
        return `<p><strong${cls}>${esc(name)}:</strong> ${esc(speakerMatch[2])}</p>`;
      }
      return `<p>${esc(para)}</p>`;
    })
    .join("\n            ");

  const relatedHtml = d.relatedVideos
    .map(
      (v) => `
              <a href="/episode/${v.videoId}/" class="related-card">
                <img src="${esc(v.thumbnail)}" alt="${esc(v.title)}" loading="lazy">
                <span class="related-title">${esc(v.title)}</span>
              </a>`
    )
    .join("\n");

  const metaDescription = d.episodeSummary.slice(0, 160).replace(/\s+\S*$/, "...");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: d.title,
    url: `https://podcast.marinamogilko.co/episode/${d.videoId}/`,
    datePublished: isoDate,
    description: d.episodeSummary,
    duration: d.duration,
    associatedMedia: {
      "@type": "VideoObject",
      embedUrl: `https://www.youtube.com/embed/${d.videoId}`,
      thumbnailUrl: d.thumbnail,
    },
    partOfSeries: {
      "@type": "PodcastSeries",
      name: "Silicon Valley Girl Podcast",
      url: "https://podcast.marinamogilko.co",
    },
    performer: {
      "@type": "Person",
      name: d.guestName,
      jobTitle: d.guestTitle,
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
  <meta property="og:url" content="https://podcast.marinamogilko.co/episode/${d.videoId}/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(d.title)}">
  <meta name="twitter:description" content="${esc(metaDescription)}">
  <meta name="twitter:image" content="${esc(d.coverArt)}">
  <script type="application/ld+json">${jsonLd}</script>
  ${SHARED_HEAD}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7; color: #1a1a1a; background: #fff;
    }
    a { color: inherit; }

    /* ---- Header ---- */
    .site-header {
      border-bottom: 1px solid #e5e5e5; padding: 1rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
      max-width: 900px; margin: 0 auto;
    }
    .site-header .logo { font-weight: 700; font-size: 1.1rem; text-decoration: none; color: #1a1a1a; }
    .header-links { display: flex; gap: 1.25rem; align-items: center; }
    .header-links a { color: #999; text-decoration: none; display: flex; align-items: center; transition: color 0.15s; }
    .header-links a:hover { color: #1a1a1a; }

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
      display: flex; align-items: baseline; gap: 1rem;
      padding: 0.6rem 0; text-decoration: none;
      border-bottom: 1px solid #f0f0f0; transition: background 0.1s;
    }
    .timestamp-link:hover { background: #fafafa; }
    .ts-time {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85rem; color: #2563eb; min-width: 3.5rem; font-weight: 500;
    }
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

    .site-footer {
      max-width: 800px; margin: 0 auto; padding: 2rem;
      text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee;
    }

    @media (max-width: 640px) {
      .site-header { padding: 0.75rem 1rem; }
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
    <a href="/">Podcast</a><span class="sep">/</span>
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
        <img src="${esc(d.coverArt)}" alt="${esc(d.title)}">
        <span class="play-btn"></span>
      </a>
    </article>

    <div class="guest-card">
      <h3>About the Guest</h3>
      <div class="guest-name">${esc(d.guestName || "Special Guest")}</div>
      <div class="guest-title">${esc(d.guestTitle)}</div>
      <p class="guest-bio">${esc(d.aboutGuest)}</p>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="panel-notes" onclick="switchTab('notes')">Show Notes</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-timestamps" onclick="switchTab('timestamps')">Timestamps</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-transcript" onclick="switchTab('transcript')">Transcript</button>
    </div>

    <div id="panel-notes" class="tab-panel active" role="tabpanel">
      <div class="summary">In this episode of the Silicon Valley Girl Podcast, Marina Mogilko interviews ${esc(d.guestName || "a special guest")}, ${esc(d.guestTitle)}. ${esc(d.episodeSummary)}</div>
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
      <h2>More from Silicon Valley Girl Podcast</h2>
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

// ---------------------------------------------------------------------------

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
