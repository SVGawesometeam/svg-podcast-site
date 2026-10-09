# About page: what Marina's team needs to confirm

**Status 2026-10-08:** `/about/` is built from `content/site.json`. The team confirmed
everything that was on partnerships.marinamogilko.co and asked to build without source
links; the `source` field in `site.json` is filled in as links arrive. What is still open is
marked below. Counts are left off until the dashboard job writes them.

Fill in directly under each item. Russian is fine.

## 1. Facts that need a source before they can be published

Confirmed by the team on 2026-10-08 (everything on the media kit page). Published on
`/about/` and in llms.txt; a source link per fact is still welcome and goes into `site.json`.

- Silicon Valley Girl was part of the official program of the World Economic Forum in Davos 2026. Source:
- First creator to receive venture capital funding as an individual (Slow Ventures, 2021). Source:
- Angel investor in 25+ startups, including Boom Supersonic, Higgsfield AI, Navier, Beacons.ai, Sunsama. Current number and source:
- Built two 8-figure businesses: an edtech company and a global media company. Exact wording you are comfortable publishing:
- WIBA Award for Best in Education (Cannes Film Festival 2023). Source:
- Learning & Development Creator of the Year, Shorty Impact Awards (year?). Source: **not on the media kit page, so not published yet; confirm and it goes in.**
- Co-founded LinguaTrip (year?). Source:
- Based in Los Altos, California (or "Silicon Valley" only?): **published as "Silicon Valley, California" until told otherwise.**

## 2. Numbers (done 2026-10-09)

The counts come from the team's dashboard, never from this file. A GitHub Action
(`.github/workflows/audience.yml`) runs every Monday at 08:00 UTC, reads the dashboard's audience
API, writes `content/audience.json`, rebuilds and commits; Vercel deploys the commit. A stale or
incomplete read fails the job and keeps last week's numbers. The About page shows the total and the
three largest platforms, rounded down (18,358,261 is shown as "18.3M+"), with the date; the homepage
"Following along" stat and llms.txt use the same file. The total spans every account the dashboard
tracks, including the dubbed and Russian channels, and the page says audiences overlap.

- Decision still open: show the all-accounts total (current) or English-only accounts? English-only
  means filtering the dashboard's per-account rows by key in `scripts/update-audience.js`.
- Number of podcast episodes published: the About page counts the pages on this site (123).

## 3. Marina's story, in her words (three to six sentences each)

- Where she is from and when she moved to the US:
- Why she started Silicon Valley Girl and when the podcast format began:
- What she wants a first-time visitor to understand about the show:
- One line on LinguaTrip and linguamarina, as background:

## 4. Speaking

- Past events with year (we have: Davos 2026 program, HubSpot Inbound 2025 judge, Cannes Lions 2026, DeepLearning.AI AI Dev conference in San Francisco, dates to confirm):
- Two or three talk topics Marina offers:

## 5. Press (received and confirmed 2026-10-08)

Confirmed by the team 2026-10-08; all 13 are on `/about/` (titles shortened from the links,
dates shown only where known). Send a date or a corrected title and it goes into `site.json`.

| # | Outlet | Title as far as the link shows it | Date | Link |
| --- | --- | --- | --- | --- |
| 1 | Forbes | My picks for the top social media influencers of 2020 (John B. Brandon) | 21 Dec 2020 | https://www.forbes.com/sites/johnbbrandon/2020/12/21/my-picks-for-the-top-social-media-influencers-of-2020/ |
| 2 | Business Insider | VC firms are buying equity directly in influencers and YouTube creators | Nov 2021 | https://www.businessinsider.com/vc-firms-are-buying-equity-directly-in-influencers-youtube-creators-2021-11 |
| 3 | Tubefilter | Creators on the Rise: Silicon Valley Girl Marina Mogilko | 1 Jun 2022 | https://www.tubefilter.com/2022/06/01/creators-on-the-rise-silicon-valley-girl-marina-mogilko/ |
| 4 | YouTube Official Blog | Meet 10 creators shaping the YouTube Shorts community | confirm (2021?) | https://blog.youtube/creator-and-artist-stories/10-creators-shaping-the-youtube-shorts-community/ |
| 5 | The Washington Post (WP Creative Group, with YouTube) | The impact of the creator economy | confirm | https://www.washingtonpost.com/creativegroup/youtube/the-impact-of-the-creator-economy/ |
| 6 | International Business Times | Why Marina Mogilko's Silicon Valley Girl podcast is exactly what the innovation economy needs right now | confirm | https://www.ibtimes.com/why-marina-mogilkos-silicon-valley-girl-podcast-exactly-what-innovation-economy-needs-right-now-3775116 |
| 7 | Paper | Marina Mogilko (podcast launch feature) | confirm | https://papermag.com/marina-mogilko |
| 8 | L'Officiel Cyprus | Marina Mogilko: redefining entrepreneurship and influence | confirm | https://www.lofficiel.cy/influencers/marina-mogilko-redefining-entrepreneurship-and-influence |
| 9 | Times Monaco | WIBA Awards winner Marina Mogilko, shining social media star from Silicon Valley | confirm (2023?) | https://www.timesmonaco.com/wiba-awards-winner-marina-mogilko-shining-social-media-star-from-silicon-valley/ |
| 10 | Vogue Adria | WIBA Awards USA launch event | confirm | https://vogueadria.com/wiba-awards-usa-launch-event/ |
| 11 | The Tilt | Marina Mogilko, YouTube content creator (content entrepreneur profile) | confirm | https://www.thetilt.com/content-entrepreneur/marina-mogilko-youtube-content-creator |
| 12 | The Tribune | Marina Mogilko: YouTube phenomenon and Silicon Valley entrepreneur | confirm | https://www.thetribune.com/marina-mogilko-youtube-phenomenon-and-silicon-valley-entrepreneur/ |
| 13 | BuzzFeed | Cost to have a baby (TikTok) | confirm; probably not for the About page | https://www.buzzfeed.com/kristatorres/cost-to-have-a-baby-tiktok |

Items 1 to 9 are the strongest for the About page. Item 13 reads as lifestyle coverage; say if you want it kept.

**Also taken from the same page (for section 1 and 4):** the fact list it publishes (Davos 2026 program; two 8-figure businesses; Slow Ventures 2021 as an individual; angel investor in Boom Supersonic, Beacons.ai, Navier, Higgsfield and 20+ startups; cover of Times Monaco and L'Officiel; WIBA Award, Best Influencer in Education, Cannes 2023) and the speaker list (ManyChat Instagram Online Summit 2024; VidCon Anaheim 2023; Alibaba Co-Create Las Vegas 2023; EduCon by YouTube, New York 2022; Stanford, San Francisco 2025; Viva Technology Paris 2025; 1 Billion Followers Summit Dubai 2025; Nas Summit San Francisco 2024; plus Davos 2026). The press links 2, 9 and 10 can serve as sources for the funding and award claims if you confirm them.

## 6. Images (received 2026-10-08)

- Portrait received and stored as `public/marina-mogilko.jpg` (1333 × 2000) with a square crop at `public/marina-mogilko-square.jpg`. Photographer credit, if one is required:
- `public/host.jpg` stays on the homepage (confirmed).

## 7. Contact lines on the page

- Which addresses may be shown publicly (partnerships@ and pr@ are on the site already; marina@ and ks@ stay private?):
