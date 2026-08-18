// Upsert the Future Proof newsletter CTA on every episode page — a single
// block placed right after the About the Guest card (before the tabs).
// No experiment, no split, never inside the transcript.
// Re-runnable: strips any existing .newsletter-cta first, then re-inserts.
// Run:  node scripts/inject-newsletter-cta.js         (apply)
//       node scripts/inject-newsletter-cta.js --dry    (report only)
const fs = require("fs");
const path = require("path");

const EPI_DIR = path.join(__dirname, "..", "public", "episode");
const DRY = process.argv.includes("--dry");
const TABS = '<div class="tabs" role="tablist">';

function ctaAside() {
  const url =
    "https://siliconvalleygirl.beehiiv.com/subscribe" +
    "?utm_source=marinamogilkoco&amp;utm_medium=transcripts&amp;utm_campaign=futureproof-sub";
  return (
`<aside class="newsletter-cta" aria-label="Subscribe to Marina's newsletter" style="margin:2.5rem 0;padding:1.75rem;background:#fafafa;border:1px solid #ededed;border-radius:10px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1.1rem;">
        <p style="margin:0;font-size:1.05rem;font-weight:600;line-height:1.35;color:#1a1a1a;max-width:34rem;">Get the AI tools, workflows and career moves in Marina&#39;s weekly newsletter</p>
        <a href="${url}" target="_blank" rel="noopener" style="background:#e00;color:#fff;font-weight:700;font-size:0.95rem;line-height:1;padding:0.8rem 1.5rem;border-radius:8px;text-decoration:none;white-space:nowrap;">Subscribe free</a>
      </aside>`);
}

// remove any previously-injected CTA (and its leading whitespace/newline)
function strip(html) {
  return html.replace(/\n?[ \t]*<aside class="newsletter-cta"[\s\S]*?<\/aside>/g, "");
}

const dirs = fs.readdirSync(EPI_DIR).filter((d) =>
  fs.existsSync(path.join(EPI_DIR, d, "index.html"))
);

let ok = 0, failed = 0;
for (const id of dirs) {
  const file = path.join(EPI_DIR, id, "index.html");
  const html = strip(fs.readFileSync(file, "utf8"));
  const i = html.indexOf(TABS);
  if (i < 0) { console.error("  FAIL anchor:", id); failed++; continue; }
  const lineStart = html.lastIndexOf("\n", i) + 1;
  const out = html.slice(0, lineStart) + "      " + ctaAside() + "\n\n" + html.slice(lineStart);
  if (!DRY) fs.writeFileSync(file, out);
  ok++;
}

console.log((DRY ? "[DRY] " : "") + `episodes: ${dirs.length}  written: ${ok}  failed: ${failed}`);
