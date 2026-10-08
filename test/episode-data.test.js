const test = require('node:test');
const assert = require('node:assert');
const {
  parseEpisodePage, fromApi, validate, repairDollarAmounts, parseTranscriptBlocks, unknownSpeakers,
} = require('../lib/episode-data');
const { renderEpisodePage, writeEpisodeData } = require('../build.js');

const INTERVIEW = {
  videoId: 'abcdefghijk',
  title: 'Acme CEO: Why "Boring" Wins & How to Start | Jane Guest',
  format: 'interview',
  guestName: 'Jane Guest',
  guestTitle: 'CEO of Acme',
  aboutGuest: "Jane Guest runs Acme. She's built it since 2019.",
  publishedAt: '2026-03-01T13:00:00.000Z',
  duration: '41 MIN',
  coverArt: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
  thumbnail: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
  summary: 'Jane explains why $100 is enough to start & what "boring" means.',
  keyTakeaways: ['Start with $100.', 'Boring beats "exciting" <sometimes>.'],
  timestamps: [{ time: '0:00', seconds: 0, title: 'Intro' }, { time: '12:30', seconds: 750, title: 'The $100 test' }],
  transcript: [
    { speaker: 'Marina Mogilko', text: 'Welcome to Silicon Valley Girl. You started Acme with $100?' },
    { speaker: 'Jane Guest', text: 'Yes. People pay $50 to $100 for a "boring" product & that is fine.' },
    { speaker: null, text: 'Continuation paragraph without a label.' },
    { html: '<p class="hand-made">A block someone <em>edited by hand</em>.</p>' },
  ],
  relatedVideos: [{ videoId: 'zyxwvutsrqp', title: 'Other Episode | Someone', thumbnail: 'https://img.youtube.com/vi/zyxwvutsrqp/maxresdefault.jpg' }],
  topics: [],
};

const SOLO = {
  ...INTERVIEW,
  videoId: 'solo1234567',
  title: 'My 19 sources of income at age 34',
  format: 'solo',
  guestName: 'Marina Mogilko',
  guestTitle: 'Host, Silicon Valley Girl Podcast',
  transcript: [{ speaker: 'Marina Mogilko', text: 'Here are my 19 sources of income.' }],
  relatedVideos: [],
};

test('a rendered page round-trips through the parser without loss', () => {
  for (const d of [INTERVIEW, SOLO]) {
    const html = renderEpisodePage(JSON.parse(JSON.stringify(d)));
    const { data, repairs } = parseEpisodePage(html);
    assert.equal(repairs, 0);
    assert.deepEqual(data, d, `${d.format} page did not round-trip`);
    assert.equal(renderEpisodePage(data), html, 're-rendering the parsed data changed the page');
  }
});

test('solo pages say About the Host and describe the thumbnail as hers', () => {
  const html = renderEpisodePage(JSON.parse(JSON.stringify(SOLO)));
  assert.match(html, /<h3>About the Host<\/h3>/);
  assert.match(html, /alt="Marina Mogilko, host of the Silicon Valley Girl Podcast"/);
  assert.match(html, /<meta name="description" content="My 19 sources of income at age 34 — Silicon Valley Girl Podcast">/);
  assert.match(html, /Marina Mogilko shares Jane explains/);
});

test('interview pages derive the meta description and the summary prefix from the guest', () => {
  const html = renderEpisodePage(JSON.parse(JSON.stringify(INTERVIEW)));
  assert.match(html, /<h3>About the Guest<\/h3>/);
  assert.ok(html.includes('content="Marina Mogilko interviews Jane Guest, CEO of Acme, on the Silicon Valley Girl Podcast"'));
  assert.ok(html.includes('Marina Mogilko interviews Jane Guest, CEO of Acme. Jane explains'));
});

