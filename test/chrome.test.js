const test = require('node:test');
const assert = require('node:assert');
const chrome = require('../lib/chrome');

test('exports every icon both builders reference', () => {
  for (const k of ['youtube', 'spotify', 'apple', 'instagram', 'linkedin', 'twitter', 'tiktok', 'newsletter', 'mail']) {
    assert.ok(chrome.ICONS[k], `missing icon: ${k}`);
    assert.match(chrome.ICONS[k], /^<svg/);
  }
});

test('head carries the favicons batch-build.js was missing', () => {
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
  for (const link of ['/#episodes', '/#host', '/#contact', '/#subscribe']) {
    assert.ok(chrome.SHARED_HEADER.includes(link), `missing nav anchor: ${link}`);
  }
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
test('the footer carries the legal links', () => {
  assert.match(chrome.SHARED_FOOTER, /href="https:\/\/partnerships\.marinamogilko\.co\/plc"[^>]*>Privacy Policy</);
  assert.match(chrome.SHARED_FOOTER, /href="https:\/\/partnerships\.marinamogilko\.co\/ts"[^>]*>Terms of Service</);
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
