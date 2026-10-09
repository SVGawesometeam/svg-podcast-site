// The static pages of Release 4: /about/, /newsletter/, /privacy/ and /terms/.
// They read content/site.json and content/legal/*.md; these tests render them
// with the real content so a broken fact file fails here, not on Vercel.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mdToHtml, renderLegalPage, renderAboutPage, renderNewsletterPage, episodeFor } = require('../lib/pages');
const { ANALYTICS_HEAD } = require('../lib/chrome');
const { esc } = require('../lib/html');

const ROOT = path.join(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));
const legal = (name) => fs.readFileSync(path.join(ROOT, 'content', 'legal', `${name}.md`), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const csp = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;

const EPISODES = [
  { videoId: 'aaaaaaaaaaa', title: 'Reid Hoffman on AI', guestName: 'Reid Hoffman', format: 'interview', publishedAt: '2026-03-01T00:00:00.000Z', thumbnail: '', duration: '40 MIN' },
  { videoId: 'bbbbbbbbbbb', title: 'Best of', guestName: 'Reid Hoffman, Sal Khan', format: 'compilation', publishedAt: '2026-04-01T00:00:00.000Z', thumbnail: '', duration: '40 MIN' },
  { videoId: 'ccccccccccc', title: 'Solo', guestName: 'Marina Mogilko', format: 'solo', publishedAt: '2026-02-01T00:00:00.000Z', thumbnail: '', duration: '20 MIN' },
];
const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
const noAnalytics = (html) => html.replace(ANALYTICS_HEAD, '');

test('the markdown subset renders headings, lists, bold, line breaks and mailto links', () => {
  const html = mdToHtml('## Heading\n\nA **bold** word & an email: a@b.co\n\nLine one\nLine two\n\n- one\n- two <b>\n');
  assert.ok(html.includes('<h2>Heading</h2>'));
  assert.ok(html.includes('A <strong>bold</strong> word &amp; an email: <a href="mailto:a@b.co">a@b.co</a>'));
  assert.ok(html.includes('<p>Line one<br>\nLine two</p>'));
  assert.ok(html.includes('<li>two &lt;b&gt;</li>'), 'markup in the text must be escaped');
});

test('the legal pages carry the whole text, the date and no Tilda link', () => {
  for (const [name, title] of [['privacy', 'Privacy Policy'], ['terms', 'Terms of Service']]) {
    const md = legal(name);
    const html = renderLegalPage(md, { path: `/${name}/`, description: 'x' });
    assert.ok(html.includes(`<h1>${title}</h1>`));
    assert.ok(html.includes(`<link rel="canonical" href="https://marinamogilko.co/${name}/">`));
    assert.match(html, /Last updated: August \d+, 2025/);
    assert.ok(html.includes('Linguamarina, Inc.'));
    assert.ok(!html.includes('partnerships.marinamogilko.co'));
    assert.doesNotMatch(noAnalytics(html), /<script>/, 'no JavaScript on a legal page');
    // Every paragraph of the source made it to the page.
    const paragraphs = md.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b && !b.startsWith('#') && !b.startsWith('Last updated'));
    for (const para of paragraphs) {
      const firstWords = para.replace(/\*\*/g, '').replace(/^- /, '').slice(0, 40);
      assert.ok(html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').includes(firstWords), `${name}: paragraph missing: ${firstWords}`);
    }
  }
});

test('the privacy policy says the duplicated sentence once and the contact address is complete', () => {
  const html = renderLegalPage(legal('privacy'), { path: '/privacy/', description: 'x' });
  assert.equal((html.match(/knowingly permits the use of malware/g) || []).length, 1);
  assert.ok(html.includes('611 Gateway Blvd<br>'));
  assert.ok(html.includes('South San Francisco, CA, 94080'));
});

test('the about page renders every fact, press link and speaking date from site.json', () => {
  const html = renderAboutPage(site, EPISODES);
  assert.ok(html.includes('<h1>Marina Mogilko</h1>'));
  assert.ok(html.includes('<link rel="canonical" href="https://marinamogilko.co/about/">'));
  assert.ok(html.includes('src="/marina-mogilko.jpg"'));
  for (const f of site.facts) assert.ok(html.includes(esc(f.text)), `fact missing: ${f.text}`);
  for (const a of site.press) assert.ok(html.includes(`href="${a.url}"`), `press link missing: ${a.outlet}`);
  for (const s of site.speaking) assert.ok(html.includes(`${s.event}</strong>, ${s.place}, ${s.year}`), `speaking missing: ${s.event}`);
  assert.match(html, /woman-hosted/);
  assert.ok(html.includes('mailto:partnerships@marinamogilko.co') && html.includes('mailto:pr@marinamogilko.co'));
  assert.ok(!/marina@|ks@/.test(html), 'private addresses must not be shown');
  assert.doesNotMatch(noAnalytics(html), /<script>/, 'no JavaScript on the about page');
});

test('the about page shows no counts until the dashboard job has written them', () => {
  const html = renderAboutPage({ ...site, counts: { updatedAt: null, items: [] } }, EPISODES);
  assert.ok(!html.includes('class="counts"'));
  assert.ok(!/\d+(\.\d+)?M\+?\s*(subscribers|followers)/i.test(html), 'a stale audience number slipped in');
  const withCounts = renderAboutPage({ ...site, counts: { updatedAt: '2026-10-08', items: [{ label: 'YouTube subscribers', value: '1.6M' }] } }, EPISODES);
  assert.ok(withCounts.includes('class="counts"') && withCounts.includes('1.6M') && withCounts.includes('as of 2026-10-08'));
});

test('featured guests link to their interview rather than a compilation, and missing ones are skipped', () => {
  assert.equal(episodeFor('Reid Hoffman', EPISODES).videoId, 'aaaaaaaaaaa');
  assert.equal(episodeFor('Sal Khan', EPISODES).videoId, 'bbbbbbbbbbb');
  assert.equal(episodeFor('Nobody', EPISODES), null);
  const html = renderAboutPage({ ...site, featuredGuests: ['Reid Hoffman', 'Nobody'] }, EPISODES);
  assert.ok(html.includes('<a href="/episode/aaaaaaaaaaa/">Reid Hoffman</a>'));
  assert.ok(!html.includes('Nobody'));
  assert.match(html, /3 episodes on this site: 1 interviews, 1 solo episodes and 1 compilations/);
});

test('the about page JSON-LD describes the same person the homepage declares', () => {
  const data = ld(renderAboutPage(site, EPISODES));
  const byType = Object.fromEntries(data['@graph'].map((n) => [n['@type'], n]));
  assert.equal(byType.ProfilePage.mainEntity['@id'], 'https://marinamogilko.co/#marina');
  assert.equal(byType.Person['@id'], 'https://marinamogilko.co/#marina');
  assert.equal(byType.Person.url, 'https://marinamogilko.co/about/');
  assert.equal(byType.Person.image, 'https://marinamogilko.co/marina-mogilko.jpg');
  assert.equal(byType.Person.subjectOf.length, site.press.length);
  assert.deepEqual(byType.Person.award, site.awards);
  assert.ok(byType.Person.sameAs.length >= 5);
  assert.equal(byType.PodcastSeries['@id'], 'https://marinamogilko.co/#podcast');
});

test('the newsletter page links the subscribe form and the archive', () => {
  const html = renderNewsletterPage(site);
  assert.ok(html.includes('<h1>Future Proof</h1>'));
  assert.ok(html.includes(`href="${site.newsletter.url.replace(/&/g, '&amp;')}"`));
  assert.ok(html.includes('href="https://siliconvalleygirl.beehiiv.com/"'));
  assert.ok(html.includes('<link rel="canonical" href="https://marinamogilko.co/newsletter/">'));
});

test('the CSP names the tag manager and analytics hosts the loader needs', () => {
  assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.analytics\.google\.com/);
  assert.match(csp, /img-src [^;]*https:\/\/\*\.google-analytics\.com/);
  assert.match(csp, /frame-src 'none'/, 'frames stay blocked');
});

test('the old legal paths redirect to the new pages', () => {
  const to = (source) => (vercel.redirects.find((r) => r.source === source) || {}).destination;
  assert.equal(to('/plc'), '/privacy/');
  assert.equal(to('/ts'), '/terms/');
});

test('the sitemap and llms.txt list the new pages', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  for (const p of ['/about/', '/newsletter/', '/privacy/', '/terms/']) assert.ok(sitemap.includes(`<loc>https://marinamogilko.co${p}</loc>`), `sitemap lacks ${p}`);
  const llms = fs.readFileSync(path.join(ROOT, 'public', 'llms.txt'), 'utf8');
  assert.ok(llms.includes('https://marinamogilko.co/about/'));
  for (const f of site.facts) assert.ok(llms.includes(f.text), `llms.txt lacks fact: ${f.text}`);
  // A count may appear only with its date, the way the audience job writes it.
  for (const line of llms.split('\n')) {
    if (/\d+(\.\d+)?[MK]\+/.test(line)) assert.match(line, /as of \d{4}-\d{2}-\d{2}/, `undated count in llms.txt: ${line}`);
  }
});
