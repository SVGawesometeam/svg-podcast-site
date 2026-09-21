#!/usr/bin/env node
/**
 * One-off: give every built episode page the same timestamp row.
 *
 *   00:00  –  Which careers are growing through 2035
 *
 * Three things were inconsistent across the archive. The separator dash came
 * from the YouTube description glued to the front of the chapter title, so it
 * sat hard against the text with the whole slack of the time column to its
 * left. The glyph was whatever that description happened to use — em dash on
 * 14 pages, en dash on 5, a plain hyphen on 4. And 93 pages had no separator
 * at all.
 *
 * After this every page renders time, <span class="ts-dash">–</span>, title,
 * with the same gap either side, and the time column is sized in ch from the
 * longest time on that page and right-aligned, so leftover width lands before
 * the time instead of in the gap before the dash.
 *
 * build.js emits exactly this for new episodes, but it cannot re-render these
 * pages: it skips any episode whose index.html exists, and deleting them to
 * re-fetch would put the hand-applied corrections in transcript-fixes/ at
 * risk. So the markup is patched in place, the way
 * scripts/restyle-episode-chrome.js and scripts/inject-newsletter-cta.js
 * already patch built pages.
 *
 *   node scripts/unify-timestamp-dash.js --dry-run
 *   node scripts/unify-timestamp-dash.js
 */

const fs = require("fs");
const path = require("path");

const DASH = "–"; // en dash: reads as a separator, and stays distinct from the
// em dashes that appear inside chapter titles ("Job #10 — Management analysts")

const DRY = process.argv.includes("--dry-run");
const EPISODES = path.join(__dirname, "..", "public", "episode");

// The CSS the template emitted before any of this. Anchored across the whole
// block so a page that differs fails loudly instead of being half-patched.
const OLD_CSS =
  /( {4}\.timestamp-link \{\n {6}display: flex; align-items: baseline; gap: )1rem(;\n[\s\S]*?\n {4}\.ts-time \{\n {6}font-family: 'SF Mono', 'Fira Code', monospace;\n {6}font-size: 0\.85rem; color: #2563eb; )min-width: 3\.5rem;( font-weight: 500;\n {4}\})\n( {4}\.ts-title \{)/;

// The same block once this script (or the current build.js) has been over it.
const NEW_CSS =
  /( {4}\.ts-time \{\n {6}font-family: 'SF Mono', 'Fira Code', monospace;\n {6}font-size: 0\.85rem; color: #2563eb; min-width: )\d+(ch;\n {6}text-align: right;)/;

const DASH_RULE = "    .ts-dash { color: #999; flex: none; }\n";

const rows = [];
let touched = 0;
let unchanged = 0;

for (const videoId of fs.readdirSync(EPISODES).sort()) {
  const file = path.join(EPISODES, videoId, "index.html");
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  const times = [...html.matchAll(/<span class="ts-time">([^<]*)<\/span>/g)].map((m) => m[1]);
  if (!times.length) continue; // a handful of episodes ship no chapter list

  const titles = [...html.matchAll(/<span class="ts-title">([^<]*)<\/span>/g)].map((m) => m[1]);
  if (titles.length !== times.length) {
    throw new Error(`${videoId}: ${times.length} times but ${titles.length} titles`);
  }

  // A leading dash is a separator only when every chapter on the page carries
  // the same one. Page-wide, so "-Idea 3" — the one description that forgot
  // the space — is still recognised, while a lone "-40% of jobs" keeps its
  // minus sign.
  const leading = titles.map((t) => (t.match(/^\s*([–—-])/) || [])[1]);
  const glyphs = new Set(leading.filter(Boolean));
  const everyTitle = leading.every(Boolean) && glyphs.size === 1;
  if (glyphs.size && !everyTitle) {
    console.warn(
      `  ! ${videoId}: ${glyphs.size > 1 ? "mixed dashes" : `only ${leading.filter(Boolean).length}/${titles.length} titles`}` +
        ` start with a dash — treating it as part of the title, separator added in front`
    );
  }

  const had = /<span class="ts-dash">([^<]*)<\/span>/.exec(html);
  const was = had ? had[1] : everyTitle ? [...glyphs][0] : "";

  // 1. normalise an existing dash column
  html = html.replace(/<span class="ts-dash">[^<]*<\/span>/g, `<span class="ts-dash">${DASH}</span>`);

  // 2. or build one: strip the dash the description supplied, add the standard
  //    separator in front of every title
  if (!had) {
    const strip = everyTitle ? new RegExp(`^\\s*[${[...glyphs].join("")}]\\s*`) : null;
    html = html.replace(
      /<span class="ts-title">([^<]*)<\/span>/g,
      (_m, title) =>
        `<span class="ts-dash">${DASH}</span>\n                ` +
        `<span class="ts-title">${strip ? title.replace(strip, "") : title.trim()}</span>`
    );
  }

  // 3. the CSS that centres it
  const width = Math.max(4, ...times.map((t) => t.length));
  if (OLD_CSS.test(html)) {
    html = html.replace(
      OLD_CSS,
      (_m, a, b, c, d) =>
        `${a}0.85rem${b}min-width: ${width}ch;\n      text-align: right;${c}\n${DASH_RULE}${d}`
    );
  } else if (NEW_CSS.test(html)) {
    html = html.replace(NEW_CSS, (_m, a, b) => `${a}${width}${b}`);
  } else {
    throw new Error(`${videoId}: timestamp CSS does not match either known shape`);
  }

  const dashes = (html.match(/class="ts-dash"/g) || []).length;
  if (dashes !== times.length) {
    throw new Error(`${videoId}: ${dashes} dashes for ${times.length} rows`);
  }

  if (html === before) {
    unchanged++;
    continue;
  }
  touched++;
  rows.push(
    `  ${videoId.padEnd(14)} ${String(times.length).padStart(2)} chapters, ` +
      `${was ? `${was} -> ${DASH}` : `no dash -> ${DASH}`}, column ${width}ch`
  );
  if (!DRY) fs.writeFileSync(file, html);
}

console.log(rows.join("\n"));
console.log(
  `\n${DRY ? "[dry run] " : ""}patched ${touched} page(s), ${unchanged} already in shape`
);
