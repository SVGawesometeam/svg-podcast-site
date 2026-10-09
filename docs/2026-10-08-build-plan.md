# Build plan: how the v2 plan gets built without breaking the transcript pages

Companion to `2026-10-08-websites-geo-seo-plan.md`. That document says what and why; this one says how, in what order, with which checks, and what the team has to hand over. Tilda is being retired, so the media kit is built here as `/partnerships/`.

## 1. The rules that protect the podcast pages

The 123 episode pages with their transcripts are the asset. These rules hold for every release:

1. **URLs never change.** `/episode/<videoId>/` stays, forever. Nothing in this plan adds a redirect from an episode page.
2. **Episode HTML is never hand-edited by a release.** Pages change only through the build, and only after the build proves it can reproduce the current pages byte for byte (Release 2). Until then, no release touches `public/episode/`.
3. **Transcript text is diffed on every build.** A script normalises the transcript text of every page before and after and fails the build on any difference that is not listed in that release's notes.
4. **Every release is a branch, a pull request and a preview.** Vercel builds a preview URL for the branch. The team looks at the preview; merging to `main` is the deploy. I open pull requests; I do not merge the first releases.
5. **Tests, then security review, then push.** The existing 75 tests plus the new ones run locally before every push. The security review runs on the diff before every push. A release that fails either does not get pushed.
6. **One change per pull request.** A template change and a copy change never ship together, so either can be rolled back alone.
7. **Rollback is one revert.** Each pull request names the commit to revert to. Static output means a revert restores the exact previous site.
8. **New episodes keep flowing.** The producer's current process keeps working throughout. Each release's extraction step is re-runnable, so an episode added mid-way is picked up by the next run.

## 2. What I can verify from here, and what I cannot

This cloud environment cannot reach `marinamogilko.co`, `partnerships.marinamogilko.co` or the Railway backend API (the network policy blocks them). What that means in practice:

- I can build, test, render and screenshot every page locally (a local server plus the pre-installed browser), and I attach desktop and mobile screenshots to each pull request.
- I cannot check the live site, the Tilda page or the `podcast.` subdomain myself. Those checks are listed per release as "team verifies on the preview or live".
- `node build.js` cannot fetch a new episode from the API here, but it rebuilds the homepage, directory, sitemap and llms.txt from the existing pages without the API, which is all the first releases need.
- If the team adds those three hosts to the environment's allowed network list, I can run the live checks myself. Otherwise the producer runs the two or three curl commands I put in each pull request.

## 3. Releases, in order

Each release lists scope, the gate that must pass, the security check, and what I need from the team. "Day" estimates are working time with no waiting; waiting on inputs or review is extra.

### Release 1: protect and fix (no template changes, about one day)

