// One-off injector: add the Future Proof newsletter CTA to every existing
// episode page. Placement is a deterministic 3-way split by videoId (top /
// mid / end) so we can A/B which position converts. Each variant carries a
// distinct utm_content so beehiiv can attribute subscribers to the position.
// Idempotent: skips a page that already has a .newsletter-cta.
// Run:  node scripts/inject-newsletter-cta.js         (apply)
//       node scripts/inject-newsletter-cta.js --dry    (report only)
const fs = require("fs");
const path = require("path");

const EPI_DIR = path.join(__dirname, "..", "public", "episode");
const DRY = process.argv.includes("--dry");

// stable hash -> 0..2  (djb2)
function variantOf(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return ["top", "mid", "end"][h % 3];
}

function ctaHtml(variant) {
  const url =
    "https://siliconvalleygirl.beehiiv.com/subscribe" +
    "?utm_source=marinamogilkoco&amp;utm_medium=transcripts" +
    "&amp;utm_campaign=futureproof-sub&amp;utm_content=cta-" + variant;
  return (
`      <aside class="newsletter-cta" aria-label="Subscribe to Marina's newsletter" style="margin:2.5rem 0;padding:1.5rem 1.75rem;background:#fafafa;border:1px solid #ededed;border-radius:10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem 1.25rem;">
        <p style="margin:0;font-size:1.05rem;font-weight:600;line-height:1.35;color:#1a1a1a;max-width:34rem;">Get the AI tools, workflows and career moves in Marina&#39;s weekly newsletter</p>
        <a href="${url}" target="_blank" rel="noopener" style="flex:0 0 auto;background:#e00;color:#fff;font-weight:700;font-size:0.95rem;line-height:1;padding:0.8rem 1.5rem;border-radius:8px;text-decoration:none;white-space:nowrap;">Subscribe free</a>
      </aside>
`);
}

const TABS = '<div class="tabs" role="tablist">';
const RELATED = '<section class="related-section">';
const TRANSCRIPT_OPEN = '<div class="transcript">';

function injectTop(html, block) {
  const i = html.indexOf(TABS);
  if (i < 0) return null;
  const lineStart = html.lastIndexOf("\n", i) + 1; // keep tabs' own indentation
  return html.slice(0, lineStart) + block + "\n" + html.slice(lineStart);
}

function injectEnd(html, block) {
  const i = html.indexOf(RELATED);
  if (i < 0) return null;
  const lineStart = html.lastIndexOf("\n", i) + 1;
  return html.slice(0, lineStart) + block + "\n" + html.slice(lineStart);
}

function injectMid(html, block) {
  const t = html.indexOf(TRANSCRIPT_OPEN);
  const sec = html.indexOf(RELATED, t);
  if (t < 0 || sec < 0) return null;
  // paragraph starts inside the transcript region
  const region = html.slice(t, sec);
  const pPositions = [];
  let idx = region.indexOf("<p>");
  while (idx >= 0) { pPositions.push(t + idx); idx = region.indexOf("<p>", idx + 1); }
  if (pPositions.length < 2) return null; // too short -> caller falls back
  const target = pPositions[Math.floor(pPositions.length / 2)];
  const lineStart = html.lastIndexOf("\n", target) + 1;
  return html.slice(0, lineStart) + block + "\n" + html.slice(lineStart);
}

const dirs = fs.readdirSync(EPI_DIR).filter((d) =>
  fs.existsSync(path.join(EPI_DIR, d, "index.html"))
);

const tally = { top: 0, mid: 0, end: 0 };
let injected = 0, skipped = 0, failed = 0;
const samples = {};

for (const id of dirs) {
  const file = path.join(EPI_DIR, id, "index.html");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes('class="newsletter-cta"')) { skipped++; continue; }

  let variant = variantOf(id);
  let out;
  if (variant === "top") out = injectTop(html, ctaHtml("top"));
  else if (variant === "end") out = injectEnd(html, ctaHtml("end"));
  else {
    out = injectMid(html, ctaHtml("mid"));
    if (!out) { variant = "end"; out = injectEnd(html, ctaHtml("end")); } // fallback for short transcripts
  }

  if (!out) { console.error("  FAIL anchor:", id); failed++; continue; }
  tally[variant]++;
  injected++;
  if (!samples[variant]) samples[variant] = id;
  if (!DRY) fs.writeFileSync(file, out);
}

console.log((DRY ? "[DRY] " : "") + `episodes: ${dirs.length}`);
console.log(`  injected: ${injected}  skipped(existing): ${skipped}  failed: ${failed}`);
console.log("  split:", JSON.stringify(tally));
console.log("  sample per variant:", JSON.stringify(samples));
