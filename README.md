<div align="center">

# Everything That Glows

**A book in twelve chapters · free to read**

*Why the world that glows, remembers, lives, falls, holds, reflects, works, and counts
(that rhymes through π and e, rings with the music of the primes, stands as the made
world, and is lived in while the light lasts) is, underneath, made of information.*

[everythingthatglows.com](https://everythingthatglows.com/)

</div>

---

Bring your hand close to a flame, and something arrives. For most of human history that
warmth was taken at face value, and the conclusion drawn from it was reasonable, careful,
and wrong. *Everything That Glows* is a book about how we found out, and about the single
thread that runs beneath the heat, the atom, the cell, the falling apple, the prime numbers,
and the mirror: that the world, underneath, is made of information.

This repository is the book's small static site:

- [`index.html`](index.html) — the landing page: prism hero, the free-to-read premise, the
  twelve chapters, an About, and a way to support the work.
- [`read.html`](read.html) — the whole book in a single self-contained file: every chapter,
  every source, the typeface, the cover animation, and the reading tools, all inside it.
  Open it in any modern browser and start reading. Nothing to install, no network required.
- [`og-image.png`](og-image.png) — the share card, so links unfurl with the prism.

## The twelve chapters

The first eight are named for what the world *does*; the last four for where the thread leads.

| | Chapter | The question underneath |
|---|---|---|
| I | **Everything That Glows** | heat, light, entropy, and information as physics |
| II | **Everything That Remembers** | counting, computation, and the limits of machines |
| III | **Everything That Lives** | order, chirality, the cell, and what life is |
| IV | **Everything That Falls** | gravity, from Kepler's ellipses to woven spacetime |
| V | **Everything That Holds** | the atom, why matter is full, and what particles are |
| VI | **Everything That Reflects** | the wave, measurement, and when *maybe* becomes *is* |
| VII | **Everything That Works** | energy, fields, work, and the closed system |
| VIII | **Everything That Counts** | number, and why mathematics is so unreasonably effective |
| IX | **The Two Uninvited Guests** | the constants that show up where you don't invite them |
| X | **The Music No One Composed** | the primes, and the operator no one can find |
| XI | **The Made World** | engineering: making and knowing, taking turns |
| XII | **While the Light Lasts** | coming home: the body, play, and what the time is for |

A **Combined Bibliography** unifies the references for all twelve chapters into a single,
fact-checked list.

## How to read it

This is a **fact-checked, inline-cited edition**. The reader is designed to stay out of your
way:

- **Inline citations** — tap any bracketed number to read its source without leaving the
  sentence; tap again, or anywhere, to dismiss. Sources are primary wherever one exists.
- **Marks** — flag where you are, or any passage worth returning to, and it waits for you.
- **A reading progress bar** and a quiet "now reading" indicator track your place.
- **Sound** *(off by default)* — soft tones tuned to simple whole-number ratios, synthesized
  live in the browser.
- **Dark mode** is honored automatically (`prefers-color-scheme`), and all motion respects
  `prefers-reduced-motion`.

The cover is a prism splitting a beam of white light into a spectrum: the book's recurring
image, and the source of its palette of warm-paper page, ink-dark serif text, and a single
rainbow rule running red through violet.

## Read it locally

Because each page is self-contained, you can simply open it:

```sh
open index.html        # macOS  (landing page; read.html for the book)
xdg-open index.html    # Linux
```

Or serve the folder if you prefer a local URL (recommended — the resume-position and
bookmark features persist properly over `http`):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publishing

The site is static and deploys as-is, with no build step and no dependencies. The included
[`netlify.toml`](netlify.toml) publishes the repository root directly, and `index.html`
becomes the homepage automatically. The same files work on any static host (GitHub Pages,
Cloudflare Pages, etc.); just point the host at the root.

The donation button and footer link point to the author's GitHub
(`github.com/sponsors/kmay89` and `github.com/kmay89`).

## A note on the text

The bracketed numbers refer to the numbered **Sources** list at the end of each chapter.
Sources are primary (the original paper or book) wherever one exists, with
authoritative-secondary sources used only for standard pedagogy or a developing
interpretation, and marked as such.

## License

© 2026 Karl Meves. **All rights reserved.** The book — its text, structure, design, and the
compiled HTML in this repository — is free to *read* online; it is **not** licensed for copying,
redistribution, adaptation, or commercial use. See [`LICENSE`](LICENSE) for the full terms.

This repository carries **no open-source license** (no MIT, Apache, BSD, or similar) for the
authored work. The only third-party licenses involved — MIT and the SIL Open Font License —
cover **solely** the bundled [KaTeX](https://katex.org/) stylesheet and math fonts used to render
equations; they are reproduced in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) purely as the
attribution those tools require, and they grant **no** rights over the book itself. For
permissions beyond reading (republication, translation, audio, print, or any commercial use),
contact the author.

## Security & privacy

The site collects nothing: no trackers, no analytics, no cookies, no accounts. The reader's
position and bookmarks are stored only in their own browser (`localStorage`) and never leave
the device. Responses are served with a strict Content-Security-Policy and the usual security
headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`); see [`netlify.toml`](netlify.toml). To report a vulnerability, see
[`SECURITY.md`](SECURITY.md).