Scope: homepage canonical and shared `@id` entities (Person with `sameAs`, PodcastSeries, Organization); H1 without the suffix on the home and directory pages; contact-form routing table and the "Partnership" option removed; SVG Instagram added to the shared social list; navigation labels (Episodes, About Marina, Newsletter, Work with Marina, pointing at today's anchors until the pages exist); analytics tag if the team provides the GA4 ID; `podcast.marinamogilko.co` and `www` redirects in `vercel.json`; deletion of `batch-build.js` and the other legacy scripts; security headers in `vercel.json` (HSTS, X-Content-Type-Options, Referrer-Policy, frame protection, a permissive-enough CSP that keeps YouTube thumbnails and Google Fonts working).

Gate: `public/episode/**` untouched (diff empty); all tests pass; new tests for routing, headers and schema; screenshots of home and directory, desktop and mobile.

Security: the contact handler gets a per-IP rate limit and a size cap; subject and body are built from validated fields only; the routing table lives server-side; no secret enters the repo; the review runs on the diff.

Team: GA4 measurement ID (optional for this release); confirm the routing emails; confirm that Vercel preview deployments are on for this repository; after merge, verify the `podcast.` redirect from a browser.

### Release 2: data layer, byte-identical (about two days)

Scope: `content/site.json`, `content/topics.json`, `content/episodes/<id>.json` extracted from the 123 pages by a script; `build.js` rewritten to render from JSON. The output must be byte-identical to today's `public/` for every page. The old "skip if exists" behaviour goes away because the data layer replaces it. `transcript-fixes/` stays as the protocol. The producer's flow for a new episode becomes: add the ID, run the build (the API still supplies the draft), review, commit.

Gate: `git diff public/` empty after a full build; the extraction is re-runnable; tests for the extractor on three representative pages (interview, solo, compilation).

Security: the build reads only local files and the one API; no new dependency.

Team: nothing. This release is invisible to visitors and is the foundation for everything after it.

### Release 3: episode template v2 on six pilot pages (about two days, then a 14-day watch)

Scope: the template in section 5.3 of the plan, applied only to the six pilot pages by a flag in their JSON; ISO durations, individual performers, Clip markup for chapters, visible transcript with chapter headings as H2 anchors, sticky section nav, topic tags, guest `sameAs`, episode-level Apple and Spotify links where the team supplies them.

Gate: transcript text identical on all six (normalised diff); the other 117 pages byte-identical; schema validation script passes (required fields, ISO 8601, valid URLs); link checker passes; screenshots of all six on desktop and mobile; keyboard navigation works without JavaScript.

Security: no inline scripts beyond the existing ones; no third-party embeds added (the YouTube player stays a link plus thumbnail unless the team wants the iframe, which changes the CSP).

Team: episode-level Apple and Spotify URLs for the six; roles at recording confirmed; after merge, watch Search Console for the six pages for 14 days before Release 6 rolls the template to everything.

### Release 4: About page, newsletter page, legal pages (about one day)

Scope: `/about/` with the Person schema, the positioning sentence, facts from `site.json` with sources, a visible FAQ, speaking and press; `/newsletter/`; `/privacy/` and `/terms/` with the text from Tilda; footer links moved off the Tilda domain; sitemap and llms.txt regenerated; llms.txt claims reduced to what the About page can source.

Gate: tests for the new routes and the sitemap; HTML validation; screenshots.

Security: none beyond the diff review.

Team: biography facts with sources (plan section 8, item 4); counts with dates; the legal page texts; press list with dates; a portrait.

### Release 5: media kit as `/partnerships/` and Tilda retirement (about three days)

Scope: the page in section 5.7 of the plan, plus `/partnerships/speaking/`; the inquiry form reusing the Release 1 handler with brand-deal routing; redirect map from every Tilda URL (including `/plc`, `/ts` and campaign paths) in `vercel.json`; the DNS change for `partnerships.marinamogilko.co` is the team's action after the page is approved.

Gate: every Tilda URL in the sitemap resolves to the new page or a mapped page; form submission tested in a mail sandbox (Resend test mode), not against the team's inbox; screenshots; the page validates with placeholder-free content only (no "TBD" ships).

Security: the form is same-origin so no CORS opening is needed; logo and image files are team-supplied originals, not watermarked downloads; no analytics from Tilda carried over.

Team: the Tilda export (text and images) or the content filled into the template I provide; audience counts and demographics with dates; formats actually sold; partner logo permissions; the HubSpot quote (already in the doc); the Apple case-study sign-off; the speaker sheet content; the Tilda sitemap; the DNS change when approved.

### Release 6: topic hubs, directory filters, homepage v2 (about three days)

Scope: topic tags on all 123 episodes (I propose, the team confirms in one session); `/topics/<slug>/` for the first four hubs; `/episodes/` with search and filters, full list kept in HTML; homepage v2 in the section order from the plan; template v2 rolled to all pages once the Release 3 watch is clean.

Status 2026-10-09: tags proposed and applied; all ten hubs built (structure: question, episodes about it, episodes that touch it, sibling links, newsletter CTA; the editorial answer, the disagreements and the FAQ from plan section 5.5 are added per hub from `content/topics/<slug>.md` after review); `/episodes/` search and filters done; the homepage has a topic strip (full homepage v2 still open); v2 pages show topic links (v1 pages untouched until the rollout).

Gate: full-site transcript diff clean; every episode still linked from the homepage or the directory; the internal-link checker reports no orphans; Peec and Search Console baseline snapshot taken before merge.

Team: confirm tags; review hub answers in Marina's voice.

### Release 7: solo guide pages and the first answer guides (editorial pace)

Scope: the guide format on the three solo pilots, then rolling; `/guides/` for the first two questions. These are the only pages with new writing and they ship at the speed the team can review and source them.

Team: sources for the numbers; review.

### Release 8: publishing automation (about four days)

Scope: the GitHub Actions workflow in section 5.9 of the plan: YouTube feed poll, Trint transcript, speaker map with evidence, draft JSON, pull request with preview and checklist, CI checks. The producer's job becomes reviewing a preview and merging.

Gate: a dry run on an already-published episode reproduces its page within the agreed tolerance; a run with an unknown speaker fails loudly; secrets exist only in GitHub Actions secrets.

Status 2026-10-09, stage one built: the trigger (feed poll every 30 minutes, or a video id by hand), the draft import through the existing backend path, the rebuild, the link check and the review pull request with the checklist (`.github/workflows/new-episode.yml`, `scripts/new-episode.js`, `scripts/poll-youtube.js`, `scripts/pr-body.js`). Unknown speakers and empty fields are listed at the top of the pull request rather than failing the run, so the producer always has something to review. Not yet built: the Trint transcript with speakers (needs API access), the speaker map with evidence, and the LLM pass for summary and topics; today those come from the backend as before. Needs from the team: the channel id as the repository variable `YOUTUBE_CHANNEL_ID`, and one manual run of the workflow on an already-published id to see the pull request appear.

Security: the workflow reads the repository, and only the import job may push its own `episode/<id>` branch and open the pull request; nothing pushes to `main`; no secrets today (the feed and the backend are read without keys; a Trint key, when it comes, is a repository secret); the workflow never runs on pull requests from forks.

Team: Trint API access (or the decision to diarise in the backend); a YouTube Data API key; a decision on who merges.

## 4. Checks that run before every push

- `npm test` plus the new tests for that release.
- Full build, then `git diff --stat public/` reviewed against the release notes; transcript diff script clean.
- Internal link check over `public/`; schema validation script; HTML validation of changed pages.
- Local render of changed pages at 1280 and 390 pixels wide, screenshots attached to the pull request.
- Security review of the diff (secrets, injection, headers, dependencies, permissions), with the findings and their resolution listed in the pull request.
- Only then: push the branch, open the pull request with the rollback commit named, and hand over for review.

## 5. Timing

Releases 1 and 2 can be built today in this session; they are the safest and need almost nothing from the team. Releases 3 to 8 are sequential and each waits for a review on its preview and for the inputs listed above, so the full build is a matter of days of work spread over two to three weeks of calendar time, paced by review and by the team's inputs. Overnight runs are fine for building branches and pull requests; nothing deploys overnight because a merge to `main` is the deploy and a person does that.

## 6. Inputs checklist (copy of plan section 8, with the release that needs each)

| Input | Needed for |
| --- | --- |
| Routing emails confirmed; GA4 ID (decided 2026-10-08: analytics goes through the team's Google Tag Manager container GTM-WZ57XVB, now loaded on every page; the team checks in Tag Manager that the container holds a GA4 tag and nothing left over from Tilda); Vercel previews confirmed on | R1 |
| Episode-level Apple and Spotify URLs for the six pilots (done for five of six on 2026-10-08, see `content/PLATFORM-LINKS.md`; the sixth, `L1EmhDYc11g`, has no podcast release found); roles at recording | R3 |
| Biography facts (confirmed 2026-10-08 from the media kit page; source links to follow and go into `content/site.json`); counts (done 2026-10-09: weekly GitHub Action reads the dashboard's audience API into `content/audience.json`; the team runs it once by hand from Actions to confirm the commit and the Vercel deploy); legal texts (received, built); press list (received, built); portrait (received) | R4 |
| Tilda export or filled template; demographics; formats; logo permissions; case-study sign-off; Tilda sitemap; DNS change | R5 |
| Topic tags: proposed 2026-10-09 (`content/topics.json`, reasoning per episode in `content/topics-proposal.json`), applied to all 123 episodes and built as ten hubs; the team confirms or edits names, questions and assignments on the preview. Hub answers in Marina's voice: go into `content/topics/<slug>.md` once reviewed; the hub renders them when the file exists | R6 |
| Sources for numbers; guide review | R7 |
| Trint API access or backend diarisation decision; YouTube API key; merge policy | R8 |
| RSS feed URL (host identified on 2026-10-08: Spotify for Creators, formerly Anchor; the feed URL is in its settings) | R1 onward |
