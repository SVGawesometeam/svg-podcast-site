// Topic hubs, the topic data on episodes, and the directory filters.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { renderTopicPage, renderTopicsIndex, episodesFor } = require('../lib/render-topics');
const { renderEpisodeCard } = require('../lib/cards');
const { renderEpisodesPage, renderEpisodePage, renderHomePage, TOPIC_HUBS, topicsOf } = require('../build.js');
const { validate } = require('../lib/episode-data');
const { ANALYTICS_HEAD } = require('../lib/chrome');

const ROOT = path.join(__dirname, '..');
const topics = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'topics.json'), 'utf8')).topics;
const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

const EP = (id, over) => ({
  videoId: id, title: `Episode ${id}`, format: 'interview', thumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  publishedAt: '2026-03-01T00:00:00.000Z', guestName: 'A Guest', guestTitle: 'CEO of Acme', duration: '30 MIN', topics: [], ...over,
});
const EPISODES = [
  EP('aaaaaaaaaaa', { topics: ['future-of-work', 'ai-skills-and-careers'], publishedAt: '2026-01-01T00:00:00.000Z' }),
  EP('bbbbbbbbbbb', { topics: ['future-of-work'], publishedAt: '2026-05-01T00:00:00.000Z', format: 'solo', guestName: 'Marina Mogilko' }),
  EP('ccccccccccc', { topics: ['ai-skills-and-careers', 'future-of-work'], guestName: 'Sal Khan', title: 'Khan Academy & AI' }),
  EP('ddddddddddd', { topics: ['money-and-investing'], format: 'compilation', guestName: 'A, B' }),
];

test('every topic has a slug, a name, a description and a question, and every episode names known topics', () => {
  const slugs = new Set(topics.map((t) => t.slug));
  for (const t of topics) for (const k of ['slug', 'name', 'description', 'question']) assert.ok(t[k], `${t.slug}: missing ${k}`);
  assert.ok(topics.length >= 7 && topics.length <= 10);
  const counts = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'episodes'))) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'episodes', f), 'utf8'));
    assert.ok(Array.isArray(d.topics) && d.topics.length >= 1 && d.topics.length <= 3, `${f}: ${JSON.stringify(d.topics)}`);
    for (const s of d.topics) { assert.ok(slugs.has(s), `${f}: unknown topic ${s}`); counts[s] = (counts[s] || 0) + 1; }
  }
  for (const t of topics) assert.ok(counts[t.slug] >= 6, `${t.slug} has only ${counts[t.slug] || 0} episodes`);
});

test('bad topic lists are rejected by validation and unknown slugs stop the build', () => {
  const ok = EP('aaaaaaaaaaa', { coverArt: 'x', transcript: [{ speaker: 'A', text: 'b' }], keyTakeaways: [], timestamps: [] });
  assert.deepEqual(validate({ ...ok, topics: ['future-of-work'] }), []);
  assert.match(validate({ ...ok, topics: 'future-of-work' }).join(), /array/);
  assert.match(validate({ ...ok, topics: ['Future Of Work'] }).join(), /bad topic slug/);
  assert.match(validate({ ...ok, topics: ['a', 'b', 'c', 'd'] }).join(), /more than three/);
  assert.match(validate({ ...ok, topics: ['a', 'a'] }).join(), /duplicate/);
  assert.throws(() => topicsOf({ videoId: 'x', topics: ['no-such-hub'] }), /not in content\/topics\.json/);
  assert.deepEqual(topicsOf({ topics: ['future-of-work'] }), [{ slug: 'future-of-work', name: 'Future of work' }]);
});

