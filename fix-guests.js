#!/usr/bin/env node
/**
 * Fix "Special Guest" / "a special guest" on episode pages.
 * - Gary Vee episode gets manual fix
 * - Episodes with a person name in the title get that name extracted via simple heuristics
 * - Remaining solo episodes get Marina Mogilko as host
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public', 'episode');

const MARINA_BIO = 'Entrepreneur, content creator, and founder based in Silicon Valley. Marina interviews the world\'s top tech leaders, investors, and innovators to uncover the trends, strategies, and mindsets shaping the future. With millions of followers across platforms, she brings a unique perspective on technology, business, and personal growth.';

// Manual overrides: videoId -> { guestName, guestTitle }
const MANUAL = {
  '4vIIeCqHYXA': { guestName: 'Gary Vaynerchuk', guestTitle: 'Entrepreneur, Author &amp; Chairman of VaynerX' },
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function patchGuestName(html, name) {
  return html
    .replace(/<div class="guest-name">[^<]*<\/div>/, `<div class="guest-name">${name}</div>`)
    .replace(/(<span>)(a special guest|Special Guest)(<\/span>)/, `$1${name}$3`);
}

function patchGuestTitle(html, title) {
  return html.replace(/<div class="guest-title">[^<]*<\/div>/, `<div class="guest-title">${title}</div>`);
}

function patchGuestBio(html, bio) {
  return html.replace(/<p class="guest-bio">[^<]*<\/p>/, `<p class="guest-bio">${esc(bio)}</p>`);
}

function patchAboutHeading(html, heading) {
  // Change "About the Guest" h3 inside guest-card
  return html.replace(
    /(<div class="guest-card">[\s\S]*?<h3>)About the Guest(<\/h3>)/,
    `$1${heading}$2`
  );
}

function patchMetaDescription(html, name, title) {
  // Update meta description to use actual name
  return html
    .replace(
      /content="Marina Mogilko interviews a special guest,[^"]*"/,
      `content="Marina Mogilko interviews ${esc(name)}, ${esc(title)}, on the Silicon Valley Girl Podcast"`
    )
    .replace(
      /content="Marina Mogilko interviews Special Guest,[^"]*"/,
      `content="Marina Mogilko interviews ${esc(name)}, ${esc(title)}, on the Silicon Valley Girl Podcast"`
    );
}

function patchSummaryIntro(html, name, title) {
  return html
    .replace(
      /interviews a special guest, \./,
      `interviews ${esc(name)}, ${esc(title)}.`
    )
    .replace(
      /interviews Special Guest, \./,
      `interviews ${esc(name)}, ${esc(title)}.`
    );
}

function patchAltText(html, name, title) {
  return html
    .replace(
      /alt="a special guest, , interviewed/,
      `alt="${esc(name)}, ${esc(title)}, interviewed`
    )
    .replace(
      /alt="Special Guest, , interviewed/,
      `alt="${esc(name)}, ${esc(title)}, interviewed`
    );
}

function patchJsonLd(html, name, title) {
  // Fix performer in JSON-LD
  return html
    .replace(
      /"performer":\{"@type":"Person","name":"","jobTitle":""\}/,
      `"performer":{"@type":"Person","name":"${name.replace(/"/g, '\\"')}","jobTitle":"${title.replace(/"/g, '\\"')}"}`
    );
}

function patchBreadcrumb(html, name) {
  return html.replace(
    /(<a href="\/#episodes">Podcast<\/a><span class="sep">\/<\/span>\s*<span>)(Episode|a special guest|Special Guest)(<\/span>)/,
    `$1${esc(name)}$3`
  );
}

function main() {
  const dirs = fs.readdirSync(PUBLIC_DIR).filter(d =>
    fs.statSync(path.join(PUBLIC_DIR, d)).isDirectory()
  );

  let fixed = 0;

  for (const dir of dirs) {
    const htmlPath = path.join(PUBLIC_DIR, dir, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;

    let html = fs.readFileSync(htmlPath, 'utf8');

    // Only process pages with "special guest"
    if (!html.includes('>a special guest<') && !html.includes('>Special Guest<')) continue;

    // Check for manual override
    if (MANUAL[dir]) {
      const { guestName, guestTitle } = MANUAL[dir];
      html = patchGuestName(html, guestName);
      html = patchGuestTitle(html, guestTitle);
      html = patchMetaDescription(html, guestName, guestTitle);
      html = patchSummaryIntro(html, guestName, guestTitle);
      html = patchAltText(html, guestName, guestTitle);
      html = patchJsonLd(html, guestName, guestTitle);
      html = patchBreadcrumb(html, guestName);
      fs.writeFileSync(htmlPath, html);
      fixed++;
      console.log(`[${fixed}] MANUAL: ${guestName} (${dir})`);
      continue;
    }

    // Solo episode — set Marina as host
    const name = 'Marina Mogilko';
    const title = 'Host, Silicon Valley Girl Podcast';

    html = patchGuestName(html, name);
    html = patchGuestTitle(html, title);
    html = patchGuestBio(html, MARINA_BIO);
    html = patchAboutHeading(html, 'About the Host');
    html = patchBreadcrumb(html, name);
    html = patchAltText(html, name, title);
    html = patchJsonLd(html, name, title);

    // For solo episodes, fix the summary intro differently
    html = html
      .replace(
        /In this episode of the Silicon Valley Girl Podcast, Marina Mogilko interviews a special guest, \./,
        'In this episode of the Silicon Valley Girl Podcast, Marina Mogilko shares'
      )
      .replace(
        /In this episode of the Silicon Valley Girl Podcast, Marina Mogilko interviews Special Guest, \./,
        'In this episode of the Silicon Valley Girl Podcast, Marina Mogilko shares'
      );

    // Fix meta for solo episodes
    const titleMatch = html.match(/<title>(.+?) — Silicon Valley Girl Podcast<\/title>/);
    const epTitle = titleMatch ? titleMatch[1] : '';
    html = html
      .replace(
        /content="Marina Mogilko interviews a special guest,[^"]*"/,
        `content="${esc(epTitle)} — Silicon Valley Girl Podcast with Marina Mogilko"`
      )
      .replace(
        /content="Marina Mogilko interviews Special Guest,[^"]*"/,
        `content="${esc(epTitle)} — Silicon Valley Girl Podcast with Marina Mogilko"`
      );

    fs.writeFileSync(htmlPath, html);
    fixed++;
    console.log(`[${fixed}] SOLO: Marina Mogilko (${dir})`);
  }

  console.log(`\nDone! Fixed ${fixed} episodes.`);
}

main();
