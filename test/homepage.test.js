const test = require('node:test');
const assert = require('node:assert');
const { renderHomePage } = require('../build.js');

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

test('partnerships mailto survives the redesign', () => {
  assert.match(renderHomePage(EPISODES), /mailto:partnerships@marinamogilko\.co/);
});

test('the header and footer come from the shared chrome', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /class="site-header"/);
  assert.match(html, /Made in Silicon Valley/);
});

test('nav anchor targets exist on the page', () => {
  const html = renderHomePage(EPISODES);
  for (const id of ['episodes', 'host', 'subscribe']) {
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

test('the cover meta renders its date in UTC, in the mock short form', () => {
  // 2026-09-08T17:00Z. The assertion guards the formatter staying UTC-pinned
  // and matching the mock's "SEP 8 2026".
  assert.match(renderHomePage(EPISODES), /SEP 8 2026/);
});

// Six cards show and the rest are revealed by the button. They stay in the
// markup rather than moving to a separate page, so the homepage keeps linking
// to every episode — which is what the archive is worth to search.
test('the archive shows six cards and hides the rest behind the button', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    videoId: `id${i}`, title: `Episode ${i}`, thumbnail: `https://i.ytimg.com/vi/id${i}/hq.jpg`,
    publishedAt: `2026-09-${String(28 - i).padStart(2, '0')}T17:00:00.000Z`,
    guestName: `Guest ${i}`, guestTitle: '', duration: '30 MIN',
  }));
  const html = renderHomePage(many);
  assert.equal((html.match(/class="ep-card"/g) || []).length, 6, 'expected six visible cards');
  assert.equal((html.match(/class="ep-card ep-card-more"/g) || []).length, 5, 'rest should be hidden, not dropped');
  assert.match(html, /All episodes/);

  // Every episode still reachable from the homepage: 11 archive + the cover.
  const links = new Set(html.match(/href="\/episode\/[^"]*"/g));
  assert.equal(links.size, 12, 'an episode lost its link');
});

test('without JavaScript the whole archive is shown and the button hidden', () => {
  const html = renderHomePage(EPISODES);
  const noscript = html.slice(html.indexOf('<noscript><style>'), html.indexOf('</noscript>', html.indexOf('<noscript><style>')));
  assert.match(noscript, /\.ep-card-more \{ display: block; \}/);
  assert.match(noscript, /\.archive-more \{ display: none; \}/);
});

// The host photo is referenced as /host.jpg. macOS is case-insensitive, so a
// file saved as host.JPG resolves locally and 404s on Vercel's Linux
// filesystem — which is exactly what happened once. This asserts the file the
// markup points at is the file that exists, spelled identically.
test('the host photo reference matches a real file, case included', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = renderHomePage(EPISODES);
  const ref = html.match(/src="\/(host\.[A-Za-z]+)"/);
  if (!ref) return; // no photo installed; the stills fallback is in use
  const dir = path.join(__dirname, '..', 'public');
  assert.ok(
    fs.readdirSync(dir).includes(ref[1]),
    `markup points at /${ref[1]} but public/ has no file spelled exactly that`
  );
});

// The hero carries an editorial pin; the cover story is always the genuinely
// newest episode. That split is what keeps "This week's cover story" true no
// matter what is pinned above it.
test('the cover story is always the newest episode and is labelled as such', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /pill-label">Latest<\/span>This week/);
  const cover = html.slice(html.indexOf('class="cover-card"'));
  assert.ok(cover.includes(`/episode/${EPISODES[0].videoId}/`), 'cover is not the newest episode');
});

test('the hero carries no "latest" wording, since it may be a pinned older episode', () => {
  const html = renderHomePage(EPISODES);
  const hero = html.slice(html.indexOf('class="hero"'), html.indexOf('class="cover"'));
  assert.ok(!/latest/i.test(hero), 'hero still claims to be the latest episode');
});

test('neither the hero nor the cover story is repeated in the archive', () => {
  const html = renderHomePage(EPISODES);
  const archive = html.slice(html.indexOf('id="episodes"'));
  const heroId = html.slice(html.indexOf('hero-media')).match(/href="\/episode\/([^/]+)\//)[1];
  const coverId = html.slice(html.indexOf('class="cover-card"')).match(/href="\/episode\/([^/]+)\//)[1];
  for (const id of new Set([heroId, coverId])) {
    assert.ok(!archive.includes(`/episode/${id}/`), `${id} duplicated in the archive`);
  }
});

test('the cover story shows its description, as the reference does', () => {
  const withDesc = EPISODES.map((e, i) => (i === 0 ? { ...e, description: 'A dek from the episode page.' } : e));
  assert.match(renderHomePage(withDesc), /<p class="cover-dek">A dek from the episode page\.<\/p>/);
});
