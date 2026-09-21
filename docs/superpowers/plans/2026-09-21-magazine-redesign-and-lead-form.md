# Magazine Redesign + Lead Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild marinamogilko.co's homepage to the mocked magazine design, carry its header and footer onto the 117 existing episode pages, and add a lead capture form that emails every enquiry to pr@marinamogilko.co.

**Architecture:** A single `lib/chrome.js` becomes the one definition of head, header, footer and chrome CSS, required by both builders. `renderHomePage()` is rewritten against it. The 117 built episode pages are patched in place by a one-off script, because `build.js` skips any episode whose HTML already exists. The form posts to a Vercel serverless function that calls Resend over plain `fetch()`.

**Tech Stack:** Node (no framework), template literals, Vercel static hosting + serverless functions, Resend REST API, `node --test` for unit tests.

## Global Constraints

- **No new npm dependencies.** `package.json` keeps its single entry (`youtube-transcript`). Use built-in `fetch()`, not the `resend` SDK.
- **Copy is verbatim from the mock.** Every string in `docs/superpowers/specs/2026-09-21-magazine-redesign-and-lead-form-design.md` §Phase 2 is reproduced exactly, including "Millions / FOLLOWING ALONG".
- **Design tokens:** accent `#E63333`, text `#000000`, ground `#F5F5F5`, cards `#FFFFFF`. Headlines bold, condensed, all-caps. No dark mode.
- **Episode page bodies are never touched** — transcript, player, tab switcher, About the Guest, related episodes, JSON-LD stay byte-identical.
- **Head metadata is preserved** — `<title>`, OG, Twitter and `PodcastSeries` JSON-LD on the homepage keep their current values.
- **Secrets are never logged, echoed, or committed.** `RESEND_API_KEY` lives only in Vercel env.
- **All form submissions go to pr@marinamogilko.co**, including `Brand deal / sponsorship`.

---

### Task 1: Extract shared chrome into one module

Fixes a latent bug: `batch-build.js`'s `SHARED_HEAD` omits every favicon and its `SHARED_HEADER` carries 3 nav icons against `build.js`'s 5. All 117 live pages have the `build.js` version, so the drift has not reached production — but any episode built by `batch-build.js` would ship without favicons.

**Files:**
- Create: `lib/chrome.js`
- Modify: `build.js` (delete `ICONS` 310-321, `SHARED_HEAD` 322-332, `SHARED_HEADER` 333-344, `SHARED_FOOTER` 345-346; add require at top)
- Modify: `batch-build.js` (delete its `ICONS`, `SHARED_HEAD`, `SHARED_HEADER`, `SHARED_FOOTER` at 20-51; add require at top)
- Test: `test/chrome.test.js`

**Interfaces:**
- Produces: `module.exports = { ICONS, SHARED_HEAD, SHARED_HEADER, SHARED_FOOTER, CHROME_CSS }` — `ICONS` is an object of SVG strings keyed `youtube|spotify|apple|instagram|linkedin|twitter|tiktok|newsletter|mail`; the other four are strings. `CHROME_CSS` is new in Task 2 and exported as `''` here so the require is stable.

- [ ] **Step 1: Write the failing test**

```js
// test/chrome.test.js
const test = require('node:test');
const assert = require('node:assert');
const chrome = require('../lib/chrome');

test('exports every icon both builders reference', () => {
  for (const k of ['youtube','spotify','apple','instagram','linkedin','twitter','tiktok','newsletter','mail']) {
    assert.ok(chrome.ICONS[k], `missing icon: ${k}`);
    assert.match(chrome.ICONS[k], /^<svg/);
  }
});

test('head carries the favicons batch-build.js was missing', () => {
  assert.match(chrome.SHARED_HEAD, /rel="icon"/);
  assert.match(chrome.SHARED_HEAD, /apple-touch-icon/);
  assert.match(chrome.SHARED_HEAD, /site\.webmanifest/);
});

test('header and footer are single strings', () => {
  assert.equal(typeof chrome.SHARED_HEADER, 'string');
  assert.equal(typeof chrome.SHARED_FOOTER, 'string');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/chrome.test.js`
Expected: FAIL — `Cannot find module '../lib/chrome'`

- [ ] **Step 3: Create the module**

