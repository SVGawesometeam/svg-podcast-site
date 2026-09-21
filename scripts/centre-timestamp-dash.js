#!/usr/bin/env node
/**
 * One-off: centre the separator dash in the timestamps of built episode pages.
 *
 * Chapter lists come from the YouTube description with the dash glued to the
 * front of each title ("00:00 – Intro"). Rendered that way it sits hard against
 * the title, with the whole slack of the fixed-width time column to its left.
 * This moves the dash into its own <span class="ts-dash"> between the time and
 * the title, so the flex gap gives it the same space on both sides.
 *
 * build.js emits it this way from now on, but it cannot re-render these pages:
 * it skips any episode whose index.html exists, and deleting them to re-fetch
 * would put the hand-applied corrections in transcript-fixes/ at risk. So the
 * markup is patched in place, the way scripts/restyle-episode-chrome.js and
 * scripts/inject-newsletter-cta.js already patch built pages.
 *
 * Only pages whose chapter titles actually start with a dash are touched.
 *
 *   node scripts/centre-timestamp-dash.js --dry-run
 *   node scripts/centre-timestamp-dash.js
 */

const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry-run");
const EPISODES = path.join(__dirname, "..", "public", "episode");

// The CSS the template emitted before this change. Anchored on the whole block
// so a page that differs fails loudly instead of being half-patched.
const OLD_CSS =
  /( {4}\.timestamp-link \{\n {6}display: flex; align-items: baseline; gap: )1rem(;\n[\s\S]*?\n {4}\.ts-time \{\n {6}font-family: 'SF Mono', 'Fira Code', monospace;\n {6}font-size: 0\.85rem; color: #2563eb; )min-width: 3\.5rem;( font-weight: 500;\n {4}\})\n( {4}\.ts-title \{)/;

// A page already carrying the new CSS (this script having run, or built by the
// current build.js) — its min-width is a ch value and .ts-dash exists.
const NEW_CSS = /\.ts-dash \{ color: #999; flex: none; \}/;

// The one page that was converted by hand before this script existed: same
// markup as the new template, but with the first stab at the column width.
const HAND_CSS =
  /( {4}\.timestamp-link \{\n {6}display: flex; align-items: baseline; gap: )0\.85rem(;\n[\s\S]*?\n {4}\.ts-time \{\n {6}font-family: 'SF Mono', 'Fira Code', monospace;\n {6}font-size: 0\.85rem; color: #2563eb; )min-width: 2\.6rem;( font-weight: 500;\n {4}\})/;

function cssFor(width) {
  return (
    `min-width: ${width}ch;\n` +
    `      text-align: right;`
  );
}

let touched = 0;
let skipped = 0;

for (const videoId of fs.readdirSync(EPISODES).sort()) {
  const file = path.join(EPISODES, videoId, "index.html");
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");

  const titles = [...html.matchAll(/<span class="ts-title">([^<]*)<\/span>/g)];
  const times = [...html.matchAll(/<span class="ts-time">([^<]*)<\/span>/g)].map(
    (m) => m[1]
  );
  // What makes a leading dash a separator rather than part of the title is that
  // EVERY chapter on the page carries the same one. Checked page-wide, so a
  // lone title like "-40% of jobs" keeps its minus sign, while "-Idea 3" — the
  // one chapter in the archive whose description forgot the space — is still
  // recognised.
  const dashed = titles.filter((m) => /^\s*[–—-]/.test(m[1]));
  const alreadySplit = /<span class="ts-dash">/.test(html);

  if (!dashed.length && !alreadySplit) {
    skipped++;
    continue;
  }
  if (dashed.length && dashed.length !== titles.length) {
    throw new Error(
      `${videoId}: ${dashed.length} of ${titles.length} chapter titles start ` +
        `with a dash, so it is part of the titles, not a separator`
    );
  }
  const glyphs = new Set(dashed.map((m) => m[1].trim()[0]));
  if (glyphs.size > 1) {
    throw new Error(`${videoId}: mixed dash characters ${[...glyphs].join(" ")}`);
  }
  const LEADING_DASH = new RegExp(`^\\s*([${[...glyphs].join("")}])\\s*`);
  const width = Math.max(4, ...times.map((t) => t.length));

  const before = html;
  html = html.replace(
    /<span class="ts-title">([^<]*)<\/span>/g,
    (whole, title) => {
      const m = glyphs.size ? title.match(LEADING_DASH) : null;
      if (!m) return whole;
      return (
        `<span class="ts-dash">${m[1]}</span>\n                ` +
        `<span class="ts-title">${title.replace(LEADING_DASH, "")}</span>`
      );
    }
  );

  if (OLD_CSS.test(html)) {
    html = html.replace(
      OLD_CSS,
      (_m, a, b, c, d) => `${a}0.85rem${b}${cssFor(width)}${c}\n    .ts-dash { color: #999; flex: none; }\n${d}`
    );
  } else if (HAND_CSS.test(html)) {
    html = html.replace(HAND_CSS, (_m, a, b, c) => `${a}0.85rem${b}${cssFor(width)}${c}`);
  } else if (!NEW_CSS.test(html)) {
    throw new Error(`${videoId}: timestamp CSS does not match either known shape`);
  }

  if (html === before) {
    skipped++;
    continue;
  }
  touched++;
  console.log(
    `  ${videoId.padEnd(14)} ${dashed.length || titles.length} chapters, ` +
      `dash ${[...glyphs][0] || "(already split)"}, column ${width}ch`
  );
  if (!DRY) fs.writeFileSync(file, html);
}

console.log(
  `\n${DRY ? "[dry run] " : ""}patched ${touched} page(s), left ${skipped} without a dash alone`
);
