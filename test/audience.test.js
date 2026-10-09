// The weekly audience job: what it accepts from the dashboard, what it
// writes, and how the numbers are shown.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { validateAudience, summarise, formatCount, countsFor, PLATFORMS } = require('../lib/audience');
const { renderAboutPage } = require('../lib/pages');
const { renderHomePage } = require('../build.js');

const ROOT = path.join(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));
const NOW = Date.parse('2026-10-09T08:00:00Z');
const good = () => ({
  readAt: '2026-10-08T06:42:27.986Z', total: 18358261, counted: 29, accounts: 29,
  platforms: [
    { key: 'youtube', label: 'YouTube', subtotal: 12632090, rows: [] },
    { key: 'tiktok', label: 'TikTok', subtotal: 3537106, rows: [] },
    { key: 'instagram', label: 'Instagram', subtotal: 1664053, rows: [] },
    { key: 'email', label: 'Email', subtotal: 85518, rows: [] },
    { key: 'mystery', label: 'Something new', subtotal: 999999999, rows: [] },
  ],
});

test('a fresh, complete read is accepted', () => {
  assert.deepEqual(validateAudience(good(), NOW), []);
});

test('a stale, partial or malformed read is refused', () => {
  assert.match(validateAudience({ ...good(), readAt: '2026-10-01T06:42:27.986Z' }, NOW).join(), /older than 3 days/);
  assert.match(validateAudience({ ...good(), counted: 27 }, NOW).join(), /27 of 29/);
  assert.match(validateAudience({ ...good(), total: '18M' }, NOW).join(), /total/);
  assert.match(validateAudience({ ...good(), platforms: [{ key: 'youtube', subtotal: 'lots' }] }, NOW).join(), /youtube subtotal/);
  assert.ok(validateAudience(null, NOW).length);
  assert.ok(validateAudience('<html>', NOW).length);
  assert.match(validateAudience({ ...good(), readAt: '2099-01-01T00:00:00Z' }, NOW).join(), /future/);
  assert.match(validateAudience({ ...good(), total: 1e12 }, NOW).join(), /plausible/);
  assert.deepEqual(validateAudience({ ...good(), platforms: [null, { key: 'youtube', subtotal: 1 }] }, NOW), [], 'a null row is skipped, not a crash');
});

test('a platform key from Object.prototype is not a known platform', () => {
  const sneaky = { ...good(), platforms: [{ key: 'constructor', subtotal: 99999999 }, { key: 'youtube', subtotal: 5 }] };
  assert.deepEqual(validateAudience(sneaky, NOW), []);
  assert.deepEqual(summarise(sneaky).platforms, { youtube: 5 });
  const html = renderAboutPage({ ...site, counts: countsFor({ updatedAt: '2026-10-08T00:00:00Z', total: 10, platforms: { constructor: 99999999 } }) }, []);
  assert.ok(!html.includes('native code') && !html.includes('on constructor'));
});

test('the file keeps only the date, the total and known platforms', () => {
  const out = summarise(good());
  assert.deepEqual(Object.keys(out), ['updatedAt', 'total', 'platforms']);
  assert.equal(out.updatedAt, '2026-10-08T06:42:27.986Z');
  assert.equal(out.total, 18358261);
  assert.deepEqual(out.platforms, { youtube: 12632090, tiktok: 3537106, instagram: 1664053, email: 85518 });
  assert.ok(!('mystery' in out.platforms), 'an unknown platform must not reach the site');
});

test('counts are rounded down and never printed in full', () => {
  assert.equal(formatCount(18358261), '18.3M+');
  assert.equal(formatCount(12632090), '12.6M+');
  assert.equal(formatCount(1000000), '1M+');
  assert.equal(formatCount(85518), '85K+');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(NaN), '');
});

test('the About page shows the total and the three largest platforms with the date', () => {
  const counts = countsFor(summarise(good()));
  assert.equal(counts.updatedAt, '2026-10-08');
  assert.deepEqual(counts.items.map((i) => i.value), ['18.3M+', '12.6M+', '3.5M+', '1.6M+']);
  assert.deepEqual(counts.items.map((i) => i.label), ['followers across all channels', 'on YouTube', 'on TikTok', 'on Instagram']);
  const html = renderAboutPage({ ...site, counts }, []);
  assert.ok(html.includes('18.3M+') && html.includes('as of 2026-10-08'));
  assert.ok(!html.includes('18358261') && !html.includes('18,358,261'));
  assert.deepEqual(countsFor(null), { updatedAt: null, items: [] });
});

test('the homepage stat uses the total when there is one and the old word when not', () => {
  const EP = [{ videoId: 'aaa', title: 'T', thumbnail: '', publishedAt: '2026-09-08T17:00:00.000Z', guestName: 'G', guestTitle: '', duration: '1 MIN' }];
  assert.match(renderHomePage(EP, { audience: summarise(good()) }), /<span class="stat-value">18.3M\+<\/span><span class="stat-label">Following along/);
  assert.match(renderHomePage(EP), /<span class="stat-value">Millions<\/span>/);
});

test('the committed audience file is one the build will accept', () => {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'audience.json'), 'utf8'));
  assert.ok(Number.isFinite(a.total) && a.total > 0);
  assert.match(a.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  for (const k of Object.keys(a.platforms)) assert.ok(Object.hasOwn(PLATFORMS, k), `unknown platform ${k}`);
});

test('the workflow runs the script, rebuilds and commits only the files it owns', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'audience.yml'), 'utf8');
  assert.match(yml, /cron: "0 8 \* \* 1"/);
  assert.match(yml, /node scripts\/update-audience\.js/);
  assert.match(yml, /node build\.js/);
  assert.match(yml, /npm test/);
  assert.match(yml, /git add content\/audience\.json public sitemap-lastmod\.json/);
  assert.match(yml, /permissions:\s+contents: write/);
  assert.match(yml, /concurrency:\s+group: audience/);
});

// The weekly job builds on CI and commits public/. A registry ID without a
// reviewed JSON file would otherwise be imported as a draft and published.
test('a CI build refuses to import a draft episode', () => {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-ci-'));
  // A throwaway copy of the inputs with one unknown ID appended.
  for (const f of ['build.js', 'package.json', 'podcast-video-ids.txt']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.cpSync(path.join(ROOT, 'lib'), path.join(tmp, 'lib'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'content'), path.join(tmp, 'content'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'public'));
  fs.appendFileSync(path.join(tmp, 'podcast-video-ids.txt'), '\nzzzzzzzzzzz\n');
  let out = '';
  try {
    execFileSync(process.execPath, ['build.js'], { cwd: tmp, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: 'pipe' });
    assert.fail('build should have refused');
  } catch (e) {
    out = String(e.stderr || e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  assert.match(out, /a CI build does not import drafts/);
});