Move the four definitions out of `build.js` verbatim — `build.js` is the correct version, `batch-build.js`'s are the stale ones. Append `const CHROME_CSS = '';` and export all five.

- [ ] **Step 4: Require it from both builders**

At the top of `build.js` and `batch-build.js`:

```js
const { ICONS, SHARED_HEAD, SHARED_HEADER, SHARED_FOOTER, CHROME_CSS } = require('./lib/chrome');
```

Delete the local definitions in both files. `batch-build.js` gains favicons and two nav icons as a side effect — that is the bug fix.

- [ ] **Step 5: Prove the refactor changed no output**

```bash
node build.js && git diff --stat public/
```

Expected: **no output from `git diff`.** `build.js` skips existing episode pages, so only `index.html`, `sitemap.xml` and `llms.txt` are rewritten, and all three must come back identical. If anything differs, the extraction was not verbatim — fix before continuing.

- [ ] **Step 6: Run the tests**

Run: `node --test test/*.test.js`
Expected: 3 passing.

- [ ] **Step 7: Add a test script**

`package.json` has no `scripts` block. Add one — it introduces no dependency:

```json
"scripts": { "test": "node --test test/*.test.js" }
```

- [ ] **Step 8: Commit**

```bash
git add lib/chrome.js test/chrome.test.js build.js batch-build.js package.json
git commit -m "Extract shared chrome into lib/chrome.js

batch-build.js carried its own copies that had drifted: no favicons and
a 3-icon header against build.js's 5. Both now read one definition, so
an episode built by either script gets the same chrome."
```

---

### Task 2: Redesign the chrome

**Files:**
- Modify: `lib/chrome.js` (`SHARED_HEADER`, `SHARED_FOOTER`, `CHROME_CSS`)
- Modify: `test/chrome.test.js`

**Interfaces:**
- Consumes: Task 1's exports.
- Produces: `CHROME_CSS` — a string of CSS rules (no `<style>` wrapper) defining `:root` tokens, `.site-header`, `.site-footer` and the reset. Both page renderers inject it inside their own `<style>`.

- [ ] **Step 1: Extend the test**

```js
test('chrome CSS defines the design tokens', () => {
  assert.match(chrome.CHROME_CSS, /--accent:\s*#E63333/);
  assert.match(chrome.CHROME_CSS, /--ground:\s*#F5F5F5/);
});

test('header is the black bar with wordmark and nav', () => {
  assert.match(chrome.SHARED_HEADER, /SILICON VALLEY GIRL/);
  assert.match(chrome.SHARED_HEADER, /WITH MARINA MOGILKO/);
  for (const link of ['#episodes', '#host', '#subscribe']) {
    assert.ok(chrome.SHARED_HEADER.includes(link), `missing nav anchor: ${link}`);
  }
});

test('footer carries the mock copy verbatim', () => {
  assert.match(chrome.SHARED_FOOTER, /Made in Silicon Valley/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/chrome.test.js`
Expected: FAIL — `--accent` not found in `CHROME_CSS`.

- [ ] **Step 3: Write the tokens and reset into `CHROME_CSS`**

```css
:root {
  --accent: #E63333;
  --text: #000000;
  --ground: #F5F5F5;
  --card: #FFFFFF;
  --rule: #E0E0E0;
  --muted: #666666;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6; color: var(--text); background: var(--ground);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
img { max-width: 100%; display: block; }
```

- [ ] **Step 4: Write the header rules**

Black bar, sticky, full-bleed with an inner max-width of 1200px. Wordmark in condensed caps with `letter-spacing: -0.01em`; `WITH MARINA MOGILKO` beside it at `0.65rem`, `letter-spacing: .12em`, colour `#999`. Nav links uppercase `0.75rem`, `letter-spacing: .08em`, `Subscribe` rendered as a red pill (`background: var(--accent)`). Below 768px the nav collapses to a single row under the wordmark. Every interactive element keeps a visible `:focus-visible` outline — `2px solid var(--accent)`, `outline-offset: 2px`.

- [ ] **Step 5: Rewrite `SHARED_HEADER` markup**

```html
<header class="site-header">
  <div class="site-header-inner">
    <a href="/" class="wordmark">SILICON VALLEY GIRL<span>WITH MARINA MOGILKO</span></a>
    <nav class="site-nav">
      <a href="/#episodes">Episodes</a>
      <a href="/#host">Host</a>
      <a href="/#subscribe" class="nav-cta">Subscribe</a>
    </nav>
  </div>
</header>
```

