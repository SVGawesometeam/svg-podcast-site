#!/usr/bin/env node
/**
 * SVG Podcast Page Generator
 * Usage: node generate-podcast-page.js <VIDEO_ID>
 * Output: <VIDEO_ID>.html  — paste into Tilda T123 block
 *
 * Requires: ANTHROPIC_API_KEY and YOUTUBE_API_KEY in environment
 * npm install youtube-transcript @anthropic-ai/sdk node-fetch
 */

const fs   = require('fs');
const path = require('path');

const VIDEO_ID      = process.argv[2];
const YT_API_KEY    = process.env.YOUTUBE_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!VIDEO_ID)      { console.error('Usage: node generate-podcast-page.js <VIDEO_ID>'); process.exit(1); }
if (!YT_API_KEY)    { console.error('Missing YOUTUBE_API_KEY'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
  const totalMin = h*60 + min + (s>=30?1:0);
  return totalMin + ' MIN';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase();
}

function parseTimestamps(description) {
  const lines = description.split('\n');
  const results = [];
  const re = /^[\[\(]?(\d{1,2}:\d{2}(?::\d{2})?)[\]\)]?\s*[-–—]?\s*(.+)/;
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m) {
      const parts = m[1].split(':').map(Number);
      const seconds = parts.length === 3
        ? parts[0]*3600 + parts[1]*60 + parts[2]
        : parts[0]*60 + parts[1];
      results.push({ time: m[1], title: m[2].trim(), seconds });
    }
  }
  return results;
}

