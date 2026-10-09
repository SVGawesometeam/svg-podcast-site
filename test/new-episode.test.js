// The new-episode workflow: the feed parser, the draft import through the
// backend path, the review notes and the pull request body.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseFeed, newVideos } = require('../lib/youtube-feed');
const { attention } = require('../lib/review');
const { importDraft, dataFile, API_BASE } = require('../build.js');

const ROOT = path.join(__dirname, '..');

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>Silicon Valley Girl</title>
<entry><id>yt:video:NEWVIDEO001</id><yt:videoId>NEWVIDEO001</yt:videoId><title>Newest &amp; Best | Guest</title><published>2026-10-09T15:00:00+00:00</published></entry>
<entry><id>yt:video:KnWKFp472GI</id><yt:videoId>KnWKFp472GI</yt:videoId><title>Already published</title><published>2026-10-02T15:00:00+00:00</published></entry>
<entry><id>yt:video:NEWVIDEO002</id><yt:videoId>NEWVIDEO002</yt:videoId><title>Older new one</title><published>2026-10-01T15:00:00+00:00</published></entry>
<entry><id>yt:video:bad</id><yt:videoId>../escape</yt:videoId><title>x</title><published>2026-10-01T15:00:00+00:00</published></entry>
</feed>`;

const backend = () => ({
  videoId: 'testdraft01', title: 'T', guestName: 'Jane Guest', guestTitle: 'CEO', aboutGuest: 'Bio',
  publishedAt: '2026-03-01T13:00:00Z', duration: '1 MIN', thumbnail: 'https://img.youtube.com/vi/testdraft01/maxresdefault.jpg',
  episodeSummary: 'S', keyTakeaways: ['K'],
  timestamps: [{ time: '0:00', seconds: 0, title: '– Intro' }],
  transcript: '**Host:** Welcome to the show everyone, today we talk about building things that last for a long time. ' +
    'It is a conversation about work, tools and the people who make them, and what to do with all of it this week. ' +
    'Please stay with us for the whole thing because the end is the best part of it all.\n\n**Jane Guest:** Thanks for having me, happy to be here and to talk through what we have learned building the company over the last five years with a small team.',
  relatedVideos: [{ videoId: 'KnWKFp472GI', title: 'On site' }, { videoId: 'zzzzzzzzzzz', title: 'Not on site' }],
});
const fakeFetch = (body, status = 200) => async (url) => {
  assert.ok(url.startsWith(API_BASE + '/'), `unexpected url ${url}`);
  return { ok: status === 200, status, json: async () => body };
};

test('the feed parser keeps only well-formed ids and decodes titles', () => {
  const entries = parseFeed(FEED);
  assert.deepEqual(entries.map((e) => e.videoId), ['NEWVIDEO001', 'KnWKFp472GI', 'NEWVIDEO002']);
  assert.equal(entries[0].title, 'Newest & Best | Guest');
  assert.equal(entries[0].publishedAt, '2026-10-09T15:00:00+00:00');
});

test('new videos are the ones not in the registry, oldest first', () => {
  const picked = newVideos(parseFeed(FEED), ['KnWKFp472GI']);
  assert.deepEqual(picked.map((e) => e.videoId), ['NEWVIDEO002', 'NEWVIDEO001']);
  assert.deepEqual(newVideos(parseFeed(FEED), ['KnWKFp472GI', 'NEWVIDEO001', 'NEWVIDEO002']), []);
});

test('importDraft writes a validated draft, keeps only on-site related episodes and enforces the id', async () => {
  const file = dataFile('testdraft01');
  try {
    const d = await importDraft('testdraft01', new Set(['KnWKFp472GI', 'testdraft01']), { fetchImpl: fakeFetch(backend()) });
    assert.ok(fs.existsSync(file));
    assert.equal(d.videoId, 'testdraft01');
    assert.deepEqual(d.relatedVideos.map((v) => v.videoId), ['KnWKFp472GI']);
    assert.equal(d.format, 'interview');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).videoId, 'testdraft01');
  } finally {
    fs.rmSync(file, { force: true });
  }
  await assert.rejects(importDraft('testdraft01', new Set(), { fetchImpl: fakeFetch({ ...backend(), videoId: 'othervideo1' }) }), /backend returned videoId/);
  await assert.rejects(importDraft('testdraft01', new Set(), { fetchImpl: fakeFetch({}, 404) }), /API returned 404/);
  await assert.rejects(importDraft('testdraft01', new Set(), { fetchImpl: fakeFetch({ ...backend(), guestName: 'Special Guest' }) }), /draft rejected/);
  await assert.rejects(importDraft('../x', new Set(), { fetchImpl: fakeFetch(backend()) }), /bad videoId/);
  assert.ok(!fs.existsSync(file), 'a rejected draft must not be written');
});

test('the review notes name what a person has to look at', () => {
  const good = {
    guestName: 'Jane Guest', guestTitle: 'CEO', summary: 'S', keyTakeaways: ['K'], timestamps: [{ seconds: 0 }], topics: ['future-of-work'],
    duration: '1 MIN', transcript: [{ speaker: 'Jane Guest', text: Array(90).fill('word').join(' ') }],
  };
  assert.deepEqual(attention(good, null), []);
  const notes = attention({ ...good, summary: '', keyTakeaways: [], timestamps: [], topics: [], transcript: [{ speaker: 'Someone Else', text: 'x'.repeat(2600) }] }, null).join('\n');
  assert.match(notes, /Someone Else/);
  assert.match(notes, /No summary/);
  assert.match(notes, /No key takeaways/);
  assert.match(notes, /No chapters/);
  assert.match(notes, /No topics/);
  assert.match(notes, /2600 characters/);
  assert.match(notes, /Transcript looks short/);
  assert.match(attention({ ...good, guestTitle: 'a special guest' }, null).join(), /Placeholder/);
  assert.deepEqual(attention({ ...good, transcript: [{ speaker: 'Someone Else', text: Array(90).fill('w').join(' ') }] }, { knownSpeakers: ['Someone Else'] }), []);
});

test('the pull request body carries the facts, the flags and the checklist', () => {
  const report = path.join(require('os').tmpdir(), `svg-report-${process.pid}.json`);
  fs.writeFileSync(report, JSON.stringify({
    videoId: 'abcdefghijk', status: 'draft', title: 'Big <Title>', format: 'interview', guestName: 'Jane', guestTitle: 'CEO', publishedAt: '2026-03-01',
    duration: '41 MIN', transcriptBlocks: 12, attention: ['No chapters'], page: '/episode/abcdefghijk/', dataFile: 'content/episodes/abcdefghijk.json',
  }));
  try {
    const body = execFileSync(process.execPath, ['scripts/pr-body.js', report], { cwd: ROOT, encoding: 'utf8' });
    assert.match(body, /## New episode draft: Big <Title>/);
    assert.match(body, /watch\?v=abcdefghijk/);
    assert.match(body, /⚠️ No chapters/);
    assert.match(body, /- \[ \] Speaker labels are only the real participants/);
    assert.match(body, /transcript-fixes\/abcdefghijk\.json/);
    assert.match(body, /Nothing is live until this pull request is merged/);
  } finally { fs.rmSync(report, { force: true }); }
});

test('the workflow opens a draft pull request and never pushes to main', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'new-episode.yml'), 'utf8');
  assert.match(yml, /cron: "\*\/30 \* \* \* \*"/);
  assert.match(yml, /workflow_dispatch:/);
  assert.match(yml, /node scripts\/new-episode\.js --report \/tmp\/report\.json -- "\$VIDEO_ID"/);
  assert.match(yml, /ids=\$\(node scripts\/poll-youtube\.js\)/, 'a failed poll must fail the job');
  assert.match(yml, /vars\.YOUTUBE_CHANNEL_ID != ''/, 'scheduled runs are skipped until the channel id is set');
  assert.match(yml, /npm test/);
  assert.match(yml, /git checkout -b "\$branch"/);
  assert.match(yml, /gh pr create --draft --base main --head "\$branch"/);
  assert.match(yml, /^permissions:\s+contents: read/m, 'the workflow default is read-only');
  assert.match(yml, /permissions:\s+contents: write\s+pull-requests: write/, 'only the import job may write');
  assert.ok(!/git push origin main|git push\s*$/m.test(yml), 'the workflow must not push to main');
});
