// The page for brands at /partnerships/: partner marks, case studies and
// testimonials come from content/ and public/partners/, so a file a
// teammate drops in must never become live markup. These tests pin the
// allowlist for inlined SVGs and the escaping of the content fields.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { plainSvg, logoHtml, renderPartners, renderTestimonials, parseCaseStudy, renderPartnershipsPage } = require('../lib/render-partnerships');
const { renderAboutPage } = require('../lib/pages');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', p), 'utf8'));
const site = read('site.json');
const SIMPLE = '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Apple</title><path d="M12 2l1 1z"/></svg>';

test('plainSvg accepts the Simple Icons shape and nothing richer', () => {
  assert.strictEqual(plainSvg(SIMPLE), SIMPLE);
  assert.strictEqual(plainSvg('<?xml version="1.0"?>\n<!-- c -->' + SIMPLE), SIMPLE);
  assert.strictEqual(plainSvg('<svg fill="#E42527" viewBox="0 0 24 24"><path d="M0 0h1" fill-rule="evenodd"/><path d="M1 1"/></svg>'),
    '<svg fill="#E42527" viewBox="0 0 24 24"><path d="M0 0h1" fill-rule="evenodd"/><path d="M1 1"/></svg>');
  const bad = [
    '<svg onload ="alert(1)"><path d="M0 0"/></svg>',
    '<svg><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>',
    SIMPLE + '<div>x</div>',
    SIMPLE.replace('</svg>', '</svg><form action="https://evil.example"></form></svg>'),
    '<svg><img src=x onerror =alert(1)></svg>',
    '<svg><style>body{display:none}</style><path d="M0 0"/></svg>',
    '<svg><path d="M0 0"/><set attributeName="href" to="javascript:alert(1)"/></svg>',
    '<svg><path d="M0 0"/><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><body>x</body></foreignObject></svg>',
    '<svg><image href="https://evil.example/x.svg"/></svg>',
    '<svg><use href="https://evil.example/x.svg#a"/></svg>',
    '<svg><title>&lt;b&gt;</title><path d="M0 0"/></svg>',
    '<svg><path d="M0 0" onclick="x"/></svg>',
    '<svg xlink:href="x"><path d="M0 0"/></svg>',
    '<svg><path d="M0 0"></path></svg>',
    '<svg><path d="&quot;"/></svg>',
    '<SVG><path d="M0 0"/></SVG>',
    'text<svg><path d="M0 0"/></svg>',
    '<svg><path d="M0 0"/></svg><svg><path d="M0 0"/></svg>',
  ];
  for (const s of bad) assert.strictEqual(plainSvg(s), null, s);
});

test('every mono SVG shipped in public/partners/ passes the allowlist', () => {
  const partners = read('partners.json');
  for (const p of partners.items.filter((x) => x.mono && x.file.endsWith('.svg'))) {
    const file = path.join(ROOT, 'public', 'partners', p.file);
    if (!fs.existsSync(file)) continue;
    assert.ok(plainSvg(fs.readFileSync(file, 'utf8')), `${p.file} is not a plain SVG`);
  }
});

test('logoHtml never inlines a rich SVG, never builds a path from the file field', () => {
  const dir = path.join(ROOT, 'public', 'partners');
  const tmp = path.join(dir, 'zz-test-rich.svg');
  fs.writeFileSync(tmp, '<svg onload ="alert(1)"><path d="M0 0"/></svg>');
  try {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const html = logoHtml({ name: 'Rich', file: 'zz-test-rich.svg', mono: true });
      assert.ok(html.startsWith('<img class="mark" src="/partners/zz-test-rich.svg"'), html);
      assert.ok(!html.includes('onload'));
      const escaped = logoHtml({ name: '<b>Evil</b>', file: '../../package.json', mono: true });
      assert.ok(escaped.includes('mark-text') && !escaped.includes('<b>'), escaped);
    } finally { console.warn = warn; }
  } finally { fs.unlinkSync(tmp); }
  const ok = logoHtml({ name: 'Apple', file: 'si-apple.svg', mono: true });
  assert.ok(ok.startsWith('<svg class="mark" aria-hidden="true" focusable="false"'), ok);
  assert.ok(ok.endsWith('</svg>'));
});

test('partner names, quotes and case studies are escaped; first row and "more" split as configured', () => {
  const warn = console.warn; console.warn = () => {};
  let html;
  try {
    html = renderPartners({ featuredCount: 2, items: [
      { name: 'A<script>', file: 'si-apple.svg', mono: true },
      { name: 'B', file: 'si-dell.svg', mono: true },
      { name: 'C', file: 'missing.png' },
    ] });
  } finally { console.warn = warn; }
  assert.ok(html.includes('A&lt;script&gt;') && !html.includes('A<script>'));
  assert.ok(html.includes('Show all 3 partners'));
  assert.strictEqual((html.match(/<li class="partner"/g) || []).length, 3);
  const quotes = renderTestimonials([{ quote: '"<img src=x onerror=1>"', name: 'X', title: 'CEO<', company: 'Y' }, { quote: '', name: 'empty' }]);
  assert.ok(!quotes.includes('<img src=x') && quotes.includes('&lt;img'));
  assert.ok(!quotes.includes('empty'));
  const study = parseCaseStudy('# T <b>\n\n[go](javascript:alert(1)) and [ok](https://example.com/)\n<!-- zzsecretnote -->');
  const page = renderPartnershipsPage(site, [], { partners: { featuredCount: 1, items: [] }, testimonials: [], caseStudies: [study] });
  assert.ok(page.includes('T &lt;b&gt;'));
  assert.ok(!page.includes('href="javascript:') && page.includes('href="https://example.com/"'));
  assert.ok(!page.includes('zzsecretnote'));
});

test('awards, press and facts links only get http(s) hrefs', () => {
  const s = JSON.parse(JSON.stringify(site));
  s.awards = [{ name: 'Bad', url: 'javascript:alert(1)' }, { name: 'Good', url: 'https://example.com/a' }];
  s.press = [{ outlet: 'O', title: 'P', url: 'data:text/html,x', date: '2024-01-01' }];
  s.facts = [{ text: 'F', source: '//evil.example/x' }];
  const html = renderAboutPage(s, []);
  assert.ok(!html.includes('href="javascript:') && !html.includes('href="data:') && !html.includes('href="//evil'));
  assert.ok(html.includes('href="https://example.com/a"'));
  assert.ok(html.includes('<span class="outlet">O</span> P'));
});