function buildTranscriptHTML(rawLines) {
  // rawLines is array of {text, offset} from youtube-transcript
  // Group into speaker blocks if formatted, else plain paragraphs
  const full = rawLines.map(l => l.text).join(' ').replace(/\s+/g,' ');

  // Try to detect **Speaker:** pattern
  const speakerRe = /\*\*(.*?)\*\*:?\s*/g;
  if (speakerRe.test(full)) {
    const blocks = [];
    const parts = full.split(/(\*\*.*?\*\*:?\s*)/);
    let current = null;
    for (const part of parts) {
      const nm = part.match(/\*\*(.*?)\*\*/);
      if (nm) { if (current) blocks.push(current); current = { name: nm[1], text: '' }; }
      else if (current) { current.text += part; }
    }
    if (current) blocks.push(current);
    return blocks.map(b =>
      `<div class="svgp-speaker-block">
        <div class="svgp-speaker-name">${esc(b.name)}</div>
        <div class="svgp-speaker-text">${esc(b.text.trim())}</div>
      </div>`
    ).join('\n');
  }

  // Fallback: chunk into ~300-word paragraphs
  const words = full.split(' ');
  const chunks = [];
  for (let i = 0; i < words.length; i += 300) {
    chunks.push(words.slice(i, i+300).join(' '));
  }
  return chunks.map(c => `<p class="svgp-plain-para">${esc(c)}</p>`).join('\n');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  let fetch;
  try { fetch = (await import('node-fetch')).default; } catch(e) { fetch = global.fetch; }

  console.log('📺  Fetching YouTube metadata...');
  const ytResp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${VIDEO_ID}&part=snippet,contentDetails&key=${YT_API_KEY}`
  );
  const ytData = await ytResp.json();
  const item   = ytData.items?.[0];
  if (!item) { console.error('Video not found:', VIDEO_ID); process.exit(1); }

  const snippet     = item.snippet;
  const title       = snippet.title;
  const description = snippet.description;
  const publishedAt = snippet.publishedAt;
  const duration    = parseDuration(item.contentDetails.duration);
  const thumbnail   = `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
  const ytUrl       = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
  const timestamps  = parseTimestamps(description);

  console.log(`   Title: ${title}`);

  console.log('📝  Fetching YouTube transcript...');
  let transcriptLines = [];
  let transcriptRaw   = '';
  try {
    const { YoutubeTranscript } = require('youtube-transcript');
    transcriptLines = await YoutubeTranscript.fetchTranscript(VIDEO_ID);
    transcriptRaw   = transcriptLines.map(l => l.text).join(' ');
    console.log(`   Got ${transcriptLines.length} transcript segments`);
  } catch(e) {
    console.warn('   ⚠️  Transcript unavailable:', e.message);
  }

  // ── Clean transcript: remove ads, sponsor reads, subscribe CTAs ───────────
  if (transcriptRaw.length > 0) {
    console.log('🧹  Cleaning transcript (removing ads & CTAs)...');
    try {
      const cleanResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          system:     'You are a transcript editor. Return ONLY the cleaned transcript text — no commentary, no explanation, no preamble.',
          messages: [{
            role:    'user',
            content: `Clean this podcast transcript by removing:
- Sponsor/ad reads (any segment promoting a product or service)
- Outro CTAs: subscribe requests, newsletter plugs, "follow us on", "leave a review", "check the link in bio", affiliate link mentions
- Any self-promotional intros like "welcome to my channel" or "don't forget to hit the bell"

Keep everything else exactly as-is: all substantive conversation between host and guest, introductions of the guest, the full interview content.

Do not summarize, do not paraphrase, do not add anything. Just return the cleaned transcript text.

TRANSCRIPT:
${transcriptRaw}`
          }]
        })
      });
      const cleanData = await cleanResp.json();
      const cleaned = cleanData.content?.[0]?.text || '';
      if (cleaned.length > 100) {
        const before = transcriptRaw.length;
        transcriptRaw = cleaned;
        // Rebuild transcriptLines as simple word-chunk objects so buildTranscriptHTML still works
        transcriptLines = transcriptRaw.split(' ').reduce((acc, word, i) => {
          const chunkIdx = Math.floor(i / 50);
          if (!acc[chunkIdx]) acc[chunkIdx] = { text: '' };
          acc[chunkIdx].text += (acc[chunkIdx].text ? ' ' : '') + word;
          return acc;
        }, []);
        console.log(`   Cleaned: ${before} → ${transcriptRaw.length} chars (removed ${Math.round((1 - transcriptRaw.length/before)*100)}%)`);
      }
    } catch(e) {
      console.warn('   ⚠️  Transcript cleaning failed, using raw:', e.message);
    }
  }

  console.log('🤖  Calling Claude to generate show notes...');
  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model:      'claude-opus-4-5',
      max_tokens: 3000,
      system:     'You are a podcast show notes writer for Silicon Valley Girl, hosted by Marina Mogilko. Return ONLY valid JSON — no markdown, no backticks, no preamble.',
      messages: [{
        role:    'user',
        content: `Video title: "${title}"
YouTube description: ${description.slice(0,1500)}
Transcript (first 6000 chars): ${transcriptRaw.slice(0,6000)}

Return this exact JSON:
{
  "guestName": "Full name of the guest (not Marina Mogilko)",
  "guestTitle": "Their professional title and company, concise",
  "recordedAt": "Event/location if mentioned in description, else null",
  "episodeSummary": "3-4 paragraphs. Specific, factual, third person. Use real numbers and quotes from the transcript. No fluff. Separate paragraphs with \\n\\n",
  "keyTakeaways": [
    "Insight 1 — specific, with a number or concrete detail",
    "Insight 2",
    "Insight 3",
    "Insight 4",
    "Insight 5"
  ],
  "aboutGuest": "2-3 sentences. Professional bio. Third person. Only state facts that appear in the transcript or description."
}`
      }]
    })
  });
  const claudeData = await claudeResp.json();
  const rawJson    = claudeData.content?.[0]?.text || '{}';
  let ai;
  try { ai = JSON.parse(rawJson.replace(/```json|```/g,'').trim()); }
  catch(e) { console.error('Claude JSON parse failed:', rawJson); process.exit(1); }

  console.log(`   Guest: ${ai.guestName}`);

  // ── Build summary HTML ────────────────────────────────────────────────────
  const summaryHtml = (ai.episodeSummary || '')
    .split('\n\n').filter(p => p.trim())
    .map(p => `<p>${esc(p.trim())}</p>`).join('\n');

  // ── Build takeaways HTML ──────────────────────────────────────────────────
  const takeawaysHtml = (ai.keyTakeaways || [])
    .map(t => `<li>${esc(t)}</li>`).join('\n');

  // ── Build timestamps HTML ─────────────────────────────────────────────────
  const tsHtml = timestamps.length
    ? timestamps.map((ts, i) => `
      <div class="svgp-ts-row">
        ${i < timestamps.length-1 ? '<div class="svgp-ts-line"></div>' : ''}
        <a class="svgp-ts-time" href="${ytUrl}&t=${ts.seconds}" target="_blank">${esc(ts.time)}</a>
        <div class="svgp-ts-dot"></div>
        <div class="svgp-ts-title">${esc(ts.title)}</div>
      </div>`).join('\n')
    : '<div style="color:#999;font-size:16px">No timestamps available for this episode.</div>';

  // ── Build transcript HTML ─────────────────────────────────────────────────
  const transcriptHtml = transcriptLines.length
    ? buildTranscriptHTML(transcriptLines)
    : '<div style="color:#999;font-size:16px">Transcript not available for this episode.</div>';

  // ── Meta line ─────────────────────────────────────────────────────────────
  const metaParts = ['SILICON VALLEY GIRL PODCAST'];
  if (publishedAt) metaParts.push(formatDate(publishedAt));
  if (duration)    metaParts.push(duration);
  if (ai.recordedAt) metaParts.push('RECORDED AT ' + ai.recordedAt.toUpperCase());
  const meta = metaParts.join(' | ');

  // ── Schema.org structured data for GEO/AI search ──────────────────────────
  const schemaOrg = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "name": title,
    "description": ai.episodeSummary || '',
    "url": ytUrl,
    "datePublished": publishedAt,
    "duration": `PT${duration.replace(' MIN','M')}`,
    "image": thumbnail,
    "transcript": transcriptRaw.slice(0, 50000),
    "author": { "@type": "Person", "name": "Marina Mogilko" },
    "about": {
      "@type": "Person",
      "name": ai.guestName,
      "jobTitle": ai.guestTitle
    },
    "partOfSeries": {
      "@type": "PodcastSeries",
      "name": "Silicon Valley Girl Podcast",
      "url": "https://siliconvalleygirl.com/podcast"
    }
  });

  // ─── Full static HTML ──────────────────────────────────────────────────────
  const html = `<!-- SVG Podcast Page | ${title} | Generated ${new Date().toISOString()} -->
<!-- Paste into Tilda T123 HTML block -->

<script type="application/ld+json">
${schemaOrg}
</script>

<div id="svg-podcast-root">

<style>
#svg-podcast-root *{box-sizing:border-box!important}
#svg-podcast-root{
  font-family:'AnotherGrotesque',Arial,sans-serif!important;
  font-size:18px!important;
  color:#111!important;background:#fff!important;max-width:1200px!important;margin:0 auto!important;
  padding:0 24px 80px!important;
}
.svgp-breadcrumb{
  display:flex!important;align-items:center!important;gap:8px!important;
  font-size:14px!important;color:#999!important;padding:24px 0 40px!important;margin:0!important;
}
.svgp-breadcrumb a{color:#999!important;text-decoration:none!important}
.svgp-breadcrumb a:hover{color:#111!important}
.svgp-hero{
  display:grid!important;grid-template-columns:1fr 380px!important;
  gap:48px!important;align-items:start!important;padding-bottom:48px!important;
  border-bottom:1px solid #eee!important;margin:0!important;
}
@media(max-width:800px){
  .svgp-hero{grid-template-columns:1fr!important;gap:24px!important}
  .svgp-cover-thumb{order:-1!important}
}
.svgp-meta{
  font-size:11px!important;font-weight:600!important;letter-spacing:.12em!important;
  color:#999!important;text-transform:uppercase!important;margin:0 0 20px 0!important;
  padding:0!important;line-height:1.4!important;
}
.svgp-title{
  font-family:'DrukTextWideTT','AnotherGrotesque',Arial,sans-serif!important;
  font-size:clamp(28px,4vw,48px)!important;font-weight:800!important;
  line-height:1.08!important;letter-spacing:-.02em!important;
  text-transform:uppercase!important;margin:0 0 24px 0!important;padding:0!important;
}
.svgp-guest-line{
  font-size:18px!important;color:#444!important;line-height:1.6!important;
  margin:0 0 40px 0!important;padding:0!important;
}
.svgp-guest-line strong{font-weight:700!important;color:#111!important}
.svgp-listen-label{font-size:16px!important;color:#555!important;margin:0 0 16px 0!important}
.svgp-listen-row{display:flex!important;gap:14px!important;flex-wrap:wrap!important}
.svgp-listen-btn{
  display:inline-flex!important;align-items:center!important;gap:10px!important;
  padding:14px 22px!important;border-radius:10px!important;
  border:1.5px solid #ddd!important;background:#fff!important;
  font-size:15px!important;font-weight:600!important;color:#111!important;
  text-decoration:none!important;white-space:nowrap!important;
  font-family:inherit!important;
}
.svgp-listen-btn:hover{border-color:#111!important;background:#f5f5f5!important}
.svgp-listen-btn svg{width:20px!important;height:20px!important;flex-shrink:0!important}
.svgp-cover-thumb{
  width:100%!important;aspect-ratio:16/9!important;border-radius:12px!important;
  overflow:hidden!important;background:#111!important;
}
.svgp-cover-thumb img{width:100%!important;height:100%!important;object-fit:cover!important}
.svgp-tabs{
  display:flex!important;gap:0!important;border-bottom:1px solid #ddd!important;
  margin:56px 0 0!important;padding:0!important;
}
.svgp-tab{
  flex:1!important;text-align:center!important;
  padding:20px 24px!important;font-size:16px!important;font-weight:600!important;
  color:#999!important;cursor:pointer!important;border-bottom:3px solid transparent!important;
  margin:0 0 -1px 0!important;transition:all .15s!important;background:none!important;
  border-top:none!important;border-left:none!important;border-right:none!important;
  font-family:inherit!important;letter-spacing:.02em!important;
}
.svgp-tab.active{color:#111!important;border-bottom-color:#111!important}
.svgp-tab:hover{color:#111!important}
.svgp-tab-panel{display:none!important;padding:52px 0!important}
.svgp-tab-panel.active{display:block!important}
.svgp-section-title{
  font-family:'DrukTextWideTT','AnotherGrotesque',Arial,sans-serif!important;
  font-size:22px!important;font-weight:800!important;text-transform:uppercase!important;
  letter-spacing:.04em!important;margin:0 0 24px 0!important;padding:0!important;
}
.svgp-summary{font-size:18px!important;line-height:1.85!important;color:#333!important;max-width:720px!important}
.svgp-summary p{margin:0!important;padding:0!important}
.svgp-summary p+p{margin-top:20px!important}
.svgp-takeaways{max-width:720px!important;margin:8px 0 0 0!important;padding:0!important}
.svgp-takeaways ol{padding:0 0 0 20px!important;margin:0!important;list-style:none!important;counter-reset:tkc!important}
.svgp-takeaways li{
  counter-increment:tkc!important;position:relative!important;padding:0 0 0 32px!important;
  font-size:18px!important;line-height:1.75!important;color:#333!important;margin:0 0 20px 0!important;
}
.svgp-takeaways li::before{content:counter(tkc)"."!important;position:absolute!important;left:0!important;font-weight:800!important;color:#111!important}
.svgp-about-text{font-size:18px!important;line-height:1.85!important;color:#333!important;font-style:italic!important;max-width:720px!important;margin:0!important}
.svgp-section{margin:0!important;padding:0!important}
.svgp-section+.svgp-section{margin-top:52px!important}
.svgp-timestamps{max-width:720px!important;padding:0 0 0 60px!important}
.svgp-ts-row{
  display:flex!important;gap:24px!important;align-items:flex-start!important;
  padding:32px 0!important;position:relative!important;margin:0!important;
}
.svgp-ts-row:first-child{padding-top:0!important}
.svgp-ts-time{font-size:16px!important;font-weight:600!important;color:#5b7fb5!important;min-width:52px!important;flex-shrink:0!important;text-decoration:none!important}
.svgp-ts-time:hover{text-decoration:underline!important}
.svgp-ts-dot{width:10px!important;height:10px!important;border-radius:50%!important;background:#ccc!important;flex-shrink:0!important;margin-top:7px!important;position:relative!important;z-index:1!important}
.svgp-ts-row:first-child .svgp-ts-dot{background:#111!important}
.svgp-ts-title{font-size:18px!important;line-height:1.55!important;color:#222!important}
.svgp-ts-line{position:absolute!important;left:88px!important;top:0!important;bottom:0!important;width:1.5px!important;background:#e0e0e0!important;z-index:0!important}
.svgp-transcript-body{max-width:720px!important}
.svgp-speaker-block{margin:0 0 36px 0!important;padding:0!important}
.svgp-speaker-name{font-size:16px!important;font-weight:800!important;color:#111!important;letter-spacing:.02em!important;margin:0 0 10px 0!important}
.svgp-speaker-text{font-size:18px!important;line-height:1.8!important;color:#333!important;margin:0!important}
.svgp-plain-para{font-size:18px!important;line-height:1.8!important;color:#333!important;margin:0 0 20px 0!important}
</style>

<!-- Breadcrumb -->
<div class="svgp-breadcrumb">
  <a href="/">Home</a><span>/</span>
  <a href="/podcast">Podcast</a><span>/</span>
  <span>${esc(ai.guestName || 'Episode')}</span>
</div>

<!-- Hero -->
<div class="svgp-hero">
  <div>
    <div class="svgp-meta">${esc(meta)}</div>
    <h1 class="svgp-title">${esc(title)}</h1>
    <p class="svgp-guest-line">
      <strong>${esc(ai.guestName)}</strong>${ai.guestTitle ? ' – ' + esc(ai.guestTitle) + ' at Silicon Valley Girl Podcast' : ''}
    </p>
    <div class="svgp-listen-label">Listen on:</div>
    <div class="svgp-listen-row">
      <a class="svgp-listen-btn" href="${ytUrl}" target="_blank">
        <svg viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" fill="#FF0000"/></svg>
        YouTube
      </a>
      <a class="svgp-listen-btn" href="https://podcasts.apple.com/search?term=silicon+valley+girl" target="_blank">
        <svg viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 6.628 5.374 12 12 12 6.627 0 12-5.372 12-12 0-6.627-5.373-12-12-12zm2.726 16.424c-.139.527-.527 1.003-1.061 1.254-.535.252-1.152.252-1.687 0-.534-.251-.922-.727-1.061-1.254-.14-.528-.063-1.098.212-1.562.275-.463.718-.788 1.232-.899v-3.9c0-.319.256-.575.575-.575.318 0 .574.256.574.575v3.9c.513.111.957.436 1.232.9.275.463.351 1.033.212 1.561z" fill="#872EC4"/></svg>
        Apple Podcasts
      </a>
      <a class="svgp-listen-btn" href="https://open.spotify.com/search/silicon%20valley%20girl" target="_blank">
        <svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="#1ED760"/></svg>
        Spotify
      </a>
    </div>
  </div>

  <!-- Thumbnail -->
  <div class="svgp-cover-thumb">
    <img src="${thumbnail}" alt="${esc(title)}" loading="lazy">
  </div>
</div>

<!-- Tabs -->
<div class="svgp-tabs">
  <button class="svgp-tab active" data-tab="shownotes">Show notes</button>
  <button class="svgp-tab" data-tab="timestamps">Timestamps</button>
  <button class="svgp-tab" data-tab="transcript">Transcripts</button>
</div>

<!-- Show Notes Panel -->
<div class="svgp-tab-panel active" data-panel="shownotes">

  <div class="svgp-section">
    <div class="svgp-section-title">Episode Summary</div>
    <div class="svgp-summary">
      ${summaryHtml}
    </div>
  </div>

  ${takeawaysHtml ? `<div class="svgp-section">
    <div class="svgp-section-title">Key Takeaways</div>
    <div class="svgp-takeaways"><ol>${takeawaysHtml}</ol></div>
  </div>` : ''}

  ${ai.aboutGuest ? `<div class="svgp-section">
    <div class="svgp-section-title">About ${esc(ai.guestName)}</div>
    <div class="svgp-about-text">${esc(ai.aboutGuest)}</div>
  </div>` : ''}

</div>

<!-- Timestamps Panel -->
<div class="svgp-tab-panel" data-panel="timestamps">
  <div class="svgp-timestamps">
    ${tsHtml}
  </div>
</div>

<!-- Transcript Panel — full text in DOM for AI crawlers -->
<div class="svgp-tab-panel" data-panel="transcript">
  <div class="svgp-transcript-body">
    ${transcriptHtml}
  </div>
</div>

</div><!-- /svg-podcast-root -->

<script>
(function(){
  document.querySelectorAll('.svgp-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.svgp-tab').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.svgp-tab-panel').forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelector('[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
    });
  });
})();
</script>`;

  const outFile = path.resolve(VIDEO_ID + '.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`\n✅  Done! File saved: ${outFile}`);
  console.log(`   Paste the contents into your Tilda T123 HTML block.`);
}

main().catch(e => { console.error(e); process.exit(1); });
