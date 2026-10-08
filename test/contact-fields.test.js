const test = require('node:test');
const assert = require('node:assert');
const { TOPICS, FIELDS, RECIPIENTS, FALLBACK_RECIPIENT, recipientFor } = require('../lib/contact-fields');
const { renderHomePage } = require('../build.js');

const EPISODES = [{
  videoId: 'aaa', title: 'An Episode', thumbnail: 'https://i.ytimg.com/vi/aaa/hq.jpg',
  publishedAt: '2026-09-08T17:00:00.000Z', guestName: 'A Guest', guestTitle: '', duration: '39 MIN',
}];

test('topics match the team routing table, in order, without the duplicate "Partnership"', () => {
  assert.deepEqual(TOPICS, [
    'Brand deal / sponsorship', 'Podcast guest', 'Speaking / event',
    'Press / interview', 'Investment', 'Job / hiring', 'Something else',
  ]);
});

test('every topic has a recipient, and the table matches what the team agreed', () => {
  assert.deepEqual(RECIPIENTS, {
    'Brand deal / sponsorship': 'partnerships@marinamogilko.co',
    'Podcast guest': 'pr@marinamogilko.co',
    'Speaking / event': 'partnerships@marinamogilko.co',
    'Press / interview': 'pr@marinamogilko.co',
    'Investment': 'marina@marinamogilko.co',
    'Job / hiring': 'ks@marinamogilko.co',
    'Something else': 'marina@marinamogilko.co',
  });
  for (const t of TOPICS) assert.ok(RECIPIENTS[t], `no recipient for ${t}`);
  for (const t of Object.keys(RECIPIENTS)) assert.ok(TOPICS.includes(t), `recipient for a topic not offered: ${t}`);
});

test('an unknown topic falls back to pr@ rather than nowhere', () => {
  assert.equal(recipientFor('Partnership'), FALLBACK_RECIPIENT);
  assert.equal(recipientFor(undefined), 'pr@marinamogilko.co');
});

test('every recipient is on the marinamogilko.co domain', () => {
  for (const addr of Object.values(RECIPIENTS)) assert.match(addr, /@marinamogilko\.co$/);
});

test('required fields are name, email, topic, details', () => {
  const required = FIELDS.filter((f) => f.required).map((f) => f.name).sort();
  assert.deepEqual(required, ['details', 'email', 'name', 'topic']);
});

test('every field carries a length cap except the select', () => {
  for (const f of FIELDS) {
    if (f.type === 'select') continue;
    assert.ok(Number.isInteger(f.max) && f.max > 0, `${f.name} has no max`);
  }
});

test('the form renders every field with a real label', () => {
  const html = renderHomePage(EPISODES);
  for (const f of FIELDS) {
    assert.ok(html.includes(`name="${f.name}"`), `missing input: ${f.name}`);
    assert.ok(html.includes(`for="f-${f.name}"`), `missing label for: ${f.name}`);
    assert.ok(html.includes(`id="f-${f.name}"`), `label points at no control: ${f.name}`);
  }
});

test('the form carries the mock copy and posts to the handler', () => {
  const html = renderHomePage(EPISODES);
  assert.match(html, /pitch marina anything/i);
  assert.match(html, /Brand deals, podcast guests, speaking, press, partnerships/);
  assert.match(html, /send opportunity/i);
  assert.ok(html.includes('/api/contact'), 'form does not reference the endpoint');
});

test('the dropdown offers every topic and nothing else', () => {
  const html = renderHomePage(EPISODES);
  for (const t of TOPICS) assert.ok(html.includes(`>${t}</option>`), `missing option: ${t}`);
  assert.ok(!html.includes('>Partnership</option>'), 'the dropped "Partnership" option is still offered');
  assert.equal((html.match(/<option /g) || []).length, TOPICS.length, 'extra options in the dropdown');
});

test('the page never learns the routing table', () => {
  const html = renderHomePage(EPISODES);
  for (const addr of ['marina@marinamogilko.co', 'ks@marinamogilko.co']) {
    assert.ok(!html.includes(addr), `${addr} leaked into the markup`);
  }
});

test('the bot traps are present and hidden from real users', () => {
  const html = renderHomePage(EPISODES);
  assert.ok(html.includes('name="website"'), 'honeypot missing');
  assert.match(html, /name="website"[^>]*tabindex="-1"/, 'honeypot is keyboard reachable');
  assert.ok(html.includes('name="rendered"'), 'render timestamp missing');
});

test('there is a no-JS fallback, so the page is never a dead end', () => {
  const html = renderHomePage(EPISODES);
  const noscript = html.slice(html.indexOf('<noscript'), html.indexOf('</noscript>'));
  assert.match(noscript, /mailto:pr@marinamogilko\.co/);
});

// The honeypot timestamp is stamped client-side on load. Baking Date.now()
// into the markup would make every build emit a different index.html and would
// measure the age of the deploy rather than time spent on the page.
test('the rendered timestamp is stamped by the client, not the build', () => {
  const a = renderHomePage(EPISODES);
  const b = renderHomePage(EPISODES);
  assert.equal(a, b, 'renderHomePage is not deterministic');
  assert.match(a, /name="rendered" value=""/);
});
