const test = require('node:test');
const assert = require('node:assert');
const chrome = require('../lib/chrome');

test('exports every icon both builders reference', () => {
  for (const k of ['youtube', 'spotify', 'apple', 'instagram', 'linkedin', 'twitter', 'tiktok', 'newsletter', 'mail']) {
    assert.ok(chrome.ICONS[k], `missing icon: ${k}`);
    assert.match(chrome.ICONS[k], /^<svg/);
  }
});

test('head carries the favicons the old batch builder was missing', () => {
  assert.match(chrome.SHARED_HEAD, /rel="icon"/);
  assert.match(chrome.SHARED_HEAD, /apple-touch-icon/);
  assert.match(chrome.SHARED_HEAD, /site\.webmanifest/);
});

test('header and footer are single strings', () => {
  assert.equal(typeof chrome.SHARED_HEADER, 'string');
  assert.equal(typeof chrome.SHARED_FOOTER, 'string');
});

// Palette read off the mock itself, which authors in oklch:
//   ground oklch(0.9938 0.0102 95.5) -> #FFFDF6 (warm paper, not a grey)
//   accent oklch(0.5729 0.2261 28.5) -> #DF1615
//   ink    oklch(0.1985 0.0084 84)   -> #171511
// The design system's #E63333/#F5F5F5 are close but not these; the brief was
// to look like the mock, so the mock wins.
test('chrome CSS defines the mock palette', () => {
  assert.match(chrome.CHROME_CSS, /--accent:\s*#DF1615/);
  assert.match(chrome.CHROME_CSS, /--ground:\s*#FFFDF6/);
  assert.match(chrome.CHROME_CSS, /--ink:\s*#171511/);
});

// The chrome is injected into episode pages too, whose bodies must not change.
// Setting a body font here would restyle every transcript.
test('chrome CSS does not set a body font', () => {
  assert.ok(!/body\s*\{[^}]*font-family/.test(chrome.CHROME_CSS),
    'chrome must not impose a body font on episode pages');
});

test('display and body faces are loaded', () => {
  assert.match(chrome.SHARED_HEAD, /Bebas\+Neue/);
  assert.match(chrome.SHARED_HEAD, /Barlow/);
});

test('header is the black bar with wordmark and nav', () => {
  assert.match(chrome.SHARED_HEADER, /SILICON VALLEY GIRL/);
  assert.match(chrome.SHARED_HEADER, /WITH MARINA MOGILKO/);
  // Nav since Release 4: the archive, the About page, the newsletter page and
  // the pitch form, in that order. Homepage sections keep their ids for links
  // from elsewhere; the nav no longer points at them.
  for (const [href, label] of [['/topics/', 'Topics'], ['/about/', 'About Marina'], ['/partnerships/', 'For brands'], ['/newsletter/', 'Newsletter'], ['/#work', 'Contact us']]) {
    assert.ok(chrome.SHARED_HEADER.includes(`href="${href}"`), `missing nav link: ${href}`);
    assert.ok(chrome.SHARED_HEADER.includes(`>${label}<`), `missing nav label: ${label}`);
  }
  assert.match(chrome.SHARED_HEADER, /href="\/#work" class="nav-cta"/, 'the contact form is the call to action');
  assert.ok(!chrome.SHARED_HEADER.includes('Work with Marina'), 'reads like a job ad; the label is Contact us');
  assert.ok(!/>Episodes</.test(chrome.SHARED_HEADER), 'Episodes left the top menu; it is the first item under Topics');
});

test('the Topics item opens a sub-menu: all episodes first, then every hub', () => {
  const { TOPIC_MENU, SHARED_HEADER } = chrome;
  const topics = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'content', 'topics.json'), 'utf8')).topics;
  assert.deepEqual(TOPIC_MENU[0], { href: '/episodes/', label: 'All episodes' });
  assert.equal(TOPIC_MENU.length, topics.length + 1);
  const sub = SHARED_HEADER.slice(SHARED_HEADER.indexOf('aria-label="Topics"'), SHARED_HEADER.indexOf('aria-label="About Marina"'));
  for (const m of TOPIC_MENU) assert.ok(sub.includes(`href="${m.href}">${m.label}<`), `Topics sub-menu lacks ${m.label}`);
});

