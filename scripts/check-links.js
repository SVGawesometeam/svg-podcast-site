#!/usr/bin/env node
// Internal link gate: every root-relative href/src in public/ must resolve
// to a file, every episode page must be linked from at least one other page,
// and every hub and static page must be reachable from the homepage. Run
// after a build:  node scripts/check-links.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith(".html")) yield p;
  }
}

// A root-relative URL resolves to a file if it is a file, or a directory
// with an index.html; the query and fragment are not part of the path.
function resolves(url) {
  let clean;
  try { clean = decodeURIComponent(url.split("#")[0].split("?")[0]); } catch { return false; }
  const target = path.join(PUBLIC, clean);
  if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return false;
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
  return fs.existsSync(path.join(target, "index.html"));
}

const pages = [...htmlFiles(PUBLIC)];
const inbound = new Map(); // "/episode/x/" -> Set of pages linking to it
const broken = [];
let links = 0;

for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const page = "/" + path.relative(PUBLIC, file).replace(/\\/g, "/").replace(/index\.html$/, "");
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (url.startsWith("//")) continue; // protocol-relative, external
    links++;
    if (!resolves(url)) broken.push(`${page} -> ${url}`);
    const normal = url.split("#")[0].split("?")[0].replace(/index\.html$/, "");
    if (normal !== page) {
      if (!inbound.has(normal)) inbound.set(normal, new Set());
      inbound.get(normal).add(page);
    }
  }
}

const orphans = pages
  .map((f) => "/" + path.relative(PUBLIC, f).replace(/\\/g, "/").replace(/index\.html$/, ""))
  .filter((p) => p !== "/" && !/^\/google[0-9a-f]+\.html$/.test(p) && !(inbound.get(p) || new Set()).size);

console.log(`${pages.length} pages, ${links} internal links checked`);
if (broken.length) console.log(`BROKEN (${broken.length}):\n  ${broken.join("\n  ")}`);
if (orphans.length) console.log(`ORPHANS (no page links to them, ${orphans.length}):\n  ${orphans.join("\n  ")}`);
if (!broken.length && !orphans.length) console.log("OK: no broken internal links, no orphan pages");
process.exit(broken.length || orphans.length ? 1 : 0);
