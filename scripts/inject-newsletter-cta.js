// Upsert the Future Proof newsletter CTA on every episode page.
// Experiment: a deterministic 2-way split by videoId — "top" (right after the
// About the Guest card) vs "end" (just before Related). Both are clean,
// always-visible slots; we deliberately do NOT drop the CTA inside the
// transcript. Each variant carries a distinct utm_content so beehiiv can
// attribute subscribers to the winning position.
// Re-runnable: strips any existing .newsletter-cta first, then re-inserts.
// Run:  node scripts/inject-newsletter-cta.js         (apply)
//       node scripts/inject-newsletter-cta.js --dry    (report only)
const fs = require("fs");
const path = require("path");

const EPI_DIR = path.join(__dirname, "..", "public", "episode");
const DRY = process.argv.includes("--dry");

// stable hash -> "top" | "end"  (djb2)
function variantOf(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return ["top", "end"][h % 2];
}

function ctaAside(variant) {
  const url =
    "https://siliconvalleygirl.beehiiv.com/subscribe" +
    "?utm_source=marinamogilkoco&amp;utm_medium=transcripts" +
    "&amp;utm_campaign=futureproof-sub&amp;utm_content=cta-" + variant;
  return (
`<aside class="newsletter-cta" aria-label="Subscribe to Marina's newsletter" style="margin:2.5rem 0;padding:1.75rem;background:#fafafa;border:1px solid #ededed;border-radius:10px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1.1rem;">
        <p style="margin:0;font-size:1.05rem;font-weight:600;line-height:1.35;color:#1a1a1a;max-width:34rem;">Get the AI tools, workflows and career moves in Marina&#39;s weekly newsletter</p>
        <a href="${url}" target="_blank" rel="noopener" style="background:#e00;color:#fff;font-weight:700;font-size:0.95rem;line-height:1;padding:0.8rem 1.5rem;border-radius:8px;text-decoration:none;white-space:nowrap;">Subscribe free</a>
      </aside>`);
}

const TABS = '<div class="tabs" role="tablist">';
const RELATED = '<section class="related-section">';

// remove any previously-injected CTA (and its leading whitespace/newline)
function strip(html) {
  return html.replace(/\n?[ \t]*<aside class="newsletter-cta"[\s\S]*?<\/aside>/g, "");
}

function insertBefore(html, anchor, variant) {
  const i = html.indexOf(anchor);
  if (i < 0) return null;
  const lineStart = html.lastIndexOf("\n", i) + 1;
  return html.slice(0, lineStart) + "      " + ctaAside(variant) + "\n\n" + html.slice(lineStart);
}

const dirs = fs.readdirSync(EPI_DIR).filter((d) =>
  fs.existsSync(path.join(EPI_DIR, d, "index.html"))
);

const tally = { top: 0, end: 0 };
let ok = 0, failed = 0;
const samples = {};

for (const id of dirs) {
  const file = path.join(EPI_DIR, id, "index.html");
  let html = strip(fs.readFileSync(file, "utf8"));
  const variant = variantOf(id);
  const out = insertBefore(html, variant === "top" ? TABS : RELATED, variant);
  if (!out) { console.error("  FAIL anchor:", id); failed++; continue; }
  tally[variant]++;
  ok++;
  if (!samples[variant]) samples[variant] = id;
  if (!DRY) fs.writeFileSync(file, out);
}

console.log((DRY ? "[DRY] " : "") + `episodes: ${dirs.length}`);
console.log(`  written: ${ok}  failed: ${failed}`);
console.log("  split:", JSON.stringify(tally));
console.log("  sample per variant:", JSON.stringify(samples));
