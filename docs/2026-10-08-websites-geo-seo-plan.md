# Silicon Valley Girl websites: GEO, SEO, AEO and human-facing plan (v2)

Prepared 8 October 2026 for the Marina Mogilko team. Replaces the 8 October "actionable website improvement plan" (reviewed critically in section 2).

**Sites:** https://marinamogilko.co/ (this repository, Vercel) and https://partnerships.marinamogilko.co/ (Tilda, not in any repository).

**What this plan is based on:** the full contents of this repository (build pipeline, 123 episode pages, tests, playbooks), the two Google Docs with the team's edits and comments, Eugenia's notes, the Apple Event 2026 case-study doc, and the Peec project "Silicon Valley Girl" queried directly for 8 September to 8 October 2026. The two live sites could not be fetched from this environment (network policy), so live-only checks are listed as day-one verification items rather than asserted.

---

## 0. The short version

1. **The site is not the problem AI engines have with you. Its content format is.** Across 2,871 tracked AI answers in 30 days, owned pages were retrieved 68 times. Apple Podcasts pages were retrieved 9,064 times, YouTube 3,896, Feedspot 2,321, Spotify 1,832, LinkedIn 1,911, Reddit 1,159. The brand's overall AI visibility is 4.7 percent. Where the brand wins, Apple, Feedspot, YouTube and Reddit carry it. Where it loses (career and skills questions), the winners are how-to guides and listicles, not podcast pages.
2. **The solo content already works. It is just credited to YouTube.** Marina's "How to Build a Profitable Personal Brand with AI" video is cited 27 times in the career prompts, from youtube.com, not from its own page on the site. Eugenia's Search Console observation (solo videos bring visitors) points the same way. Solo videos stay on the homepage and become the model for a new "guide" page format.
3. **Three things Claude can fix alone this week:** the duplicate host `podcast.marinamogilko.co` that AI engines are retrieving, the missing identity data (no homepage canonical, Person schema with only a name, invalid durations), and the contact-form routing. None of these risk the GEO infrastructure.
4. **The biggest technical blocker to everything else is that the build cannot re-render an existing page.** Every template change today is a one-off patch script over 123 HTML files. Step one of the content work is a small data layer (`content/episodes/<id>.json`) so that pages, topic hubs, filters, llms.txt and the sitemap all render from the same reviewed data. This is also the foundation of the publishing automation.
5. **Media kit:** fix the facts on Tilda now (two hours of team work), then rebuild it as `/partnerships/` inside this repository so it shares the design, the form backend, the structured data and the deploy pipeline. Combine into one site, not one page: the media kit gets its own entry in the navigation ("Work with Marina"), not a tab in the middle of the podcast.
6. **Distribution is a first-class workstream, not a footnote.** Apple Podcasts show and episode descriptions, transcripts in the RSS feed, Feedspot and editorial list placements, and honest community presence move the numbers more than any on-site change. This needs team owners, not Claude.
7. **Publishing becomes automatic but gated:** a new YouTube upload opens a pull request with a preview page built from a diarised transcript; the producer reviews a checklist and merges. No more "write to Claude for every episode".

---

## 1. What the evidence says

### 1.1 Peec, 8 September to 8 October 2026 (queried directly)

**Brand visibility by topic** (share of AI answers that mention Silicon Valley Girl; the strongest competitor in brackets):

| Topic | SVG visibility | Answers in topic | Leader |
| --- | --- | --- | --- |
| Women in tech podcasts | 28.0% | 93 | SVG (share of voice 94%) |
| LinguaMarina | 11.8% | 93 | SVG |
| AI podcasts hosted by women | 7.5% | 93 | SVG (share of voice 100%) |
| Podcasts with tech CEO interviews | 6.8% | 557 | Masters of Scale 28.2% |
| AI and automation | 1.1% | 370 | Lex Fridman 27.0% |
| AI skills and careers | 0% | 371 | nobody above 0.5% |
| AI career advice for professionals | 0% | 93 | All-In 1.1% |
| Future of jobs | 0% | 93 | Lex Fridman 4.3% |
| All prompts | 4.7% | 2,871 | Diary of a CEO 16.1% |

Two readings matter. First, the "0%" topics are small samples (93 answers) in which **every tracked podcast also scores near zero**, because the prompts there are not podcast prompts. They are "what AI skills should I learn in 2026", "how to start an AI business with no money", "how to build a personal brand with AI", "AI business ideas you can start with no coding". The sources that win them are listicles and how-to guides (TripleTen, Forbes, Coursiv, Shopify, Microsoft WorkLab) and individual YouTube videos. A curated "episodes about careers" page will not win those prompts. A direct, sourced answer page can. Second, the winning topics are won by a positioning the sites never state: a woman-hosted AI and tech podcast. That phrase should appear on the About page, the homepage, the Apple Podcasts description and the media kit.

**Owned URLs retrieved by AI engines in 30 days:**

| URL | Retrieved | Cited |
| --- | --- | --- |
| /episode/ktpNFfpJ5rw (Ryan Roslansky) | 29 | 10 |
| /episode/PR__eFQsnhg (Thomas Dohmke) | 13 | 14 |
| / (homepage) | 10 | 4 |
| podcast.marinamogilko.co/episode/PTZ5iN9nDkY (Yossi Matias, **wrong host**) | 9 | 3 |
| /episode/U7PcyE0p54s (Aravind Srinivas) | 4 | 0 |
| /episode/PTZ5iN9nDkY (Yossi Matias) | 2 | 0 |
| /episode/213rSCulKUQ (career compilation) | 1 | 0 |

