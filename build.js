const fs = require("fs");
const path = require("path");

const API_URL =
  "https://svg-dashboard-production.up.railway.app/api/podcast-page/PTZ5iN9nDkY";

async function build() {
  console.log("Fetching podcast data...");
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();

  const html = renderPage(data);

  const outDir = path.join(__dirname, "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "index.html");
  fs.writeFileSync(outPath, html);
  console.log(`Written to ${outPath}`);
}

function renderPage(d) {
  const published = new Date(d.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

  // Replace generic speaker labels (e.g. "Guest", "Google VP") with the actual guest name
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
              <a href="https://youtube.com/watch?v=${v.videoId}" class="related-card" target="_blank" rel="noopener">
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
    url: `https://podcast.marinamogilko.co`,
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
      url: "https://www.youtube.com/@SiliconValleyGirl",
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
  <meta property="og:url" content="https://podcast.marinamogilko.co">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(d.title)}">
  <meta name="twitter:description" content="${esc(metaDescription)}">
  <meta name="twitter:image" content="${esc(d.coverArt)}">
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 900px;
      margin: 0 auto;
    }
    .site-header .logo {
      font-weight: 700;
      font-size: 1.1rem;
      text-decoration: none;
      color: #1a1a1a;
    }
    .header-links {
      display: flex;
      gap: 1.25rem;
      align-items: center;
    }
    .header-links a {
      font-size: 0.85rem;
      color: #666;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s;
    }
    .header-links a:hover { color: #1a1a1a; }

    /* ---- Breadcrumb ---- */
    .breadcrumb {
      max-width: 800px;
      margin: 1.5rem auto 0;
      padding: 0 2rem;
      font-size: 0.8rem;
      color: #999;
    }
    .breadcrumb a {
      color: #999;
      text-decoration: none;
    }
    .breadcrumb a:hover { color: #1a1a1a; }
    .breadcrumb .sep { margin: 0 0.4rem; }

    /* ---- Main Content ---- */
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 2rem 4rem;
    }

    /* ---- Episode Header ---- */
    .episode-header {
      margin-bottom: 2.5rem;
    }
    .episode-header h1 {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }
    .episode-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .episode-meta span + span::before {
      content: "\\00b7";
      margin-right: 1rem;
    }
    .episode-cover {
      width: 100%;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    /* ---- Guest Card ---- */
    .guest-card {
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .guest-card h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      margin-bottom: 0.75rem;
    }
    .guest-name {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .guest-title {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 0.5rem;
    }
    .guest-bio {
      font-size: 0.9rem;
      color: #444;
      line-height: 1.6;
    }

    /* ---- Tabs ---- */
    .tabs {
      border-bottom: 2px solid #eee;
      display: flex;
      gap: 0;
      margin-bottom: 2rem;
    }
    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      padding: 0.75rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: #999;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-btn:hover { color: #1a1a1a; }
    .tab-btn.active {
      color: #1a1a1a;
      border-bottom-color: #1a1a1a;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ---- Show Notes ---- */
    .summary {
      font-size: 1rem;
      color: #333;
      margin-bottom: 2rem;
      line-height: 1.8;
    }
    .takeaways h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    .takeaways ul {
      padding-left: 1.25rem;
      color: #333;
    }
    .takeaways li {
      margin-bottom: 0.6rem;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    /* ---- Timestamps ---- */
    .timestamps-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .timestamp-link {
      display: flex;
      align-items: baseline;
      gap: 1rem;
      padding: 0.6rem 0;
      text-decoration: none;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.1s;
    }
    .timestamp-link:hover { background: #fafafa; }
    .ts-time {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85rem;
      color: #2563eb;
      min-width: 3.5rem;
      font-weight: 500;
    }
    .ts-title {
      font-size: 0.95rem;
      color: #333;
    }

    /* ---- Transcript ---- */
    .transcript p {
      margin-bottom: 1.25rem;
      font-size: 0.95rem;
      line-height: 1.8;
      color: #333;
    }
    .speaker {
      font-weight: 600;
      color: #1a1a1a;
    }
    .speaker-marina {
      font-weight: 600;
      color: #2563eb;
    }

    /* ---- Related Episodes ---- */
    .related-section {
      margin-top: 4rem;
      padding-top: 2.5rem;
      border-top: 1px solid #eee;
    }
    .related-section h2 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.5rem;
    }
    .related-card {
      text-decoration: none;
      color: inherit;
      transition: opacity 0.15s;
    }
    .related-card:hover { opacity: 0.8; }
    .related-card img {
      width: 100%;
      border-radius: 6px;
      display: block;
      margin-bottom: 0.5rem;
    }
    .related-title {
      font-size: 0.85rem;
      font-weight: 500;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ---- Responsive ---- */
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

  <header class="site-header">
    <a href="/" class="logo">Silicon Valley Girl Podcast</a>
    <nav class="header-links">
      <a href="https://www.youtube.com/@SiliconValleyGirl" target="_blank" rel="noopener">YouTube</a>
      <a href="https://open.spotify.com/show/1uvTQ1Jy2rBcipKjHvTHMU" target="_blank" rel="noopener">Spotify</a>
      <a href="https://podcasts.apple.com/us/podcast/silicon-valley-girl/id1455186950" target="_blank" rel="noopener">Apple Podcasts</a>
    </nav>
  </header>

  <nav class="breadcrumb">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/">Podcast</a><span class="sep">/</span>
    <span>${esc(d.guestName)}</span>
  </nav>

  <main class="container">
    <article class="episode-header">
      <h1>${esc(d.title)}</h1>
      <div class="episode-meta">
        <span>${esc(d.guestName)}</span>
        <span>${published}</span>
        <span>${esc(d.duration)}</span>
      </div>
      <img class="episode-cover" src="${esc(d.coverArt)}" alt="${esc(d.title)}">
    </article>

    <div class="guest-card">
      <h3>About the Guest</h3>
      <div class="guest-name">${esc(d.guestName)}</div>
      <div class="guest-title">${esc(d.guestTitle)}</div>
      <p class="guest-bio">${esc(d.aboutGuest)}</p>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="panel-notes" onclick="switchTab('notes')">Show Notes</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-timestamps" onclick="switchTab('timestamps')">Timestamps</button>
      <button class="tab-btn" role="tab" aria-selected="false" aria-controls="panel-transcript" onclick="switchTab('transcript')">Transcript</button>
    </div>

    <div id="panel-notes" class="tab-panel active" role="tabpanel">
      <div class="summary">${esc(d.episodeSummary)}</div>
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
