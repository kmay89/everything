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
