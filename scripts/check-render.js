#!/usr/bin/env node
// The data-layer gate: render every content/episodes/<id>.json with the
// current template and compare with the page as committed at a git ref
// (default HEAD). Reports, per page:
//
//   identical      byte-for-byte the same
//   css-only       the same once whitespace inside <style> is collapsed
//                  (older pages carry blank-line residue from past patches)
//   DIFFERENT      anything else; the first difference is printed
//
// Independently of bytes, the content is compared on what matters: visible
// text, every link and image source, the parsed JSON-LD and the meta tags.
// A content difference fails the run even when it is "only" whitespace.
//
//   node scripts/check-render.js [ref] [--allow id,id]   (allowed: transcript
//   text repaired on purpose this release; still reported)
//   --ignore-chrome   compare the pages with the shared header, footer and
//                     analytics scripts cut out of both sides. For a release
//                     that changes the chrome on purpose (nav labels, footer
//                     links, a tag), it shows that nothing else moved. The
//                     chrome itself is covered by test/chrome.test.js.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { renderEpisodePage } = require("../build.js");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content", "episodes");
const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith("--")) || "HEAD";
const allowIdx = args.indexOf("--allow");
const allowed = new Set(allowIdx === -1 ? [] : (args[allowIdx + 1] || "").split(",").filter(Boolean));
const ignoreChrome = args.includes("--ignore-chrome");

const stripChrome = (html) => html
  .replace(/<header class="site-header">[\s\S]*?<\/header>/, "<header/>")
  .replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, "<footer/>")
  .replace(/\s*<script>window\.dataLayer[^<]*<\/script>\s*<script async src="https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=[^"]*"><\/script>/, "");

function committed(id) {
  try {
    return execFileSync("git", ["show", `${ref}:public/episode/${id}/index.html`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch { return null; }
}

// Entities and their characters are the same content. &#x27; and ' both
// render as an apostrophe; the old pages carry the entity, the data layer
// stores the character.
const decode = (t) => t
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const styleOf = (html) => (html.match(/<style>([\s\S]*?)<\/style>/) || [, ""])[1]
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
// Byte comparison of everything outside <style>, after the differences that
// are not content: the theme-color meta, entity-vs-character spellings,
// indentation between tags, and the solo-page thumbnail alt that the template
// now renders correctly ("host of", not "interviewed by" herself).
const normalise = (html) => html
  .replace(/<style>[\s\S]*?<\/style>/, "<style/>")
  .replace(/\s*<meta name="theme-color" content="[^"]*">/g, "")
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  .replace(/alt="Marina Mogilko, Host, Silicon Valley Girl Podcast, interviewed by Marina Mogilko on the Silicon Valley Girl Podcast"/g,
           'alt="Marina Mogilko, host of the Silicon Valley Girl Podcast"')
  .replace(/>\s+</g, "> <");
const text = (html) => decode(html
  .replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const links = (html) => [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => decode(m[1])).sort().join("\n");
const ld = (html) => JSON.stringify(JSON.parse((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [, "{}"])[1]));
// theme-color is the browser-chrome tint, not page content; the data layer
// renders every page with the site's one value.
const metas = (html) => [...html.matchAll(/<(?:meta|title|link rel="canonical")[^>]*>[^<]*/g)]
  .map((m) => decode(m[0])).filter((m) => !m.includes('name="theme-color"')).join("\n");

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `…${a.slice(Math.max(0, i - 60), i)}▸${a.slice(i, i + 80)}… | now: ▸${b.slice(i, i + 80)}…`;
}

const ids = fs.readdirSync(CONTENT).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
const counts = { identical: 0, cssOnly: 0, styleDiff: 0, different: 0, contentDiff: 0, allowedDiff: 0, missing: 0 };
const styleIds = [];
const differentIds = [];

for (const id of ids) {
  let before = committed(id);
  if (before === null) { counts.missing++; console.log(`NEW       ${id} (no committed page at ${ref})`); continue; }
  const data = JSON.parse(fs.readFileSync(path.join(CONTENT, `${id}.json`), "utf8"));
  let after = renderEpisodePage(data);
  if (ignoreChrome) { before = stripChrome(before); after = stripChrome(after); }

  const problems = [];
  if (text(before) !== text(after)) problems.push(["text", firstDiff(text(before), text(after))]);
  if (links(before) !== links(after)) problems.push(["links", firstDiff(links(before), links(after))]);
  if (ld(before) !== ld(after)) problems.push(["json-ld", firstDiff(ld(before), ld(after))]);
  if (metas(before) !== metas(after)) problems.push(["meta", firstDiff(metas(before), metas(after))]);

  if (problems.length) {
    const tag = allowed.has(id) ? "ALLOWED " : "CONTENT ";
    if (allowed.has(id)) counts.allowedDiff++; else { counts.contentDiff++; differentIds.push(id); }
    for (const [what, where] of problems) console.log(`${tag}${id} ${what}: ${where}`);
    continue;
  }
  if (before === after) { counts.identical++; continue; }
  if (normalise(before) === normalise(after)) {
    if (styleOf(before) !== styleOf(after)) { counts.styleDiff++; styleIds.push(id); }
    counts.cssOnly++;
    continue;
  }
  if (allowed.has(id)) {
    counts.allowedDiff++;
    console.log(`ALLOWED ${id} markup: ${firstDiff(normalise(before), normalise(after))}`);
    continue;
  }
  counts.different++;
  differentIds.push(id);
  console.log(`DIFFERENT ${id}: ${firstDiff(normalise(before), normalise(after))}`);
}

console.log(`\nRender vs ${ref}${ignoreChrome ? " (chrome ignored)" : ""}: ${counts.identical} identical, ${counts.cssOnly} same after normalisation (${counts.styleDiff} of them with different CSS rules), ${counts.different} markup-different, ${counts.contentDiff} content-different, ${counts.allowedDiff} allowed content changes, ${counts.missing} new`);
if (styleIds.length) console.log(`Pages whose CSS rules (not content) change to the current template: ${styleIds.join(" ")}`);
if (differentIds.length) console.log(`Not passing: ${differentIds.join(" ")}`);
process.exit(counts.different + counts.contentDiff ? 1 : 0);
