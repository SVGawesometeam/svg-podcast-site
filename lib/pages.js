// The static pages that are not episodes: /about/, /newsletter/, /privacy/
// and /terms/. All of them read from content/ (site.json and the legal
// texts) and share one shell, so a chrome change reaches them like any
// other page. None of them needs JavaScript.

const { esc, jsonForScript } = require("./html");
const { SHARED_HEAD, SHARED_HEADER, SHARED_FOOTER, CHROME_CSS, SOCIAL_LINKS } = require("./chrome");
const { SITE_URL, IDS } = require("./site");

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const PAGE_CSS = `
    body {
      font-family: var(--body); background: var(--ground); color: var(--ink);
      line-height: 1.55; margin: 0; -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    h1, h2, h3 { margin: 0; font-weight: 400; }
    p, ul, ol { margin: 0; }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
    .narrow { max-width: 760px; }
    .page { padding: clamp(2rem, 3.5vw, 3rem) 0 clamp(3rem, 5vw, 4rem); }
    .page h1 {
      font-family: var(--display); text-transform: uppercase;
      font-size: clamp(2.25rem, 5vw, 3.75rem); line-height: 1; margin-bottom: 0.5rem;
    }
    .eyebrow {
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 0.75rem;
    }
    .dek { font-size: 1.15rem; line-height: 1.5; max-width: 40rem; }
    .muted { color: rgba(23, 21, 17, 0.6); }
    .section { padding-top: clamp(2.25rem, 4vw, 3.5rem); }
    .section h2 {
      font-family: var(--display); text-transform: uppercase; letter-spacing: 0.01em;
      font-size: clamp(1.6rem, 3vw, 2.25rem); line-height: 1; margin-bottom: 1rem;
    }
    .section h3 { font-weight: 600; font-size: 1.05rem; margin-bottom: 0.35rem; }
    .prose p + p, .prose ul + p, .prose p + ul { margin-top: 1rem; }
    .prose ul, .prose ol { padding-left: 1.3rem; }
    .prose li + li { margin-top: 0.4rem; }
    .prose h2 { margin-top: 2.25rem; }
    .prose h3 { margin-top: 1.5rem; }
    .btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-weight: 600; text-decoration: none; padding: 0.75rem 1.3rem;
      border-radius: 8px; border: 2px solid var(--ink); background: transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn:hover { background: var(--ink); color: var(--ground); }
    .btn-accent { background: var(--accent); border-color: var(--accent); color: var(--ground); }
    .btn-accent:hover { background: var(--ink); border-color: var(--ink); }
    .btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
    .back-home {
      display: inline-block; margin-top: 2.5rem; font-size: 0.95rem;
      font-weight: 600; text-decoration: none; border-bottom: 2px solid var(--accent);
      padding-bottom: 2px;
    }
    @media (max-width: 640px) {
      .wrap { padding: 0 1rem; }
    }`;

function shell({ title, description, path, body, jsonLd, css = "", image = `${SITE_URL}/og-image.png`, type = "website" }) {
  const url = `${SITE_URL}${path}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Silicon Valley Girl Podcast</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(title)} — Silicon Valley Girl Podcast">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${esc(image)}">
  <meta name="twitter:card" content="summary_large_image">
  ${SHARED_HEAD}
  <style>
    /* CHROME-START */${CHROME_CSS}
    /* CHROME-END */
${PAGE_CSS}${css}
  </style>${jsonLd ? `\n  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>` : ""}
</head>
<body>

  ${SHARED_HEADER}

${body}

  ${SHARED_FOOTER}

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// A small Markdown subset, enough for the legal texts: # headings, "- " lists,
// **bold**, paragraphs separated by blank lines (lines inside one paragraph
// become line breaks, which is how the postal address is written), and
// email addresses as links. Anything else is text.
// ---------------------------------------------------------------------------

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '<a href="mailto:$1">$1</a>');
}

function mdToHtml(md) {
  // HTML comments are notes to editors (the draft marker on hub copy) and
  // never reach the page.
  const blocks = md.replace(/<!--[\s\S]*?-->/g, "").replace(/\r/g, "").trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    const first = lines[0];
    const heading = first.match(/^(#{1,3}) (.+)$/);
    if (heading && lines.length === 1) {
      const level = heading[1].length;
      return `<h${level}>${inline(heading[2])}</h${level}>`;
    }
    if (lines.every((l) => l.startsWith("- "))) {
      return `<ul>\n${lines.map((l) => `  <li>${inline(l.slice(2))}</li>`).join("\n")}\n</ul>`;
    }
    // A heading directly followed by text on the next line: render both.
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${inline(heading[2])}</h${level}>\n<p>${lines.slice(1).map(inline).join("<br>\n")}</p>`;
    }
    return `<p>${lines.map(inline).join("<br>\n")}</p>`;
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Legal pages
// ---------------------------------------------------------------------------

