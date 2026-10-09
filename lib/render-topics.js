// Topic hubs: /topics/ (the index) and /topics/<slug>/ (one per topic in
// content/topics.json). A hub answers "which episodes cover X": the
// question, the episodes that are mainly about it, then the ones that touch
// it, and links to the sibling hubs. The editorial answer in Marina's voice,
// where the guests disagree and the FAQ (plan section 5.5) are added per hub
// from content/topics/<slug>.md once the team has reviewed them; until then
// the hub is the curated list.

const { esc } = require("./html");
const { shell, mdToHtml } = require("./pages");
const { renderEpisodeCard, CARD_CSS, FORMAT_LABEL } = require("./cards");
const { SITE_URL, IDS } = require("./site");

// Episodes for a hub: primary first (the slug is first in their list), then
// secondary; newest first within each group.
function episodesFor(slug, episodes) {
  const newest = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);
  const primary = episodes.filter((ep) => (ep.topics || [])[0] === slug).sort(newest);
  const secondary = episodes.filter((ep) => (ep.topics || []).includes(slug) && (ep.topics || [])[0] !== slug).sort(newest);
  return { primary, secondary };
}

function countFormats(list) {
  const c = list.reduce((acc, ep) => ((acc[ep.format] = (acc[ep.format] || 0) + 1), acc), {});
  const parts = [];
  if (c.interview) parts.push(`${c.interview} interview${c.interview === 1 ? "" : "s"}`);
  if (c.solo) parts.push(`${c.solo} solo episode${c.solo === 1 ? "" : "s"}`);
  if (c.compilation) parts.push(`${c.compilation} compilation${c.compilation === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function topicJsonLd(topic, all) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/topics/${topic.slug}/#page`,
    url: `${SITE_URL}/topics/${topic.slug}/`,
    name: `${topic.name}: Silicon Valley Girl Podcast episodes`,
    description: topic.description,
    isPartOf: { "@id": IDS.website },
    about: { "@type": "Thing", name: topic.name },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: all.length,
      itemListElement: all.map((ep, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/episode/${ep.videoId}/`,
        name: ep.title,
      })),
    },
  };
}

function renderTopicPage(topic, episodes, topics, { editorial = null, newsletterCta = () => "" } = {}) {
  const { primary, secondary } = episodesFor(topic.slug, episodes);
  const all = [...primary, ...secondary];
  const siblings = topics.filter((t) => t.slug !== topic.slug);

  const body = `  <main class="page topic">
    <div class="wrap">
      <p class="eyebrow"><a href="/topics/">Topics</a></p>
      <h1>${esc(topic.name)}</h1>
      <p class="dek">${esc(topic.description)}</p>
      <p class="topic-question"><span class="label">The question this page answers</span>${esc(topic.question)}</p>
      <p class="archive-count">${all.length} episodes: ${countFormats(all)}</p>
${editorial ? `
      <section class="section prose narrow editorial">
${mdToHtml(editorial)}
      </section>` : ""}
      <section class="section" id="start-here">
        <h2>Episodes about this</h2>
        <div class="ep-grid">${primary.map((ep) => renderEpisodeCard(ep)).join("")}
        </div>
      </section>
${secondary.length ? `
      <section class="section" id="also">
        <h2>Also covered in</h2>
        <div class="ep-grid">${secondary.map((ep) => renderEpisodeCard(ep)).join("")}
        </div>
      </section>` : ""}
${newsletterCta()}
      <section class="section" id="more-topics">
        <h2>More topics</h2>
        <ul class="topic-chips">
          ${siblings.map((t) => `<li><a href="/topics/${esc(t.slug)}/">${esc(t.name)}</a></li>`).join("\n          ")}
        </ul>
      </section>
    </div>
  </main>`;

  return shell({
    title: topic.name,
    description: `${topic.question} ${all.length} Silicon Valley Girl Podcast episodes on ${topic.name.toLowerCase()}, each with a full transcript: ${topic.description}`,
    path: `/topics/${topic.slug}/`,
    body,
    jsonLd: topicJsonLd(topic, all),
    css: `${CARD_CSS}
    .eyebrow a { text-decoration: none; }
    .topic-question { margin-top: 1.25rem; padding: 1rem 1.25rem; border-left: 4px solid var(--accent); background: var(--card); max-width: 46rem; font-size: 1.05rem; }
    .topic-question .label { display: block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(23, 21, 17, 0.55); margin-bottom: 0.3rem; }
    .archive-count { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(23, 21, 17, 0.55); margin-top: 1.25rem; }
    .topic-chips { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .topic-chips a { display: inline-block; padding: 0.5rem 0.9rem; border: 1.5px solid var(--ink); border-radius: 999px; text-decoration: none; font-weight: 500; font-size: 0.9rem; }
    .topic-chips a:hover { background: var(--ink); color: var(--ground); }
    .editorial h2 { font-size: 1.4rem; }`,
  });
}

function renderTopicsIndex(topics, episodes) {
  const tiles = topics.map((t) => {
    const { primary, secondary } = episodesFor(t.slug, episodes);
    const n = primary.length + secondary.length;
    return `
        <a class="topic-tile" href="/topics/${esc(t.slug)}/">
          <h2>${esc(t.name)}</h2>
          <p class="q">${esc(t.question)}</p>
          <p class="n">${n} episodes</p>
        </a>`;
  }).join("");
  const body = `  <main class="page">
    <div class="wrap">
      <p class="eyebrow">Browse</p>
      <h1>Topics</h1>
      <p class="dek">Every episode of the Silicon Valley Girl Podcast, sorted by the question it helps with. Each topic page lists the episodes about it, with transcripts.</p>
      <div class="topic-grid">${tiles}
      </div>
      <p><a class="back-home" href="/episodes/">Or browse all ${episodes.length} episodes &rarr;</a></p>
    </div>
  </main>`;
  return shell({
    title: "Topics",
    description: `Silicon Valley Girl Podcast episodes by topic: ${topics.map((t) => t.name.toLowerCase()).join(", ")}. ${episodes.length} episodes with transcripts.`,
    path: "/topics/",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/topics/#page`,
      url: `${SITE_URL}/topics/`,
      name: "Silicon Valley Girl Podcast topics",
      isPartOf: { "@id": IDS.website },
      hasPart: topics.map((t) => ({ "@type": "CollectionPage", name: t.name, url: `${SITE_URL}/topics/${t.slug}/` })),
    },
    css: `
    .topic-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 2rem; }
    .topic-tile { display: block; text-decoration: none; background: var(--card); border: 1.5px solid var(--rule); border-radius: 12px; padding: 1.4rem; transition: border-color 0.15s, transform 0.15s; }
    .topic-tile:hover { border-color: var(--ink); transform: translateY(-2px); }
    .topic-tile h2 { font-family: var(--display); text-transform: uppercase; font-size: 1.6rem; line-height: 1; margin-bottom: 0.6rem; }
    .topic-tile .q { font-size: 0.98rem; line-height: 1.45; }
    .topic-tile .n { margin-top: 0.8rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }`,
  });
}

module.exports = { renderTopicPage, renderTopicsIndex, episodesFor, topicJsonLd, FORMAT_LABEL };
