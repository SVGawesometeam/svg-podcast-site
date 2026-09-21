# Magazine redesign + lead capture form — design

**Date:** 2026-09-21
**Repo:** `SVGawesometeam/svg-podcast-site` (serves marinamogilko.co via Vercel)
**Status:** awaiting review

## Goal

Two changes to marinamogilko.co:

1. Replace the homepage with the magazine design mocked at
   `https://silicon-valley-magic.lovable.app`, and carry its header and footer
   onto the 117 existing episode pages.
2. Add a lead capture form, mocked at `https://ai-lead-response.lovable.app`,
   at the foot of the homepage. Every submission is emailed to
   **pr@marinamogilko.co**.

The mock is built on the SVG design system already documented in the
dashboard's CLAUDE.md — `#E63333` accent, `#000` text, `#F5F5F5` ground, bold
condensed all-caps headlines. This is not an arbitrary restyle; it brings the
public site in line with the system used internally.

## Decisions

Settled with Marina on 2026-09-21. Recorded with rationale so a later reader
does not re-litigate them.

| # | Decision | Rationale |
|---|---|---|
| 1 | Homepage fully redesigned; episode pages get **new header and footer only** | Episode pages are the SEO surface — transcripts, JSON-LD, sitemap. Restyling their bodies in the same change multiplies risk for little gain. Shared chrome keeps navigation continuous. |
| 2 | Form backend is a **Vercel serverless function calling Resend** | Lives in the same repo as the site; submissions are not held by a third party; Marina controls `marinamogilko.co` DNS, so the sending domain can be verified and mail lands in the inbox rather than spam. |
| 3 | The `WANT YOUR BRAND ON THE PODCAST?` block and its `partnerships@` mailto **stay on the page** | Existing routing that works; some senders prefer a plain mail link. |
| 4 | The form's dropdown **keeps `Brand deal / sponsorship`**, and every submission goes to **pr@** | Simplest build, one destination, no routing logic in the function. Accepted cost: brand deals arriving via the form are forwarded to partnerships@ by hand. |
| 5 | The mock's copy is used **verbatim** | Explicit instruction. Note this narrows the show's positioning to AI and makes a public reach claim ("Millions / FOLLOWING ALONG"); both are Marina's call and are reproduced as written. |

## Constraint discovered during design

**`build.js` cannot re-render an existing episode page.** At `build.js:161`, if
`public/episode/<id>/index.html` already exists the episode is skipped and its
metadata is read back out of the built HTML by `readExistingEpisodeMeta()`.
A normal build regenerates only `index.html`, `sitemap.xml` and `llms.txt`.

Forcing a re-render would mean deleting the pages and re-fetching 117
transcripts from YouTube — which throttles datacenter IPs — and would put the
hand-applied corrections in `transcript-fixes/` at risk.

**Therefore episode chrome is patched in place**, by a one-off script. This is
already the repo's idiom: `scripts/inject-newsletter-cta.js` and
`patch-jsonld.js` both perform post-hoc surgery on built HTML.

## Architecture

### Current

- `build.js` (990 lines) — `renderHomePage()` at 364, `renderEpisodePage()` at
  610, each with an inline `<style>` block. Owns `SHARED_HEAD` (322),
  `SHARED_HEADER` (333), `SHARED_FOOTER` (345). The homepage uses `SHARED_HEAD`
  and `SHARED_FOOTER` but **not** `SHARED_HEADER` — it renders its own.
- `batch-build.js` (780 lines) — carries its **own copies** of all three
  constants and its own episode `<style>` block. A genuine fork of the episode
  template, kept in sync by hand.
- No `api/` directory. `vercel.json` contains redirects only. `package.json`
  has one dependency (`youtube-transcript`).

### Target

```
lib/chrome.js                      NEW — single source for head, header,
                                   footer and chrome CSS
build.js                           requires lib/chrome.js; renderHomePage()
                                   rewritten
batch-build.js                     requires lib/chrome.js; local copies deleted
scripts/restyle-episode-chrome.js  NEW — one-off in-place patcher for the 117
                                   existing episode pages
api/contact.js                     NEW — Vercel function, POST handler
```

## Phase 1 — Extract the chrome (prerequisite, no visual change)

Move `SHARED_HEAD`, `SHARED_HEADER`, `SHARED_FOOTER`, the `ICONS` map and the
header/footer CSS into `lib/chrome.js`. Both builders require it. Delete the
duplicated definitions from `batch-build.js`.

**Verification gate:** run the build before and after the refactor;
`git diff public/` must be **empty**. Committed on its own, so a regression here
is trivially bisectable.

This phase must land before Phase 3 touches the chrome, so the new header has
exactly one definition rather than two that can drift.

