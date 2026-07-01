/* Apple Books store-readiness checks for the built EPUB editions.
 *
 * EPUBCheck (run separately in CI) is the main automated gate Apple runs at
 * upload, but Apple layers a handful of its own requirements on top of it, and
 * a file can pass EPUBCheck clean while still tripping those. This script
 * asserts the extra layer, reading the *built* EPUBs in ./dist directly (as
 * ZIP containers — no dependency) so it checks the real shipped artifact:
 *
 *   - Cover image dimensions (a common Apple rejection reason):
 *     portrait, short side >= 1400 px, ~2:3 book ratio.
 *   - Store metadata completeness in package.opf: title, author, language,
 *     publisher, description, a unique UUID identifier, dcterms:modified,
 *     BISAC subject codes, and schema.org accessibility metadata.
 *   - The cover is declared both the modern (properties="cover-image") and the
 *     legacy (<meta name="cover">) way.
 *   - Math is encoded the way each edition promises: real MathML in the default
 *     edition (Apple Books renders and reflows it), SVG in the Kindle edition —
 *     with zero pre-rendered KaTeX and zero stray TeX left behind in either.
 *   - The reading serif (Literata) is actually embedded and referenced.
 *   - A navigable table of contents (epub:type="toc") plus landmarks.
 *
 * Run: node check-epub-apple.mjs   (exits non-zero on any failure)
 * Build the EPUBs first: node build-epub.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import zlib from "node:zlib";
import { SUBSETS } from "./literata.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "dist");
const rootDir = join(here, "..");

// Equation count in the source, taken as the number of LaTeX annotations KaTeX
// emits (check-html.mjs guarantees exactly one per equation). The EPUB must
// carry this many, so a silently dropped or duplicated equation fails the build
// instead of sliding under the coarse "≥ MIN_EQUATIONS" floor below.
const SRC_HTML = existsSync(join(rootDir, "read.html"))
  ? readFileSync(join(rootDir, "read.html"), "utf8") : "";
const SRC_EQUATIONS = (SRC_HTML.match(/encoding="application\/x-tex"/g) || []).length;

// Codepoint ranges the embedded Literata subsets actually cover (from their
// @font-face unicode-range). A reader draws a character from Literata only when
// its codepoint falls inside one of these ranges; anything else comes from the
// reader's own fallback serif.
const FONT_RANGES = [];
for (const s of SUBSETS) for (const tok of s.range.split(",")) {
  const m = tok.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
  if (m) FONT_RANGES.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
}
const fontCovers = (cp) => cp <= 0x7f || FONT_RANGES.some(([a, b]) => cp >= a && cp <= b);

// Prose characters that legitimately fall outside Literata's ranges and are
// drawn from the reader's fallback serif — arrows, common math symbols,
// sub/superscripts, and vulgar fractions that every mainstream serif covers.
// Reviewed and accepted. A prose character outside BOTH the font ranges AND this
// set fails the check, so a genuinely unsupported glyph (a "tofu" box) is caught
// before it ships. Add a codepoint here only after confirming it renders.
const ALLOWED_FALLBACK = new Set([
  0x21a9,                                          // ↩ citation back-reference
  0x2192, 0x2194,                                  // → ↔
  0x221a, 0x2248, 0x223c, 0x2207, 0x221d, 0x210f,  // √ ≈ ∼ ∇ ∝ ℏ
  0x2080, 0x2081, 0x2082, 0x2086,                  // ₀ ₁ ₂ ₆ subscripts
  0x2070, 0x2075, 0x2076, 0x207b,                  // ⁰ ⁵ ⁶ ⁻ superscripts
  0x2153, 0x2155, 0x2159, 0x215b,                  // ⅓ ⅕ ⅙ ⅛ fractions
  0x2609,                                          // ☉ Sun
]);

// Reduce an XHTML string to its prose text: drop math + figure subtrees (their
// symbols are the reader's/​outlines' job, not Literata's) and markup, then
// decode entities so we test the real codepoints.
function proseText(xhtmlStr) {
  return xhtmlStr
    .replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|middot|lsquo|rsquo|ldquo|rdquo);/g,
      (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
        mdash: "—", ndash: "–", hellip: "…", middot: "·",
        lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" }[n]));
}

const failures = [];
const fail = (scope, msg) => failures.push(`${scope}: ${msg}`);
const ok = (scope, msg) => console.log(`  ok   ${scope}: ${msg}`);
const check = (scope, cond, okMsg, failMsg) =>
  cond ? ok(scope, okMsg) : fail(scope, failMsg);

/* --------------------------------------------------------- minimal unzip --- */
// Read a ZIP (EPUB OCF container) into a Map of entry name -> Buffer, using the
// central directory. Handles stored (0) and raw-deflated (8) entries, which is
// all build-epub.mjs produces.
function readZip(buf) {
  const EOCD_SIG = 0x06054b50;
  // Locate the End Of Central Directory record, scanning back from the tail
  // (past any trailing comment).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a ZIP: no end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central dir entry");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    // Jump to the local header to find where the data actually begins.
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error("bad local header");
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/* ---------------------------------------------------------- jpeg dimensions */
// Parse width/height from the SOF marker of a JPEG (no image library).
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) { o++; continue; }
    let marker = buf[o + 1];
    o += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)) continue; // markers without a length
    const len = buf.readUInt16BE(o);
    // SOF0..SOF15, excluding DHT(C4), JPG(C8), DAC(CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(o + 3), width: buf.readUInt16BE(o + 5) };
    }
    o += len;
  }
  return null;
}

