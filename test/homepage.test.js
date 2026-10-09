const test = require('node:test');
const assert = require('node:assert');
const { renderHomePage, renderEpisodesPage } = require('../build.js');

const EPISODES = [
  {
    videoId: 'aaa', title: 'Superhuman CEO: How to Position Yourself',
    thumbnail: 'https://i.ytimg.com/vi/aaa/hq.jpg', publishedAt: '2026-09-08T17:00:00.000Z',
    guestName: 'Shishir Mehrotra', guestTitle: 'CEO, Superhuman', duration: '39 MIN',
  },
  {
    videoId: 'bbb', title: 'The Biggest Opportunities in AI',
    thumbnail: 'https://i.ytimg.com/vi/bbb/hq.jpg', publishedAt: '2026-08-28T17:00:00.000Z',
    guestName: 'Andrew Ng', guestTitle: 'Founder, DeepLearning.AI', duration: '38 MIN',
  },
  {
    videoId: 'ccc', title: 'Boring Businesses Compilation',
    thumbnail: 'https://i.ytimg.com/vi/ccc/hq.jpg', publishedAt: '2026-08-01T17:00:00.000Z',
    guestName: 'Andrew Ng, Sal Khan, Fei-Fei Li', guestTitle: '', duration: '25 MIN',
  },
];

// Display copy is written in natural case and uppercased by CSS. All-caps in
// the source gets announced letter-by-letter or as an acronym by some screen
// readers, so the casing lives in the stylesheet; these assertions are
// therefore case-insensitive on the words the mock specifies.
test('hero copy is verbatim from the mock', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /the podcast that decodes the valley/i);
  assert.match(html, /what can I actually do with this today\?/);
  assert.match(html, /new episode weekly/i);
});

test('the headline puts YOUR in the accent colour', () => {
  assert.match(renderHomePage(EPISODES), /<span class="accent">your<\/span>/i);
});

test('display headings are uppercased in CSS, not in the markup', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /\.hero h1 \{[^}]*text-transform: uppercase/);
});

test('newest episode is the cover story and is not repeated in the archive', () => {
  const html = renderHomePage(EPISODES);
  const archive = html.slice(html.indexOf('id="episodes"'));
  assert.ok(!archive.includes('Superhuman CEO'), 'cover story duplicated in the archive');
  assert.ok(archive.includes('The Biggest Opportunities in AI'), 'archive missing an episode');
});

test('every episode is linked', () => {
  const html = renderHomePage(EPISODES);
  for (const e of EPISODES) assert.ok(html.includes(`/episode/${e.videoId}/`), `unlinked: ${e.videoId}`);
});

// Pre-existing SEO rule, kept: a montage must not compete with each guest's own
// episode for a "[name] podcast" query.
test('a compilation shows Marina, not its guest list', () => {
  const html = renderHomePage(EPISODES);
  assert.ok(!html.includes('Andrew Ng, Sal Khan, Fei-Fei Li'), 'compilation listed its guests');
});

test('head metadata is preserved', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /<title>Silicon Valley Girl Podcast — Marina Mogilko<\/title>/);
  assert.match(html, /"@type":\s*"PodcastSeries"/);
  assert.match(html, /og:image" content="https:\/\/marinamogilko\.co\/og-image\.png"/);
});

test('the partnerships block is gone; contact goes through the form', () => {
  const html = renderHomePage(EPISODES);
  assert.ok(!html.includes('Want your brand on the podcast?'));
  assert.ok(!html.includes('id="contact"'));
  assert.ok(html.includes('id="work"') && html.includes('id="pitch-form"'));
});

test('the header and footer come from the shared chrome', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /class="site-header"/);
  assert.match(html, /Made in Silicon Valley/);
});

test('nav anchor targets exist on the page', () => {
  const html = renderHomePage(EPISODES);
  for (const id of ['episodes', 'search', 'host', 'work', 'subscribe']) {
    assert.ok(html.includes(`id="${id}"`), `nav points at #${id} but no such element`);
  }
});

