// Audience counts. The team's dashboard reads every account once a day and
// publishes a JSON summary; a weekly GitHub Action (see
// .github/workflows/audience.yml) copies the subtotals into
// content/audience.json, and the build reads that file. The site never calls
// the dashboard at request time, so a dashboard outage cannot break a page.

const AUDIENCE_API = "https://svg-dashboard-production.up.railway.app/api/audience";

// Platform keys the dashboard uses, with the label the site shows. Anything
// else the API returns is ignored rather than rendered.
const PLATFORMS = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  threads: "Threads",
  telegram: "Telegram",
  email: "Newsletter",
  linkedin: "LinkedIn",
  x: "X",
  spotify: "Spotify",
  facebook: "Facebook",
};

const MAX_AGE_DAYS = 3;
// No account on earth has this many followers; a total above it is a bug.
const MAX_TOTAL = 1e9;
const known = (key) => typeof key === "string" && Object.hasOwn(PLATFORMS, key);

// What the API returns is trusted as far as the team's dashboard is, and no
// further: numbers have to be numbers, keys have to be known, and a read
// that is stale or incomplete is refused so last week's file stays.
function validateAudience(d, now = Date.now()) {
  const problems = [];
  if (!d || typeof d !== "object") return ["response is not an object"];
  const readAt = Date.parse(d.readAt);
  if (Number.isNaN(readAt)) problems.push("readAt is not a date");
  else if ((now - readAt) / 864e5 > MAX_AGE_DAYS) problems.push(`readAt is older than ${MAX_AGE_DAYS} days`);
  else if (readAt - now > 864e5) problems.push("readAt is in the future");
  if (!(Number.isFinite(d.total) && d.total > 0 && d.total < MAX_TOTAL)) problems.push("total is not a plausible positive number");
  if (!(Number.isInteger(d.counted) && Number.isInteger(d.accounts))) problems.push("counted/accounts missing");
  else if (d.counted < d.accounts) problems.push(`only ${d.counted} of ${d.accounts} accounts were read`);
  if (!Array.isArray(d.platforms) || d.platforms.length === 0) problems.push("platforms missing");
  else {
    for (const p of d.platforms) {
      if (!p || typeof p !== "object" || !known(p.key)) continue;
      if (!(Number.isFinite(p.subtotal) && p.subtotal >= 0 && p.subtotal < MAX_TOTAL)) problems.push(`${p.key} subtotal is not a plausible number`);
    }
  }
  return problems;
}

// The file the site reads: the date, the total and one subtotal per known
// platform. Nothing else from the response is kept.
function summarise(d) {
  const platforms = {};
  for (const p of d.platforms) {
    if (p && typeof p === "object" && known(p.key) && Number.isFinite(p.subtotal)) platforms[p.key] = Math.round(p.subtotal);
  }
  return { updatedAt: new Date(d.readAt).toISOString(), total: Math.round(d.total), platforms };
}

// Rounded down, never up, and never to the last digit: YouTube publishes
// rounded counts and two accounts are entered by hand, so "18,358,261"
// would claim a precision the number does not have. 18358261 -> "18.3M+".
function formatCount(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n >= 1e6) return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1e3) return `${Math.floor(n / 1e3)}K+`;
  return String(Math.floor(n));
}

// What the About page and llms.txt show: the total and the three largest
// platforms. The total spans every account the dashboard tracks, including
// the dubbed and Russian channels, and audiences overlap, which the page says.
function countsFor(audience, { top = 3 } = {}) {
  if (!audience || !Number.isFinite(audience.total)) return { updatedAt: null, items: [] };
  const items = [{ label: "followers across all channels", value: formatCount(audience.total) }];
  const ranked = Object.entries(audience.platforms || {})
    .filter(([key, n]) => known(key) && Number.isFinite(n) && n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top);
  for (const [key, n] of ranked) items.push({ label: `on ${PLATFORMS[key]}`, value: formatCount(n) });
  return { updatedAt: String(audience.updatedAt).slice(0, 10), items };
}

module.exports = { AUDIENCE_API, PLATFORMS, MAX_AGE_DAYS, MAX_TOTAL, known, validateAudience, summarise, formatCount, countsFor };