/* --------------------------------------------------------------- per-book --- */
const EDITIONS = [
  { file: "everything-that-glows.epub", label: "MathML edition", math: "mathml" },
  { file: "everything-that-glows-kindle.epub", label: "Kindle (SVG) edition", math: "svg" },
];

// Floors, not tripwires: the book currently has 12 chapters and 121 equations.
const MIN_TOC_ENTRIES = 12;
const MIN_EQUATIONS = 100;
const MIN_COVER_SHORT_SIDE = 1400; // Apple's short-side minimum

function textOf(entries, name) {
  const b = entries.get(name);
  return b ? b.toString("utf8") : "";
}

function allXhtml(entries) {
  let text = "";
  for (const [name, buf] of entries) {
    if (/^OEBPS\/(xhtml\/.*|nav)\.xhtml$/.test(name)) text += buf.toString("utf8") + "\n";
  }
  return text;
}

function checkEdition(ed) {
  const scope = ed.label;
  const path = join(distDir, ed.file);
  if (!existsSync(path)) {
    fail(scope, `${ed.file} not found in dist/ — run: node build-epub.mjs`);
    return;
  }
  let entries;
  try {
    entries = readZip(readFileSync(path));
  } catch (e) {
    fail(scope, `could not read EPUB container: ${e.message}`);
    return;
  }

  const opf = textOf(entries, "OEBPS/package.opf");
  const nav = textOf(entries, "OEBPS/nav.xhtml");
  const css = textOf(entries, "OEBPS/css/book.css");
  const xhtml = allXhtml(entries);

  /* --- cover image dimensions --- */
  const coverBuf = entries.get("OEBPS/images/cover.jpg");
  if (!coverBuf) {
    fail(scope, "no cover image at OEBPS/images/cover.jpg");
  } else {
    const dim = jpegSize(coverBuf);
    if (!dim) {
      fail(scope, "cover.jpg is not a parseable JPEG");
    } else {
      const shortSide = Math.min(dim.width, dim.height);
      const portrait = dim.height >= dim.width;
      const ratio = dim.height / dim.width;
      const ratioOk = ratio >= 1.3 && ratio <= 1.7; // ~2:3 (1.5) book cover
      check(scope, portrait && shortSide >= MIN_COVER_SHORT_SIDE && ratioOk,
        `cover ${dim.width}×${dim.height} (portrait, short side ${shortSide} ≥ ${MIN_COVER_SHORT_SIDE}, ratio ${ratio.toFixed(2)})`,
        `cover ${dim.width}×${dim.height} fails Apple's cover rules ` +
          `(need portrait, short side ≥ ${MIN_COVER_SHORT_SIDE}, ratio ~1.5; got portrait=${portrait}, short=${shortSide}, ratio=${ratio.toFixed(2)})`);
    }
  }

  /* --- store metadata completeness --- */
  const meta = [
    ["dc:title", /<dc:title[^>]*>[^<]+<\/dc:title>/],
    ["dc:creator (author)", /<dc:creator[^>]*>[^<]+<\/dc:creator>/],
    ["dc:language", /<dc:language>[a-z]{2}/i],
    ["dc:publisher", /<dc:publisher>[^<]+<\/dc:publisher>/],
    ["dc:description", /<dc:description>[^<]{50,}<\/dc:description>/],
    ["unique UUID identifier", /<dc:identifier[^>]*>urn:uuid:[0-9a-fA-F-]{36}<\/dc:identifier>/],
    ["dcterms:modified", /property="dcterms:modified">\d{4}-\d{2}-\d{2}T[\d:]+Z</],
  ];
  const missing = meta.filter(([, re]) => !re.test(opf)).map(([k]) => k);
  check(scope, missing.length === 0,
    "OPF has title, author, language, publisher, description, UUID, dcterms:modified",
    `OPF missing required metadata: ${missing.join(", ")}`);

  // BISAC subject codes (e.g. "SCIENCE / Physics / General").
  const bisac = (opf.match(/<dc:subject>[^<]*\s*\/\s*[^<]*<\/dc:subject>/g) || []).length;
  check(scope, bisac >= 1,
    `${bisac} BISAC subject code(s) present`,
    "no BISAC-formatted <dc:subject> codes (expected e.g. \"SCIENCE / Physics / General\")");

  // schema.org accessibility metadata.
  const a11y = [
    ["schema:accessMode", /property="schema:accessMode">/],
    ["schema:accessModeSufficient", /property="schema:accessModeSufficient">/],
    ["schema:accessibilityFeature", /property="schema:accessibilityFeature">/],
    ["schema:accessibilityHazard", /property="schema:accessibilityHazard">/],
    ["schema:accessibilitySummary", /property="schema:accessibilitySummary">[^<]{20,}</],
  ];
  const a11yMissing = a11y.filter(([, re]) => !re.test(opf)).map(([k]) => k);
  check(scope, a11yMissing.length === 0,
    "schema.org accessibility metadata present",
    `missing accessibility metadata: ${a11yMissing.join(", ")}`);

  /* --- cover declared both ways --- */
  check(scope, /properties="[^"]*\bcover-image\b/.test(opf) && /<meta name="cover" content="[^"]+"/.test(opf),
    "cover declared via properties=\"cover-image\" and legacy <meta name=\"cover\">",
    "cover not declared both the modern (properties=\"cover-image\") and legacy (<meta name=\"cover\">) way");

  /* --- math encoding, per edition --- */
  const mathCount = (xhtml.match(/<math[\s>]/g) || []).length;
  const katexLeft = (xhtml.match(/class="[^"]*\bkatex\b/g) || []).length;
  const texLeft = (xhtml.match(/application\/x-tex/g) || []).length;
  const svgCount = (xhtml.match(/<svg[\s>]/g) || []).length;

  check(scope, katexLeft === 0,
    "no pre-rendered KaTeX markup left in content",
    `${katexLeft} pre-rendered KaTeX node(s) leaked into the EPUB`);
  check(scope, texLeft === 0,
    "no stray TeX annotations left in content",
    `${texLeft} stray x-tex annotation(s) left in the EPUB`);

  if (ed.math === "mathml") {
    check(scope, mathCount >= MIN_EQUATIONS,
      `${mathCount} equations encoded as MathML (Apple Books reflows them)`,
      `only ${mathCount} <math> element(s) (expected ≥ ${MIN_EQUATIONS}) — MathML edition should carry real MathML`);
    // The MathML edition must advertise the MathML accessibility feature.
    check(scope, /property="schema:accessibilityFeature">MathML</.test(opf),
      "advertises the MathML accessibility feature",
      "MathML edition does not declare schema:accessibilityFeature MathML");
  } else {
    check(scope, mathCount === 0,
      "no MathML in the Kindle edition (equations are SVG, Kindle-safe)",
      `${mathCount} <math> element(s) present — the Kindle edition must render equations as SVG, not MathML`);
    check(scope, svgCount > 0,
      `${svgCount} SVG graphic(s) present (equations + figures)`,
      "no SVG content found in the Kindle edition");
  }

  /* --- equation-count parity with the source (no silent drops) --- */
  const eqCount = ed.math === "mathml"
    ? mathCount
    : (xhtml.match(/class="eq"/g) || []).length + (xhtml.match(/class="eq-inline"/g) || []).length;
  check(scope, SRC_EQUATIONS > 0 && eqCount === SRC_EQUATIONS,
    `equation count matches the source exactly (${eqCount} of ${SRC_EQUATIONS})`,
    SRC_EQUATIONS === 0
      ? "could not read read.html to count source equations"
      : `equation count ${eqCount} ≠ ${SRC_EQUATIONS} in read.html — an equation was dropped or duplicated in the build`);

  /* --- glyph coverage: every prose character actually renders --- */
  const offenders = new Map();
  for (const [name, buf] of entries) {
    if (!/^OEBPS\/(xhtml\/.*|nav)\.xhtml$/.test(name)) continue;
    for (const ch of proseText(buf.toString("utf8"))) {
      const cp = ch.codePointAt(0);
      if (fontCovers(cp) || ALLOWED_FALLBACK.has(cp)) continue;
      offenders.set(cp, (offenders.get(cp) || 0) + 1);
    }
  }
  check(scope, offenders.size === 0,
    "every prose character is covered by the embedded font or the reviewed fallback set",
    `${offenders.size} prose character(s) outside the embedded font and not reviewed: ` +
      [...offenders.keys()].map((cp) =>
        `U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${JSON.stringify(String.fromCodePoint(cp))}`).join(", ") +
      ` — confirm each renders, then add it to ALLOWED_FALLBACK in check-epub-apple.mjs`);

  /* --- embedded reading font --- */
  const fontEntries = [...entries.keys()].filter((n) => /^OEBPS\/fonts\/.+\.woff2$/.test(n));
  check(scope, fontEntries.length > 0 && /@font-face/.test(css) && /\.woff2/.test(css) && /font\/woff2/.test(opf),
    `${fontEntries.length} embedded woff2 font file(s), referenced by @font-face and manifest`,
    "reading font not embedded/referenced (expected woff2 files, @font-face in book.css, font/woff2 in OPF)");

  /* --- navigation --- */
  const tocLinks = (nav.match(/<li><a href="[^"]+">/g) || []).length;
  check(scope, /epub:type="toc"/.test(nav) && tocLinks >= MIN_TOC_ENTRIES,
    `navigable TOC with ${tocLinks} entries`,
    `TOC missing or too small (epub:type="toc" with ≥ ${MIN_TOC_ENTRIES} entries; found ${tocLinks})`);
  check(scope, /epub:type="landmarks"/.test(nav),
    "landmarks navigation present",
    "no epub:type=\"landmarks\" navigation");
}

console.log("Apple Books store-readiness checks");
for (const ed of EDITIONS) {
  console.log(`\n${ed.label} (${ed.file})`);
  checkEdition(ed);
}

if (failures.length) {
  console.error("\nFAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nAll Apple Books store-readiness checks passed.");
