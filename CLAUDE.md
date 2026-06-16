# CLAUDE.md

Guidance for working in this repository.

## What this is

This repo is the website for *Everything That Glows*, a literary science book in twelve
chapters arguing that the world is, underneath, made of information. It is a small static
site: a landing page plus the book itself. Both are self-contained HTML — embedded fonts
(base64 woff2), inline CSS, and inline JavaScript. There is no build system, no package
manager, and no dependencies.

## Layout

- `index.html` — the landing page: prism hero, the free-to-read premise, a theatrical
  first-visit **orientation overlay** (`#enter`: purpose → optional sound → how progress/marks
  work → make-it-yours/install → "Begin at the beginning"), the free-to-read premise, a
  **curiosity panel** ("Questions you'll get to live with"), the twelve chapters as a
  **non-clickable preview** (no deep links — readers funnel into the book and navigate via its
  Contents), an FAQ, an About, a "Support the work" panel, and a footer. Sections gently
  reveal on scroll (below the fold; honors `prefers-reduced-motion`). The orientation shows
  once (`et-onboarded`) and is reopenable via "How to read this".
- `welcome.mp3` — a ~29s welcome tone played when the reader opts into sound during orientation.
- `read.html` — the whole book and its reader (~1.7 MB). The canonical book artifact.
  The reader chrome is consolidated behind a single **Menu** button in the topbar (a
  `#menusheet` that proxies to the still-present feature controls: Contents, Search, Journey,
  Flags, Display & text, Sound, Share, Support). **Share** uses the Web Share API (native
  sheet → iMessage on Apple) with a copy/mailto fallback; **selecting text** offers Copy, **Flag**
  (bookmark that exact paragraph), **Link** (deep link to it), or **Share as image**. Every
  paragraph gets a stable anchor (`<sectionId>-p<n>`) at load, so flags, jumps, and deep links are
  **paragraph-precise**; flagged paragraphs show an inline accent marker, and each saved flag has a
  Share action. Quote cards are
  rendered on a `<canvas>` by the shared `window.ETShare` helper (`hueFor`/`chapterIndex`/
  `image`/`sendImage`), **themed per chapter** with a spectrum hue, shared as a PNG file where
  supported, else downloaded.
  Reader features: a settings panel ("Aa") for theme (auto/light/dark), text size, line
  spacing, and **typeface** (serif/sans); in-book **Search**; an ambient "minutes to next
  chapter" pill; a welcome-back toast; "Copy quote" on text selection; a skip link and
  focus-trapped dialogs. A **quick tools dock** (bottom-right) surfaces in-the-moment
  **Flag this spot** + a flag count outside the Menu, with a first-visit coachmark and a one-time
  reminder if the reader hasn't flagged anything. A gentle engagement layer: a **Contents progress summary** (bar +
  "N of 12 · ~time left" + milestone badges), an **end-of-chapter card** (encouragement,
  optional saved reflection, "Mark as read", next-chapter link), and **milestone toasts** —
  no streaks or pressure. A **reflections-across-time** layer captures a **Before** note at each
  chapter's start (with a per-chapter **starter prompt** tied to that chapter's subject, modeling
  how science begins — a question, an observation, or something to learn), uses **Flags** as the
  in-the-moment layer, and the end-of-chapter **After** reflection; entries are timestamped
  (`created`/`updated`, migrated from the older single `t`) and a **"Thoughts across time"** timeline
  (menu + Your journey) shows the arc per chapter with relative timestamps.
  A **Your journey** panel (progress ring, time read, reflections count, milestone badges) opens
  from the Contents summary, and finishing all twelve triggers a one-time **completion celebration**.
  A **cast roster** ("Minds you've met", from the Menu / Your journey) auto-checks each figure
  as you reach their bolded introduction (`IntersectionObserver` on the curated `ROSTER`), grouped
  by chapter with an "N of M minds met" count. A **Reading mode** row offers **Immersive** (fullscreen)
  and a best-effort **Lock rotation** (Screen Orientation API; disabled where unsupported, e.g.
  iOS). State lives in `localStorage`: `et-theme`, `et-textsize`, `et-leading`, `et-font`,
  `et-progress`/`et-current` (auto reading progress, written only by the reader script), and the
  engagement-owned `et-read`, `et-before`/`et-after` (timestamped reflections; migrated from the
  legacy `et-notes`), `et-milestones`, `et-celebrated`, and the quick-tools `et-tools-intro`/
  `et-tools-nudge`/`et-flag-used`, as well as `et-cast` (minds met). Theme/size/typeface are applied pre-paint by a small head
  script. The landing orientation's install step shows iOS-specific "Share → Add to Home Screen"
  guidance (no `beforeinstallprompt` on iOS Safari).
- `privacy.html` — privacy & cookies policy (no data collected, no cookies); contact
  errerlabs@gmail.com.
- `404.html` — themed not-found page (Netlify serves it automatically).
- `manifest.webmanifest` + `sw.js` + `icon-*.png` / `apple-touch-icon.png` — PWA: installable,
  offline-capable. `sw.js` precaches core files; network-first for HTML, cache-first for assets.
  Bump the `CACHE` constant in `sw.js` when republishing so clients refresh.
- `og-image.png` — the 1200×630 Open Graph share card (the prism, on-brand).
- `README.md` — repo-facing description, written in the book's voice.
- `netlify.toml` — static deploy config: publishes the root (no build command),
  security headers + CSP for every response, cache rules, the service-worker headers, and the
  www→apex redirect.
- `LICENSE` — proprietary, all rights reserved (the book is free to read, not to redistribute).
- `THIRD-PARTY-NOTICES.md` — MIT/OFL notices for the bundled KaTeX CSS and math fonts.
- `SECURITY.md` — how to report a vulnerability.
- `robots.txt` / `sitemap.xml` — crawl + indexing hygiene.

When regenerating the PWA icons (no image libraries are installed), use the stdlib PNG
rasterizer approach (zlib + struct, supersampled) — see the session history for the script.

## Working notes

- **Editing the book** means editing `read.html` directly. Because it is one large file,
  prefer targeted `Edit` calls over rewrites. The structure is: `<style>` (theme variables +
  layout), the `<body>` (title/cover, foreword, `#contents`, then each chapter as an `<h1>`
  section with Roman-numeral `<h2>` subsections and a `Sources` block), and a trailing
  `<script>` that powers progress, "Marks", citations, and the optional sound.
- **Editing the landing page** means editing `index.html`. It deliberately reuses the book's
  exact design tokens, prism artwork, and cover animation so the two pages feel like one work.
  The donation button and footer link point to GitHub Sponsors / profile (`kmay89`).
- **Design language**: warm paper (`--paper`), ink serif body, a prism/spectrum accent
  (red→violet rule). Honor `prefers-color-scheme` (dark mode) and `prefers-reduced-motion`.
- **Citations** are bracketed numbers tied to a per-chapter numbered `Sources` list; sources
  are primary wherever one exists. Keep that invariant if you touch references.
- **Verify visually** by opening `index.html` / `read.html` in a browser, or
  `python3 -m http.server`. There are no automated tests.
