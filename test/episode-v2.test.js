const test = require('node:test');
const assert = require('node:assert');
const { renderEpisodePage } = require('../build.js');
const { isoDuration, performers } = require('../lib/render-episode-v2');
const { ANALYTICS_HEAD } = require('../lib/chrome');

const BASE = {
  videoId: 'abcdefghijk',
  title: 'Acme CEO: Why "Boring" Wins | Jane Guest',
  format: 'interview',
  template: 'v2',
  guestName: 'Jane Guest',
  guestTitle: 'CEO of Acme',
  aboutGuest: 'Jane Guest runs Acme.',
  publishedAt: '2026-03-01T13:00:00.000Z',
  duration: '41 MIN',
  coverArt: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
  thumbnail: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
  summary: 'Jane explains why $100 is enough to start.',
  keyTakeaways: ['Start with $100.', 'Boring beats "exciting".'],
  timestamps: [{ time: '0:00', seconds: 0, title: 'Intro' }, { time: '12:30', seconds: 750, title: 'The $100 test' }],
  transcript: [
    { speaker: 'Marina Mogilko', text: 'Welcome to Silicon Valley Girl.' },
    { speaker: 'Jane Guest', text: 'People pay $50 to $100 for a "boring" product.' },
  ],
  relatedVideos: [{ videoId: 'zyxwvutsrqp', title: 'Other Episode', thumbnail: 'https://img.youtube.com/vi/zyxwvutsrqp/maxresdefault.jpg' }],
  platformLinks: { apple: 'https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545?i=1000000000001', spotify: 'https://open.spotify.com/episode/4miuPQzUH8NiZ6kdcZB7p7' },
  topics: [],
};

const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

test('v2 renders only when a page opts in', () => {
  const v1 = renderEpisodePage({ ...BASE, template: undefined });
  const v2 = renderEpisodePage(BASE);
  assert.match(v1, /role="tablist"/);
  assert.doesNotMatch(v2, /role="tablist"/);
});

test('the H1 is the title alone and the page title keeps the site name', () => {
  const html = renderEpisodePage(BASE);
  assert.ok(html.includes(`<h1>Acme CEO: Why &quot;Boring&quot; Wins | Jane Guest</h1>`));
  assert.ok(html.includes('<title>Acme CEO: Why &quot;Boring&quot; Wins | Jane Guest — Silicon Valley Girl Podcast</title>'));
});

test('summary, takeaways, chapters and transcript are visible sections with headings and anchors', () => {
  const html = renderEpisodePage(BASE);
  for (const id of ['summary', 'takeaways', 'chapters', 'transcript']) {
    assert.ok(html.includes(`id="${id}"`), `missing section ${id}`);
    assert.ok(html.includes(`href="#${id}"`), `missing nav link to ${id}`);
  }
  assert.match(html, /<h2>In this episode<\/h2>/);
  assert.match(html, /<h2>Key takeaways<\/h2>/);
  assert.match(html, /<h2>Chapters<\/h2>/);
  assert.match(html, /<h2>Transcript<\/h2>/);
  const content = html.replace(/\/\* CHROME-START \*\/[\s\S]*?\/\* CHROME-END \*\//, '');
  assert.doesNotMatch(content, /display:\s*none/, 'something is hidden by default');
  // The only script is the analytics loader every page carries.
  assert.doesNotMatch(html.replace(ANALYTICS_HEAD, ''), /<script>/, 'the page should need no JavaScript');
  assert.ok(html.includes('People pay $50 to $100 for a &quot;boring&quot; product.'));
});

test('platform buttons use the episode link when present and the show link, labelled, otherwise', () => {
  const html = renderEpisodePage(BASE);
  assert.ok(html.includes('href="https://open.spotify.com/episode/4miuPQzUH8NiZ6kdcZB7p7"'));
  assert.ok(html.includes('?i=1000000000001"'));
  assert.doesNotMatch(html, /\(show\)/);

  const noLinks = renderEpisodePage({ ...BASE, platformLinks: undefined });
  assert.ok(noLinks.includes('href="https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY"'));
  assert.match(noLinks, /Spotify <span class="show-level">\(show\)<\/span>/);
});

test('JSON-LD carries ISO duration, clips, shared ids and the platform pages', () => {
  const data = ld(renderEpisodePage(BASE));
  assert.equal(data.duration, 'PT41M');
  assert.equal(data['@id'], 'https://marinamogilko.co/episode/abcdefghijk/#episode');
  assert.equal(data.partOfSeries['@id'], 'https://marinamogilko.co/#podcast');
  assert.equal(data.host['@id'], 'https://marinamogilko.co/#marina');
  assert.deepEqual(data.performer, { '@type': 'Person', name: 'Jane Guest', jobTitle: 'CEO of Acme' });
  assert.equal(data.associatedMedia.duration, 'PT41M');
  assert.equal(data.associatedMedia.hasPart.length, 2);
  assert.deepEqual(data.associatedMedia.hasPart[0], {
    '@type': 'Clip', name: 'Intro', startOffset: 0, endOffset: 750,
    url: 'https://www.youtube.com/watch?v=abcdefghijk&t=0s',
  });
  assert.equal(data.associatedMedia.hasPart[1].endOffset, undefined);
  assert.deepEqual(data.sameAs, [BASE.platformLinks.apple, BASE.platformLinks.spotify]);
  assert.equal(data.isAccessibleForFree, true);
});

test('a compilation lists each guest as a person; a solo episode performs as the host', () => {
  const comp = { ...BASE, format: 'compilation', guestName: 'Sal Khan, Alex Mashrabov and Andrew Ng', guestTitle: 'Khan Academy, Higgsfield, Coursera' };
  assert.deepEqual(performers(comp), [
    { '@type': 'Person', name: 'Sal Khan' }, { '@type': 'Person', name: 'Alex Mashrabov' }, { '@type': 'Person', name: 'Andrew Ng' },
  ]);
  assert.match(renderEpisodePage(comp), /<h2>About the guests<\/h2>/);

  const solo = { ...BASE, format: 'solo', guestName: 'Marina Mogilko', guestTitle: 'Host, Silicon Valley Girl Podcast', platformLinks: undefined };
  const html = renderEpisodePage(solo);
  assert.deepEqual(ld(html).performer, { '@id': 'https://marinamogilko.co/#marina' });
  assert.match(html, /<h2>About the host<\/h2>/);
  assert.match(html, /alt="Marina Mogilko, host of the Silicon Valley Girl Podcast"/);
  assert.doesNotMatch(html, /at the time of recording/);
  assert.ok(html.includes('content="Acme CEO: Why &quot;Boring&quot; Wins | Jane Guest — Silicon Valley Girl Podcast"'));
});

test('durations convert to ISO 8601 or are left out', () => {
  assert.equal(isoDuration('24 MIN'), 'PT24M');
  assert.equal(isoDuration('75 MIN'), 'PT1H15M');
  assert.equal(isoDuration('60 MIN'), 'PT1H');
  assert.equal(isoDuration('about an hour'), null);
  const data = ld(renderEpisodePage({ ...BASE, duration: 'about an hour' }));
  assert.equal(data.duration, undefined);
});

test('the meta description and the guest role line read as before', () => {
  const html = renderEpisodePage(BASE);
  assert.ok(html.includes('content="Marina Mogilko interviews Jane Guest, CEO of Acme, on the Silicon Valley Girl Podcast"'));
  assert.match(html, /CEO of Acme <span class="when">\(at the time of recording\)<\/span>/);
  assert.match(html, /<span class="format">Interview<\/span>/);
  assert.match(html, /41 min/);
});
