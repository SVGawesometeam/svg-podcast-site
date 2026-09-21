#!/usr/bin/env node
/**
 * One-off: restyle the chrome on episode pages that are already built.
 *
 * build.js cannot re-render these. It skips any episode whose index.html
 * exists and reads the metadata back out of the built HTML, so the only way to
 * re-render would be to delete the pages and re-fetch 117 transcripts from an
 * endpoint that throttles datacenter IPs — putting the hand-applied
 * corrections in transcript-fixes/ at risk for a change that is purely visual.
 *
 * So the chrome is patched in place, the way scripts/inject-newsletter-cta.js
 * and patch-jsonld.js already patch built pages. Only the header markup, the
 * footer markup and the chrome CSS region move; transcripts, players, tab
 * switchers and JSON-LD are untouched.
 *
 *   node scripts/restyle-episode-chrome.js --dry-run
 *   node scripts/restyle-episode-chrome.js
 */

const fs = require("fs");
const path = require("path");
const { SHARED_HEADER, SHARED_FOOTER, CHROME_CSS } = require("../lib/chrome");

const CHROME_BLOCK = `    /* CHROME-START */${CHROME_CSS}\n    /* CHROME-END */`;

// The CSS the original template emitted, from the first chrome rule to the
// last. Anchored on both ends so a page whose structure differs fails loudly
// instead of being silently half-patched.
const OLD_CSS = /^ {4}\.site-header \{\n[\s\S]*?^ {4}\.header-links a:hover \{ color: #1a1a1a; \}$/m;
const SENTINEL_CSS = /^ {4}\/\* CHROME-START \*\/[\s\S]*?^ {4}\/\* CHROME-END \*\/$/m;

// Swept away on the first pass; absent on every pass after that, so neither is
// required for the patch to be considered valid.
const OLD_FOOTER_CSS = /^ {4}\.site-footer \{\n[\s\S]*?^ {4}\}\n/m;
const OLD_MQ_HEADER = /^ {6}\.site-header \{ padding: 0\.75rem 1rem; \}\n/m;

const HEADER_MARKUP = /<header class="site-header">[\s\S]*?<\/header>/;
const FOOTER_MARKUP = /<footer class="site-footer">[\s\S]*?<\/footer>/;

function patchPage(html) {
  const input = html;

  // 1. Chrome CSS. A page already carrying sentinels is re-patched between
  //    them, which is what makes repeated runs converge.
  if (SENTINEL_CSS.test(html)) {
    html = html.replace(SENTINEL_CSS, CHROME_BLOCK);
  } else if (OLD_CSS.test(html)) {
    html = html.replace(OLD_CSS, CHROME_BLOCK);
  } else {
    throw new Error("does not match: no chrome CSS region (neither sentinels nor the original rules)");
  }

  // 2. Stale rules the new chrome supersedes.
  html = html.replace(OLD_FOOTER_CSS, "");
  html = html.replace(OLD_MQ_HEADER, "");

  // 3. Markup.
  if (!HEADER_MARKUP.test(html)) throw new Error("does not match: no <header class=\"site-header\">");
  if (!FOOTER_MARKUP.test(html)) throw new Error("does not match: no <footer class=\"site-footer\">");
  html = html.replace(HEADER_MARKUP, SHARED_HEADER.trim());
  html = html.replace(FOOTER_MARKUP, SHARED_FOOTER.trim());

  return { html, changed: html !== input };
}

module.exports = { patchPage };

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const root = path.join(__dirname, "..", "public", "episode");
  const files = fs.globSync(path.join(root, "*", "index.html"));

  if (!files.length) {
    console.error("No episode pages found under public/episode/");
    process.exit(1);
  }

  const failed = [];
  const results = [];

  // Patch every page in memory first. Nothing is written until all 117 have
  // been shown to match, so a structural surprise on page 90 cannot leave the
  // site half-restyled.
  for (const file of files) {
    try {
      results.push({ file, ...patchPage(fs.readFileSync(file, "utf8")) });
    } catch (e) {
      failed.push(`${path.relative(process.cwd(), file)}: ${e.message}`);
    }
  }

  if (failed.length) {
    console.error(`REFUSED — ${failed.length} of ${files.length} page(s) did not match:\n  ${failed.join("\n  ")}`);
    console.error("\nNothing was written. Inspect those pages before re-running.");
    process.exit(1);
  }

  const changed = results.filter((r) => r.changed);
  if (!dryRun) for (const r of changed) fs.writeFileSync(r.file, r.html);

  console.log(`${dryRun ? "Would patch" : "Patched"} ${changed.length} of ${files.length} pages`);
  if (dryRun && changed.length) {
    console.log(`First: ${path.relative(process.cwd(), changed[0].file)}`);
  }
}