test('a hub lists primary episodes first, then the ones that touch the topic, newest first', () => {
  const { primary, secondary } = episodesFor('future-of-work', EPISODES);
  assert.deepEqual(primary.map((e) => e.videoId), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
  assert.deepEqual(secondary.map((e) => e.videoId), ['ccccccccccc']);
  const topic = topics.find((t) => t.slug === 'future-of-work');
  const html = renderTopicPage(topic, EPISODES, topics, { newsletterCta: () => '<div class="cta">CTA</div>' });
  assert.ok(html.includes('<h1>Future of work</h1>'));
  assert.ok(html.includes(topic.question));
  assert.match(html, /3 episodes: 2 interviews, 1 solo episode/);
  assert.ok(html.indexOf('/episode/bbbbbbbbbbb/') < html.indexOf('/episode/aaaaaaaaaaa/'));
  const main = html.slice(html.indexOf('<main'));
  assert.ok(main.indexOf('Also covered in') < main.indexOf('/episode/ccccccccccc/'), 'secondary episode listed under its own heading');
  assert.ok(main.indexOf('/episode/aaaaaaaaaaa/') < main.indexOf('Also covered in'));
  assert.ok(!html.includes('/episode/ddddddddddd/'));
  assert.ok(html.includes('<div class="cta">CTA</div>'));
  assert.ok(html.includes('<link rel="canonical" href="https://marinamogilko.co/topics/future-of-work/">'));
  assert.ok(html.includes('href="/topics/ai-skills-and-careers/"'), 'sibling hubs are linked');
  assert.ok(!html.includes('href="/topics/future-of-work/"'), 'a hub does not link itself');
  assert.doesNotMatch(html.replace(ANALYTICS_HEAD, ''), /<script>/, 'hubs need no JavaScript');
  const data = ld(html);
  assert.equal(data['@type'], 'CollectionPage');
  assert.equal(data.mainEntity.numberOfItems, 3);
  assert.equal(data.mainEntity.itemListElement[0].url, 'https://marinamogilko.co/episode/bbbbbbbbbbb/');
});

test('an editorial section renders when the hub has reviewed copy', () => {
  const topic = topics[0];
  const html = renderTopicPage(topic, EPISODES, topics, { editorial: '## Marina\'s take\n\nShort **answer**.' });
  assert.ok(html.includes('<h2>Marina&#39;s take</h2>') || html.includes("<h2>Marina's take</h2>"));
  assert.ok(html.includes('Short <strong>answer</strong>.'));
});

test('the topics index links every hub with its question and count', () => {
  const html = renderTopicsIndex(topics, EPISODES);
  for (const t of topics) {
    assert.ok(html.includes(`href="/topics/${t.slug}/"`), `index lacks ${t.slug}`);
    assert.ok(html.includes(t.question.replace(/'/g, '&#39;')) || html.includes(t.question), `index lacks the question for ${t.slug}`);
  }
  assert.match(html, /3 episodes<\/p>/, 'future-of-work count');
  assert.equal(ld(html).hasPart.length, topics.length);
});

test('episode cards carry the filter data and a format label', () => {
  const html = renderEpisodeCard(EP('ccccccccccc', { topics: ['ai-skills-and-careers', 'future-of-work'], guestName: 'Sal Khan', title: 'Khan Academy & AI' }));
  assert.ok(html.includes('data-format="interview"'));
  assert.ok(html.includes('data-topics="ai-skills-and-careers future-of-work"'));
  assert.ok(html.includes('data-search="khan academy &amp; ai sal khan ceo of acme"'));
  assert.ok(html.includes('<span class="ep-format">Interview</span>'));
  assert.ok(html.includes('Khan Academy &amp; AI</h3>'));
});

test('the directory keeps every episode in the HTML and the toolbar is hidden until the script runs', () => {
  const html = renderEpisodesPage(EPISODES, topics);
  for (const ep of EPISODES) assert.ok(html.includes(`href="/episode/${ep.videoId}/"`));
  assert.match(html, /<form class="toolbar" id="filters" hidden/);
  assert.match(html, /<option value="interview">Interviews<\/option>/);
  for (const t of topics) assert.ok(html.includes(`<option value="${t.slug}">`), `no topic option for ${t.slug}`);
  assert.match(html, /form\.hidden = false/);
  assert.ok(!/href="[^"]*\?(q|format|topic)=/.test(html), 'filters must not create URLs');
  assert.match(html, /4 episodes</);
});

test('v2 episode pages show their topics as links and carry them as keywords', () => {
  const d = {
    videoId: 'abcdefghijk', title: 'T', format: 'interview', template: 'v2', guestName: 'Jane', guestTitle: 'CEO', aboutGuest: 'x',
    publishedAt: '2026-03-01T13:00:00.000Z', duration: '41 MIN', coverArt: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
    thumbnail: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg', summary: 's', keyTakeaways: ['k'], timestamps: [],
    transcript: [{ speaker: 'Jane', text: 'hi' }], relatedVideos: [], topics: ['future-of-work', 'money-and-investing'],
  };
  const html = renderEpisodePage(d);
  assert.ok(html.includes('<a href="/topics/future-of-work/">Future of work</a>'));
  assert.ok(html.includes('<a href="/topics/money-and-investing/">Money and investing</a>'));
  assert.equal(ld(html).keywords, 'Future of work, Money and investing');
  const v1 = renderEpisodePage({ ...d, template: undefined });
  assert.ok(!v1.includes('/topics/future-of-work/'), 'v1 pages are unchanged until the template rolls out');
});

test('the homepage has the topic strip and the nav links the topics index', () => {
  const html = renderHomePage(EPISODES, { topics });
  assert.match(html, /<h2 class="section-title">Explore by topic<\/h2>/);
  for (const t of topics) assert.ok(html.includes(`href="/topics/${t.slug}/"`));
  assert.ok(html.includes('href="/topics/" class="all"'));
  assert.ok(html.includes('<a href="/topics/">Topics</a>'));
});

test('the sitemap and llms.txt list the hubs', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('<loc>https://marinamogilko.co/topics/</loc>'));
  for (const t of topics) assert.ok(sitemap.includes(`<loc>https://marinamogilko.co/topics/${t.slug}/</loc>`));
  const llms = fs.readFileSync(path.join(ROOT, 'public', 'llms.txt'), 'utf8');
  for (const t of topics) assert.ok(llms.includes(`https://marinamogilko.co/topics/${t.slug}/`), `llms.txt lacks ${t.slug}`);
  assert.equal(TOPIC_HUBS.length, topics.length);
});

test('a hub slug that is not a plain slug stops the build before any path is built', () => {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-topics-'));
  for (const f of ['build.js', 'package.json', 'podcast-video-ids.txt']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.cpSync(path.join(ROOT, 'lib'), path.join(tmp, 'lib'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'content'), path.join(tmp, 'content'), { recursive: true });
  const bad = JSON.parse(fs.readFileSync(path.join(tmp, 'content', 'topics.json'), 'utf8'));
  bad.topics[0].slug = '../escape';
  fs.writeFileSync(path.join(tmp, 'content', 'topics.json'), JSON.stringify(bad));
  let out = '';
  try {
    execFileSync(process.execPath, ['-e', 'require("./build.js")'], { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });
    assert.fail('should have thrown');
  } catch (e) { out = String(e.stderr || e.message); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  assert.match(out, /bad slug/);
});
