# CLAUDE.md

Guidance for working in this repository.

## What this is

This repo is the website for *Everything That Glows*, a literary science book in twelve
chapters arguing that the world is, underneath, made of information. It is a small static
site: a landing page plus the book itself. Both are self-contained HTML — embedded fonts
(base64 woff2), inline CSS, and inline JavaScript. There is no build system, no package
manager, and no dependencies.

## Layout

- `index.html` — the landing page: a hero that leads with the raster **book cover**
  (`cover-web.jpg`, framed with a spectral glow; the prism/spectrum motif is carried by the
  `hero-filament` arc and the spectral `cover-rule`), the free-to-read premise, a theatrical
  first-visit **orientation overlay** (`#enter`, light copy, self-paced — no auto-advance:
  purpose → optional sound (plays `welcome.mp3`) → **"what do you hope to find"** chips + write-in
  saved to `et-hopes` → how progress/marks work → make-it-yours/install → "Begin at the beginning"), the free-to-read premise, a
  **curiosity panel** ("Questions you'll get to live with"), the twelve chapters as a
  **non-clickable preview** (no deep links — readers funnel into the book and navigate via its
  Contents), an FAQ, an About, a **"Two ways to read" chooser** (`#read-options`: a primary
  **web edition** card that sells the reader's features — flags + reflections, search, Reference &
  people, read aloud, install/offline — beside a **Download the ebook** card with the EPUB /
  Kindle-friendly EPUB linked to the latest GitHub Release assets), a "Support the work" panel,
  and a footer. Sections gently
  reveal on scroll (below the fold; honors `prefers-reduced-motion`). The orientation shows
  once (`et-onboarded`) and is reopenable via "How to read this".
