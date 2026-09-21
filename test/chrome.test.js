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
