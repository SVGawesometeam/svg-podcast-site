#!/usr/bin/env node
// Weekly: copy the dashboard's audience subtotals into content/audience.json.
// Run by .github/workflows/audience.yml (and by hand with `node
// scripts/update-audience.js`). A stale, partial or malformed read exits
// non-zero and leaves the previous file untouched; the workflow then fails
// visibly and the site keeps last week's numbers.

const fs = require("fs");
const path = require("path");
const { AUDIENCE_API, validateAudience, summarise } = require("../lib/audience");

const OUT = path.join(__dirname, "..", "content", "audience.json");

async function main() {
  // A fixed URL on the team's own host: a redirect anywhere would be a surprise, so it is an error.
  const res = await fetch(AUDIENCE_API, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`audience API returned HTTP ${res.status}`);
  const data = await res.json();
  const problems = validateAudience(data);
  if (problems.length) throw new Error(`refusing the read: ${problems.join("; ")}`);

  const next = JSON.stringify(summarise(data), null, 2) + "\n";
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (prev === next) {
    console.log(`content/audience.json unchanged (read at ${data.readAt})`);
    return;
  }
  fs.writeFileSync(OUT, next);
  console.log(`Written content/audience.json: total ${data.total} read at ${data.readAt}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