- `welcome.mp3` — a ~29s welcome tone played when the reader opts into sound during orientation.
- `read.html` — the whole book and its reader (~1.7 MB). The canonical book artifact.
  The reader chrome is consolidated behind a single **Menu** button in the topbar (a
  `#menusheet` that proxies to the still-present feature controls: Contents, Search, Journey,
  Flags, Reference & people, Display & text, Sound, Share, Read aloud, Support). **Read aloud** uses the Web Speech
  API (`speechSynthesis`, on-device, no network): a player with play/pause/stop, a voice picker and
  speed (persisted `et-voice`/`et-rate`), reading block-by-block from the viewport with the current
  block highlighted, skipping citations and reading equations as "(equation)". **Share** uses the Web Share API (native
  sheet → iMessage on Apple) with a copy/mailto fallback; **selecting text** offers Copy, **Flag**
  (bookmark that exact paragraph), **Link** (deep link to it), or **Share as image**. Every
  paragraph gets a stable anchor (`<sectionId>-p<n>`) at load, so flags, jumps, and deep links are
  **paragraph-precise**; flagged paragraphs show an inline accent marker, and each saved flag has a
  Share action. The Marks panel also has **Export notes** (Markdown of flags + reflections),
  **Back up data** (versioned JSON: `schemaVersion`/`position`/`marks`/`prefs`), and **Restore data**
  (import with Merge or Replace) — all on-device, no network. Quote cards are
  rendered on a `<canvas>` by the shared `window.ETShare` helper (`hueFor`/`chapterIndex`/
  `image`/`sendImage`), **themed per chapter** with a spectrum hue, shared as a PNG file where
  supported, else downloaded.
  Reader features: a settings panel ("Aa") for theme (auto/light/**warm** sepia/dark; the
  manual theme updates the `theme-color` meta and carries across pages), text size, line
  spacing, and **typeface** (serif/sans); in-book **Search**; an ambient "minutes to next
  chapter" pill; a welcome-back toast; "Copy quote" on text selection; a skip link and
  focus-trapped dialogs. A **quick tools dock** (bottom-right) surfaces in-the-moment
  **Flag this spot** + a flag count outside the Menu, with a first-visit coachmark and a one-time
  reminder if the reader hasn't flagged anything. **Keyboard shortcuts** (desktop; ignored while
  typing): `/` search, `g` Contents, `m` Flags, `r` Reference & people, `a` Aa menu, `b` flag,
  `j`/`k` next/previous section, `?` help overlay, `Esc` close — also in the Menu as "Keyboard shortcuts". A gentle engagement layer: a **Contents progress summary** (bar +
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
  as you reach their bolded introduction (`IntersectionObserver` on the curated `ROSTER`, exposed via
  `window.ETCast.roster`), grouped by chapter with an "N of M minds met" count. A **Reference & people**
  panel (Menu, or `r`; `window.ETShowReference`) is an on-device index/X-Ray: it lazily scans `.prose`
  text once for the cast (full name, plus unambiguous non-denylisted surnames) and a curated inline
  `IDEAS` list (aliases, blurbs intentionally left blank for the author to fill), groups results into
  **People** and **Ideas**, is searchable, and lists each entry's occurrences as snippet rows that jump
  to the paragraph and flash it. Each person's first bold introduction in the prose becomes a tappable
  `.xref` that opens its entry (mouse/touch; the Menu/`r` is the keyboard route). The **"Thoughts across
  time"** panel also surfaces **"What you hoped to find"** from the landing orientation (`et-hopes`).
  A **Reading mode** row offers **Immersive** (fullscreen)
  and a best-effort **Lock rotation** (Screen Orientation API; disabled where unsupported, e.g.
  iOS). State lives in `localStorage`: `et-theme`, `et-textsize`, `et-leading`, `et-font`,
  `et-progress`/`et-current` (auto reading progress, written only by the reader script), and the
  engagement-owned `et-read`, `et-before`/`et-after` (timestamped reflections; migrated from the
  legacy `et-notes`), `et-milestones`, `et-celebrated`, and the quick-tools `et-tools-intro`/
  `et-tools-nudge`/`et-flag-used`, `et-cast` (minds met), and `et-hopes` (what you hoped to find,
  written by the landing orientation). Theme/size/typeface are applied pre-paint by a small head
  script. The landing orientation's install step shows iOS-specific "Share → Add to Home Screen"
  guidance (no `beforeinstallprompt` on iOS Safari). The topbar also surfaces a Kindle-style
  **quick-controls row** (`.qbar`: Contents, Search, Aa/Display, Flags) alongside the Menu button,
  proxying to the same handlers; the Menu has a **Download ebook (EPUB)** item linking to the
  latest GitHub Release asset.
- `privacy.html` — privacy & cookies policy (no data collected, no cookies); contact
  errerlabs@gmail.com.
- `404.html` — themed not-found page (Netlify serves it automatically).
- `manifest.webmanifest` + `sw.js` + `icon-*.png` / `apple-touch-icon.png` — PWA: installable,
  offline-capable. `sw.js` precaches core files; network-first for HTML, cache-first for assets.
  Bump the `CACHE` constant in `sw.js` when republishing so clients refresh.
- `cover.jpg` — the 1600×2400 raster **book cover** embedded in both EPUBs (shown as the
  Kindle / Apple Books thumbnail). Regenerate from a source image with
  `cd tools && node prepare-cover.mjs <source.(png|jpg)>` (scales to 1600×2400, JPEG).
- `cover-web.jpg` — a lighter 440×660 web thumbnail of the cover (≈2× its 200px display size),
  shown in the landing page's "Take it with you" panel.
- `og-image.jpg` — the 1200×630 Open Graph / Twitter share card: the cover beside the thesis,
  with **Karl Meves · Errerlabs**. `cover-web.jpg` and `og-image.jpg` are both regenerated from
  `cover.jpg` by `cd tools && node build-social.mjs`.
- `README.md` — repo-facing description, written in the book's voice.
- `netlify.toml` — static deploy config: publishes the root (no build command),
  security headers + CSP for every response, cache rules, the service-worker headers, and the
  www→apex redirect.
- `LICENSE` — proprietary, all rights reserved (the book is free to read, not to redistribute).
- `THIRD-PARTY-NOTICES.md` — MIT/OFL notices for the bundled KaTeX CSS and math fonts.
- `SECURITY.md` — how to report a vulnerability.
- `robots.txt` / `sitemap.xml` — crawl + indexing hygiene.
- `tools/` — **build + integrity tooling, separate from the site** (the published site stays
  dependency-free). `tools/check-html.mjs` parses every page into a real DOM and asserts it
  renders (catches the blank/black-page bug — an unclosed `<style>`/`<script>` that swallows the
  body — which `node --check` cannot see; also checks 12 chapters, equation MathML+LaTeX, figure
  titles). `tools/build-epub.mjs` regenerates two EPUBs from `read.html` into `tools/dist/`:
  `everything-that-glows.epub` (equations as **MathML**, for Apple Books/Play Books/Kobo/Thorium)
  and `everything-that-glows-kindle.epub` (equations as **SVG**, Kindle-safe). Both render math
  from each equation's LaTeX source via **MathJax** and keep figures as inline SVG, so they track
  edits; the ZIP is written with stdlib `zlib` (no dependency). Both embed `../cover.jpg` as the
  EPUB **cover image** (a full-bleed cover page + `properties="cover-image"` + legacy `meta
  name="cover"` for Kindle), with the textual title page kept after it. Both also write a
  **store-ready `package.opf`**: title/author (`aut` + sort key)/publisher, a catalog
  `dc:description` + BISAC `dc:subject` codes (edit these in the `META` object), and **schema.org
  accessibility metadata declared honestly per edition** — the MathML edition advertises the
  `MathML` feature and `accessModeSufficient: textual`; the SVG/Kindle edition declares
  `textual,visual` and says its equations are images (no over-claiming). `tools/prepare-cover.mjs`
  regenerates `cover.jpg` from a source image (resvg + jpeg-js). Validate with `epubcheck` (needs
  Java); both should report 0 errors. `tools/check-epub-apple.mjs` (`npm run check:epub`) asserts
  the **Apple Books store-readiness** layer that epubcheck does *not* cover — it unzips the built
  EPUBs in `dist/` (as ZIP containers, no dependency) and checks cover dimensions (portrait, short
  side ≥ 1400 px, ~2:3), OPF metadata completeness (title/author/language/publisher/description/
  UUID/`dcterms:modified`/BISAC/schema.org a11y), the dual cover declaration, math encoding per
  edition (real MathML vs SVG, zero leftover KaTeX/TeX), embedded fonts, and TOC + landmarks. See
  `tools/README.md`, and `tools/PUBLISHING.md` for the store-by-store submission checklist (Apple
  Books / Google Play / Kobo / Kindle).
- `.github/workflows/ci.yml` — runs the HTML integrity check, builds both EPUBs, runs the Apple
  Books store-readiness check, and validates them with epubcheck (v5.2.1) on every push/PR (uploads
  the EPUBs as artifacts). This is the guard that keeps the book buildable, store-ready, and
  unbreakable as the prose is edited.
- `.github/workflows/release.yml` — on a pushed `v*` tag (or manual dispatch with a tag), builds,
  runs the Apple Books store-readiness check, epubcheck-validates both EPUBs and publishes a
  **GitHub Release** with both files attached.
  The site's download buttons point at the release's `latest/download/<file>` URLs, so cutting a
  new tagged release updates them. Cut a release after the book changes: `git tag vX.Y.Z &&
  git push origin vX.Y.Z`.

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
- **Author / publisher**: the book is **by Karl Meves**, **published by Errerlabs** (contact
  `errerlabs@gmail.com`). Keep that split consistent across the site footers, the JSON-LD
  (`author` = Person Karl Meves, `publisher` = Organization Errerlabs), and the EPUB metadata
  (`dc:creator` / `dc:publisher` in `tools/build-epub.mjs`) and title page.
- **Reading typeface**: the body serif is **Literata** (SIL OFL), embedded in `read.html` as
  inline base64 woff2 (`/*ETG-FONTS-START*/…/*ETG-FONTS-END*/` in the `<style>`; latin +
  latin-ext + greek, regular + italic, variable 400–700) and set as the first `--serif` fallback.
  The EPUB embeds the same woff2 (`OEBPS/fonts/`, `@font-face` in its CSS). Both come from
  `@fontsource-variable/literata` via the shared `tools/literata.mjs`; regenerate the reader's
  inline copy with `cd tools && node build-fonts.mjs`. Kindle substitutes its own serif.
- **Design language**: warm paper (`--paper`), ink serif body, a prism/spectrum accent
  (red→violet rule). Honor `prefers-color-scheme` (dark mode) and `prefers-reduced-motion`.
- **Citations** are bracketed numbers tied to a per-chapter numbered `Sources` list; sources
  are primary wherever one exists. Keep that invariant if you touch references. The book also
  ends with a **Combined Bibliography** appendix (`#appendix`): **Part I** is the curated
  "recurring sources / the spine," and **Part II** is a single unified A–Z list of every unique
  source across all twelve chapters, each entry tagged with the chapters that cite it (e.g.
  `[Glows 24 · Remembers 80]`). A source cited in more than one chapter appears once, with all its
  tags merged — keep that single-entry invariant if you add citations.
- **Verify visually** by opening `index.html` / `read.html` in a browser, or
  `python3 -m http.server`.
- **After editing the book**, run `cd tools && npm run check` (HTML integrity — same check CI
  runs, and the one that would have caught the blank-page regression) and, if equations/figures
  changed, `npm run build:epub` then validate with epubcheck. CI does all of this on every
  push/PR; keep it green.
