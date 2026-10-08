// vercel.json is configuration the tests can read like any other file. These
// checks keep the security headers and the host redirects from being lost in
// a later edit, and keep the CSP in step with the hosts the pages actually
// load from.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { SHARED_HEAD } = require('../lib/chrome');
const { renderHomePage } = require('../build.js');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const headers = Object.fromEntries(
  config.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value])
);

const EPISODES = [{
  videoId: 'aaa', title: 'An Episode', thumbnail: 'https://img.youtube.com/vi/aaa/maxresdefault.jpg',
  publishedAt: '2026-09-08T17:00:00.000Z', guestName: 'A Guest', guestTitle: '', duration: '39 MIN',
}];

test('the stray hosts redirect permanently to the canonical host, path preserved', () => {
  for (const host of ['podcast.marinamogilko.co', 'www.marinamogilko.co']) {
    const rule = config.redirects.find((r) => (r.has || []).some((h) => h.type === 'host' && h.value === host));
    assert.ok(rule, `no redirect for ${host}`);
    assert.equal(rule.source, '/:path*');
    assert.equal(rule.destination, 'https://marinamogilko.co/:path*');
    assert.equal(rule.permanent, true);
  }
});

test('host redirects come before the path redirects', () => {
  const firstPathRule = config.redirects.findIndex((r) => !r.has);
  const lastHostRule = config.redirects.map((r) => Boolean(r.has)).lastIndexOf(true);
  assert.ok(lastHostRule < firstPathRule, 'a path rule precedes a host rule');
});

test('the Roslansky legacy slug still maps to its episode', () => {
  const rule = config.redirects.find((r) => r.source === '/podcast/ryan-roslansky-linkedin-ceo-future-of-jobs');
  assert.equal(rule.destination, '/episode/ktpNFfpJ5rw/');
});

test('security headers are set on every path', () => {
  assert.match(headers['Strict-Transport-Security'], /max-age=\d{7,}/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Referrer-Policy'], /strict-origin/);
  assert.ok(headers['Permissions-Policy']);
  assert.ok(headers['Content-Security-Policy']);
});

test('the CSP allows every third-party host the pages load resources from', () => {
  const csp = headers['Content-Security-Policy'];
  const html = renderHomePage(EPISODES) + SHARED_HEAD;
  // Resources (not links): stylesheet, font and image hosts.
  const hosts = new Set(
    [...html.matchAll(/(?:src|href)="(https:\/\/[^/"]+)[^"]*"/g)]
      .filter((m) => /rel="stylesheet"|<img|<link rel="preconnect"/.test(html.slice(Math.max(0, m.index - 80), m.index + 10)) || /img\.youtube|fonts\./.test(m[1]))
      .map((m) => m[1])
  );
  for (const h of hosts) {
    assert.ok(csp.includes(h), `CSP does not allow ${h}`);
  }
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /connect-src 'self'/, 'the contact form posts to /api/contact and needs connect-src self');
});

test('the homepage declares a canonical URL and the shared identities', () => {
  const html = renderHomePage(EPISODES);
  assert.ok(html.includes('<link rel="canonical" href="https://marinamogilko.co/">'), 'no canonical');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const types = Object.fromEntries(ld['@graph'].map((n) => [n['@type'], n]));
  assert.equal(types.Person['@id'], 'https://marinamogilko.co/#marina');
  assert.ok(types.Person.sameAs.length >= 5, 'Person has too few sameAs links');
  assert.equal(types.PodcastSeries['@id'], 'https://marinamogilko.co/#podcast');
  assert.deepEqual(types.PodcastSeries.author, { '@id': 'https://marinamogilko.co/#marina' });
  assert.ok(types.PodcastSeries.sameAs.some((u) => u.includes('podcasts.apple.com')));
  assert.equal(types.Organization['@id'], 'https://marinamogilko.co/#org');
  // No dated claim lives in the schema; those belong on the About page with sources.
  assert.ok(!/\d+(\.\d+)?M\+?/.test(JSON.stringify(ld)), 'an audience count crept into the schema');
});