test('hand-made transcript blocks and per-page overrides are rendered verbatim', () => {
  const d = { ...INTERVIEW, metaDescription: 'A custom description', summaryHtml: 'Custom <em>summary</em>', relatedHeading: 'Watch the full interviews', performer: { alternateName: 'JG' } };
  const html = renderEpisodePage(JSON.parse(JSON.stringify(d)));
  assert.ok(html.includes('<p class="hand-made">A block someone <em>edited by hand</em>.</p>'));
  assert.ok(html.includes('content="A custom description"'));
  assert.ok(html.includes('<div class="summary">Custom <em>summary</em></div>'));
  assert.ok(html.includes('<h2>Watch the full interviews</h2>'));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(ld.performer, { '@type': 'Person', name: 'Jane Guest', alternateName: 'JG', jobTitle: 'CEO of Acme' });
  const { data } = parseEpisodePage(html);
  assert.equal(data.metaDescription, 'A custom description');
  assert.equal(data.summaryHtml, 'Custom <em>summary</em>');
  assert.equal(data.relatedHeading, 'Watch the full interviews');
  assert.deepEqual(data.performer, { alternateName: 'JG' });
});

test('an empty chapter list renders the placeholder and parses back as empty', () => {
  const d = { ...INTERVIEW, timestamps: [] };
  const html = renderEpisodePage(JSON.parse(JSON.stringify(d)));
  assert.ok(html.includes('No timestamps available for this episode.'));
  assert.deepEqual(parseEpisodePage(html).data.timestamps, []);
});

test('text is escaped on the way out and unescaped on the way back', () => {
  const html = renderEpisodePage(JSON.parse(JSON.stringify(INTERVIEW)));
  assert.ok(html.includes('Boring beats &quot;exciting&quot; &lt;sometimes&gt;.'));
  assert.ok(!html.includes('<sometimes>'));
  assert.equal(parseEpisodePage(html).data.keyTakeaways[1], 'Boring beats "exciting" <sometimes>.');
});

test('the replace-pattern corruption is reversed exactly', () => {
  const corrupted = 'People pay $50 to <div id="panel-transcript" class="tab-panel" role="tabpanel">\n        <div class="transcript">00 for a report and </div>\n      </div>00 to $500.';
  const { html, repairs } = repairDollarAmounts(corrupted);
  assert.equal(html, 'People pay $50 to $100 for a report and $200 to $500.');
  assert.equal(repairs, 2);
  assert.equal(repairDollarAmounts('A clean $100 and $200.').repairs, 0);
});

test('parseTranscriptBlocks keeps labels, continuations and foreign markup apart', () => {
  const blocks = parseTranscriptBlocks(
    '<p><strong class="speaker-marina">Marina Mogilko:</strong> Hi &amp; welcome.</p>\n' +
    '            <p>Just text.</p>\n' +
    '            <p><strong class="speaker">Guest:</strong> With <em>markup</em>.</p>\n' +
    '            <div class="x">odd</div>'
  );
  assert.deepEqual(blocks, [
    { speaker: 'Marina Mogilko', text: 'Hi & welcome.' },
    { speaker: null, text: 'Just text.' },
    { html: '<p><strong class="speaker">Guest:</strong> With <em>markup</em>.</p>' },
    { html: '<div class="x">odd</div>' },
  ]);
});