test('every image is sized, so nothing reflows as thumbnails land', () => {
  const html = renderHomePage(EPISODES);
  const imgs = (html.match(/<img[^>]*>/g) || []).filter((i) => i.includes('i.ytimg.com'));
  assert.ok(imgs.length >= 3, 'expected episode thumbnails');
  for (const img of imgs) {
    assert.match(img, /width="\d+"/);
    assert.match(img, /height="\d+"/);
  }
});

// The hero thumbnail is the largest above-the-fold image and so the likely LCP
// element. Deferring it would delay the metric it defines.
test('the hero image is eager while the rest are lazy', () => {
  const html = renderHomePage(EPISODES);
  const hero = html.slice(html.indexOf('hero-media'), html.indexOf('</section>'));
  const heroImg = hero.match(/<img[^>]*>/)[0];
  assert.ok(!heroImg.includes('loading="lazy"'), 'hero image must not be lazy');

  const below = html.slice(html.indexOf('id="episodes"'));
  for (const img of below.match(/<img[^>]*>/g) || []) {
    assert.match(img, /loading="lazy"/);
  }
});

test('the curated block shows the chosen episodes in the chosen order under the chosen heading', () => {
  const html = renderHomePage(EPISODES, { featuredEpisodes: { heading: 'Conversations that matter', videoIds: ['ccc', 'nope', 'aaa'] } });
  assert.match(html, /<h2 class="section-title">Conversations that matter<\/h2>/);
  const block = html.slice(html.indexOf('id="featured"'), html.indexOf('<section class="about">'));
  assert.ok(block.indexOf('/episode/ccc/') < block.indexOf('/episode/aaa/'), 'order is the team\'s order');
  assert.ok(!block.includes('/episode/bbb/'));
  assert.ok(!renderHomePage(EPISODES).includes('id="featured"'), 'no block without the site facts');
});

// Six cards on the homepage, everything else on its own page. Revealing the
// rest in place buried the sections below — the form included — behind a
// scroll past 110 cards.
test('the homepage archive shows six cards and links to the full list', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    videoId: `id${i}`, title: `Episode ${i}`, thumbnail: `https://i.ytimg.com/vi/id${i}/hq.jpg`,
    publishedAt: `2026-09-${String(28 - i).padStart(2, '0')}T17:00:00.000Z`,
    guestName: `Guest ${i}`, guestTitle: '', duration: '30 MIN',
  }));
  const html = renderHomePage(many);
  assert.equal((html.match(/class="ep-card"/g) || []).length, 6, 'expected six cards');
  assert.ok(!html.includes('ep-card-more'), 'hidden cards should be gone entirely');
  assert.match(html, /href="\/episodes\/"[^>]*>All episodes/);
});

test('the all-episodes page lists every episode', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    videoId: `id${i}`, title: `Episode ${i}`, thumbnail: `https://i.ytimg.com/vi/id${i}/hq.jpg`,
    publishedAt: `2026-09-${String(28 - i).padStart(2, '0')}T17:00:00.000Z`,
    guestName: `Guest ${i}`, guestTitle: '', duration: '30 MIN',
  }));
  const html = renderEpisodesPage(many);
  assert.equal((html.match(/class="ep-card"/g) || []).length, 12, 'an episode is missing');
  assert.match(html, /12 episodes/);
  assert.match(html, /class="site-header"/, 'should carry the shared chrome');
  assert.match(html, /Made in Silicon Valley/);
  assert.match(html, /<link rel="canonical" href="[^"]*\/episodes\/">/);
});