Total: 68 retrievals, 31 citations. The domain is not in Peec's top 40 sources for this prompt set.

**Where the citations in the career topics actually go:** Apple Podcasts category pages for other shows (98 and 88 citations), TripleTen's AI skills listicle (94), Microsoft WorkLab (86), Forbes personal-brand listicle (57), Coursiv's "start an AI side business with no money" guide (55), and **youtube.com/watch?v=KfoenLbhOTI, Silicon Valley Girl's own personal-brand video (27 citations)**. The site page for that video exists at /episode/KfoenLbhOTI/ and was not retrieved once.

**Peec's own recommendation for an owned page:** a content-optimisation action on /episode/L1EmhDYc11g/ ("5 BEST AI Businesses To Start before 2026"), scored 25 out of 100. The suggestions are a template for every solo page: a short quotable summary at the top that answers the title's question, headings inside the transcript ("GPT wrappers: what they are and how to build one"), a stated reason behind each claim, a source for each number, and "say who Reid Hoffman is at the first mention and link to a page that shows it". Peec also lists pending off-site actions: editorial pitches (Forbes, Investopedia, USA Today, Business Insider), listicle inclusions (ODSC, 99signals, quicklets.ai, Business Insider), and community presence (Quora, Reddit, YouTube). The team has rejected Peec's content briefs for self-published "best podcasts" listicles; that was the right call.

**Not connected:** Google Analytics (Peec cannot report AI referrals) and server logs (Peec cannot report AI crawler visits). The site markup contains no analytics tag at all. Search Console is verified (two verification files are in `public/`) and is the only traffic data the team has.

### 1.2 The repository and the live main site