test('a backend draft is cleaned once at import, not on every render', () => {
  const ep = {
    videoId: 'abcdefghijk', title: 'T', guestName: 'Jane Guest', guestTitle: 'CEO', aboutGuest: 'Bio',
    publishedAt: '2026-03-01T13:00:00Z', duration: '41 MIN', thumbnail: 'https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg',
    episodeSummary: 'S', keyTakeaways: ['K'],
    timestamps: [{ time: '0:00', seconds: 0, title: '– Intro' }, { time: '1:00', seconds: 60, title: '– Next' }],
    transcript: '**Host:** Welcome.\n\n**CEO of Acme:** Thanks. This episode is sponsored by Widgets. Buy them. **Marina Mogilko:** Back to it.\n\n**Jane Guest:** Sure.',
    relatedVideos: [],
  };
  const d = fromApi(ep, null);
  assert.equal(d.format, 'interview');
  assert.deepEqual(d.timestamps.map((t) => t.title), ['Intro', 'Next']);
  const speakers = d.transcript.map((b) => b.speaker);
  assert.ok(speakers.every((s) => ['Jane Guest', 'Marina Mogilko'].includes(s)), `unexpected labels: ${speakers}`);
  assert.ok(!JSON.stringify(d.transcript).includes('sponsored by'), 'ad copy survived import');
  assert.deepEqual(validate(d), []);

  // Rendering the reviewed data applies no heuristics: an ad kept on purpose stays.
  const kept = { ...INTERVIEW, transcript: [{ speaker: 'Jane Guest', text: 'This episode is sponsored by Widgets.' }] };
  assert.ok(renderEpisodePage(JSON.parse(JSON.stringify(kept))).includes('sponsored by Widgets'));
});

test('a solo draft is labelled as Marina and formatted as solo', () => {
  const d = fromApi({ videoId: 'solo1234567', title: 'T', guestName: '', publishedAt: '2026-03-01T13:00:00Z', duration: '10 MIN', thumbnail: 'x', transcript: 'Hello there.\n\nSecond paragraph.' }, null);
  assert.equal(d.format, 'solo');
  assert.equal(d.guestName, 'Marina Mogilko');
  assert.deepEqual(d.transcript[0], { speaker: 'Marina Mogilko', text: 'Hello there.' });
});

test('validate catches the mistakes that used to reach production', () => {
  assert.ok(validate({ ...INTERVIEW, guestName: 'Special Guest' }).some((p) => /placeholder/.test(p)));
  assert.ok(validate({ ...INTERVIEW, transcript: [] }).some((p) => /empty transcript/.test(p)));
  assert.ok(validate({ ...INTERVIEW, guestTitle: '' }).some((p) => /guestTitle/.test(p)));
  assert.ok(validate({ ...INTERVIEW, format: 'podcast' }).some((p) => /bad format/.test(p)));
  assert.deepEqual(validate(INTERVIEW), []);
});

test('unknown speaker labels are reported against the guest list and the fix file', () => {
  const d = { ...INTERVIEW, transcript: [{ speaker: 'Reed Hoffman', text: 'phantom' }, { speaker: 'Jane Guest', text: 'real' }] };
  assert.deepEqual(unknownSpeakers(d, null), ['Reed Hoffman']);
  assert.deepEqual(unknownSpeakers(d, { knownSpeakers: ['Reed Hoffman'] }), []);
});

test('a title containing a closing script tag cannot end the JSON-LD block', () => {
  const d = { ...INTERVIEW, title: 'Evil </script><script>alert(1)</script> | X' };
  const html = renderEpisodePage(JSON.parse(JSON.stringify(d)));
  const block = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.ok(!block.includes('</script>'), 'closing tag leaked into the JSON-LD block');
  assert.equal(JSON.parse(block).name, d.title, 'the escaped JSON no longer parses to the same title');
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag reached the page');
});

test('episode data is only ever written under content/episodes with a valid id', () => {
  for (const bad of ['../../package', '../x', 'abc', 'abcdefghijk/..', '']) {
    assert.throws(() => writeEpisodeData({ ...INTERVIEW, videoId: bad }), /refusing to write/, `accepted ${JSON.stringify(bad)}`);
  }
});

test('validate rejects chapter offsets and related ids that could break a link', () => {
  assert.ok(validate({ ...INTERVIEW, timestamps: [{ time: '0:00', seconds: '0" onmouseover="x', title: 'Intro' }] }).some((p) => /bad offset/.test(p)));
  assert.ok(validate({ ...INTERVIEW, relatedVideos: [{ videoId: '../x', title: 't', thumbnail: 'u' }] }).some((p) => /bad related videoId/.test(p)));
});
