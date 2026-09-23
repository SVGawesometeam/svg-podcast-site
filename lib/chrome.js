// Shared chrome: head, header, footer and the CSS tokens behind them.
// build.js and batch-build.js both read this. They used to carry their own
// copies, and the batch-build copy had drifted: no favicons, and a 3-icon
// header against the 5 in build.js.

const ICONS = {
  youtube: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#FF0000" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81z"/><path fill="#fff" d="M9.55 15.57V8.43L15.82 12z"/></svg>`,
  spotify: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-.99-.12-1.14-.6-.12-.48.12-.99.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.2-1.26 11.28-.96 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>`,
  apple: `<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ap" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#F452FF"/><stop offset="100%" stop-color="#832BC1"/></linearGradient></defs><rect width="24" height="24" rx="5.4" fill="url(#ap)"/><circle cx="12" cy="13.5" r="2" fill="#fff"/><path fill="#fff" d="M12 8.2a5.3 5.3 0 0 0-3.75 1.55.75.75 0 1 0 1.06 1.06A3.8 3.8 0 0 1 12 9.7a3.8 3.8 0 0 1 2.69 1.11.75.75 0 1 0 1.06-1.06A5.3 5.3 0 0 0 12 8.2z"/><path fill="#fff" d="M12 5a8.5 8.5 0 0 0-6.01 2.49.75.75 0 1 0 1.06 1.06A7 7 0 0 1 12 6.5a7 7 0 0 1 4.95 2.05.75.75 0 1 0 1.06-1.06A8.5 8.5 0 0 0 12 5z"/><path fill="#fff" d="M11.25 15.5v3.25a.75.75 0 0 0 1.5 0V15.5a.75.75 0 0 0-1.5 0z"/></svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><path fill="#fff" d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 7.92a3.12 3.12 0 1 1 0-6.24 3.12 3.12 0 0 1 0 6.24zm5-8.12a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0zM19.94 8.13c-.05-1.14-.3-2.15-.6-2.46a4.44 4.44 0 0 0-1.57-1.57c-.76-.39-1.52-.55-2.46-.6C14.26 3.44 13.7 3.42 12 3.42s-2.26.02-3.31.08c-.94.05-1.7.21-2.46.6a4.44 4.44 0 0 0-1.57 1.57c-.39.76-.55 1.52-.6 2.46-.06 1.05-.08 1.61-.08 3.31s.02 2.26.08 3.31c.05.94.21 1.7.6 2.46.34.66.8 1.2 1.57 1.57.76.39 1.52.55 2.46.6 1.05.06 1.61.08 3.31.08s2.26-.02 3.31-.08c.94-.05 1.7-.21 2.46-.6a4.44 4.44 0 0 0 1.57-1.57c.39-.76.55-1.52.6-2.46.06-1.05.08-1.61.08-3.31s-.02-2.26-.08-3.31zm-1.54 6.52c-.04.82-.2 1.26-.34 1.56-.18.44-.4.76-.74 1.1-.34.34-.66.56-1.1.74-.3.14-.74.3-1.56.34-.88.04-1.15.05-3.38.05s-2.5-.01-3.38-.05c-.82-.04-1.26-.2-1.56-.34a2.98 2.98 0 0 1-1.1-.74 2.98 2.98 0 0 1-.74-1.1c-.14-.3-.3-.74-.34-1.56C5.12 13.77 5.1 13.5 5.1 12s.02-1.77.06-2.65c.04-.82.2-1.26.34-1.56.18-.44.4-.76.74-1.1.34-.34.66-.56 1.1-.74.3-.14.74-.3 1.56-.34C9.78 5.57 10.05 5.55 12 5.55s2.22.02 3.1.06c.82.04 1.26.2 1.56.34.44.18.76.4 1.1.74.34.34.56.66.74 1.1.14.3.3.74.34 1.56.04.88.06 1.15.06 2.65s-.02 1.77-.06 2.65z"/></svg>`,
  linkedin: `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.17 10.06H9.7v8.38H7.17v-8.38zM8.44 6.56a1.47 1.47 0 1 1 0 2.94 1.47 1.47 0 0 1 0-2.94zM10.95 10.06h2.42v1.14h.04c.34-.64 1.16-1.3 2.38-1.3 2.54 0 3.01 1.68 3.01 3.86v4.68h-2.52v-4.14c0-.98-.02-2.26-1.38-2.26-1.38 0-1.58 1.08-1.58 2.18v4.22h-2.52v-8.38z"/></svg>`,
  twitter: `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#000"/><path fill="#fff" d="M13.9 10.47 19.15 4.5h-1.24l-4.56 5.18L9.71 4.5H5.5l5.5 7.9L5.5 19.5h1.24l4.82-5.47 3.85 5.47h4.21l-5.72-8.03zm-1.71 1.94-.56-.8-4.43-6.32h1.9l3.59 5.13.56.8 4.66 6.66h-1.9l-3.82-5.47z"/></svg>`,
  tiktok: `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#000"/><path fill="#fff" d="M16.6 5.82a3.6 3.6 0 0 1-1.9-1.32h-1.9v9.1a1.9 1.9 0 1 1-1.9-1.9c.13 0 .26.02.38.05v-1.98a4 4 0 0 0-.38-.02 3.86 3.86 0 1 0 3.86 3.86V8.7a5.4 5.4 0 0 0 3.14 1v-1.9a3.6 3.6 0 0 1-1.4-.98z"/></svg>`,
  newsletter: `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EC4899"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#3B5BDB"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#bh)"/><rect x="8.7" y="5" width="6.6" height="2.9" rx="1.45" fill="#fff"/><rect x="7.5" y="8.35" width="9" height="2.9" rx="1.45" fill="#fff"/><rect x="6.3" y="11.7" width="11.4" height="2.9" rx="1.45" fill="#fff"/><rect x="7.2" y="15.05" width="3.1" height="2.95" rx="1.2" fill="#fff"/><rect x="13.7" y="15.05" width="3.1" height="2.95" rx="1.2" fill="#fff"/><path d="M10.7 18v-1.55a1.3 1.3 0 0 1 2.6 0V18z" fill="#fff"/></svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#5b6470"/><path fill="#fff" d="M5 7.5h14a.5.5 0 0 1 .5.5v.4l-7.5 4.3L4.5 8.4V8a.5.5 0 0 1 .5-.5zM4.5 9.9l6.9 3.95a1 1 0 0 0 1 0L19.5 9.9V16a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5z"/></svg>`,
};

