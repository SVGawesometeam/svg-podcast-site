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

  const takeawaysHtml = d.keyTakeaways
    .map((t) => `<li>${esc(t)}</li>`)
    .join("\n            ");

  const timestampsHtml = d.timestamps
    .map(
      (t) =>
        `<a href="https://youtube.com/watch?v=${d.videoId}&t=${t.seconds}s" class="timestamp">${esc(t.time)} — ${esc(t.title)}</a>`
    )
    .join("\n            ");

  const relatedHtml = d.relatedVideos
    .map(
      (v) => `
            <a href="https://youtube.com/watch?v=${v.videoId}" class="related-card">
              <img src="${esc(v.thumbnail)}" alt="${esc(v.title)}">
              <span>${esc(v.title)}</span>
            </a>`
    )
    .join("\n");

  const transcriptHtml = d.transcript
    .split(/\n\n+/)
    .map((para) => {
      const speakerMatch = para.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
      if (speakerMatch) {
        return `<p><strong>${esc(speakerMatch[1])}:</strong> ${esc(speakerMatch[2])}</p>`;
      }
      return `<p>${esc(para)}</p>`;
    })
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(d.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; background: #f8f8f8; }
    .hero { position: relative; background: #000; color: #fff; padding: 3rem 1.5rem 2.5rem; text-align: center; }
    .hero img { width: 100%; max-width: 720px; border-radius: 12px; margin-bottom: 1.5rem; }
    .hero h1 { font-size: 1.75rem; max-width: 720px; margin: 0 auto 0.75rem; }
    .meta { font-size: 0.9rem; opacity: 0.8; }
    .meta span + span::before { content: " · "; }
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
    section { background: #fff; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; }
    .guest { display: flex; gap: 1rem; align-items: flex-start; }
    .guest-info strong { display: block; font-size: 1.1rem; }
    .guest-info span { font-size: 0.9rem; color: #555; }
    .guest-info p { margin-top: 0.5rem; font-size: 0.95rem; }
    ul { padding-left: 1.25rem; }
    ul li { margin-bottom: 0.5rem; }
    .timestamps { display: flex; flex-direction: column; gap: 0.4rem; }
    .timestamp { text-decoration: none; color: #1a73e8; font-size: 0.95rem; }
    .timestamp:hover { text-decoration: underline; }
    .transcript p { margin-bottom: 1rem; }
    .transcript strong { color: #1a73e8; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .related-card { text-decoration: none; color: inherit; border-radius: 8px; overflow: hidden; background: #f0f0f0; }
    .related-card img { width: 100%; display: block; }
    .related-card span { display: block; padding: 0.5rem; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="hero">
    <img src="${esc(d.coverArt)}" alt="Episode cover">
    <h1>${esc(d.title)}</h1>
    <div class="meta">
      <span>${esc(d.guestName)}</span>
      <span>${published}</span>
      <span>${esc(d.duration)}</span>
    </div>
  </div>

  <div class="container">
    <section>
      <h2>About the Guest</h2>
      <div class="guest">
        <div class="guest-info">
          <strong>${esc(d.guestName)}</strong>
          <span>${esc(d.guestTitle)}</span>
          <p>${esc(d.aboutGuest)}</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Episode Summary</h2>
      <p>${esc(d.episodeSummary)}</p>
    </section>

    <section>
      <h2>Key Takeaways</h2>
      <ul>
        ${takeawaysHtml}
      </ul>
    </section>

    <section>
      <h2>Timestamps</h2>
      <div class="timestamps">
        ${timestampsHtml}
      </div>
    </section>

    <section>
      <h2>Transcript</h2>
      <div class="transcript">
        ${transcriptHtml}
      </div>
    </section>

    <section>
      <h2>Related Episodes</h2>
      <div class="related">
        ${relatedHtml}
      </div>
    </section>
  </div>
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