function parseLegal(md) {
  const title = (md.match(/^# (.+)$/m) || [, "Untitled"])[1].trim();
  const updated = (md.match(/^Last updated: (.+)$/m) || [, ""])[1].trim();
  const body = md.replace(/^# .+$/m, "").replace(/^Last updated: .+$/m, "").trim();
  return { title, updated, body };
}

function renderLegalPage(md, { path, description }) {
  const { title, updated, body } = parseLegal(md);
  return shell({
    title,
    description,
    path,
    body: `  <main class="page">
    <div class="wrap narrow prose legal">
      <p class="eyebrow">Legal</p>
      <h1>${esc(title)}</h1>
      ${updated ? `<p class="muted">Last updated: ${esc(updated)}</p>` : ""}
      <div class="legal-body">
${mdToHtml(body)}
      </div>
      <a class="back-home" href="/">&larr; Back to the homepage</a>
    </div>
  </main>`,
    css: `
    .legal-body { margin-top: 2rem; }
    .legal-body h2 { font-family: var(--display); text-transform: uppercase; font-size: 1.6rem; line-height: 1; margin: 2.25rem 0 0.75rem; }
    .legal-body h3 { font-weight: 600; font-size: 1.05rem; margin: 1.5rem 0 0.5rem; }
    .legal-body p + p { margin-top: 1rem; }
    .legal-body ul { margin-top: 1rem; }`,
  });
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

const FORMAT_LABEL = { interview: "interviews", solo: "solo episodes", compilation: "compilations" };

// The newest page on which the named guest appears, preferring an interview
// with them alone over a compilation they are one voice in.
function episodeFor(name, episodes) {
  const matches = episodes.filter((ep) => (ep.guestName || "").includes(name));
  return matches.find((ep) => ep.format !== "compilation") || matches[0] || null;
}

function featuredGuestLinks(site, episodes) {
  const links = [];
  for (const name of site.featuredGuests || []) {
    const ep = episodeFor(name, episodes);
    if (!ep) { console.warn(`   WARN about: no episode found for featured guest "${name}"`); continue; }
    links.push({ name, href: `/episode/${ep.videoId}/` });
  }
  return links;
}

function yearOf(date) {
  return date ? String(date).slice(0, 4) : "";
}

function aboutJsonLd(site, episodes) {
  const p = site.person;
  const press = (site.press || []).map((a) => ({
    "@type": "CreativeWork",
    name: a.title,
    url: a.url,
    publisher: { "@type": "Organization", name: a.outlet },
    ...(a.date ? { datePublished: a.date } : {}),
  }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}/about/#page`,
        url: `${SITE_URL}/about/`,
        name: `About ${p.name}`,
        isPartOf: { "@id": IDS.website },
        mainEntity: { "@id": IDS.person },
      },
      {
        "@type": "Person",
        "@id": IDS.person,
        name: p.name,
        url: `${SITE_URL}/about/`,
        image: `${SITE_URL}${p.portrait}`,
        jobTitle: p.jobTitle,
        description: p.positioning,
        homeLocation: { "@type": "Place", name: p.location },
        worksFor: { "@id": IDS.org },
        knowsAbout: ["Artificial intelligence", "Careers", "Entrepreneurship", "Creator economy"],
        ...(site.awards && site.awards.length ? { award: site.awards } : {}),
        sameAs: p.sameAs,
        ...(press.length ? { subjectOf: press } : {}),
      },
      {
        "@type": "PodcastSeries",
        "@id": IDS.podcast,
        name: "Silicon Valley Girl Podcast",
        url: `${SITE_URL}/`,
        author: { "@id": IDS.person },
      },
    ],
  };
}

function renderAboutPage(site, episodes) {
  const p = site.person;
  const guests = featuredGuestLinks(site, episodes);
  const byFormat = episodes.reduce((acc, ep) => ((acc[ep.format] = (acc[ep.format] || 0) + 1), acc), {});
  const total = episodes.length;
  const soloCount = byFormat.solo || 0;
  const listen = SOCIAL_LINKS.filter((s) => ["YouTube", "Apple Podcasts", "Spotify"].includes(s.label));

  const factsHtml = (site.facts || []).map((f) => `
          <li>${esc(f.text)}${f.source ? ` <a class="source" href="${esc(f.source)}" target="_blank" rel="noopener">${esc(f.sourceLabel || "Source")}</a>` : ""}</li>`).join("");

  const bioHtml = (p.bio || []).map((para) => `<p>${esc(para)}</p>`).join("\n          ");

  const guestsHtml = guests.map((g) => `<a href="${g.href}">${esc(g.name)}</a>`).join(", ");

  const speakingHtml = (site.speaking || []).map((s) => `
          <li><strong>${esc(s.event)}</strong>, ${esc(s.place)}, ${esc(s.year)}${s.note ? ` <span class="muted">(${esc(s.note)})</span>` : ""}</li>`).join("");

  const topicsHtml = (site.speakingTopics || []).map((t) => `<li>${esc(t)}</li>`).join("\n            ");

  const pressHtml = (site.press || []).map((a) => `
          <li><a href="${esc(a.url)}" target="_blank" rel="noopener"><span class="outlet">${esc(a.outlet)}</span> ${esc(a.title)}</a>${a.date ? ` <span class="muted">${yearOf(a.date)}</span>` : ""}</li>`).join("");

  const counts = site.counts && site.counts.items && site.counts.items.length ? site.counts : null;
  const countsHtml = counts ? `
        <div class="counts">
          ${counts.items.map((c) => `<div><span class="count-value">${esc(c.value)}</span><span class="count-label">${esc(c.label)}</span></div>`).join("\n          ")}
        </div>
        <p class="muted small">Across every Silicon Valley Girl and linguamarina account, audiences overlapping; rounded down, as of ${esc(counts.updatedAt)}.</p>` : "";

  const faq = [
    ["Who is Marina Mogilko?", `${esc(p.bio[0])}`],
    ["What is the Silicon Valley Girl podcast?", `${esc(p.positioning)} There are ${total} episodes on this site: ${byFormat.interview || 0} interviews, ${soloCount} solo episodes and ${byFormat.compilation || 0} compilations, each with a full transcript. A new episode comes out every week.`],
    ["Who has been a guest?", `Guests have included ${guestsHtml}. The <a href="/episodes/">episode directory</a> lists all ${total}.`],
    ["Are there episodes without a guest?", `Yes. In the ${soloCount} solo episodes Marina explains one tool, one career move or one idea from the valley on her own, in about twenty minutes.`],
    ["Where can I listen?", `On ${listen.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(", ")}. Every episode page on this site carries the transcript, the chapters and the key takeaways.`],
    [`What is ${esc(site.newsletter.name)}?`, `${esc(site.newsletter.name)} is Marina's newsletter: ${esc(site.newsletter.cadence.toLowerCase())} with the AI idea worth your attention and exactly what to try with it. <a href="/newsletter/">Read about it and subscribe</a>.`],
    ["How do I work with Marina?", `Brand partnerships go to <a href="mailto:${esc(site.contacts.partnerships)}">${esc(site.contacts.partnerships)}</a>, press to <a href="mailto:${esc(site.contacts.press)}">${esc(site.contacts.press)}</a>. Guest pitches and speaking invitations go through the <a href="/#work">form on the homepage</a>.`],
  ];
  const faqHtml = faq.map(([q, a]) => `
          <div class="faq-item">
            <h3>${q}</h3>
            <p>${a}</p>
          </div>`).join("");

  const body = `  <main class="page about">
    <div class="wrap">
      <section class="about-hero">
        <div>
          <p class="eyebrow">About the host</p>
          <h1>${esc(p.name)}</h1>
          <p class="dek">${esc(p.positioning)}</p>
          <div class="btn-row">
            <a class="btn btn-accent" href="/episodes/">Listen to the podcast</a>
            <a class="btn" href="/newsletter/">${esc(site.newsletter.name)} newsletter</a>
            <a class="btn" href="/#work">Work with Marina</a>
          </div>
        </div>
        <img class="portrait" src="${esc(p.portrait)}" alt="${esc(p.name)}, host of the Silicon Valley Girl Podcast" width="${esc(p.portraitWidth)}" height="${esc(p.portraitHeight)}">
      </section>
${countsHtml}
      <section class="section" id="facts">
        <h2>In short</h2>
        <ul class="facts">${factsHtml}
        </ul>
      </section>

      <section class="section prose narrow" id="story">
        <h2>The story</h2>
          ${bioHtml}
      </section>

      <section class="section" id="guests">
        <h2>Guests on the show</h2>
        <p class="dek">${guestsHtml}.</p>
        <p><a class="back-home" href="/episodes/">All ${total} episodes &rarr;</a></p>
      </section>

      <section class="section" id="speaking">
        <h2>Speaking</h2>
        <div class="two-col">
          <div>
            <h3>Recent stages</h3>
            <ul class="plain">${speakingHtml}
            </ul>
          </div>
          <div>
            <h3>Talks Marina gives</h3>
            <ul class="plain">
            ${topicsHtml}
            </ul>
            <p class="muted small">Invite Marina through the <a href="/#work">form on the homepage</a> or write to <a href="mailto:${esc(site.contacts.partnerships)}">${esc(site.contacts.partnerships)}</a>.</p>
          </div>
        </div>
      </section>

      <section class="section" id="press">
        <h2>Press</h2>
        <ul class="press">${pressHtml}
        </ul>
        <p class="muted small">Press enquiries: <a href="mailto:${esc(site.contacts.press)}">${esc(site.contacts.press)}</a>.</p>
      </section>

      <section class="section" id="faq">
        <h2>Questions people ask</h2>
        <div class="faq">${faqHtml}
        </div>
      </section>
    </div>
  </main>`;

  return shell({
    title: `About ${p.name}`,
    description: `${p.name} is the host of Silicon Valley Girl, a woman-hosted AI, tech and career podcast from Silicon Valley. Who she is, who has been on the show, where to listen and how to work with her.`,
    path: "/about/",
    body,
    jsonLd: aboutJsonLd(site, episodes),
    image: `${SITE_URL}${site.person.portraitSquare || p.portrait}`,
    type: "profile",
    css: `
    .about-hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr); gap: clamp(1.5rem, 4vw, 4rem); align-items: center; }
    .about-hero .portrait { width: 100%; height: auto; border-radius: 12px; display: block; }
    .counts { display: flex; gap: 2.5rem; flex-wrap: wrap; margin-top: 2rem; }
    .counts div { display: flex; flex-direction: column; }
    .count-value { font-family: var(--display); font-size: 2.25rem; line-height: 1; }
    .count-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(23, 21, 17, 0.6); }
    .small { font-size: 0.9rem; margin-top: 0.75rem; }
    .facts { padding-left: 1.3rem; max-width: 46rem; }
    .facts li + li { margin-top: 0.6rem; }
    .facts .source { font-size: 0.8rem; margin-left: 0.3rem; color: var(--accent); }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    .plain { list-style: none; padding: 0; }
    .plain li + li { margin-top: 0.5rem; }
    .press { list-style: none; padding: 0; columns: 2; column-gap: 2.5rem; max-width: 60rem; }
    .press li { break-inside: avoid; margin-bottom: 0.6rem; }
    .press a { text-decoration: none; border-bottom: 1px solid var(--rule); }
    .press a:hover { border-bottom-color: var(--accent); }
    .press .outlet { font-weight: 700; }
    .faq { max-width: 46rem; }
    .faq-item + .faq-item { margin-top: 1.5rem; }
    @media (max-width: 720px) {
      .about-hero { grid-template-columns: 1fr; }
      .about-hero .portrait { max-width: 360px; }
      .press { columns: 1; }
    }`,
  });
}

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

function renderNewsletterPage(site) {
  const n = site.newsletter;
  const body = `  <main class="page">
    <div class="wrap narrow prose">
      <p class="eyebrow">Newsletter</p>
      <h1>${esc(n.name)}</h1>
      <p class="dek">${esc(n.cadence)} from Marina Mogilko: the AI idea worth your attention, and exactly what to try with it.</p>
      <div class="btn-row">
        <a class="btn btn-accent" href="${esc(n.url)}" target="_blank" rel="noopener">Subscribe, it's free</a>
        <a class="btn" href="https://siliconvalleygirl.beehiiv.com/" target="_blank" rel="noopener">Read past issues</a>
      </div>

      <section class="section">
        <h2>What you get</h2>
        <ul>
          <li>One email a week, short enough to read with a coffee.</li>
          <li>The AI tool, product or idea that is actually worth your time this week, and how to use it.</li>
          <li>What the podcast guests said that you can act on: the career move, the business lesson, the workflow.</li>
          <li>No sponsor copy pretending to be advice. When something is sponsored, it says so.</li>
        </ul>
      </section>

      <section class="section">
        <h2>Who it is for</h2>
        <p>People who want to use AI at work and in their business without reading everything: founders, people building a career in tech, creators, and anyone outside the valley who wants to know what is going on inside it.</p>
      </section>

      <section class="section">
        <h2>Prefer to listen?</h2>
        <p>The <a href="/episodes/">podcast</a> goes deeper on the same questions, with the people building the technology. Every episode page here has the transcript and the key takeaways.</p>
      </section>

      <a class="back-home" href="/">&larr; Back to the homepage</a>
    </div>
  </main>`;
  return shell({
    title: `${n.name}, the newsletter`,
    description: `${n.name} is Marina Mogilko's weekly newsletter on AI tools and career moves. ${n.cadence}, free.`,
    path: "/newsletter/",
    body,
  });
}

module.exports = { shell, mdToHtml, parseLegal, renderLegalPage, renderAboutPage, renderNewsletterPage, aboutJsonLd, episodeFor };
