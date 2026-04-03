#!/usr/bin/env node
/**
 * Fix unformatted transcripts in existing episode pages.
 * Sends raw transcript to Claude Haiku for speaker-attributed formatting,
 * then patches the HTML in-place.
 *
 * Requires: ANTHROPIC_API_KEY in env
 */

const fs   = require('fs');
const path = require('path');
const glob = require('path');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const PUBLIC_DIR = path.join(__dirname, 'public', 'episode');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Extract guest name from page title: "Some Title — Silicon Valley Girl Podcast"
function extractGuestFromHtml(html) {
  const guestMatch = html.match(/<div class="guest-name">([^<]+)<\/div>/);
  if (guestMatch) return guestMatch[1].trim();
  // Fallback: try title
  const titleMatch = html.match(/<title>(.+?) — Silicon Valley Girl Podcast<\/title>/);
  return titleMatch ? titleMatch[1].trim() : 'Guest';
}

// Extract raw transcript text from the transcript tab panel
function extractTranscript(html) {
  // Find the transcript div content between markers
  const startMarker = '<div class="transcript">';
  const startIdx = html.indexOf(startMarker, html.indexOf('panel-transcript'));
  if (startIdx === -1) return null;
  const contentStart = startIdx + startMarker.length;
  // Find the closing </div> — transcript div is followed by </div></div> (panel close)
  const endIdx = html.indexOf('</div>', contentStart);
  if (endIdx === -1) return null;
  const panelMatch = [null, html.slice(contentStart, endIdx)];
  // Strip HTML tags to get plain text
  return panelMatch[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isAlreadyFormatted(html) {
  // Check if transcript already has speaker-marina formatting
  return html.includes('class="speaker-marina"') &&
    html.includes('Marina Mogilko:</strong>');
}

async function formatTranscript(rawText, guestName) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: 'You are a transcript formatter. Return ONLY the formatted transcript — no commentary, no explanation, no preamble.',
      messages: [{
        role: 'user',
        content: `Format this podcast transcript into a clean dialogue. The host is Marina Mogilko. The guest is ${guestName}. Identify speaker changes (marked by >> or natural conversation shifts) and format as:

**Marina Mogilko:** [her text]

**${guestName}:** [their text]

Merge short fragments into readable paragraphs. Remove any remaining >> markers. Do NOT use generic labels like "Guest" or job titles — always use "${guestName}" for the guest. Return ONLY the formatted transcript, nothing else.

TRANSCRIPT:
${rawText.slice(0, 80000)}`
      }],
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Claude API: ${JSON.stringify(data.error)}`);
  return data.content?.[0]?.text || '';
}

function transcriptToHtml(formatted) {
  return formatted
    .split(/\n\n+/)
    .map(para => {
      const speakerMatch = para.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
      if (speakerMatch) {
        const name = speakerMatch[1];
        const isMarina = name.toLowerCase().includes('marina');
        const cls = isMarina ? ' class="speaker-marina"' : ' class="speaker"';
        return `<p><strong${cls}>${esc(name)}:</strong> ${esc(speakerMatch[2].trim())}</p>`;
      }
      if (para.trim()) return `<p>${esc(para.trim())}</p>`;
      return '';
    })
    .filter(Boolean)
    .join('\n            ');
}

function patchHtml(html, newTranscriptHtml) {
  const startMarker = '<div class="transcript">';
  const startIdx = html.indexOf(startMarker, html.indexOf('panel-transcript'));
  if (startIdx === -1) return html;
  const contentStart = startIdx + startMarker.length;
  const endIdx = html.indexOf('</div>', contentStart);
  if (endIdx === -1) return html;
  return html.slice(0, contentStart) +
    '\n            ' + newTranscriptHtml + '\n          ' +
    html.slice(endIdx);
}

async function main() {
  // Find all episode directories
  const dirs = fs.readdirSync(PUBLIC_DIR).filter(d =>
    fs.statSync(path.join(PUBLIC_DIR, d)).isDirectory()
  );

  const toFix = [];
  for (const dir of dirs) {
    const htmlPath = path.join(PUBLIC_DIR, dir, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (isAlreadyFormatted(html)) continue;
    toFix.push({ dir, htmlPath, html });
  }

  console.log(`Found ${toFix.length} episodes needing transcript formatting (${dirs.length - toFix.length} already done)\n`);

  let fixed = 0, failed = 0;

  for (let i = 0; i < toFix.length; i++) {
    const { dir, htmlPath, html } = toFix[i];
    const guest = extractGuestFromHtml(html);
    const rawTranscript = extractTranscript(html);

    if (!rawTranscript || rawTranscript.length < 50) {
      console.log(`[${i+1}/${toFix.length}] SKIP ${dir} — no transcript content`);
      continue;
    }

    console.log(`[${i+1}/${toFix.length}] Fixing: ${guest} (${dir})...`);

    try {
      const formatted = await formatTranscript(rawTranscript, guest);
      if (!formatted || formatted.length < 50) {
        console.log(`   SKIP — Claude returned empty/short response`);
        failed++;
        continue;
      }

      const newHtml = transcriptToHtml(formatted);
      const patched = patchHtml(html, newHtml);
      fs.writeFileSync(htmlPath, patched);
      fixed++;
      console.log(`   Fixed ${fixed}/${toFix.length}: ${guest}`);
    } catch (e) {
      console.error(`   FAILED: ${e.message}`);
      failed++;
    }

    if (i < toFix.length - 1) await sleep(2000);
  }

  console.log(`\n========================================`);
  console.log(`Transcript formatting complete!`);
  console.log(`  Fixed:   ${fixed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${toFix.length - fixed - failed}`);
  console.log(`========================================`);
}

main().catch(e => { console.error(e); process.exit(1); });