test('the About Marina item opens a sub-menu of the About page sections, without JavaScript', () => {
  const sub = chrome.SHARED_HEADER.slice(chrome.SHARED_HEADER.indexOf('aria-label="About Marina"'), chrome.SHARED_HEADER.indexOf('</ul>', chrome.SHARED_HEADER.indexOf('aria-label="About Marina"')));
  for (const m of chrome.ABOUT_MENU) assert.ok(sub.includes(`href="${m.href}">${m.label}<`), `sub-menu lacks ${m.label}`);
  assert.ok(chrome.ABOUT_MENU.every((m) => m.href.startsWith('/about/')), 'every item is a section of the About page');
  assert.match(chrome.CHROME_CSS, /\.nav-menu:hover \.nav-sub, \.nav-menu:focus-within \.nav-sub/, 'opens on hover and on keyboard focus');
  assert.ok(!/<script/.test(chrome.SHARED_HEADER));
});

test('nav anchors are root-relative so they work from an episode page', () => {
  assert.ok(!/href="#/.test(chrome.SHARED_HEADER), 'bare fragment would not leave an episode page');
});

test('footer carries the mock copy verbatim', () => {
  assert.match(chrome.SHARED_FOOTER, /Made in Silicon Valley/);
});

test('focus styling is present, so keyboard users can see where they are', () => {
  assert.match(chrome.CHROME_CSS, /:focus-visible/);
});

// Legal links live in the shared footer so they reach every page — the
// homepage, /episodes/ and all 118 episode pages — rather than the homepage
// alone, which is the usual way these end up missing where they matter.
// Since Release 4 the texts live on this site, not on the Tilda subdomain
// that is being retired.
test('the footer carries the legal links', () => {
  assert.match(chrome.SHARED_FOOTER, /href="\/privacy\/"[^>]*>Privacy Policy</);
  assert.match(chrome.SHARED_FOOTER, /href="\/terms\/"[^>]*>Terms of Service</);
  assert.ok(!chrome.SHARED_FOOTER.includes('partnerships.marinamogilko.co'), 'footer still points at Tilda');
});

// The tag manager loader is the one script every page carries. It is a plain
// async script (not the injected snippet) so the CSP can name its host, and
// the dataLayer push comes before it.
test('the shared head loads the tag manager after priming the dataLayer', () => {
  assert.equal(chrome.GTM_ID, 'GTM-WZ57XVB');
  assert.ok(chrome.SHARED_HEAD.includes(chrome.ANALYTICS_HEAD), 'analytics not in the shared head');
  const push = chrome.ANALYTICS_HEAD.indexOf('window.dataLayer.push');
  const load = chrome.ANALYTICS_HEAD.indexOf('<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-WZ57XVB">');
  assert.ok(push !== -1 && load !== -1 && push < load, 'dataLayer must be primed before gtm.js loads');
  assert.ok(!/noscript|<iframe/.test(chrome.ANALYTICS_HEAD), 'frames are blocked site-wide; no noscript iframe');
});

// The icons live in the sticky header so the accounts are reachable from any
// scroll position on every page, not just the foot of the homepage.
test('the header carries every social account as an icon', () => {
  const { SOCIAL_LINKS, SHARED_HEADER } = chrome;
  assert.ok(SOCIAL_LINKS.length >= 7, 'expected the full set of accounts');
  for (const s of SOCIAL_LINKS) {
    assert.ok(SHARED_HEADER.includes(s.url), `header missing ${s.label}`);
  }
});

// Icon-only links have no text, so each needs an accessible name or a screen
// reader announces "link" seven times in a row.
test('each header icon has an accessible name and no visible label text', () => {
  const { SOCIAL_LINKS, SHARED_HEADER } = chrome;
  const socials = SHARED_HEADER.slice(SHARED_HEADER.indexOf('class="site-socials"'), SHARED_HEADER.indexOf('class="site-nav"'));
  for (const s of SOCIAL_LINKS) {
    assert.ok(socials.includes(`aria-label="${s.label}"`), `no aria-label for ${s.label}`);
  }
  assert.ok(!/>\s*[A-Za-z]/.test(socials.replace(/<svg[\s\S]*?<\/svg>/g, '')), 'a label is rendered as visible text');
});

test('the header icons open in a new tab without leaking the opener', () => {
  const socials = chrome.SHARED_HEADER.slice(chrome.SHARED_HEADER.indexOf('class="site-socials"'));
  const count = (socials.match(/rel="noopener"/g) || []).length;
  assert.equal(count, chrome.SOCIAL_LINKS.length, 'an icon is missing rel="noopener"');
});