Anchors are root-relative (`/#episodes`) so they work from an episode page, not just the homepage.

- [ ] **Step 6: Rewrite `SHARED_FOOTER` markup**

```html
<footer class="site-footer">
  <div class="site-footer-inner">
    <span class="footer-mark">SILICON VALLEY GIRL</span>
    <span class="footer-legal">&copy; 2026 Marina Mogilko &middot; Made in Silicon Valley</span>
  </div>
</footer>
```

- [ ] **Step 7: Run tests, then build and eyeball**

Run: `node --test test/*.test.js` → 6 passing.
Run: `node build.js`, open `public/index.html`. The homepage is still the old layout wearing the new header and footer — expected and temporary. Confirm no console errors and no horizontal scroll at 375px.

- [ ] **Step 8: Commit**

```bash
git add lib/chrome.js test/chrome.test.js
git commit -m "Redesign the shared header and footer

Black bar with the wordmark, nav anchors and a red Subscribe pill; new
footer copy. Design tokens land in CHROME_CSS so both page types read
one palette."
```

---

### Task 3: Rewrite the homepage

**Files:**
- Modify: `build.js` — `renderHomePage()` (364-598) replaced wholesale
- Test: `test/homepage.test.js`

**Interfaces:**
- Consumes: `CHROME_CSS`, `SHARED_HEAD`, `SHARED_HEADER`, `SHARED_FOOTER`, `ICONS` from `lib/chrome.js`. Episode objects as `readExistingEpisodeMeta()` returns them: `{ videoId, title, description, publishedAt, duration, guest, thumbnail }`.
- Produces: nothing consumed downstream; `renderHomePage(episodes)` keeps its signature.

- [ ] **Step 1: Write the failing test**

```js
// test/homepage.test.js
const test = require('node:test');
const assert = require('node:assert');
const { renderHomePage } = require('../build.js');

const EPISODES = [
  { videoId: 'aaa', title: 'Newest Episode', description: 'Dek one.',
    publishedAt: '2026-09-08', duration: '39 MIN', guest: 'Shishir Mehrotra',
    thumbnail: 'https://i.ytimg.com/vi/aaa/hq.jpg' },
  { videoId: 'bbb', title: 'Older Episode', description: 'Dek two.',
    publishedAt: '2026-08-28', duration: '38 MIN', guest: 'Andrew Ng',
    thumbnail: 'https://i.ytimg.com/vi/bbb/hq.jpg' },
];

test('hero copy is verbatim from the mock', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /THE PODCAST THAT DECODES THE VALLEY/);
  assert.match(html, /what can I actually do with this today\?/);
});

test('newest episode is the cover story and is not repeated in the archive', () => {
  const html = renderHomePage(EPISODES);
  const archive = html.slice(html.indexOf('id="episodes"'));
  assert.ok(!archive.includes('Newest Episode'), 'cover story duplicated in archive');
  assert.ok(archive.includes('Older Episode'), 'archive missing older episode');
});

test('every episode is linked', () => {
  const html = renderHomePage(EPISODES);
  for (const e of EPISODES) assert.ok(html.includes(`/episode/${e.videoId}/`));
});

test('head metadata is preserved', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /<title>Silicon Valley Girl Podcast — Marina Mogilko<\/title>/);
  assert.match(html, /"@type":\s*"PodcastSeries"/);
});

test('partnerships mailto survives the redesign', () => {
  assert.match(renderHomePage(EPISODES), /mailto:partnerships@marinamogilko\.co/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/homepage.test.js`
Expected: FAIL — `renderHomePage is not a function` (`build.js` exports nothing yet).

- [ ] **Step 3: Export the renderer**

At the foot of `build.js`, before the `build()` invocation:

```js
module.exports = { renderHomePage, renderEpisodePage };
```

Guard the existing self-invocation at the foot of the file so requiring the module doesn't trigger a build:

```js
if (require.main === module) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run again — now it fails on content**

Run: `node --test test/homepage.test.js`
Expected: FAIL on the hero copy assertion. The module loads; the markup is still the old design.

- [ ] **Step 5: Rewrite `renderHomePage()`**

Eleven sections in the order fixed by the spec: header · hero · cover story · about the show · archive · meet the host · partnerships · newsletter · follow along · form (Task 5 fills this; leave `<!-- FORM -->` here) · footer. All copy verbatim from spec §Phase 2.

Derived values, never hardcoded: `const [cover, ...rest] = episodes;` — cover story from `cover`, archive grid from `rest`, hero thumbnail from `cover.thumbnail`, `Latest episode →` to `/episode/${cover.videoId}/`. Drop the mock's `All episodes →` link per the spec: all 117 are on the page, so it would link to itself.

Layout: hero headline `clamp(2.75rem, 9vw, 6rem)`, `line-height: 0.95`, uppercase, with `YOUR` wrapped in `<span class="accent">`. Archive is `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, collapsing to one column below 640px. `MEET THE HOST` is a full-bleed black band. Every thumbnail gets `loading="lazy"` and explicit `width`/`height` to prevent layout shift.

- [ ] **Step 6: Run tests**

Run: `node --test test/*.test.js`
Expected: 11 passing.

- [ ] **Step 7: Build and inspect at both widths**

```bash
node build.js && git diff --stat public/
```

Expected: `public/index.html` changed; `sitemap.xml` and `llms.txt` **unchanged**. Open at 1440px and 375px: no horizontal scroll, all 116 archive cards present, cover story not duplicated.

- [ ] **Step 8: Commit**

```bash
git add build.js test/homepage.test.js public/index.html
git commit -m "Rebuild the homepage to the magazine design

Hero, cover story, archive grid, host band, newsletter and follow-along,
copy verbatim from the mock. Cover story is the newest episode and is
excluded from the archive rather than repeated."
```

---

### Task 4: Patch the chrome on the 117 built episode pages

`build.js:161` skips any episode whose `index.html` exists and reads its metadata back out of the HTML, so these pages cannot be re-rendered without deleting them and re-fetching 117 transcripts from a throttled endpoint. They are patched in place instead — the idiom `scripts/inject-newsletter-cta.js` and `patch-jsonld.js` already use.

**Files:**
- Create: `scripts/restyle-episode-chrome.js`
- Modify: `public/episode/*/index.html` (117 files, by script)
- Test: `test/restyle-chrome.test.js`

**Interfaces:**
- Consumes: `SHARED_HEADER`, `SHARED_FOOTER`, `CHROME_CSS` from `lib/chrome.js`.
- Produces: `module.exports = { patchPage }` — `patchPage(html: string) => { html: string, changed: boolean }`. Pure, so it is testable without touching disk.

- [ ] **Step 1: Write the failing test**

```js
// test/restyle-chrome.test.js
const test = require('node:test');
const assert = require('node:assert');
const { patchPage } = require('../scripts/restyle-episode-chrome');

const PAGE = `<!DOCTYPE html><html><head><style>
    /* CHROME-START */
    .site-header { padding: 1rem; }
    /* CHROME-END */
    .transcript { color: red; }
  </style></head><body>
  <header class="site-header"><a class="logo">old</a></header>
  <main><p id="keep">transcript body</p></main>
  <footer class="site-footer">&copy; 2026 old</footer>
