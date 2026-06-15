# CLAUDE.md

Guidance for working in this repository.

## What this is

This repo **is** a book: *Everything*, a literary science book in twelve chapters arguing
that the world is, underneath, made of information. The entire work lives in a single
self-contained file, [`index.html`](index.html) — embedded fonts (base64 woff2), inline CSS,
and inline JavaScript. There is no build system, no package manager, and no dependencies.

## Layout

- `index.html` — the whole book and its reader (~1.7 MB). The canonical, published artifact.
- `README.md` — repo-facing description, written in the book's voice.
- `netlify.toml` — static deploy config (publishes the root; no build command).

## Working notes

- **Editing the book** means editing `index.html` directly. Because it is one large file,
  prefer targeted `Edit` calls over rewrites. The structure is: `<style>` (theme variables +
  layout), the `<body>` (title/cover, `#contents`, then each chapter as an `<h1>` section
  with Roman-numeral `<h2>` subsections and a `Sources` block), and a trailing `<script>`
  that powers progress, "Marks", citations, and the optional sound.
- **Design language**: warm paper (`--paper`), ink serif body, a prism/spectrum accent
  (red→violet rule). Honor `prefers-color-scheme` (dark mode) and `prefers-reduced-motion`.
- **Citations** are bracketed numbers tied to a per-chapter numbered `Sources` list; sources
  are primary wherever one exists. Keep that invariant if you touch references.
- **Verify visually** by opening `index.html` in a browser, or `python3 -m http.server`.
  There are no automated tests.