| Area | Finding | Consequence |
| --- | --- | --- |
| Inventory | 123 episode pages plus homepage and `/episodes/`, 125 sitemap URLs. Every page has a canonical, PodcastEpisode JSON-LD, a full transcript (shortest 724 words, median 5,008). No empty guest fields, no ", ," artefacts remain. | The transcript project is done. Do not restart it. |
| Build | `build.js` skips any episode whose HTML already exists and reads its metadata back out of the HTML. Template changes are applied by one-off patch scripts (`scripts/`). The fix-application machinery in `build.js` is written but never called. `batch-build.js` is a legacy fork hard-coded to `https://podcast.marinamogilko.co`. | A reviewed data layer is a prerequisite for every template change in this plan. Peec confirms the `podcast.` host is live and being retrieved, so it must redirect. |
| Homepage | No canonical. PodcastSeries schema with an author Person that has only a name. Positioning copy: "the only question that matters" (Alexa's objection stands). Stats read "Weekly / Millions / SF". Hero is a pinned episode, cover story is the newest. Six archive cards, two of them solo. | Fix identity data; replace copy; keep format-labelled solo links. |
| Episode template | H1 repeats the "— Silicon Valley Girl Podcast" suffix. Sections use h3 only. Show notes, timestamps and transcript are JavaScript tabs with `display:none`; the transcript is in the HTML but hidden by default. Duration is "24 MIN" (not ISO 8601). Compilations carry one Person named "Sal Khan, Alex Mashrabov, …". No guest `sameAs`, no episode-level Apple or Spotify links, no topic tags. | Template v2 in section 5.3. |
| Directory | `/episodes/` lists all 123 with no search, filter or format label. | Section 5.6. |
| Redirects | Everything under the old `/podcast/*` and `/ru/*` paths 301s to the homepage, except Roslansky. | If Search Console still shows impressions for old slugs, map them to the matching episode. Low priority. |
| Contact form | All submissions go to pr@; the dropdown still has "Partnership". Validation and tests exist. | Server-side routing table from the team's doc, one small change. |
| Social links | Instagram points only to the podcast account; TikTok to @linguamarina; the main SVG Instagram is missing. | One-line change in `lib/chrome.js`. |
| llms.txt | Hand-written facts: "1.55M+ subscribers" (the media-kit doc says 1.59M), "first creator to receive VC funding as an individual", 18M+ audience, awards. | One source of truth for facts (About page), then llms.txt and schema copy it. |
| Tests | 75 passing tests covering the homepage, chrome, form fields and validation. | Release gates can be automated, not just described. |
| Analytics | None in markup. | Add GA4 (needed for Peec AI-referral reporting) or Vercel Analytics. Decision for the team; GA4 recommended because Peec reads it. |

### 1.3 The media kit (from the team's doc, its comments, and the previous plan's live review)

Confirmed by the team's own comments and ready to use: HubSpot testimonial from Brandon Huang (Manager, Global Creator Partnerships); speaker credits "HubSpot Inbound 2025 judge" and "Cannes Lions 2026"; partners to add "Cisco, MongoDB, Magnific, Microsoft Foundry, IBM, TED"; follower counts (linguamarina 8.9M, SVG YouTube 1.59M, Instagram 1.3M, LinkedIn 82K, X 20.6K); a guest shortlist of 15 names. The Apple Event 2026 doc is a finished case study in all but layout: 22 posts, 30.2M post-level views, a 16.3M-view Reel, newsletter sent to 20,511 subscribers at a 49.27% open rate, with links to every asset.

Still wrong on the live page according to the doc: Linguamarina Inc. leads; "350,000 new subscribers monthly" with no date; a number visually assigned to the wrong account; "Case Study" in the menu with no case studies; no formats, no demographics; duplicated guest blocks with roles frozen at recording time; a Lingoda affiliate link in the footer; mixed fonts; a watermarked image; a hero image with stray letters; intermittent 502s; email-only contact.

---

## 2. Critical review of the 8 October plan

The previous plan is careful and most of its guardrails are right. It is kept as the source of the release gates, the fact-verification stance, the copy drafts and the "no domain migration" decision. The table lists where this plan differs and why.

| Previous plan | Verdict | Why |
| --- | --- | --- |
| Treats GEO mainly as on-site structure (headings, schema, About page, topic pages); distribution is "supporting work, separate from website code", medium priority. | **Rebalanced.** Distribution becomes workstream D with named owners and runs in parallel from week one. | 68 owned retrievals against 9,064 for Apple. The site cannot out-structure that gap; the Apple, YouTube, Feedspot and Reddit surfaces have to carry the brand into the answers, and the site has to be the page those surfaces link to. |
| Topic pages (M3) as "curated resources" with 4–8 episode links are the main answer to the 0% career topics. | **Split into two page types.** Topic hubs for "podcasts about X" prompts; answer guides for "what should I learn / how do I start" prompts (section 5.5). | The cited sources in those topics are how-to guides and listicles. A list of episodes is the wrong shape for "what AI skills should I learn in 2026". |
| Solo videos: "retain useful solo content". | **Strengthened to "solo pages are the pilot for the guide format".** | Peec: the solo personal-brand video is already the brand's only cited asset in the career topics, via YouTube. The site page should be the version that gets cited. |
| "Copy transcripts across external sites: do not make bulk duplication a launch requirement." | **Agreed, and replaced with the legitimate mechanism:** transcripts and chapters published in the podcast RSS feed, so Apple, iHeart and Listen Notes carry them natively. | Eugenia's data shows third-party transcript copies get cited. You cannot control Singju Post, but you control the feed. |
| Does not mention `podcast.marinamogilko.co`. | **Added as a day-one fix.** | Peec retrieved the Yossi Matias page from that host nine times. It splits the signal. |
| Media kit stays on Tilda; "do not assume both sites share one codebase". | **Changed:** fix facts on Tilda now, rebuild as `/partnerships/` in this repository within the next release, 301 the subdomain. | Tilda cannot be reviewed or tested by Claude, is the source of the 502s and the broken image, and keeps the brand's identity data split across two systems. One domain also pools authority. |
| About page, FAQ markup retired, llms.txt low priority, no popup, defer partner offers, no domain migration. | **Kept.** One addition: register `siliconvalleygirl.ai` / `.co` / `.io` / `siliconvalleygirlpodcast.com` defensively (about $140 for the first year) and point them at the main site. Registering is not migrating. | Cheap brand protection; the migration question stays closed until there is a measured reason to open it. |
| Release 0 baseline "must not postpone simple fixes", 4-week schedule. | **Kept the gates, replaced the schedule.** Work is split into "Claude alone" and "needs team input" so editorial items do not block technical ones (section 6). | Case studies, demographics, formats and the RSS host are team inputs with no code dependency. |
| M8 "automation can prepare a draft". | **Made concrete** (section 5.9). | The team asked for it explicitly, and the current manual loop is the reason template changes are expensive. |
| Media-kit audience "do not repeat the document's suspected visual misassignment as a confirmed error". | **Kept**, with the doc's counts listed as the numbers to publish once the team confirms the date. | |
| Duration ISO 8601, individual performers, canonical, `webFeed` fix, shared `@id` identifiers. | **Kept, with VideoObject `hasPart` Clip markup for chapters added.** | Chapters already exist on every page; Clip markup is what Google uses for key moments in video results. |
| "Hidden tab labels are not document headings." | **Kept and extended:** the transcript stops being hidden by default. | Hidden content is indexed with less weight, and chapter headings inside a hidden panel do nothing for a reader. |
| Topic pages for health and education "when editorial capacity supports them". | **Kept as later**, but the taxonomy is fixed now so every episode can be tagged once (section 5.2). | |

Two things the previous plan got right that the team's docs push against, and that this plan also keeps: do not remove solo videos from the homepage (Eugenia's Search Console evidence plus the Peec citation), and do not migrate domains now.

---

## 3. Decisions on the open questions

