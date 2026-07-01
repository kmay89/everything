# Publishing *Everything That Glows* to the stores

A practical checklist for getting the book onto the major ebook stores. The
book is **free to read on the web**; these are the steps for the optional
store listings (which also bring Apple Books / Kindle library copies, search
discovery, and "Add to Library" buttons).

Two EPUB editions ship from [`build-epub.mjs`](build-epub.mjs) into `tools/dist/`:

| File | Math | Send to |
|------|------|---------|
| `everything-that-glows.epub` | MathML (accessible, scalable) | **Apple Books**, **Google Play Books**, **Kobo** |
| `everything-that-glows-kindle.epub` | SVG (image math) | **Amazon Kindle (KDP)** |

> Always upload the build that CI validated, and run a fresh
> `npm run build:epub` + epubcheck (see [README](README.md)) right before you
> submit so the catalog metadata below is current. How the whole quality
> pipeline works — and how to replicate it for another book — is documented
> in [`PIPELINE.md`](PIPELINE.md).

## What's already baked into the EPUB metadata

`build-epub.mjs` writes a complete, store-ready `OEBPS/package.opf`, so most of
each store's metadata form is already answered by the file itself:

- **Title / author / publisher** — `Everything That Glows` · Karl Meves
  (`aut`, sorted *Meves, Karl*) · Errerlabs.
- **Identifier** — a stable `urn:uuid:` (deterministic from the title). This is
  fine for stores that assign their own ID. If you buy ISBNs, set them per
  edition (see "ISBNs" below).
- **Language / publication date / rights** — `en` · `2026-06-16` ·
  all rights reserved.
- **Description** and **BISAC subjects** (`SCIENCE / Physics / General`,
  `SCIENCE / Essays`, `SCIENCE / History`, `PHILOSOPHY / Epistemology`,
  `SCIENCE / Cosmology`) — edit these in the `META` object at the top of
  `build-epub.mjs` if you want different catalog copy or categories.
- **Cover** — `../cover.jpg` (1600×2400) as the EPUB cover image.
- **Accessibility metadata** (schema.org / EPUB Accessibility), declared
  honestly **per edition** — see below.

## Accessibility metadata

Since the European Accessibility Act took effect (June 28 2025), ebooks sold
into the EU must carry accurate accessibility metadata, and Apple Books, Google
Play, and Kobo all surface it on the product page. Both editions declare it:

- `accessMode` textual + visual; `accessibilityHazard` none.
- Features: `tableOfContents`, `readingOrder`, `structuralNavigation`,
  `displayTransformability`, `alternativeText` (every figure SVG has a `<title>`
  description, checked by `check-html.mjs`).
- The **MathML edition** additionally declares the `MathML` feature and
  `accessModeSufficient: textual` — assistive tech can speak the equations.
- The **Kindle/SVG edition** declares `accessModeSufficient: textual,visual`
  (its equations are images) and says so in its `accessibilitySummary`. This is
  deliberate honesty, not a gap to "fix" — Kindle's pipeline wants image math.

We do **not** assert formal WCAG conformance (`dcterms:conformsTo`); that's a
certification claim. If the book is ever audited, add the conformance link and
`a11y:certifiedBy` in `accessibilityMeta()`.

## ISBNs (optional)

Stores will assign their own product IDs, so an ISBN is **not required** to
publish on any of the four. If you want a single portable identifier, buy one
ISBN **per edition + format** and set it as the `dc:identifier` in
`build-epub.mjs` (replace the generated `urn:uuid:`). Apple can issue a free
ISBN-like identifier at publish time; KDP assigns a free ASIN.

## Store-by-store

### Apple Books
- Upload `everything-that-glows.epub` (MathML) via **Apple Books for Authors**
  (web) or iTunes Producer / Transporter.
- Sells/distributes only from a Mac account; needs a free Apple Books partner
  account and a US tax/banking setup even for free books.
- Price: **Free**. Apple shows the accessibility metadata on the listing.

### Google Play Books
- **Play Books Partner Center → Books → add the EPUB** (MathML edition).
- Fill ISBN *or* let Google assign a GGKEY. Set territories and **Free**.
- Google ingests `dc:description` / subjects but lets you override them.

### Kobo
- **Kobo Writing Life** → create ebook → upload the MathML EPUB.
- Pick categories, set price **Free** (KWL allows $0), enable global reach.
- Kobo (Rakuten) reads the accessibility metadata for its EU listings.

### Amazon Kindle (KDP)
- **KDP → Create a Kindle eBook**, upload `everything-that-glows-kindle.epub`.
- Amazon's **minimum list price is non-zero** in most stores; to make it free
  you either enroll in **KDP Select** and use Free Book Promotion days, or get
  Amazon to **price-match** the free web edition (point KDP support at the
  public download). Plan for this — "free" is the one thing KDP fights.
- **Preview in Kindle Previewer** before publishing: epubcheck proves the file
  is valid, but only the Previewer shows Amazon's converted rendering (check the
  equations — they're images in this edition — and the cover thumbnail).

## Cover specs (all stores accept the bundled cover)

`cover.jpg` is 1600×2400 (2:3), JPEG — within every store's bounds (Apple wants
the short side ≥ 1400 px; KDP wants 1.6:1 ideal but accepts 2:3; Kobo/Google are
lenient). Regenerate from new art with `node prepare-cover.mjs <source>`.

## After a content change

1. Edit `read.html`.
2. `npm run check && npm run build:epub`, then epubcheck both files.
3. Cut a tagged release (`git tag vX.Y.Z && git push origin vX.Y.Z`) so the
   site's download buttons and these store uploads share one artifact.
4. Re-upload the new EPUB to each store (they version in place).