</body></html>`;

test('replaces header, footer and chrome CSS', () => {
  const { html, changed } = patchPage(PAGE);
  assert.equal(changed, true);
  assert.ok(html.includes('WITH MARINA MOGILKO'));
  assert.ok(html.includes('Made in Silicon Valley'));
  assert.ok(!html.includes('<a class="logo">old</a>'));
});

test('leaves the body untouched', () => {
  const { html } = patchPage(PAGE);
  assert.ok(html.includes('<p id="keep">transcript body</p>'));
  assert.ok(html.includes('.transcript { color: red; }'), 'non-chrome CSS was eaten');
});

test('is idempotent', () => {
  const once = patchPage(PAGE).html;
  const twice = patchPage(once);
  assert.equal(twice.html, once, 'second run changed the output');
  assert.equal(twice.changed, false);
});

test('throws rather than half-writing a page it does not recognise', () => {
  assert.throws(() => patchPage('<html><body>no chrome here</body></html>'), /does not match/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/restyle-chrome.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `patchPage`**

Three replacements, each anchored on a marker that must be found or the function throws:
1. `<header class="site-header">` … `</header>` → `SHARED_HEADER`
2. `<footer class="site-footer">` … `</footer>` → `SHARED_FOOTER`
3. The chrome CSS region → `CHROME_CSS`. Existing pages have no `/* CHROME-START */` sentinels, so on first run match from `.site-header {` through the closing brace of the last chrome rule; **write the sentinels in**, so every later run matches on them. That is what makes the function idempotent.

Return `{ html, changed: html !== input }`.

- [ ] **Step 4: Add the CLI wrapper**

```js
if (require.main === module) {
  const dry = process.argv.includes('--dry-run');
  const files = fs.globSync('public/episode/*/index.html');
  const failed = [];
  let changed = 0;
  for (const f of files) {
    try {
      const out = patchPage(fs.readFileSync(f, 'utf8'));
      if (out.changed) { changed++; if (!dry) fs.writeFileSync(f, out.html); }
    } catch (e) { failed.push(`${f}: ${e.message}`); }
  }
  if (failed.length) {
    console.error(`REFUSED — ${failed.length} page(s) did not match:\n` + failed.join('\n'));
    process.exit(1);
  }
  console.log(`${dry ? 'Would patch' : 'Patched'} ${changed} of ${files.length} pages`);
}
```

It collects failures and exits non-zero **before** writing nothing further, so a structural surprise never leaves the site half-patched.

- [ ] **Step 5: Run the tests**

Run: `node --test test/*.test.js`
Expected: 15 passing.

- [ ] **Step 6: Dry run against the real 117**

Run: `node scripts/restyle-episode-chrome.js --dry-run`
Expected: `Would patch 117 of 117 pages`, no `REFUSED`. If any page is refused, stop and inspect it — do not force the write.

- [ ] **Step 7: Patch for real, then verify the body is untouched**

```bash
node scripts/restyle-episode-chrome.js
git diff --stat public/episode | tail -1
git diff public/episode/-Epp6VmpezI/index.html | grep -c '^[+-].*transcript-turn'
```

Expected: 117 files changed; the transcript grep returns **0** — no transcript line moved. Spot-check an early episode, a recent one and a compilation in the browser.

- [ ] **Step 8: Confirm JSON-LD survived**

```bash
node patch-jsonld.js && git diff --stat public/episode | tail -1
```

Expected: no further changes — the structured data is already correct.

- [ ] **Step 9: Commit**

```bash
git add scripts/restyle-episode-chrome.js test/restyle-chrome.test.js public/episode
git commit -m "Restyle the chrome on 117 built episode pages

build.js cannot re-render a page that already exists, so the header,
footer and chrome CSS are patched in place. Transcripts, players and
JSON-LD are byte-identical; the script is idempotent and refuses to
write a page whose structure it does not recognise."
```

---

### Task 5: The form

**Files:**
- Modify: `build.js` — replace the `<!-- FORM -->` marker in `renderHomePage()`
- Create: `lib/contact-fields.js`
- Test: `test/contact-fields.test.js`

**Interfaces:**
- Produces: `module.exports = { TOPICS, FIELDS }` — `TOPICS` is the ordered array of the eight dropdown strings; `FIELDS` describes each input as `{ name, label, type, required }`. Task 6's validator imports the same module, so the form and the server cannot disagree about field names.

- [ ] **Step 1: Write the failing test**

```js
// test/contact-fields.test.js
const test = require('node:test');
const assert = require('node:assert');
const { TOPICS, FIELDS } = require('../lib/contact-fields');

test('topics match the mock, in order', () => {
  assert.deepEqual(TOPICS, [
    'Brand deal / sponsorship', 'Podcast guest', 'Speaking / event',
    'Press / interview', 'Partnership', 'Investment', 'Job / hiring',
    'Something else',
  ]);
});

test('required fields are name, email, topic, details', () => {
  const required = FIELDS.filter(f => f.required).map(f => f.name).sort();
  assert.deepEqual(required, ['details', 'email', 'name', 'topic']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/contact-fields.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/contact-fields.js`**

```js
const TOPICS = [
  'Brand deal / sponsorship', 'Podcast guest', 'Speaking / event',
  'Press / interview', 'Partnership', 'Investment', 'Job / hiring',
  'Something else',
];

const FIELDS = [
  { name: 'name',    label: 'YOUR NAME',                     type: 'text',     required: true,  max: 200 },
  { name: 'email',   label: 'EMAIL',                         type: 'email',    required: true,  max: 320 },
  { name: 'company', label: 'COMPANY (OPTIONAL)',            type: 'text',     required: false, max: 200 },
  { name: 'topic',   label: "WHAT'S THIS ABOUT?",            type: 'select',   required: true },
  { name: 'budget',  label: 'BUDGET OR TIMELINE (OPTIONAL)', type: 'text',     required: false, max: 200 },
  { name: 'details', label: 'DETAILS',                       type: 'textarea', required: true,  max: 5000 },
];

module.exports = { TOPICS, FIELDS };
```

- [ ] **Step 4: Render the form into the homepage**

Replace `<!-- FORM -->` with a section headed `PITCH MARINA ANYTHING` and the dek verbatim from the spec, generated by mapping over `FIELDS`. Every control gets a real `<label for>` — the mock's uppercase labels are styling, not placeholders. Plus two bot traps: a `website` input inside a `.hp` wrapper (`position:absolute; left:-9999px`) with `tabindex="-1"` and `autocomplete="off"`, and `<input type="hidden" name="rendered" value="${Date.now()}">`. Submit reads `SEND OPPORTUNITY`. Under the form, a `<noscript>` line pointing at `mailto:pr@marinamogilko.co`.

- [ ] **Step 5: Write the client script**

Inline at the end of the page: `preventDefault`, disable the button and set its text to `Sending…`, `POST` JSON to `/api/contact`. On `ok`, replace the form with a confirmation. On failure, show the message above the form and **re-enable the button with every field still populated** — the user must never lose what they typed. On network error, show the same failure path.

- [ ] **Step 6: Run tests and build**

Run: `node --test test/*.test.js` → 17 passing.
Run: `node build.js`. Open the homepage; tab through every field confirming visible focus rings and that labels are clickable.

- [ ] **Step 7: Commit**

```bash
git add build.js lib/contact-fields.js test/contact-fields.test.js public/index.html
git commit -m "Add the Work With Marina form to the homepage

Fields and copy from the mock. Field definitions live in
lib/contact-fields.js so the markup and the server-side validator cannot
disagree about names. Honeypot and a render timestamp for bots."
```

---

### Task 6: The serverless handler

**Files:**
- Create: `api/contact.js`
- Create: `lib/contact-validation.js`
- Test: `test/contact-validation.test.js`

**Interfaces:**
- Consumes: `FIELDS`, `TOPICS` from `lib/contact-fields.js`.
- Produces: `validate(body) => { ok: true, data } | { ok: false, error: string }` and `isBot(body) => boolean`. `api/contact.js` is the thin HTTP and Resend wrapper around them, so all the logic is unit-testable without a network.

- [ ] **Step 1: Write the failing test**

```js
// test/contact-validation.test.js
const test = require('node:test');
const assert = require('node:assert');
const { validate, isBot } = require('../lib/contact-validation');

const GOOD = { name: 'Jane Doe', email: 'jane@example.com', topic: 'Podcast guest',
               details: 'I would like to pitch a guest.', rendered: String(Date.now() - 30000) };

test('accepts a well-formed submission', () => {
  assert.equal(validate(GOOD).ok, true);
});

test('rejects a missing required field', () => {
  const r = validate({ ...GOOD, details: '' });
  assert.equal(r.ok, false);
  assert.match(r.error, /details/i);
});

test('rejects a malformed email', () => {
  assert.equal(validate({ ...GOOD, email: 'not-an-email' }).ok, false);
});

test('rejects an unknown topic', () => {
  assert.equal(validate({ ...GOOD, topic: 'Nonsense' }).ok, false);
});

test('rejects an over-length field', () => {
  assert.equal(validate({ ...GOOD, details: 'x'.repeat(5001) }).ok, false);
});

test('a filled honeypot is a bot', () => {
  assert.equal(isBot({ ...GOOD, website: 'http://spam.example' }), true);
});

test('a submission faster than three seconds is a bot', () => {
  assert.equal(isBot({ ...GOOD, rendered: String(Date.now() - 500) }), true);
});

test('a normal submission is not a bot', () => {
  assert.equal(isBot(GOOD), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/contact-validation.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

`validate` walks `FIELDS`: required fields must be non-empty after trim, every field is capped at its `max`, `email` must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, `topic` must be in `TOPICS`. Returns trimmed values in `data`. `isBot` returns true when `website` is non-empty or `Date.now() - Number(rendered) < 3000`; a missing or unparseable `rendered` is **not** treated as a bot, so a stale cache can never silently swallow a real enquiry.

- [ ] **Step 4: Run the tests**

Run: `node --test test/*.test.js`
Expected: 25 passing.

- [ ] **Step 5: Write `api/contact.js`**

```js
const { validate, isBot } = require('../lib/contact-validation');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

  // Bots get a 200 so they learn nothing about why nothing happened.
  if (isBot(body)) return res.status(200).json({ ok: true });

  const result = validate(body);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const d = result.data;
  const subject = `[SVG site] ${d.topic} — ${d.name}${d.company ? `, ${d.company}` : ''}`;
  const text = [
    `Name:    ${d.name}`,
    `Email:   ${d.email}`,
    `Company: ${d.company || '—'}`,
    `Topic:   ${d.topic}`,
    `Budget:  ${d.budget || '—'}`,
    '',
    d.details,
    '',
    `Sent ${new Date().toISOString()} from marinamogilko.co`,
  ].join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Silicon Valley Girl <forms@marinamogilko.co>',
      to: ['pr@marinamogilko.co'],
      reply_to: d.email,
      subject,
      text,
    }),
  });

  if (!r.ok) {
    // Never surface the provider's response — it can echo the key.
    console.error('Resend rejected the send:', r.status);
    return res.status(502).json({ error: 'Could not send right now. Please email pr@marinamogilko.co.' });
  }
  return res.status(200).json({ ok: true });
};
```

`reply_to: d.email` is the detail that makes the inbox usable — hitting reply answers the sender. The error path prints the status only; the provider's body can contain the key.

- [ ] **Step 6: Commit**

```bash
git add api/contact.js lib/contact-validation.js test/contact-validation.test.js
git commit -m "Add the contact handler

Validation and bot detection live in lib/ as pure functions so they are
testable without a network; api/contact.js is the HTTP and Resend
wrapper. Reply-To is the sender, so replying from the inbox works."
```

---

### Task 7: Prove it on a preview deploy

The one assumption this plan rests on: Vercel serves this project zero-config from `public/` with no framework detected, and functions in `api/` **should** still deploy. That is assumed, not proven. Prove it before trusting the form.

**Files:** none — verification only.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/magazine-redesign
```

Vercel builds a preview. Take its URL from the GitHub deployment.

- [ ] **Step 2: Confirm the function deployed at all**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X GET "<preview-url>/api/contact"
```

Expected: `405` — the handler is live and rejecting GET. A `404` means `api/` was **not** picked up: add an explicit `functions` block to `vercel.json` and redeploy before going further.

- [ ] **Step 3: Set the key**

Add `RESEND_API_KEY` in the Vercel project's environment variables for Preview and Production. Do not put it in any file. Redeploy the preview so it picks the variable up.

- [ ] **Step 4: Submit for real**

Fill the form on the preview and send. Confirm the mail arrives at pr@marinamogilko.co, that Reply-To is the address you typed, and that replying reaches it.

- [ ] **Step 5: Confirm the bot traps**

```bash
curl -s -X POST "<preview-url>/api/contact" -H 'Content-Type: application/json' \
  -d '{"name":"Bot","email":"b@x.com","topic":"Podcast guest","details":"spam","website":"http://spam"}'
```

Expected: `{"ok":true}` and **no email arrives.**

- [ ] **Step 6: Check the pages on the preview**

Homepage at 1440px and 375px; two episode pages; confirm header anchors jump correctly from an episode page back to the homepage sections.

- [ ] **Step 7: Merge**

Open the PR, and merge once the preview is clean. Production deploys from `main`.

---

## Known gap, carried deliberately

Resend needs SPF and DKIM records on `marinamogilko.co` before mail sends from `forms@marinamogilko.co`. That needs DNS access this project does not have. **Until those records exist, Task 7 Step 4 will fail or land in spam** — send from Resend's shared `onboarding@resend.dev` in the interim by changing the `from` line, and switch to `forms@` once the records are in. Do not treat a spam-foldered test as a passing test.
