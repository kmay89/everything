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

Both editions embed `../cover.jpg` as the EPUB **cover image** — a full-bleed
cover page, the `properties="cover-image"` manifest flag, and the legacy
`<meta name="cover">` that Kindle expects — so it shows as the library
thumbnail in Apple Books and Kindle. The textual title page is kept right
after the cover.

## Catalog metadata & accessibility

`build-epub.mjs` writes a complete, store-ready `package.opf`: title, author
(`aut`, with a sort key), publisher, language, date, rights, a catalog
`dc:description`, BISAC `dc:subject` codes, the cover, and **schema.org
accessibility metadata declared honestly per edition** (the MathML edition
advertises accessible math and `accessModeSufficient: textual`; the SVG/Kindle
edition says its equations are images). Edit the catalog copy in the `META`
object at the top of the script.

To publish to Apple Books, Google Play Books, Kobo, or Kindle, follow
[`PUBLISHING.md`](PUBLISHING.md) — which edition goes to which store, the free
ISBN/ASIN situation, the KDP "make it free" workaround, and cover specs.

## Cover image

```sh
node prepare-cover.mjs <source-image.(png|jpg)>   # → ../cover.jpg, 1600×2400 JPEG
```

`cover.jpg` is committed to the repo and embedded by `build-epub.mjs`; rerun
this only when the cover art changes. The source is scaled to a 2:3 portrait
(a 1024×1536 source maps exactly). Uses `@resvg/resvg-js` + `jpeg-js`.

Then refresh the web/social images derived from the cover:

```sh
node build-social.mjs    # → ../cover-web.jpg (landing thumbnail) + ../og-image.png (share card)
```

## Validate the EPUBs

```sh
# one-time: fetch epubcheck
curl -fsSL -o /tmp/epubcheck.zip \
  https://github.com/w3c/epubcheck/releases/download/v5.2.1/epubcheck-5.2.1.zip
unzip -o /tmp/epubcheck.zip -d /tmp

java -jar /tmp/epubcheck-5.2.1/epubcheck.jar dist/everything-that-glows.epub
java -jar /tmp/epubcheck-5.2.1/epubcheck.jar dist/everything-that-glows-kindle.epub
```

Both should report `0 fatals / 0 errors / 0 warnings`. For Kindle specifically,
also preview the `-kindle.epub` in Amazon's **Kindle Previewer** before
publishing — epubcheck validates the EPUB, but only the Previewer shows how
Amazon's converter will render it.

## Apple Books store-readiness check

```sh
npm run check:epub   # node check-epub-apple.mjs
```

epubcheck is the main automated gate Apple runs at upload, but Apple layers a
few requirements on top of it — and a file can pass epubcheck clean while still
tripping those. `check-epub-apple.mjs` reads the **built** EPUBs in `dist/`
(as ZIP containers, no dependency) and asserts that extra layer:

- **Cover** — portrait, short side ≥ 1400 px, ~2:3 ratio (a common rejection
  reason), read straight from the embedded JPEG.
- **Metadata** — title, author, language, publisher, a 50+ char description, a
  unique `urn:uuid` identifier, `dcterms:modified`, BISAC subject codes, and
  schema.org accessibility metadata all present in `package.opf`.
- **Cover declaration** — both the modern `properties="cover-image"` and the
  legacy `<meta name="cover">`.
- **Math** — real MathML in the default edition (Apple Books reflows it) and
  SVG in the Kindle edition, with **zero** pre-rendered KaTeX or stray TeX left
  behind in either.
- **Equation-count parity** — the EPUB carries *exactly* as many equations as
  `read.html` (counted from the LaTeX annotations), so a silently dropped or
  duplicated equation fails the build.
- **Glyph coverage** — every character in the prose is either covered by the
  embedded Literata subsets (their `@font-face` unicode-ranges) or in a reviewed
  fallback allowlist; a *new* out-of-range character fails the check so a
  possible missing-glyph ("tofu") box is caught before it ships. It does **not**
  judge whether equations are mathematically correct or how anything *renders*
  on-device — that stays a Kindle Previewer / Apple Books Previewer eyeball pass.
- **Fonts** — Literata actually embedded (woff2) and referenced.
- **Navigation** — a `epub:type="toc"` table of contents plus landmarks.

Run `node build-epub.mjs` first so `dist/` holds the current build.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the HTML check,
builds both editions, runs the Apple Books store-readiness check, and validates
them with epubcheck (v5.2.1 — the version Apple runs) on every push and pull
request, and uploads the built EPUBs as workflow artifacts. The same
store-readiness gate runs in
[`release.yml`](../.github/workflows/release.yml) before assets are published.

For the full picture — how the gates fit together, the Apple submission
process end to end, and a step-by-step checklist for porting this pipeline to
another book — see [`PIPELINE.md`](PIPELINE.md).