**One site or two?** One codebase, two entry points, one navigation. `marinamogilko.co` is the home of Marina and the podcast. The media kit becomes `marinamogilko.co/partnerships/`, reachable from the main navigation as "Work with Marina" and from the footer. `partnerships.marinamogilko.co` redirects there, path by path, including `/plc` and `/ts` (the legal pages the main site's footer links to today) and the campaign and resource paths in the Tilda sitemap. Until the rebuild ships, the Tilda page stays live with its facts corrected.

**Navigation (both surfaces):** Episodes · Topics · About Marina · Newsletter · Work with Marina. Labels, not anchors: each is a real page with its own URL and title. "Host" becomes "About Marina". "Subscribe" becomes "Newsletter" (Nastya's point). "The archive" becomes "All episodes" (Alexa's point).

**Solo videos on the homepage:** stay, in a section labelled "Practical AI with Marina" with the format shown on every card ("Solo video", "Interview", "Compilation"). Nastya's instinct to simplify is right for the top of the page: one hero episode, one latest episode, then topics, then a guest row, then the practical section. Clear hierarchy, nothing removed.

**Numbers instead of "Millions":** yes, with a date, and only numbers the team confirms. Candidate line: "1.59M subscribers on YouTube · 123 episodes · based in Silicon Valley since 2015" (the year is a placeholder until confirmed). The same numbers feed llms.txt, the Person schema and the media kit from one file.

**"Only one question" copy:** replaced with Alexa's version, with "founders and scientists" widened per Nastya: "founders, tech leaders, researchers, and innovators".

**X and TikTok order, partner promo-code section, newsletter popup:** cosmetic, later, and no, respectively. A promo-code page is a reasonable audience-facing page later (`/partners/`), not part of this plan.

**Domain:** no migration. Register the four Silicon Valley Girl domains defensively.

**Tabs on the episode page:** replaced by visible stacked sections with a sticky in-page nav. Humans scan, machines read, nobody depends on JavaScript.

---

## 4. Target architecture

### 4.1 URL map (main site)

| URL | Status | Purpose |
| --- | --- | --- |
| `/` | exists, revised | Positioning, hero, latest, topics, guests, practical videos, Marina, newsletter, work with us |
| `/episodes/` | exists, revised | Full directory with search and filters; every episode linked in HTML regardless of filters |
| `/episode/<videoId>/` | exists, template v2 | Unchanged URLs, forever |
| `/about/` | new | Marina's biography, facts with sources, FAQ, speaking, press; Person schema with `sameAs` |
| `/topics/<slug>/` | new | Topic hubs (section 5.5) |
| `/guides/<slug>/` | new, phase 3 | Answer guides for how-to prompts (section 5.5) |
| `/newsletter/` | new, small | What Future Proof is, latest public issues, Beehiiv form |
| `/partnerships/` | new, phase 2 | Media kit (section 5.7), plus `/partnerships/speaking/` |
| `/privacy/`, `/terms/` | new | Moved from Tilda `/plc` and `/ts` |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | exist | Regenerated from the data layer |

### 4.2 Data layer

```
content/
  site.json            facts: counts with "as of" dates, bio, sameAs links, awards with sources
  topics.json          taxonomy: slug, name, question the hub answers, description
  episodes/<id>.json   title, format (interview|solo|compilation), guests[] with role-at-recording
                       and sameAs, publishedAt, durationSeconds, summary, takeaways[], chapters[],
                       topics[], platformLinks {apple, spotify}, transcript turns [{speaker, text}],
                       sources[] (for numbers cited in solo pages), related[] (optional override)
transcript-fixes/      stays as the protocol of what was fixed and why
```

The first step is a one-time extraction script that reads the 123 existing HTML pages into `content/episodes/*.json`, followed by a build that renders from JSON and must produce byte-identical HTML for every page (the same "empty diff" gate the September refactor used). After that gate passes, template changes are a normal build, and `batch-build.js`, `fix-guests.js`, `fix-transcripts.js`, `generate-podcast-page.js` and `patch-jsonld.js` are deleted.

### 4.3 Identity and structured data

One `@id` per entity, reused on every page of both surfaces:

- `https://marinamogilko.co/#marina` Person: name, jobTitle, description, image, `sameAs` (YouTube SVG, YouTube linguamarina, Instagram SVG, Instagram podcast, LinkedIn, X, TikTok, Apple Podcasts, Spotify), `knowsAbout`, `worksFor` the publishing organisation.
- `https://marinamogilko.co/#podcast` PodcastSeries: name, description, `author`/`host` the Person, `webFeed` the real RSS URL (not the Spotify page), `sameAs` Apple and Spotify show URLs.
- `https://marinamogilko.co/#org` Organization: Linguamarina, Inc. as publisher, used in the media kit and legal pages.
- Episode: PodcastEpisode with ISO 8601 `duration` (from seconds), `partOfSeries` by `@id`, one `performer` Person per guest with `jobTitle` as at recording and `sameAs`, `associatedMedia` VideoObject with `hasPart` Clip entries built from chapters (`startOffset`, `endOffset`, `url` with `t=`), and `isAccessibleForFree: true`.
- About page: Person page with a visible FAQ (no FAQPage markup needed).

---

## 5. Workstreams

Priorities: **P1** protects traffic, fixes a material fact or enables a conversion; **P2** improves discovery, credibility or usability; **P3** expansion.

### 5.1 Workstream A: protect and fix (P1, Claude alone, week 1)

1. **Duplicate host.** Verify what `podcast.marinamogilko.co` serves today. If it is a Vercel alias of this project, remove the alias and add a permanent redirect to the same path on `marinamogilko.co`. Verify that `www.marinamogilko.co` and `http://` also redirect. Delete `batch-build.js`.
2. **Homepage canonical** and the shared `@id` entities above; expand the Person; `webFeed` only once the feed URL is known.
3. **Durations** to ISO 8601; **compilation performers** as individual people; **H1** without the site-name suffix.
4. **Contact routing** server-side per the team's table (brand deal and speaking → partnerships@, guest and press → pr@, investment and other → marina@, hiring → ks@); remove "Partnership" from the dropdown; keep pr@ as the fallback; extend the existing tests.
5. **Social links:** add the SVG Instagram next to the podcast Instagram with distinct labels; keep the shared list in `lib/chrome.js` as the single source for both sites.
6. **Navigation labels** per section 3 (pages that do not exist yet keep pointing at the homepage anchors until they ship).
7. **Analytics tag** (GA4 recommended; team provides the property) so Peec can report AI referrals and the newsletter and form conversions can be measured. Add conversion events for form submit and newsletter click.
8. **Old-slug redirects:** if Search Console shows impressions for any `/podcast/<slug>` URL, map it to its episode; otherwise leave.
9. **Media kit on Tilda (team, two hours):** Silicon Valley Girl first, Linguamarina as the second channel; "Data as of October 2026" on every number; the five counts from the doc; remove the Lingoda link and the monthly-growth claim; replace the hero image; add the HubSpot testimonial and the two speaker credits. No structural change.

### 5.2 Workstream B0: data layer and taxonomy (P1, Claude alone, weeks 1–2)

Build `content/` as in 4.2 with the byte-identical gate. Fix the taxonomy now so tagging happens once:

| Slug | Hub question | Seeds |
| --- | --- | --- |
| `ai-skills-and-careers` | Which skills matter now, and how do I show them? | Roslansky, Dohmke, Matias, Grennan, Katanforoosh; solo "9 AI Skills", "Must Have AI Skills", "7 Habits", "Top 1% Career Strategy" |
| `future-of-work` | How is AI changing jobs, and where do experts disagree? | Acemoglu, Brynjolfsson, Zahidi, Roslansky, Bengio; solo "Future of Work 2026", "TOP 10 Highest-Paying Jobs" |
| `ai-business-and-startups` | How do I turn what I know into an AI product or business? | Osika, Staniszewski, Masad, Priestley, Lee, Srinivas; solo "5 BEST AI Businesses", "Launch a $1M AI Business Solo", compilations "Boring Businesses", "6 Profitable AI business ideas" |
| `ai-tools-and-workflows` | Which tools and workflows actually change how I work? | Pedregal, Mehrotra, Liu, Sottiaux, Woodward; solo "11 AI tools", "AI Agents EXPLAINED", "Self-Running AI Company" |
| `women-in-tech-and-ai` | Who are the women building and explaining AI? | Fei-Fei Li, Rus, Wojcicki, Chan, Lopes Lara, Miller, Price, Rangan, Barra; Marina's own story |
| `ai-health-and-education` (later) | How is AI changing medicine and learning? | Chen, Wojcicki, Chan, Khan, Price, Ng, E. Wojcicki |

An LLM pass proposes tags for all 123 episodes; an editor confirms in one sitting. The fifth topic is deliberate: it is the brand's winning position in AI answers.

### 5.3 Workstream B1: episode template v2 (P1, pilot on six pages, then all)

Order of the page: H1 (title only) · meta line with format, guest, date, duration · player with chapter links · **"In one paragraph"**: a 60–90 word quotable summary that answers the title · Key takeaways · Guest card with role at recording, bio and `sameAs` links · Listen on Apple / Spotify (episode links where verified, show links otherwise, labelled honestly) · Chapters as a jump list · **Transcript, visible, with each chapter as an H2 anchor** and speaker labels · Topic tags linking to hubs · Related episodes by shared topic, mixing formats · Newsletter CTA. A sticky mini-nav (Summary · Takeaways · Chapters · Transcript) replaces the tabs.

Pilot pages: Roslansky (`ktpNFfpJ5rw`), Dohmke (`PR__eFQsnhg`), Matias (`PTZ5iN9nDkY`), Staniszewski (`EUrkIpq838c`), Srinivas (`U7PcyE0p54s`), and the solo "5 BEST AI Businesses" (`L1EmhDYc11g`, the page Peec scored). Gate: transcript text identical before and after (normalised), all links resolve, schema validates, Search Console shows no drop on protected pages after 14 days. Then roll to all pages in one build.

### 5.4 Workstream B2: solo pages as guides (P1 for the pilot, then rolling)

For solo videos, the same template plus the Peec optimisation list: a direct answer to the title's question in the first paragraph; chapter headings rewritten as statements ("GPT wrappers: what they are and how to build one"); each number in the summary and takeaways given a source link in `sources[]` (the editor supplies them; Claude lists what needs one); each named person introduced once with a link (guests to their episode page, others to an authoritative page); a short "Do this week" list taken from the video's own action steps. Pilot: `L1EmhDYc11g`, `KfoenLbhOTI` (already cited via YouTube), `ael24TrS0ws` (highest-paying jobs, on the homepage today). Measure in Peec whether the site URL starts appearing beside or instead of the YouTube URL.

### 5.5 Workstream B3: topic hubs and answer guides (P1 for the first two hubs, P2 for the rest)

**Topic hubs** `/topics/<slug>/` answer "which podcast covers X" and anchor internal linking. Each: title and the hub question · a 150–250 word editorial answer in Marina's voice · "Where the guests disagree" with two or three attributed positions linked to transcript anchors · curated episodes with one-line reasons, interviews and solo videos mixed and labelled · a visible FAQ of three to five questions · newsletter CTA · links to sibling hubs. First two: `ai-skills-and-careers` and `future-of-work`. Then `ai-business-and-startups` and `women-in-tech-and-ai`.

**Answer guides** `/guides/<slug>/` target the how-to prompts the project tracks, one page per question, built from the solo video on the subject plus guest quotes with timestamps and primary sources. First two: "What AI skills should I learn in 2026" (from the "9 AI Skills", "Must Have AI Skills" and Roslansky/Matias material) and "How to build a personal brand with AI" (from `KfoenLbhOTI`). Then "How to start an AI business with no money" and "How to stay relevant as AI changes your job". These are written pages with an author line (Marina, with an editorial reviewer named), a dated "last reviewed" line, and the video embedded. They are the only new written content this plan asks for; everything else is derived from recordings.

### 5.6 Workstream B4: homepage, directory, About, newsletter page (P1 for About, P2 for the rest)

- **Homepage order:** hero (positioning line, three listen buttons, pinned episode) · Latest episode · Explore by topic (five tiles) · Six guests (portraits, names, roles at recording, real episode links) · Practical AI with Marina (four solo or compilation cards, format labelled) · About Marina (short, numbers with dates, link) · Future Proof · Work with Marina (link to `/partnerships/`, inline form stays).
- **`/episodes/`:** search by guest, title and topic; filters by format and topic; newest first; the full list remains in the HTML and filtering is client-side; no indexable filter URLs. "Editor's picks" rather than "Most watched" until there is a dated view-count source.
- **`/about/`:** the previous plan's content list stands. Add the explicit positioning sentence, the facts in `site.json` with their sources, a visible FAQ (who is Marina, what is the podcast, who has been a guest, is there solo content, where to listen, what is Future Proof, how to work with Marina), speaking and press with dates. Nothing unsourced ships; the llms.txt claims (Davos 2026 program, Slow Ventures 2021, 25+ angel investments, WIBA, Shorty) need a source each or they come out of llms.txt too.
- **`/newsletter/`:** one screen: what Future Proof is, cadence, three latest public issue links from Beehiiv, the form. Public Beehiiv issues are already citable articles; link to them from topic hubs where relevant instead of mirroring them.

### 5.7 Workstream C: media kit rebuild as `/partnerships/` (P1 for facts, P2 for the rebuild)

Order of the page: **Partner with Silicon Valley Girl** and a two-sentence introduction · primary CTA "Tell us about your campaign" (the existing form with brand-deal routing) and "Request audience insights" · Audience: labelled channel cards (account, link, metric, number, date) plus demographics (age bands, gender, top countries, US share, period, platform) from channel analytics · Formats: podcast integration, YouTube integration, short-form video, newsletter placement, speaking and moderation, multi-deliverable packages; only what is actually sold · Case studies (two or three; the Apple Event 2026 coverage is ready, labelled as event coverage unless Apple is a paid partner, and used only with Apple's agreement on name and logo) · Selected guests (one block, six to eight portraits, roles at recording, correct links) · Partners (existing list plus Cisco, MongoDB, Magnific, Microsoft Foundry, IBM, TED after contract and logo-use checks; OpenAI and Dropbox only when complete) · Testimonials (HubSpot's Brandon Huang quote verbatim; Perplexity requested through the team) · Speaking: topics, formats, past events with dates (Davos 2026, HubSpot Inbound 2025 judge, Cannes Lions 2026, the DeepLearning.AI AI Dev conference once the date is confirmed), one-page speaker sheet · Marina in brief and press (clickable cards: outlet, title, date) · Linguamarina and language-learning portfolio as a secondary section · legal footer.

Same fonts, same chrome, same social list, same `@id` entities as the main site. Redirect map from every Tilda URL. The Tilda page stays live until the gate passes.

### 5.8 Workstream D: distribution (P1, team owners, starts week 1)

| Action | Owner | Done when |
| --- | --- | --- |
| **Identify the RSS host** (not Beehiiv; likely the host that submitted Apple id1819090545). | Producer | Host and feed URL recorded in `site.json`. |
| **Apple Podcasts and Spotify show descriptions:** name the positioning (woman-hosted AI, tech and career podcast), the five topics, and the site. Keep the show title. | Producer | Live, screenshot in the baseline folder. |
| **Episode descriptions on the feed:** first line is the career or business framing, then chapters, then the link to `marinamogilko.co/episode/<id>/`. Start with the pilot six, then every new episode by default. | Producer | Pilot six live; template in the publishing checklist. |
| **Transcripts and chapters in the feed** (`<podcast:transcript>`, `<podcast:chapters>`) if the host supports Podcasting 2.0; Apple ingests feed transcripts. If not, evaluate a host that does before the next season. | Producer with Claude | Transcript visible in Apple Podcasts for a pilot episode. |
| **YouTube descriptions:** first line links to the episode page on the site; chapters stay. | Producer | Pilot six updated; template adopted. |
| **Listicle and directory placements:** verify current Feedspot listings; submit to Feedspot "Future of Work", "AI", "Career" and "Women in Tech" lists; pitch the lists Peec names (askanurag.com, runn.io, DigitalOcean, Zapier, Jotform, ODSC, 99signals) with the topic hubs as the evidence. No paid or undisclosed placements. | PR | Each list checked, pitched or declined, logged. |
| **Editorial pitches** from Peec's pending list (Forbes, Investopedia, USA Today, Business Insider) using the answer guides as the hook. | PR | Pitched, logged. |
| **Community presence:** the r/womenintech thread already recommends the show. A named team member, with disclosed affiliation, answers real questions on Reddit, Quora and LinkedIn with source-linked contributions. Never fabricated praise. | Social | Monthly log. |
| **Wikipedia:** not pursued. | | |

### 5.9 Workstream E: publishing automation (P2, Claude with producer, weeks 4–6)

**Today:** producer messages Claude; Claude adds the ID, runs the build against the Railway backend, which guesses speakers from YouTube captions; the producer or Marina exports a Trint CSV by hand; Claude rebuilds attribution; fixes are applied to HTML; commit and push. The root cause of attribution errors is the backend's speaker guessing; the Trint export is the fix, done by hand every time.

**Target:**

1. **Trigger.** A GitHub Actions workflow polls the channel's YouTube feed every 30 minutes (or is dispatched manually with a video ID). A new video ID in the feed starts the run.
2. **Transcript with speakers.** Audio goes to Trint through its API (the same source the team already trusts for "who said what"); the diarised transcript comes back as segments. The Trint integration connected to this environment currently shows no workspaces, so the team grants API or workspace access first. Fallback if Trint access is not granted: a diarising ASR in the existing backend, with the same output shape.
3. **Speaker map with evidence.** The rules already written in `TRANSCRIPTS-WORKFLOW.md` become code: the speaker who opens with the show's intro and asks most questions is Marina; the remaining speaker is the guest from YouTube metadata; short backchannels are merged; marker phrases ("my newsletter") are checked and any conflict is listed for the reviewer. Unknown speakers fail the run.
4. **Draft generation.** Metadata from the YouTube Data API; summary, takeaways, chapter headings as statements, topic tags, "numbers that need a source" and "people who need an introduction" from an LLM pass over the transcript; everything written into `content/episodes/<id>.json`. Ads removed by the existing patterns, logged.
5. **Review gate.** The workflow opens a pull request with a Vercel preview URL and the section-10 checklist from `TRANSCRIPTS-WORKFLOW.md` as the PR body. The producer reviews the preview, edits the JSON (directly or by asking Claude in the PR), and merges. Merge deploys; the homepage, directory, hubs, sitemap and llms.txt regenerate from the data layer.
6. **Checks in CI:** tests, unknown-speaker check, empty-field check, title house-style check, schema validation, internal link check, transcript-length sanity check, byte-identical check for pages not in the change.

This removes the per-episode Claude session and makes every rule reproducible. The `transcript-fixes/` protocol continues for anything a human changes after review.

### 5.10 Workstream F: measurement and gates (P1, from day one)

**Baseline before any template change:** Search Console export (pages and queries, last 3 months, weekly), Peec brand and URL reports for the same window (already captured above), the list of protected URLs below, screenshots of both homepages, a copy of the Tilda sitemap.

**Protected URLs** (no change to URL, title or transcript text without a logged reason): the homepage; `/episode/ktpNFfpJ5rw/`, `/episode/PR__eFQsnhg/`, `/episode/PTZ5iN9nDkY/`, `/episode/U7PcyE0p54s/`, `/episode/EUrkIpq838c/`, `/episode/213rSCulKUQ/`, `/episode/KfoenLbhOTI/`, `/episode/ael24TrS0ws/`, `/episode/cVGHg4Vd9uM/`; every solo page that shows clicks in Search Console (Eugenia marks these from the export).

**Release gates for any template or navigation change** (automated where possible): every previously valid URL still returns 200 at the same path; every protected page keeps its transcript text (normalised diff empty or every change explained); no `noindex`, robots or canonical regression; sitemap entries unchanged except intended additions; structured data validates (Schema.org validator and Rich Results Test); players, chapter links, forms and newsletter links work on mobile; a rollback commit is named in the PR.

**Track monthly:** Search Console clicks and impressions on protected pages and on new hubs and guides; Peec visibility by topic, owned URLs retrieved and cited, and the YouTube-versus-site split for solo videos; AI referrals once GA4 is connected; confirmed newsletter subscriptions (Beehiiv) and qualified inquiries by form topic. Keep the Peec prompt set stable; changing it changes the measurement, not the result.

---

## 6. Sequence and ownership

| When | Claude alone | Needs team input first |
| --- | --- | --- |
| Week 1 | A1–A6, A8; baseline capture; data-layer extraction script | A7 (GA4 property), A9 (Tilda fixes), RSS host, confirm the counts and dates for `site.json` |
| Weeks 1–2 | Data layer with byte-identical gate; template v2 on the six pilot pages; `/about/` skeleton; nav pages | About-page facts with sources; topic tags confirmed; episode-level Apple and Spotify links for the pilot six |
| Weeks 2–4 | Solo guide pilot (three pages); first two topic hubs; homepage v2; `/episodes/` filters; `/newsletter/` | Sources for the numbers on the solo pilots; hub answers reviewed in Marina's voice; demographics, formats, partner permissions and case-study sign-off for the media kit |
| Weeks 4–6 | Template rollout to all pages; `/partnerships/` build and redirect map; publishing automation; first two answer guides | Trint API access; guide review; Tilda redirect list; speaker sheet content |
| Weeks 6–8 | Remaining hubs; second pair of guides; cleanup of legacy scripts | Distribution results review; next-quarter priorities |
| Ongoing | Monthly measurement report | Distribution actions (D) run continuously from week 1 |

One pull request per numbered item. No item combines a template change with a content rewrite. Nothing deploys from this document; each PR carries its own before-and-after check.

---

## 7. Copy (drafts to review, not final)

**Positioning line (homepage, About, Apple description, media kit):** Silicon Valley Girl is a weekly AI, tech and career podcast hosted by entrepreneur and creator Marina Mogilko, one of the few women-led shows interviewing the people building AI.

**Homepage introduction:** Each week Marina sits down with founders, tech leaders, researchers and innovators to ask the questions that matter beyond the tech world: which skills will still matter, where the next opportunities are, and what the people building this technology see coming that the rest of us don't. Between interviews she shares practical solo videos on AI tools, careers and building a business.

**Practical section:** Practical AI with Marina. Solo videos and curated conversations on using AI at work, learning the skills that pay, and turning ideas into businesses.

**Newsletter:** Future Proof by Silicon Valley Girl. One email a week: the AI idea worth your attention and exactly what to try with it.

**Work with Marina:** Partner with Silicon Valley Girl. Bring your brand into conversations about AI, technology, careers and entrepreneurship: podcast and YouTube integrations, short-form video, newsletter placements and speaking.

**About page opening:** Marina Mogilko is an entrepreneur, creator and the host of Silicon Valley Girl. Based in Silicon Valley, she interviews founders, researchers and business leaders about AI, the future of work and entrepreneurship, and makes practical videos for people who want to understand and use new technology. She writes Future Proof, a weekly newsletter on AI tools and career moves. Earlier she co-founded LinguaTrip and built the English-learning channel linguamarina. (Dates, counts, investments and awards follow only with sources.)

**Episode "In one paragraph" pattern:** [Guest], [role at recording], on [the one question]. [Two sentences with the concrete answer, with a number if the guest gave one.] Recorded [month year] at [place, if notable].

---

## 8. Inputs the team owes before the dependent work can ship

1. Which service hosts the podcast RSS feed, and its URL.
2. GA4 property (or a decision to use another analytics tool) and the Vercel environment variable.
3. Confirmed audience counts with an "as of" month for YouTube (both channels), Instagram (both accounts), TikTok, LinkedIn, X, newsletter subscribers.
4. Sources for every biography claim currently in llms.txt (Davos 2026 program, Slow Ventures 2021, number of angel investments, WIBA 2023, Shorty Impact Awards, "two 8-figure businesses"); anything without a source comes out.
5. Audience demographics export (YouTube Studio, Instagram insights) and the list of formats actually sold.
6. Permission status for partner logos (including Apple for the event case study) and the Perplexity testimonial request.
7. Trint API or workspace access for the automation, or the decision to diarise in the backend instead.
8. The Tilda sitemap and any campaign links still in circulation, for the redirect map.
9. Episode-level Apple and Spotify URLs for the six pilot episodes.
10. Confirmation of the topic tags proposed for the 123 episodes (one review session).

---

## Appendix A: tracked prompts by topic (Peec, 50 active prompts)

- **AI skills and careers:** what AI skills should I learn in 2026 · how to build a personal brand with AI · how to start an AI business with no money · Best podcasts about using AI at work
- **AI career advice for professionals:** AI business ideas you can start with no coding
- **Future of jobs:** What podcasts cover the future of work and AI job trends
- **AI and automation:** best AI tools to use in 2026 · Podcasts about tech, AI & Future Trends · Best podcasts about how AI is changing careers and jobs · best podcasts about future of ai
- **Podcasts with tech CEO interviews:** best business youtube channels · Anthropic Podcast · Ryan Roslansky podcast interview · Best podcasts interviewing tech CEOs · What podcast should I listen to if I want to hear from tech leaders? · Best podcasts with Silicon Valley CEO interviews
- **Women in tech podcasts:** Best podcasts for women interested in AI and startups
- **AI podcasts hosted by women:** What are the best podcasts about AI hosted by women
- **LinguaMarina:** Career growth, AI podcast
- **Unassigned (28 prompts), including:** Podcasts like Lex Fridman / Diary of a CEO / All-In / TBPN / Masters of Scale · who are the best AI podcast hosts · best solo female tech podcaster · best podcast for AI startup founders · best AI podcasts for keeping up with AI news · Silicon Valley podcast · GitHub / ElevenLabs / Replit / Perplexity / LinkedIn / Reid Hoffman CEO podcast · podcast with Yossi Matias · Allie K. Miller interview · AI podcasts hosted by female creators · podcasts about AI and the future of work · how to stay relevant as AI changes my job · Best podcasts for career advice · Best podcasts for entrepreneurs · Best interview podcasts 2026

Assigning the unassigned prompts to topics in Peec improves reporting and changes nothing about performance.

## Appendix B: sources behind the previous plan that still apply

Google's documentation on AI features and site requirements, the retirement of FAQ rich results, the llms.txt clarification, OpenAI and Perplexity crawler documentation, Google's site-move guidance, Schema.org `duration`, `PodcastEpisode`, `webFeed` and `Clip`. Google needs no special GEO schema or AI text file; GEO here means making the expertise easy to identify, retrieve and cite, then checking in Peec and Search Console whether it worked.
