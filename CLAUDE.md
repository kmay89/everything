# CLAUDE.md

Guidance for working in this repository.

## What this is

This repo is the website for *Everything That Glows*, a literary science book in twelve
chapters arguing that the world is, underneath, made of information. It is a small static
site: a landing page plus the book itself. Both are self-contained HTML — embedded fonts
(base64 woff2), inline CSS, and inline JavaScript. There is no build system, no package
manager, and no dependencies.

## Layout

- `index.html` — the landing page (~21 KB): prism hero, the free-to-read premise, the twelve
  chapters (each linking into the book), an About, a "Support the work" panel, and a footer.
- `read.html` — the whole book and its reader (~1.7 MB). The canonical book artifact.
- `og-image.png` — the 1200×630 Open Graph share card (the prism, on-brand).
- `README.md` — repo-facing description, written in the book's voice.
- `netlify.toml` — static deploy config (publishes the root; no build command).

## Working notes

- **Editing the book** means editing `read.html` directly. Because it is one large file,
  prefer targeted `Edit` calls over rewrites. The structure is: `<style>` (theme variables +
  layout), the `<body>` (title/cover, foreword, `#contents`, then each chapter as an `<h1>`
  section with Roman-numeral `<h2>` subsections and a `Sources` block), and a trailing
  `<script>` that powers progress, "Marks", citations, and the optional sound.
- **Editing the landing page** means editing `index.html`. It deliberately reuses the book's
  exact design tokens, prism artwork, and cover animation so the two pages feel like one work.
  The donation button and footer link contain `YOUR-USERNAME` placeholders to fill in.
- **Design language**: warm paper (`--paper`), ink serif body, a prism/spectrum accent
  (red→violet rule). Honor `prefers-color-scheme` (dark mode) and `prefers-reduced-motion`.
- **Citations** are bracketed numbers tied to a per-chapter numbered `Sources` list; sources
  are primary wherever one exists. Keep that invariant if you touch references.
- **Verify visually** by opening `index.html` / `read.html` in a browser, or
  `python3 -m http.server`. There are no automated tests.
