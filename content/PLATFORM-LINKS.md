# Platform links (Apple Podcasts, Spotify) per episode

Stored as `platformLinks` in `content/episodes/<id>.json`. Rendered from Release 3 on.

**Source and method (2026-10-08).** Apple's and Spotify's sites are not reachable from the build
environment, so the links come from Peec's record of the Apple and Spotify pages AI engines
retrieved for this show (6 months), plus the episode list and descriptions on the Apple show page
as Peec captured it on 2026-10-07. Each link was matched to a site episode by guest, publication
date (podcast releases run 0–6 days after YouTube) and length. Podcast titles often differ from
YouTube titles, so title alone was never the criterion.

| Episode | Apple | Spotify | Note |
| --- | --- | --- | --- |
| ktpNFfpJ5rw Roslansky | i=1000750778981 | — | Apple title "How to Stay Employed When AI Replaces Your Job" |
| PTZ5iN9nDkY Matias | i=1000758651130 | 23JaKg8DRLsWs7DxbVXC1o | Apple title "The AI Skills Gap Is Real" |
| PR__eFQsnhg Dohmke | i=1000714865301 | 4miuPQzUH8NiZ6kdcZB7p7 | |
| EUrkIpq838c Staniszewski | — | 3PNXUm9mFPXumaX0rlZcCp | |
| U7PcyE0p54s Srinivas | i=1000728606111 | 1mU95mt1sQVe8Gp6RMY7j3 | Apple title "AI Is About to Change the Internet Forever" |
| 3FgPLbfs_oY Masad | i=1000724561089 | 4OkAZKDh7QgF6HwxMN8eoG | |
| UJo_MiMA7qE Zhang | — | 5K3Dhk2UzF1DXiyekfh6nR | |
| Yu0z7-KMHpo Yang | — | 1B4ntfNDdOh32CjRJCWll6 | Spotify title "The 5 Levels of AI-Native" |
| l6d_0PB0Pbg Future of Work 2026 | i=1000754621744 | — | |
| 213rSCulKUQ Career compilation | i=1000787860395 | — | Apple title "Top 1% Career Playbook" |
| gwsaC3WiCqs 6 AI business ideas | — | 0UZycKI2R5BcDIEMlxKOby | Spotify title "6 AI Businesses You Can Start in 2026" |
| YfRkj9kmQf0 Allie K. Miller | i=1000760014527 | — | Apple title "How to Build an AI Brain in 1 Hour" |
| zL2PIa72gJ4 AI tools compilation | i=1000764731536 | — | Apple title "The 6 AI Tools They Use Daily" |
| qy8Gr27yLMk Brockman | i=1000792835630 | — | |
| ael24TrS0ws Highest-paying jobs | i=1000792200698 | — | |
| KEAYPqQG2-M Osika | i=1000791626205 | — | |
| JEZVl3BkSLk Mehrotra | i=1000788495064 | — | |
| o-wv_szZ0V0 Ng | i=1000786527866 | — | |
| 72duHF7iZiU Brynjolfsson | i=1000777720945 | — | Two different Spotify IDs are given as "full episode" in Marina's own descriptions; not stored until checked |
| subu-xHrp1w Fei-Fei Li | i=1000774171967 | 1FvQHmEJoGUARR2EY6AEWk | From the "Moment" description's full-episode links |

**Not found:** L1EmhDYc11g (5 BEST AI Businesses, Oct 2025) and the remaining ~100 episodes. The
fastest way to fill them all: the feed itself. The show is hosted on **Spotify for Creators**
(formerly Anchor; episode pages live at podcasters.spotify.com/pod/show/siliconvalleygirl). Its RSS
feed lists every episode with its Spotify for Creators page, and Apple's lookup API
(`https://itunes.apple.com/lookup?id=1819090545&entity=podcastEpisode&limit=200`) returns every Apple
episode URL. Both are one request each from any machine that can reach them.

**A podcast-only episode with no site page:** "How AI Is Solving Problems We Thought Were Impossible |
Yossi Matias" (Apple i=1000761530214, Spotify 04iYEo0Iw7f195Lavr4zAT, 15 April 2026, 28 min) is among
the most-retrieved pages for the brand in AI answers and has no page on marinamogilko.co. Worth a page
if a YouTube version exists.
