// The episode card used by the directory and the topic hubs: thumbnail,
// guest · date · length, title, and a format label. One markup, one CSS.
const { esc } = require("./html");

const FORMAT_LABEL = { interview: "Interview", solo: "Solo", compilation: "Compilation" };

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function displayGuest(ep) {
  if (!ep.guestName) return "";
  if (ep.guestName === "Marina Mogilko") return "Marina Mogilko";
  return ep.guestName;
}

// data-* attributes carry what the directory's client-side filter needs:
// format, topic slugs and a lowercase search string. They are inert
// without JavaScript, and the card is a plain link either way.
function renderEpisodeCard(ep, { reason } = {}) {
  const search = `${ep.title} ${ep.guestName || ""} ${ep.guestTitle || ""}`.toLowerCase();
  return `
          <a href="/episode/${ep.videoId}/" class="ep-card" data-format="${esc(ep.format || "")}" data-topics="${esc((ep.topics || []).join(" "))}" data-search="${esc(search)}">
            <img src="${esc(ep.thumbnail)}" alt="${esc(ep.title)}" loading="lazy" width="480" height="270">
            <div class="ep-card-body">
              <p class="ep-card-meta">${esc(displayGuest(ep))} &middot; ${formatDateShort(ep.publishedAt)} &middot; ${esc(ep.duration)}${ep.format ? ` <span class="ep-format">${Object.hasOwn(FORMAT_LABEL, ep.format) ? FORMAT_LABEL[ep.format] : esc(ep.format)}</span>` : ""}</p>
              <h3 class="ep-card-title">${esc(ep.title)}</h3>${reason ? `
              <p class="ep-card-reason">${esc(reason)}</p>` : ""}
            </div>
          </a>`;
}

const CARD_CSS = `
    .ep-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.8rem 1.4rem;
    }
    .ep-card { text-decoration: none; display: block; }
    .ep-card[hidden] { display: none; }
    .ep-card img { width: 100%; height: auto; display: block; border-radius: 8px; aspect-ratio: 16 / 9; object-fit: cover; }
    .ep-card-body { padding-top: 0.75rem; }
    .ep-card-meta {
      font-size: 0.64rem; font-weight: 700; letter-spacing: 0.13em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 0.4rem;
    }
    .ep-format {
      display: inline-block; margin-left: 0.4rem; padding: 0.1rem 0.45rem; border-radius: 999px;
      border: 1px solid var(--rule); color: rgba(23, 21, 17, 0.6); letter-spacing: 0.08em;
    }
    .ep-card-title {
      font-family: var(--display); font-size: 1.22rem; line-height: 1.08;
      letter-spacing: 0.01em; text-transform: uppercase; margin: 0; font-weight: 400;
    }
    .ep-card:hover .ep-card-title { color: var(--accent); }
    .ep-card-reason { font-size: 0.9rem; color: rgba(23, 21, 17, 0.7); margin: 0.4rem 0 0; }
    @media (max-width: 640px) {
      .ep-grid { grid-template-columns: 1fr; }
      .ep-card-meta { font-size: 0.75rem; }
    }`;

module.exports = { renderEpisodeCard, CARD_CSS, FORMAT_LABEL, formatDateShort, displayGuest };
