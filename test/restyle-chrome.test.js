const test = require('node:test');
const assert = require('node:assert');
const { patchPage } = require('../scripts/restyle-episode-chrome');

// Mirrors the real structure of the 117 built pages: no CHROME sentinels, the
// old header CSS running from .site-header to .header-links a:hover, a
// .site-footer block, and a .site-header override inside the media query.
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    a { color: inherit; }
    .site-header {
      border-bottom: 1px solid #e5e5e5; padding: 1rem 2rem;
      display: flex; align-items: center; justify-content: space-between;
      max-width: 900px; margin: 0 auto;
    }
    .site-header .logo { font-weight: 700; font-size: 1.1rem; text-decoration: none; color: #1a1a1a; }
    .header-links { display: flex; gap: 1.25rem; align-items: center; }
    .header-links a { color: #999; text-decoration: none; display: flex; align-items: center; transition: color 0.15s; }
    .header-links a:hover { color: #1a1a1a; }
    .breadcrumb {
      padding: 0 2rem;
    }
    .transcript-turn { color: #222; }
    .site-footer {
      max-width: 800px; margin: 0 auto; padding: 2rem;
      text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee;
    }
    @media (max-width: 640px) {
      .site-header { padding: 0.75rem 1rem; }
      .breadcrumb { padding: 0 1rem; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="logo">Silicon Valley Girl Podcast</a>
    <nav class="header-links"><a href="https://x.example">icon</a></nav>
  </header>
  <main><p class="transcript-turn">transcript body stays</p></main>
  <script type="application/ld+json">{"@type":"PodcastEpisode"}</script>
  <footer class="site-footer">&copy; 2026 Silicon Valley Girl Podcast &middot; Marina Mogilko</footer>
</body>
</html>`;

test('replaces the header, footer and chrome CSS', () => {
  const { html, changed } = patchPage(PAGE);
  assert.equal(changed, true);
  assert.ok(html.includes('WITH MARINA MOGILKO'), 'new header missing');
  assert.ok(html.includes('Made in Silicon Valley'), 'new footer missing');
  assert.ok(html.includes('CHROME-START'), 'sentinels not written');
  assert.ok(!html.includes('class="logo"'), 'old header markup survived');
  assert.ok(!html.includes('border-bottom: 1px solid #e5e5e5'), 'old header CSS survived');
});

test('leaves the body and its structured data untouched', () => {
  const { html } = patchPage(PAGE);
  assert.ok(html.includes('<p class="transcript-turn">transcript body stays</p>'));
  assert.ok(html.includes('.transcript-turn { color: #222; }'), 'non-chrome CSS was eaten');
  assert.ok(html.includes('{"@type":"PodcastEpisode"}'), 'JSON-LD was disturbed');
  assert.ok(html.includes('.breadcrumb { padding: 0 1rem; }'), 'media query was over-trimmed');
});

test('drops the stale footer rule and the media-query header override', () => {
  const { html } = patchPage(PAGE);
  assert.ok(!html.includes('border-top: 1px solid #eee'), 'old footer CSS survived');
  assert.ok(!html.includes('.site-header { padding: 0.75rem 1rem; }'), 'stale override survived');
});

test('is idempotent', () => {
  const once = patchPage(PAGE);
  const twice = patchPage(once.html);
  assert.equal(twice.html, once.html, 'second run changed the output');
  assert.equal(twice.changed, false, 'second run reported a change');
});

test('throws rather than half-writing a page it does not recognise', () => {
  assert.throws(
    () => patchPage('<html><body>no chrome here</body></html>'),
    /does not match/
  );
});