// Nothing may become unreachable: the homepage shows six, and the rest must be
// one click away rather than orphaned.
test('every episode is reachable from the homepage in at most one hop', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    videoId: `id${i}`, title: `Episode ${i}`, thumbnail: `https://i.ytimg.com/vi/id${i}/hq.jpg`,
    publishedAt: `2026-09-${String(28 - i).padStart(2, '0')}T17:00:00.000Z`,
    guestName: `Guest ${i}`, guestTitle: '', duration: '30 MIN',
  }));
  const onHome = new Set((renderHomePage(many).match(/href="\/episode\/([^/]+)\//g) || []));
  const onList = new Set((renderEpisodesPage(many).match(/href="\/episode\/([^/]+)\//g) || []));
  for (const ep of many) {
    const href = `href="/episode/${ep.videoId}/`;
    assert.ok(onHome.has(href) || onList.has(href), `${ep.videoId} is unreachable`);
  }
});

// The hero carries an editorial pin; the cover story is always the genuinely
// newest episode. That split is what keeps "This week's cover story" true no
// matter what is pinned above it.
test('the hero is always the newest episode, with nothing pinned over it', () => {
  const html = renderHomePage(EPISODES, { featuredEpisodes: { heading: 'X', videoIds: ['bbb'] } });
  const hero = html.slice(html.indexOf('<section class="hero">'), html.indexOf('</section>'));
  assert.ok(hero.includes('/episode/aaa/'), 'the newest episode is the hero');
  assert.ok(!html.includes('cover story'));
});

test('the hero carries no "latest" wording, since it may be a pinned older episode', () => {
  const html = renderHomePage(EPISODES);
  const hero = html.slice(html.indexOf('class="hero"'), html.indexOf('class="cover"'));
  assert.ok(!/latest/i.test(hero), 'hero still claims to be the latest episode');
});

test('neither the hero nor a curated episode is repeated in the archive', () => {
  const html = renderHomePage(EPISODES, { featuredEpisodes: { heading: 'X', videoIds: ['bbb'] } });
  const archive = html.slice(html.indexOf('id="episodes"'), html.indexOf('id="search"'));
  assert.ok(!archive.includes('/episode/aaa/'), 'hero repeated in the archive');
  assert.ok(!archive.includes('/episode/bbb/'), 'curated episode repeated in the archive');
  assert.ok(archive.includes('/episode/ccc/'));
});

test('the about-the-show block links the three platforms and names no guests', () => {
  const html = renderHomePage(EPISODES);
  const block = html.slice(html.indexOf('<section class="about">'), html.indexOf('id="episodes"'));
  assert.ok(!block.includes('Past guests include'));
  assert.ok(block.includes('href="https://www.youtube.com/@SiliconValleyGirl"'));
  assert.ok(block.includes('href="https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY"'));
  assert.ok(block.includes('href="https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545"'));
});

// macOS is case-insensitive, so a file saved as host.JPG satisfies
// existsSync('host.jpg') locally and then 404s on Vercel's Linux filesystem.
// This has now happened twice. The assertion is deliberately not skippable:
// if no photo is installed at all, that is a separate, visible state and the
// stills fallback covers it, but a reference that does not resolve is a bug.
test('the host photo reference resolves to a real file, case included', () => {
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  const dir = nodePath.join(__dirname, '..', 'public');
  const onDisk = nodeFs.readdirSync(dir).filter((f) => /^host\.[A-Za-z]+$/.test(f));
  const ref = renderHomePage(EPISODES).match(/src="\/(host\.[A-Za-z]+)"/);

  if (!onDisk.length) {
    assert.equal(ref, null, 'markup points at a host photo but none exists in public/');
    return;
  }
  assert.ok(ref, `public/ has ${onDisk[0]} but the markup does not reference it`);
  assert.ok(
    onDisk.includes(ref[1]),
    `markup points at /${ref[1]} but public/ holds ${onDisk.join(', ')} — ` +
      `identical on macOS, a 404 on Linux`
  );
});

// Release 6 homepage additions. They need the site facts (guests, counts,
// positioning), so they render only when the facts are passed in.
const SITE = {
  person: { positioning: 'Silicon Valley Girl is a woman-hosted AI, tech and career podcast.' },
  featuredGuests: ['Shishir Mehrotra', 'Andrew Ng', 'Nobody Here', 'Sal Khan'],
  counts: { updatedAt: '2026-10-08', items: [{ label: 'followers across all channels', value: '18.3M+' }] },
  audience: { total: 18358261 },
  topics: [{ slug: 'future-of-work', name: 'Future of work' }],
};
const MORE = [
  ...EPISODES,
  { videoId: 'ddd', title: 'Solo: 9 AI Skills', thumbnail: 'https://i.ytimg.com/vi/ddd/hq.jpg', publishedAt: '2026-07-01T17:00:00.000Z', guestName: 'Marina Mogilko', guestTitle: 'Host', duration: '20 MIN', format: 'solo' },
  { videoId: 'eee', title: 'Interview E', thumbnail: 'https://i.ytimg.com/vi/eee/hq.jpg', publishedAt: '2026-06-01T17:00:00.000Z', guestName: 'E Guest', guestTitle: 'CEO, E', duration: '30 MIN', format: 'interview' },
].map((e) => ({ format: e.videoId === 'ccc' ? 'compilation' : 'interview', ...e }));

test('the library search block sends the query to the directory and lists the topics', () => {
  const html = renderHomePage(MORE, SITE);
  assert.match(html, /<section id="search" class="library">/);
  assert.match(html, /Search the entire library\./);
  assert.match(html, /Silicon Valley Girl podcast library/);
  assert.match(html, /<form class="library-search" action="\/episodes\/" method="get" role="search">/);
  assert.match(html, /<input type="search" id="home-q" name="q"/);
  assert.ok(html.includes('href="/topics/future-of-work/"') && html.includes('href="/topics/" class="all"'));
  assert.ok(!html.includes('Explore by topic'));
  assert.ok(!html.includes('Guests on the show'), 'the curated block replaced the guests row');
  assert.match(html, /<a class="btn btn-ink archive-more" href="\/episodes\/">All episodes/);
});

test('the newsletter prompt is in the page, hidden, and opens the subscribe page with the address filled in', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /<div class="nl-pop" id="nl-pop" hidden role="dialog"/);
  assert.match(html, /<input type="email" id="nl-pop-email" name="email"[^>]*required/);
  assert.match(html, /<form id="nl-pop-form" class="nl-pop-form" action="https:\/\/siliconvalleygirl\.beehiiv\.com\/subscribe\?[^"]*">/);
  assert.ok(!/nl-pop-form[^>]*method=/.test(html), 'no native submission: the CSP would block it and the script opens the page instead');
  assert.match(html, /pop\.hidden = false; remember\(\);/, 'remembered when shown, so it appears once per 30 days');
  assert.match(html, /setTimeout\(function \(\) \{[\s\S]*?\}, 40000\)/, 'appears after 40 seconds');
  assert.match(html, /localStorage\.setItem\(KEY/, 'remembered once dismissed');
  assert.match(html, /window\.open\(form\.getAttribute\("action"\) \+ "&email=" \+ encodeURIComponent\(email\), "_blank", "noopener"\)/);
  assert.ok(!/innerHTML/.test(html));
});

test('the practical row shows only solo and compilation episodes, labelled, and not the ones already on the page', () => {
  const html = renderHomePage(MORE, SITE);
  const section = html.slice(html.indexOf('id="practical"'), html.indexOf('id="host"'));
  assert.ok(section.includes('/episode/ddd/') && section.includes('/episode/ccc/'));
  assert.ok(!section.includes('/episode/eee/') && !section.includes('/episode/bbb/'), 'interviews do not belong here');
  assert.match(section, /<span class="ep-format">Solo<\/span>/);
  assert.match(section, /<span class="ep-format">Compilation<\/span>/);
  assert.ok(section.includes('href="/topics/ai-tools-and-workflows/"'));
});

test('the host block carries the positioning line, the dated count, the episode count and the About link', () => {
  const html = renderHomePage(MORE, SITE);
  assert.ok(html.includes('<p class="host-positioning">Silicon Valley Girl is a woman-hosted AI, tech and career podcast.</p>'));
  assert.match(html, /<span class="stat-value">18.3M\+<\/span><span class="stat-label">Following along &middot; 2026-10-08<\/span>/);
  assert.match(html, /<span class="stat-value">5<\/span><span class="stat-label">Episodes with transcripts<\/span>/);
  assert.ok(html.includes('href="/about/"'));
  assert.ok(!html.includes('<span class="stat-value">SF</span>'));
});
