# The EPUB pipeline, the Apple process, and how to copy it to another book

This is the playbook for the whole book-quality system in this repo: what the
pipeline builds, every automated gate it passes through, what Apple actually
checks at upload, what stays manual, and — the part written to be reused — a
step-by-step checklist for standing the same parity up for another book
(*Grows*, *Knows*, *Shows*, or anything else built the same way).

Companion docs, so nothing here is duplicated:

- [`README.md`](README.md) — how to *run* each tool.
- [`PUBLISHING.md`](PUBLISHING.md) — the store-by-store submission checklist
  (Apple Books / Google Play / Kobo / Kindle), ISBNs, accessibility metadata.
- Root `CLAUDE.md` — the repo map.

---

## 1. The shape of the pipeline

One source of truth, everything downstream regenerated from it:

```
read.html  (the canonical book: prose, equations as KaTeX+LaTeX, figures as inline SVG)
   │
   ├─ check-html.mjs            gate 0: the source is structurally sound
   │
   ├─ build-epub.mjs            builds BOTH editions into tools/dist/
   │     ├─ everything-that-glows.epub          equations as MathML
   │     └─ everything-that-glows-kindle.epub   equations as SVG
   │
   ├─ check-epub-apple.mjs      gate 1: Apple store-readiness (this repo's own)
   │
   ├─ epubcheck (v5.2.1, Java)  gate 2: spec validity — the validator Apple runs
   │
   └─ release.yml (on v* tag)   publishes both files as GitHub Release assets;
                                the site's download buttons point at
                                releases/latest/download/<file>
```

Design rules that make it portable:

- **Nothing is hand-maintained downstream.** Edit the prose in `read.html`;
  the EPUBs, their metadata, their math, and their cover page all regenerate.
- **The published site stays dependency-free**; the tools use npm only where
  unavoidable (jsdom, MathJax) and the stdlib everywhere else. The ZIP writer
  in `build-epub.mjs` and the ZIP *reader* in `check-epub-apple.mjs` are both
  hand-rolled on `node:zlib` — no archive dependency to keep in sync.
- **Checks read the shipped artifact, not the intermediate.**
  `check-epub-apple.mjs` unzips the actual files in `dist/` and parses the
  real JPEG bytes and the real `package.opf`. If the build lies, the check
  catches it.

## 2. The gates, in order

### Gate 0 — `check-html.mjs` (source integrity)

Parses every page into a real DOM (jsdom) and asserts it renders. Catches the
class of bug where an unclosed `<style>`/`<script>` swallows the whole body
(the "blank/black page"), which `node --check` cannot see. For the book it
also asserts the invariants the EPUB build *depends on*:

- exactly **12** `section.chapter` elements;
- **every** equation carries both its KaTeX MathML and its LaTeX source
  annotation (the LaTeX is what the EPUB build renders from — lose it and the
  EPUB silently loses math);
- every figure SVG has an accessible `<title>`.

### Gate 1 — `check-epub-apple.mjs` (Apple readiness)

epubcheck is the main automated gate Apple runs at upload — but Apple layers
its own requirements on top, and a file can pass epubcheck clean while still
bouncing. This script asserts that extra layer against both built editions:

| Check | Why Apple cares |
|---|---|
| Cover: portrait, short side ≥ 1400 px, ~2:3 ratio (parsed from the JPEG's own bytes) | The most common cover rejection reason. |
| OPF completeness: title, author, language, publisher, 50+ char description, unique `urn:uuid`, `dcterms:modified`, BISAC subjects, schema.org accessibility metadata | Store catalog forms ingest these; EU listings (EAA, since June 2025) surface the accessibility block. |
| Cover declared **both** ways: `properties="cover-image"` + legacy `<meta name="cover">` | Modern readers use the former; Kindle's importer still reads the latter. |
| Math encoding per edition: real `<math>` in the MathML edition, none in the Kindle edition; **zero** leftover KaTeX markup or stray `x-tex` annotations in either | Half-converted math is the classic way a science EPUB looks broken on-device. |
| **Equation-count parity**: the EPUB carries *exactly* as many equations as `read.html` (counted from the LaTeX annotations; `<math>` for MathML, `eq`/`eq-inline` spans for Kindle) | A dropped or duplicated equation fails CI instead of sliding under a coarse floor. |
| **Glyph coverage**: every prose character (math/SVG subtrees excluded) is inside the embedded Literata `unicode-range`s or in the reviewed `ALLOWED_FALLBACK` set | Catches a possible missing-glyph "tofu" box before a reader sees one. A *new* out-of-range character fails with instructions. |
| Fonts embedded (woff2) + referenced by `@font-face` and the manifest | "Embedded" in the CSS but missing from the container is a silent fallback. |
| `epub:type="toc"` nav with a floor of entries, plus `landmarks` | Apple builds its chapter list from this. |

**What it deliberately does NOT check** (so nobody over-trusts it):
whether the math is *mathematically correct* (no tool reads meaning — `E=mc³`
passes), and how anything *renders on-device*. Those stay human: a Kindle
Previewer / Apple Books eyeball pass before submitting.

### Gate 2 — epubcheck v5.2.1

The W3C validator, EPUB 3.3 rules — the same automated validation Apple runs
at ingest. Target: `0 fatals / 0 errors / 0 warnings`. CI fetches the pinned
version so results are reproducible; bump the `EPUBCHECK_VERSION` env in both
workflows together when a new release lands.

### CI wiring

- **`.github/workflows/ci.yml`** — every push and PR: gate 0 → build →
  gate 1 → gate 2, then uploads both EPUBs as workflow artifacts.
- **`.github/workflows/release.yml`** — on a `v*` tag: same gates, then
  publishes the GitHub Release with both files attached. Because the site
  links to `releases/latest/download/<file>`, **a bad build can never become
  the public download** — the gates run before the release exists.

## 3. The Apple Books process, end to end

What was verified the manual way on v1.0.5 (and is now what CI automates):

1. **EPUBCheck v5.2.1 clean** — 0 errors / 0 warnings / 0 infos against
   EPUB 3.3. This is the gate; plenty of tool-built EPUBs throw at least
   warnings.
2. **Cover** — 1600×2400 (2:3 portrait); short side 1600 clears Apple's
   ~1400 px minimum comfortably. Apple cites ~1.6 as ideal; 2:3 is the
   standard book ratio and is accepted.
3. **Metadata** — complete OPF (see the table above), plus BISAC codes and
   schema.org accessibility metadata, which Apple shows on the listing.
4. **Math** — all 121 expressions as real MathML, zero pre-rendered KaTeX,
   zero stray TeX. Apple Books renders MathML natively and *reflows* it, so
   equations scale with the reader's font size instead of sitting there as
   fixed images. This is the hard part most science EPUBs get wrong.
5. **Fonts / nav** — Literata embedded (Latin/Greek, roman + italic);
   clickable TOC + landmarks.

**At upload (process, not code — CI can't do these):**

- Upload via **Apple Books for Authors** (or iTunes Producer / Transporter);
  needs the free partner account with tax/banking set up even for free books.
- Hand the portal the same **`cover.jpg` separately** — it asks for the cover
  independently of the one embedded in the EPUB.
- Keep the **store title matching the cover art exactly** — Apple can bounce
  a title/cover mismatch.
- Decide **free vs. paid and price parity** before setting a price — the EPUB
  is free on GitHub, and stores notice. (Kindle-specific pricing fights live
  in [`PUBLISHING.md`](PUBLISHING.md).)
- **Eyeball pass**: the MathML edition in Apple Books, the Kindle edition in
  Kindle Previewer. Validation proves the file is well-formed; only a
  renderer shows you what readers see.

## 4. Copying the parity to another book

The pipeline was built to be forked. Everything book-specific lives in a
small, enumerable set of places; everything else copies verbatim.

### Copy verbatim (no edits)

```
tools/check-html.mjs          gate 0 (edit only the PAGES list if page names differ)
tools/check-epub-apple.mjs    gate 1 (edit only the knobs listed below)
tools/literata.mjs            font subsets (same reading serif)
tools/build-fonts.mjs         regenerates the reader's inline fonts
tools/prepare-cover.mjs       cover regeneration
tools/package.json            scripts + pinned deps (then npm install)
.github/workflows/ci.yml      the CI gauntlet
.github/workflows/release.yml the release gauntlet
```

`build-epub.mjs` also copies whole — its parsing is driven by the document
structure, not this book's text — but it contains the per-book `META` block
you must edit (below).

### The per-book customization points — the complete list

1. **`tools/build-epub.mjs` — the `META` object** (top of file): title,
   subtitle, creator, publisher, publication date (ISO + display form),
   rights line, catalog `description`, BISAC `subjects`, `keywords`.
   The UUID is derived deterministically from the title, so it changes on its
   own; `fileAs` computes the "Meves, Karl" sort key from `creator`.

2. **`tools/build-epub.mjs` — the two output filenames**, in the
   `buildEdition(...)` calls at the bottom of the file:
   ```js
   buildEdition("mathml", "everything-that-glows.epub",        "mathml");
   buildEdition("svg",    "everything-that-glows-kindle.epub", "kindle");
   ```
   Keep the `<book>.epub` / `<book>-kindle.epub` convention.

3. **`tools/check-epub-apple.mjs` — the `EDITIONS` list** (must name the same
   two files) **and three floors**:
   - `MIN_TOC_ENTRIES` — chapters + front/backmatter minus a margin;
   - `MIN_EQUATIONS` — a floor *under* the real count (parity does the exact
     check; the floor just fails fast if math conversion breaks wholesale).
     For a book with **no** equations set it to 0 — the parity check then
     asserts exactly 0 leaked through;
   - `MIN_COVER_SHORT_SIDE` — leave at 1400 (Apple's rule, not the book's).

4. **`tools/check-epub-apple.mjs` — `ALLOWED_FALLBACK`**: start with a copy
   of this book's set, then run the check. It will fail listing any
   codepoints the new book uses outside the font ranges; confirm each renders
   (open the book, look at it), then add them. That failure loop *is* the
   review process — do not pre-emptively silence it.

5. **`cover.jpg`** — the new book's 1600×2400 cover
   (`node prepare-cover.mjs <source>`), plus `build-social.mjs` for
   `cover-web.jpg` / `og-image.jpg` if the site mirrors this one.

6. **The site's download buttons** (`index.html`) and the reader Menu's
   ebook link — point at
   `https://github.com/<owner>/<repo>/releases/latest/download/<book>.epub`.

7. **Grep for the old slug last.** The filename appears in the workflows'
   comments/docs and in `release.yml`'s asset list and release body:
   ```sh
   grep -rn "everything-that-glows" --include="*.yml" --include="*.mjs" \
        --include="*.md" --include="*.html" . | grep -v node_modules
   ```
   Zero hits (outside historical notes) means the port is complete.

### Source-document invariants the new book must honor

The pipeline assumes the `read.html` conventions; a book that follows them
inherits the whole system for free:

- each chapter is a `<section class="chapter">` with an `<h1>`;
- foreword as `section.foreword`, bibliography as `section.appendix`
  (both optional — the build skips what's absent);
- equations rendered as KaTeX **with the LaTeX annotation intact**
  (`annotation[encoding="application/x-tex"]` — this is what the EPUB
  renders from);
- figures as inline `<svg>` with a `<title>`;
- reader-only elements marked `data-no-epub` so they're stripped;
- the light-theme design tokens in `:root` (the EPUB CSS resolves `var()`
  against them).

### Port acceptance checklist

```sh
cd tools && npm install
npm run all          # gate 0 → build → gate 1, all green
# fetch epubcheck (see README.md) and validate both files: 0/0/0
git tag v0.1.0 && git push origin v0.1.0   # release.yml runs the same gauntlet
```

Then the one human step: open both editions in real readers and look at
them — cover thumbnail, a math-heavy page, a figure, the TOC.

## 5. Known floors and honest limits

- **Equation parity counts, it doesn't read.** Wrong math that is
  well-formed passes every gate. Proofreading is an author job.
- **Glyph coverage tests codepoints, not shaping.** A character can be
  present in the font and still look wrong in context (rare in Latin/Greek
  text; real in scripts this book doesn't use).
- **`ALLOWED_FALLBACK` is a reviewed trust list.** Every entry is a bet that
  mainstream reader fallback serifs cover that codepoint (arrows, common math
  symbols, sub/superscripts, vulgar fractions — safe bets). Audit it when
  copying to a new book rather than growing it blindly.
- **epubcheck version is pinned** in two workflows; bump both together.
- **Rendering is not automatable from the file.** The Previewer pass before
  each store submission is part of the pipeline, not optional polish.