## Phase 2 — Homepage

`renderHomePage(episodes)` is rewritten. Section order, with copy verbatim from
the mock:

1. **Header** — black bar. `SILICON VALLEY GIRL` wordmark, `WITH MARINA
   MOGILKO` beside it, nav `Episodes` / `Host` / `Subscribe` as in-page
   anchors.
2. **Hero** — eyebrow `THE PODCAST THAT DECODES THE VALLEY`; headline
   `WHAT AI / MEANS FOR / YOUR DAY` with `YOUR` in `#E63333`; the paragraph
   "Marina Mogilko interviews the founders and scientists building AI, then
   asks them the only question that matters: what can I actually do with this
   today?"; button row `Watch on YouTube` / `Spotify` / `Apple` /
   `Latest episode →`; the newest episode's thumbnail with a
   `NEW EPISODE WEEKLY` badge. `Latest episode →` links to the newest
   episode's own page (`/episode/<id>/`).
3. **Cover story** — eyebrow `LATEST`, heading `THIS WEEK'S COVER STORY`, then
   the newest episode: `<DATE> · <DURATION> · WITH <GUEST>`, title, description,
   `Play on YouTube` / `Spotify`. Generated from episode data, not hardcoded.
4. **About the show** — heading `ABOUT THE SHOW`, three paragraphs verbatim.
   The guest list ("Andrew Ng, Fei-Fei Li, Sal Khan, Anne Wojcicki and Shishir
   Mehrotra") is static copy.
5. **The archive** — heading `THE ARCHIVE`, anchor `#episodes`. A card grid
   replacing the current flat list. Each card: thumbnail,
   `<GUEST> · <DURATION>`, title in caps. **All 117 episodes render**, newest
   first, excluding the cover story — the internal linking matters for SEO and
   the page already carries them today.

   The mock's `All episodes →` link is **dropped**. It implies a subset is
   shown and a fuller list lives elsewhere; here every episode is already on
   the page, so the link would point at itself. This is the one deliberate
   departure from the mock, and it is a consequence of the real data rather
   than a design preference.
6. **Meet the host** — black band, anchor `#host`. Heading `MEET THE HOST`,
   `MARINA MOGILKO`, bio verbatim, stat row `Weekly / NEW EPISODES`,
   `Millions / FOLLOWING ALONG`, `SF / BASED IN THE VALLEY`.
7. **Partnerships** — eyebrow `PARTNERSHIPS`, `WANT YOUR BRAND ON THE
   PODCAST?`, red pill linking `mailto:partnerships@marinamogilko.co`.
   Unchanged behaviour, new styling.
8. **Newsletter** — `GET THE / WEEKLY BRIEF`, "One email a week: the AI idea
   worth your attention, and exactly what to try with it.",
   `Subscribe to the newsletter` pointing at the existing Beehiiv URL already
   in `build.js`. Anchor `#subscribe`.
9. **Follow along** — `FOLLOW ALONG`, buttons for YouTube, Spotify, Apple,
   Instagram, TikTok, LinkedIn, X, reusing the existing `ICONS` map and URLs.
10. **Work with Marina** — the form (Phase 4).
11. **Footer** — `SILICON VALLEY GIRL`, `© 2026 Marina Mogilko · Made in
    Silicon Valley`.

Head metadata (`<title>`, OG, Twitter, `PodcastSeries` JSON-LD) is **preserved
as-is**. The mock's `<title>` is not adopted — changing an indexed title is an
SEO decision, not a design one, and was not part of the request.

Responsive: single column below 768px; hero headline scales with `clamp()`;
archive grid collapses 3 → 2 → 1. No horizontal scroll at 375px.

## Phase 3 — Episode page chrome

`renderEpisodePage()` picks up the new header and footer from `lib/chrome.js`
automatically, so every **future** episode is correct with no further work.

For the 117 **existing** pages, `scripts/restyle-episode-chrome.js`:

- Replaces the region between `<header class="site-header">` and `</header>`,
  the `<footer class="site-footer">…</footer>` line, and the chrome-only CSS
  rules inside the page's `<style>` block.
- Touches nothing else. Transcript markup, player embed, tab switcher,
  `About the Guest`, related episodes, JSON-LD: byte-identical.
- `--dry-run` prints a unified diff for one page and writes nothing.
- **Idempotent** — running twice produces the same output, so a partial run is
  safely repeatable.
- Aborts on any page whose structure does not match, listing the offenders,
  rather than writing a half-patched file.

**Verification:** diff three sample pages (an early one, a recent one, a
compilation) and confirm only the header, footer and chrome CSS regions moved.
Confirm `patch-jsonld.js` output is unaffected.

## Phase 4 — The form

### Markup

Section at the foot of the homepage. Heading `PITCH MARINA ANYTHING`, dek
"Brand deals, podcast guests, speaking, press, partnerships — anything at all.
Tell us what you have in mind and the team will get back to you."

| Field | Name | Required | Type |
|---|---|---|---|
| Your name | `name` | yes | text |
| Email | `email` | yes | email |
| Company (optional) | `company` | no | text |
| What's this about? | `topic` | yes | select |
| Budget or timeline (optional) | `budget` | no | text |
| Details | `details` | yes | textarea |

`topic` options, in order: Brand deal / sponsorship · Podcast guest · Speaking
/ event · Press / interview · Partnership · Investment · Job / hiring ·
Something else.

Submit button: `SEND OPPORTUNITY`.

### `api/contact.js`

Vercel serverless function. Rejects anything but `POST`. Validates server-side —
required fields present, `email` shaped like an address, per-field length caps
(name 200, company 200, budget 200, details 5000). Sends via Resend's REST API
using built-in `fetch()`, so **no new npm dependency is added**;
`package.json` keeps its single entry.

```
To:       pr@marinamogilko.co
From:     forms@marinamogilko.co   (verified sending domain)
Reply-To: <submitter's email>
Subject:  [SVG site] <topic> — <name><, company if given>
Body:     every field, labelled, plus submission time
```

`Reply-To` set to the sender is the detail that makes this usable: hitting
reply in the inbox answers the person directly.

Secrets: `RESEND_API_KEY` as a Vercel environment variable. Never committed,
never logged, never echoed in a response body.

### Anti-spam

A public form pointed at a real inbox will be found by bots.

- **Honeypot** — a visually hidden field bots fill. If filled, respond `200`
  and silently discard, so the bot learns nothing.
- **Minimum time-to-submit** — a render timestamp in a hidden field; a
  submission under ~3 seconds is rejected.
- **Server-side validation and length caps** as above.

Honest limit: real rate limiting on serverless needs a shared store (Vercel KV
or Upstash) — deliberately out of scope for launch. If spam appears, add
Cloudflare Turnstile; it drops in without reshaping the handler.

### States and accessibility

- Success replaces the form with a confirmation, in place, no navigation.
- **Errors never discard what was typed.** The failure message names what went
  wrong and the values stay in the fields.
- The button disables and reads `Sending…` in flight, so double submits can't
  happen.
- Every field has a real `<label>` (the mock's uppercase labels are styling, not
  placeholders). Visible focus rings. Errors linked by `aria-describedby`.
  Invalid fields carry `aria-invalid`.
- `<noscript>` fallback: a line pointing at `mailto:pr@marinamogilko.co`, so the
  page is never a dead end without JS.

## Verification plan

1. Phase 1: `git diff public/` empty after the refactor.
2. Build locally; review `public/index.html` in a browser at 1440px and 375px.
3. Screenshot the homepage and two episode pages, before and after.
4. Confirm `sitemap.xml` and `llms.txt` are unchanged by the redesign.
5. Confirm episode-page JSON-LD is byte-identical after the chrome patch.
6. Deploy the branch as a Vercel **preview** and submit the form end to end,
   confirming arrival at pr@ with a working Reply-To — **before** merging.
7. Submit with the honeypot filled and confirm nothing arrives.

## Risks and dependencies

| Risk | Handling |
|---|---|
| **`api/` may not be picked up.** Vercel serves this project zero-config from `public/` with no framework detected. Functions in `api/` should still deploy, but this is assumed, not proven. | Prove it on a preview deploy with a hello-world handler **before** building the form UI on top of it. Fallback: explicit `functions` config in `vercel.json`. |
| **Resend needs SPF/DKIM records on `marinamogilko.co`.** | **Blocked on Marina** — requires DNS access this project does not have. Until done, mail sends from Resend's shared domain and is more likely to be filtered. |
| Chrome patcher mangles an episode page | `--dry-run` first; abort-on-mismatch; idempotent; the 117 pages are in git, so any bad write is one `git checkout` away. |
| Copy makes a public reach claim ("Millions") | Flagged and confirmed as Marina's call. Reproduced verbatim as instructed. |
| Homepage weight grows with a 117-card grid | Current page is already 92 KB with all 117 present. Thumbnails stay lazy-loaded. Measure after build; if it regresses badly, paginate the archive. |

## Out of scope

- Restyling episode page **bodies** — transcript, player, tab switcher.
- Changing `<title>` or meta descriptions.
- A standalone `/work-with-marina` page. The form lives on the homepage only.
- Routing brand deals to partnerships@ programmatically (decision 4).
- Rate limiting beyond honeypot and timing.
- Auto-publishing new episodes when a video goes live — a real gap, tracked
  separately; unrelated to this work.
