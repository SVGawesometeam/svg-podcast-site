// The page for brands at /partnerships/: who the audience is, in numbers;
// the partners; the Apple case study; what partners say; the formats; the
// contact form. Everything comes from content/ (partners.json,
// testimonials.json, case-studies/*.md, audience.json via site.counts) and
// public/partners/ (the logo files). No JavaScript beyond the shared form.
const fs = require("fs");
const path = require("path");
const { esc } = require("./html");
const { shell, mdToHtml } = require("./pages");
const { renderContactForm, CONTACT_FORM_CSS, CONTACT_FORM_SCRIPT } = require("./contact-form");
const { SITE_URL, IDS } = require("./site");

const PARTNERS_DIR = path.join(__dirname, "..", "public", "partners");

// A vector mark is inlined only when it is the plain shape Simple Icons
// ship: an <svg> root with a few known attributes, an optional <title>,
// and <path d="..."> elements, nothing else. The HTML parser would run
// anything richer (event attributes, links, styles, a closed root followed
// by markup) as part of the page, so such a file is served as an image,
// where it is inert. Returns the cleaned markup or null.
const SVG_ATTR = /^\s+(xmlns|viewBox|role|fill|width|height|xml:space)="[^"<>&]*"/;
function plainSvg(svg) {
  let s = String(svg).replace(/^\uFEFF/, "").replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!s.startsWith("<svg")) return null;
  let i = 4;
  let attrs = "";
  for (;;) {
    const m = SVG_ATTR.exec(s.slice(i));
    if (!m) break;
    attrs += m[0];
    i += m[0].length;
  }
  const rootEnd = /^\s*>/.exec(s.slice(i));
  if (!rootEnd) return null;
  i += rootEnd[0].length;
  let inner = "";
  for (;;) {
    const rest = s.slice(i);
    let m;
    if ((m = /^\s*<title>([^<&]*)<\/title>/.exec(rest))) {
      inner += `<title>${m[1]}</title>`;
    } else if ((m = /^\s*<path((?:\s+(?:d|fill|fill-rule|clip-rule|opacity)="[^"<>&]*")+)\s*\/>/.exec(rest))) {
      inner += `<path${m[1]}/>`;
    } else if ((m = /^\s*<\/svg>\s*$/.exec(rest))) {
      return `<svg${attrs}>${inner}</svg>`;
    } else {
      return null;
    }
    i += m[0].length;
  }
}

// A partner's mark: vector marks are inlined so they take the page's ink
// colour; everything else is an image. A missing file is skipped with a
// note, never a broken image.
function logoHtml(p) {
  const file = path.join(PARTNERS_DIR, p.file);
  if (!/^[a-z0-9.-]+$/.test(p.file) || !fs.existsSync(file)) {
    console.warn(`   WARN partners: no logo file ${p.file} for ${p.name}`);
    return `<span class="mark mark-text" aria-hidden="true">${esc(p.name.slice(0, 2).toUpperCase())}</span>`;
  }
  if (p.mono && p.file.endsWith(".svg")) {
    const body = plainSvg(fs.readFileSync(file, "utf8"));
    if (!body) {
      console.warn(`   WARN partners: ${p.file} is not a plain SVG; shown as an image`);
      return `<img class="mark" src="/partners/${esc(p.file)}" alt="" width="36" height="36" loading="lazy">`;
    }
    return body.replace(/^<svg/, '<svg class="mark" aria-hidden="true" focusable="false"');
  }
  return `<img class="mark" src="/partners/${esc(p.file)}" alt="" width="36" height="36" loading="lazy">`;
}

function partnerTile(p) {
  return `<li class="partner"${p.mono ? "" : ' data-raster="1"'}>${logoHtml(p)}<span class="partner-name">${esc(p.name)}</span></li>`;
}

function renderPartners(partners) {
  const n = partners.featuredCount || 9;
  const first = partners.items.slice(0, n);
  const rest = partners.items.slice(n);
  return `
      <section class="section" id="partners">
        <h2>Brands Marina has worked with</h2>
        <ul class="partner-grid featured">
          ${first.map(partnerTile).join("\n          ")}
        </ul>${rest.length ? `
        <details class="more-partners">
          <summary><span class="btn btn-ink">Show all ${partners.items.length} partners</span></summary>
          <ul class="partner-grid">
            ${rest.map(partnerTile).join("\n            ")}
          </ul>
        </details>` : ""}
      </section>`;
}

function parseCaseStudy(md) {
  const text = String(md).replace(/<!--[\s\S]*?-->/g, "").trim();
  const title = (text.match(/^# (.+)$/m) || [, "Case study"])[1].trim();
  const body = text.replace(/^# .+\n?/m, "").trim();
  return { title, body };
}

function renderCaseStudies(studies) {
  if (!studies.length) return "";
  return `
      <section class="section" id="case-study">
        <h2>Case stud${studies.length === 1 ? "y" : "ies"}</h2>
        ${studies.map(({ title, body }) => `
        <article class="case prose">
          <h3>${esc(title)}</h3>
${mdToHtml(body).replace(/<h2>/g, "<h4>").replace(/<\/h2>/g, "</h4>")}
        </article>`).join("\n")}
      </section>`;
}

function renderTestimonials(items) {
  const withQuote = items.filter((t) => t.quote && t.quote.trim());
  if (!withQuote.length) return "";
  return `
      <section class="section" id="testimonials">
        <h2>What it&rsquo;s like working with Marina</h2>
        <div class="quotes">
          ${withQuote.map((t) => `
          <figure class="quote">
            <blockquote>${esc(t.quote)}</blockquote>
            <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.role)}</span></figcaption>
          </figure>`).join("")}
        </div>
      </section>`;
}

function renderNumbers(site, episodes) {
  const counts = site.counts && site.counts.items && site.counts.items.length ? site.counts : null;
  const tiles = [];
  if (counts) for (const c of counts.items) tiles.push([c.value, c.label]);
  tiles.push([String(episodes.length), "podcast episodes, all with transcripts"]);
  tiles.push(["Weekly", "new episode, newsletter and shorts"]);
  return `
      <section class="section" id="numbers">
        <h2>Silicon Valley Girl in numbers</h2>
        <div class="numbers">
          ${tiles.map(([v, l]) => `<div><span class="num">${esc(v)}</span><span class="num-label">${esc(l)}</span></div>`).join("\n          ")}
        </div>
        ${counts ? `<p class="muted small">Audience across every Silicon Valley Girl and linguamarina account, audiences overlapping; rounded down; as of ${esc(counts.updatedAt)}, refreshed weekly from the team&rsquo;s dashboard.</p>` : ""}
      </section>`;
}

const FORMATS = [
  ["Podcast and YouTube integrations", "A segment inside an episode or a long-form video, scripted with you and delivered in Marina's voice."],
  ["Short-form video", "Reels, TikToks and Shorts made for each platform, not cut down from one master."],
  ["Event coverage", "Marina on the ground at a launch or conference, publishing in real time across every channel."],
  ["Newsletter placements", "A feature or a placement in Future Proof, the weekly newsletter."],
  ["Speaking", "Keynotes and panels on AI, careers and building a media business."],
];

function renderPartnershipsPage(site, episodes, { partners, testimonials, caseStudies }) {
  const body = `  <main class="page brands">
    <div class="wrap">
      <section class="brands-hero">
        <p class="eyebrow">For brands</p>
        <h1>Reach the people building their work and lives with AI</h1>
        <p class="dek">Silicon Valley Girl is a woman-hosted AI, tech and career podcast with an audience across YouTube, TikTok, Instagram, X and the Future Proof newsletter. Marina interviews the founders and scientists building AI and turns it into content people act on. Brands join that conversation in the formats below.</p>
        <div class="btn-row">
          <a class="btn btn-accent" href="#contact">Start a conversation</a>
          <a class="btn" href="#case-study">See a case study</a>
        </div>
      </section>
${renderNumbers(site, episodes)}
${renderPartners(partners)}
${renderCaseStudies(caseStudies)}
${renderTestimonials(testimonials.items || [])}
      <section class="section" id="formats">
        <h2>What we do together</h2>
        <div class="formats">
          ${FORMATS.map(([h, d]) => `<div class="format"><h3>${esc(h)}</h3><p>${esc(d)}</p></div>`).join("\n          ")}
        </div>
      </section>

      <section class="section narrow" id="contact">
        <h2>Tell us what you have in mind</h2>
        <p class="work-dek">Brand deals, event coverage, newsletter placements, speaking &mdash; describe the idea and the team will get back to you. Or write to <a href="mailto:${esc(site.contacts.partnerships)}">${esc(site.contacts.partnerships)}</a>.</p>
${renderContactForm()}
      </section>
    </div>
  </main>`;

  return shell({
    title: "Work with Silicon Valley Girl",
    description: "Partner with Marina Mogilko and the Silicon Valley Girl podcast: audience numbers, brands we have worked with, the Apple Event case study, what partners say, and the formats on offer.",
    path: "/partnerships/",
    body,
    scripts: CONTACT_FORM_SCRIPT,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${SITE_URL}/partnerships/#page`,
      url: `${SITE_URL}/partnerships/`,
      name: "Work with Silicon Valley Girl",
      isPartOf: { "@id": IDS.website },
      about: { "@id": IDS.org },
      mainEntity: { "@id": IDS.person },
    },
    css: `${CONTACT_FORM_CSS}
    .brands-hero { max-width: 48rem; }
    .brands-hero h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); }
    .numbers { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem 2rem; margin-top: 1.5rem; }
    .numbers div { display: flex; flex-direction: column; }
    .num { font-family: var(--display); font-size: clamp(2rem, 4vw, 3rem); line-height: 1; }
    .num-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(23, 21, 17, 0.6); margin-top: 0.35rem; }
    .partner-grid { list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; }
    .partner-grid.featured { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); }
    @media (min-width: 1100px) { .partner-grid.featured { grid-template-columns: repeat(9, 1fr); } }
    .partner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6rem; padding: 1.1rem 0.6rem; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; min-height: 104px; }
    .partner .mark { width: 36px; height: 36px; display: block; fill: var(--ink); object-fit: contain; }
    .partner[data-raster] .mark { border-radius: 8px; }
    .partner .mark-text { display: inline-flex; align-items: center; justify-content: center; font-family: var(--display); font-size: 1rem; background: var(--ground); border-radius: 8px; }
    .partner-name { font-size: 0.72rem; font-weight: 600; text-align: center; line-height: 1.25; color: rgba(23, 21, 17, 0.75); }
    .more-partners { margin-top: 1rem; }
    .more-partners summary { list-style: none; cursor: pointer; display: inline-block; margin-top: 0.5rem; }
    .more-partners summary::-webkit-details-marker { display: none; }
    .more-partners[open] summary .btn::after { content: " \\2191"; }
    .case { background: var(--card); border: 1px solid var(--rule); border-radius: 12px; padding: clamp(1.25rem, 3vw, 2.25rem); max-width: 52rem; margin-top: 1.25rem; }
    .case h3 { font-family: var(--display); text-transform: uppercase; font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1; margin-bottom: 0.75rem; }
    .case h4 { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin: 1.5rem 0 0.5rem; }
    .case ul { padding-left: 1.2rem; }
    .quotes { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; }
    .quote { margin: 0; background: var(--card); border: 1px solid var(--rule); border-radius: 12px; padding: 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
    .quote blockquote { margin: 0; font-size: 0.95rem; line-height: 1.55; }
    .quote blockquote::before { content: "\\201C"; color: var(--accent); font-family: var(--display); font-size: 2rem; line-height: 0; margin-right: 0.2rem; vertical-align: -0.4em; }
    .quote figcaption { margin-top: auto; display: flex; flex-direction: column; font-size: 0.82rem; color: rgba(23, 21, 17, 0.7); }
    .quote figcaption strong { color: var(--ink); }
    .formats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 1.5rem; }
    .format { border-top: 2px solid var(--ink); padding-top: 0.9rem; }
    .format h3 { font-weight: 700; font-size: 1rem; margin-bottom: 0.4rem; }
    .format p { font-size: 0.92rem; color: rgba(23, 21, 17, 0.75); }`,
  });
}

module.exports = { renderPartnershipsPage, parseCaseStudy, renderPartners, renderTestimonials, logoHtml, plainSvg };