const SHARED_HEAD = `
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#171511">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;


// Every account the site links to, in display order. The header renders these
// as icons alone; the homepage's Follow Along block renders the same list with
// labels. Defined here rather than in build.js because the header reaches all
// 119 pages and build.js only renders two of them.
const SOCIAL_LINKS = [
  { url: "https://www.youtube.com/@SiliconValleyGirl", label: "YouTube", icon: ICONS.youtube },
  { url: "https://open.spotify.com/show/02ZRsvu61y1C2GIc8J2gsY", label: "Spotify", icon: ICONS.spotify },
  { url: "https://podcasts.apple.com/us/podcast/silicon-valley-girl-ai-tech-and-career-growth/id1819090545", label: "Apple Podcasts", icon: ICONS.apple },
  { url: "https://www.instagram.com/siliconvalleygirlpodcast/", label: "Instagram", icon: ICONS.instagram },
  { url: "https://www.tiktok.com/@linguamarina", label: "TikTok", icon: ICONS.tiktok },
  { url: "https://www.linkedin.com/in/marinamogilko/", label: "LinkedIn", icon: ICONS.linkedin },
  { url: "https://x.com/siliconvalleymm", label: "X", icon: ICONS.twitter },
];

// Icon-only, so each link needs an accessible name of its own — a screen
// reader reading "link" seven times is the failure mode here.
const SHARED_SOCIALS = `<nav class="site-socials" aria-label="Social media">
        ${SOCIAL_LINKS.map(
          (s) =>
            `<a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.label}" title="${s.label}">${s.icon}</a>`
        ).join("\n        ")}
      </nav>`;

// Anchors are root-relative (/#episodes, not #episodes) because this header is
// also injected into every episode page, where a bare fragment would scroll to
// nothing instead of returning to the homepage section.
const SHARED_HEADER = `
  <header class="site-header">
    <div class="site-header-inner">
      <a href="/" class="wordmark">SILICON VALLEY GIRL<span>WITH MARINA MOGILKO</span></a>
      ${SHARED_SOCIALS}
      <nav class="site-nav">
        <a href="/#episodes">Episodes</a>
        <a href="/#host">Host</a>
        <a href="/#contact">Contact us</a>
        <a href="/#subscribe" class="nav-cta">Subscribe</a>
      </nav>
    </div>
  </header>`;

const SHARED_FOOTER = `
  <footer class="site-footer">
    <div class="site-footer-inner">
      <span class="footer-mark">SILICON VALLEY GIRL</span>
      <nav class="footer-links">
        <a href="https://partnerships.marinamogilko.co/plc">Privacy Policy</a>
        <a href="https://partnerships.marinamogilko.co/ts">Terms of Service</a>
      </nav>
      <span class="footer-legal">&copy; 2026 Marina Mogilko &middot; Made in Silicon Valley</span>
    </div>
  </footer>`;

// Palette read off the mock, which authors in oklch:
//   oklch(0.9938 0.0102 95.5) -> #FFFDF6   warm paper, not a neutral grey
//   oklch(0.5729 0.2261 28.5) -> #DF1615
//   oklch(0.1985 0.0084 84)   -> #171511   warm near-black
//
// Deliberately does NOT set a body font. This block is injected into episode
// pages as well, and those set Inter for their transcripts; imposing a face
// here would restyle 117 pages of body copy that are meant to stay untouched.
const CHROME_CSS = `
  :root {
    --accent: #DF1615;
    --ground: #FFFDF6;
    --ink: #171511;
    --card: #FFFFFF;
    --muted: #C5C1B9;
    --rule: rgba(23, 21, 17, 0.12);
    --display: 'Bebas Neue', 'Arial Narrow', Impact, sans-serif;
    --body: 'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }
  img { max-width: 100%; }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 2px;
  }

  /* ---- Header ----
     Cream, not a black bar: the mock's header is the page ground with a 2px
     ink rule under it. The red pill is the "with Marina Mogilko" tag; the ink
     pill is Subscribe. */
  .site-header {
    background: var(--ground);
    color: var(--ink);
    border-bottom: 2px solid var(--ink);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .site-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }
  .site-header .wordmark {
    font-family: var(--display);
    font-size: 1.6rem;
    letter-spacing: 0.01em;
    line-height: 1;
    color: var(--ink);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .site-header .wordmark span {
    font-family: var(--body);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: var(--accent);
    color: var(--ground);
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  /* Icons sit between the wordmark and the nav and stay in the sticky header,
     so the accounts are reachable from any scroll position on any page. The
     SVGs carry brand colours at 20-22px; shrinking them to 18px keeps seven of
     them from reading as clutter beside the wordmark. */
  .site-socials {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 auto;
  }
  .site-socials a {
    display: inline-flex;
    align-items: center;
    opacity: 0.85;
    transition: opacity 0.15s, transform 0.15s;
  }
  .site-socials a:hover { opacity: 1; transform: translateY(-1px); }
  .site-socials svg { width: 18px; height: 18px; display: block; }

  .site-nav {
    display: flex;
    align-items: center;
    gap: 1.8rem;
  }
  .site-nav a {
    font-family: var(--body);
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--ink);
    text-decoration: none;
    transition: color 0.15s;
  }
  .site-nav a:hover { color: var(--accent); }
  .site-nav .nav-cta {
    background: var(--ink);
    color: var(--ground);
    font-weight: 600;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
  }
  .site-nav .nav-cta:hover { background: var(--accent); color: var(--ground); }

  /* The header is sticky, so anything the nav jumps to needs a matching
     scroll offset or its heading lands underneath the bar. */
  [id] { scroll-margin-top: 6rem; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

  /* ---- Footer ---- */
  .site-footer {
    background: var(--ink);
    color: #fff;
    margin-top: 0;
  }
  .site-footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2.5rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .site-footer .footer-mark {
    font-family: var(--display);
    font-size: 1.25rem;
    letter-spacing: 0.02em;
  }
  .site-footer .footer-links {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  .site-footer .footer-links a {
    font-family: var(--body);
    font-size: 0.8rem;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .site-footer .footer-links a:hover { color: var(--ground); }

  .site-footer .footer-legal {
    font-family: var(--body);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  @media (max-width: 720px) {
    .site-header-inner {
      padding: 0.6rem 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .site-header .wordmark { font-size: 1.2rem; flex-wrap: wrap; gap: 0.5rem; }
    .site-socials { margin: 0; gap: 1rem; flex-wrap: wrap; }
    .site-socials a { min-height: 36px; }
    .site-socials svg { width: 20px; height: 20px; }
    .site-nav { gap: 1.1rem; }
    /* Comfortable tap targets on a phone. */
    .site-nav a { min-height: 44px; display: inline-flex; align-items: center; }
    .site-header .wordmark { min-height: 44px; }
    .site-footer-inner { padding: 2rem 1rem; flex-direction: column; align-items: flex-start; gap: 1.1rem; }
    .site-footer .footer-links a { min-height: 44px; display: inline-flex; align-items: center; font-size: 0.9rem; }
  }`;

module.exports = { ICONS, SOCIAL_LINKS, SHARED_HEAD, SHARED_HEADER, SHARED_SOCIALS, SHARED_FOOTER, CHROME_CSS };
