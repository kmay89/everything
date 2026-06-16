# Tooling for *Everything That Glows*

Build and integrity tooling for the book. **This is not part of the published
site** — the site itself stays a dependency-free set of static files. These
scripts live here so they can be run locally and in CI without touching the
site's "no build system" promise.

Everything is generated from [`../read.html`](../read.html), the single source
of truth for the book. Edit the book there; rerun these and the outputs follow.

## Setup

```sh
cd tools
npm install
```

Requires Node 18+ (for the EPUB builder) and, for validation only, a Java
runtime (for [epubcheck](https://github.com/w3c/epubcheck)).

## HTML integrity check

```sh
npm run check        # node check-html.mjs
```

Parses every page into a real DOM and asserts it actually renders. It catches
the class of structural breakage that produces a blank/black page — an unclosed
`<style>`/`<script>` that swallows the rest of the document — which plain
syntax linting cannot see. It also verifies, for `read.html`:

- exactly 12 chapters are present,
- every equation carries both MathML and its LaTeX source (the EPUB depends on
  this),
- every figure has an accessible `<title>`,
- all inline scripts parse.

It exits non-zero on any failure, so it gates CI.

## EPUB export

```sh
npm run build:epub           # both editions, into tools/dist/
node build-epub.mjs --mathml # MathML edition only
node build-epub.mjs --kindle # SVG edition only
```

Two editions are produced because no single math format renders everywhere:

| File | Equations | Best for |
|------|-----------|----------|
| `everything-that-glows.epub` | **MathML** | Apple Books, Google Play Books, Kobo, Thorium — selectable, scalable math |
| `everything-that-glows-kindle.epub` | **SVG** | Kindle and anywhere MathML support is weak |

Both render equations and figures from the LaTeX source and inline SVG in
`read.html`, so they track your edits. The bulky KaTeX visual markup and math
fonts are dropped (MathML readers supply their own; the SVG edition embeds
glyph outlines per equation).

The ZIP is written with Node's built-in `zlib` (no dependency), `mimetype`
stored first per the EPUB OCF spec.

## Validate the EPUBs

```sh
# one-time: fetch epubcheck
curl -fsSL -o /tmp/epubcheck.zip \
  https://github.com/w3c/epubcheck/releases/download/v5.1.0/epubcheck-5.1.0.zip
unzip -o /tmp/epubcheck.zip -d /tmp

java -jar /tmp/epubcheck-5.1.0/epubcheck.jar dist/everything-that-glows.epub
java -jar /tmp/epubcheck-5.1.0/epubcheck.jar dist/everything-that-glows-kindle.epub
```

Both should report `0 fatals / 0 errors / 0 warnings`. For Kindle specifically,
also preview the `-kindle.epub` in Amazon's **Kindle Previewer** before
publishing — epubcheck validates the EPUB, but only the Previewer shows how
Amazon's converter will render it.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the HTML check,
builds both editions, and validates them with epubcheck on every push and pull
request, and uploads the built EPUBs as workflow artifacts.
