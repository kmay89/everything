/* Build EPUB editions of Everything That Glows from read.html.
 *
 * The book's single source of truth is ../read.html. This script regenerates
 * the EPUB(s) from it, so edits to the prose, equations, or figures flow
 * straight through on the next build. Nothing here is hand-maintained.
 *
 * Two editions are produced in ./dist:
 *   everything-that-glows.epub          equations as MathML  (Apple Books,
 *                                       Google Play Books, Kobo, Thorium, ...)
 *   everything-that-glows-kindle.epub   equations as SVG     (Kindle-safe)
 *
 * Figures are kept as inline SVG in both. The math fonts and the bulky KaTeX
 * visual markup are dropped: MathML readers use their own math fonts, and the
 * SVG edition embeds glyph outlines per equation.
 *
 * Run:  node build-epub.mjs            (both editions)
 *       node build-epub.mjs --mathml   (MathML only)
 *       node build-epub.mjs --kindle   (SVG only)
 *
 * Validate the output with epubcheck (run separately; see tools/README.md).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { SUBSETS as LIT, FAMILY as LITFAM, read as litRead } from "./literata.mjs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(here, "dist");

const args = process.argv.slice(2);
const wantMathml = args.includes("--mathml") || !args.includes("--kindle");
const wantKindle = args.includes("--kindle") || !args.includes("--mathml");

const META = {
  title: "Everything That Glows",
  subtitle: "A book in twelve chapters",
  creator: "Karl Meves",
  language: "en",
  rights: "© 2026 Karl Meves. All rights reserved.",
  publisher: "Errerlabs",
  published: "2026-06-16",        // ISO publication date (dc:date)
  publishedLong: "June 16, 2026", // display form for the title page
};

/* ----------------------------------------------------------------- parse --- */
const html = readFileSync(join(root, "read.html"), "utf8");
const coverImg = readFileSync(join(root, "cover.jpg")); // raster cover for Kindle/Apple Books
const vc = new VirtualConsole(); // suppress jsdom CSS-parse noise
const dom = new JSDOM(html, { virtualConsole: vc });
const doc = dom.window.document;
const { XMLSerializer } = dom.window;
const xml = new XMLSerializer();

/* --------------------------------------------------- theme tokens / CSS --- */
// Pull the light-theme custom properties so we can resolve var() statically
// (an EPUB has no JS theme switch). Read :root first, then any light override.
function extractTokens(styleText) {
  const tokens = {};
  const grab = (block) => {
    if (!block) return;
    for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      tokens[m[1].trim()] = m[2].trim();
    }
  };
  const rootM = styleText.match(/:root\s*\{([^}]*)\}/i);
  grab(rootM && rootM[1]);
  const lightM = styleText.match(/html\[data-theme=["']light["']\]\s*\{([^}]*)\}/i);
  grab(lightM && lightM[1]);
  return tokens;
}
function resolveVars(css, tokens, seen = 0) {
  if (seen > 5) return css;
  let changed = false;
  const out = css.replace(/var\(\s*--([a-z0-9-]+)\s*(?:,[^)]*)?\)/gi, (m, name) => {
    if (tokens[name] != null) { changed = true; return tokens[name]; }
    return m;
  });
  return changed ? resolveVars(out, tokens, seen + 1) : out;
}

const styleText = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
const TOKENS = extractTokens(styleText);

// Extract figure/diagram rules from the source stylesheet so new dia-* classes
// the author adds keep styling in the EPUB. Match top-level rule blocks whose
// selector list mentions a figure/diagram/katex-display token.
function extractFigureCss(text) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const sel = m[1].trim();
    if (/(^|[\s,>])\.(dia|diagram)\b|(^|[\s,>])figure\b|figcaption|\.katex-display/.test(sel)) {
      // skip @-rule fragments and reader-only states
      if (sel.startsWith("@") || /:hover|:focus|\.speaking/.test(sel)) continue;
      rules.push(`${sel}{${m[2].trim()}}`);
    }
  }
  return resolveVars(rules.join("\n"), TOKENS);
}
const figureCss = extractFigureCss(styleText);

/* --------------------------------------------------------------- mathjax --- */
// Both editions render from each equation's LaTeX source (the KaTeX
// annotation) via MathJax: spec-valid MathML for modern readers, SVG for
// Kindle. This avoids KaTeX's MathML arity quirks (e.g. an extra invisible
// operator inside <msub>) that epubcheck rejects.
let MJ = null;
function initMathJax() {
  if (MJ) return MJ;
  const { mathjax } = require("mathjax-full/js/mathjax.js");
  const { TeX } = require("mathjax-full/js/input/tex.js");
  const { SVG } = require("mathjax-full/js/output/svg.js");
  const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
  const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
  const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");
  const { SerializedMmlVisitor } = require("mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js");
  const { STATE } = require("mathjax-full/js/core/MathItem.js");
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  // bussproofs needs an output jax with getBBox(); the book doesn't use it.
  const packages = AllPackages.filter((p) => p !== "bussproofs");

  const svgOut = new SVG({ fontCache: "local" }); // self-contained per equation
  const svgDoc = mathjax.document("", { InputJax: new TeX({ packages }), OutputJax: svgOut });
  const mmlDoc = mathjax.document("", { InputJax: new TeX({ packages }) });
  const visitor = new SerializedMmlVisitor();

  MJ = {
    toSvg: (latex, display) =>
      adaptor.outerHTML(svgDoc.convert(latex, { display: !!display })),
    toMathml: (latex, display) => {
      const node = mmlDoc.convert(latex, { display: !!display, end: STATE.CONVERT });
      return visitor.visitTree(node, mmlDoc);
    },
  };
  return MJ;
}

/* ------------------------------------------------- per-document transform --- */
// Strip MathJax's data-mjx-* bookkeeping attributes for clean, portable output.
function cleanMjx(el) {
  const walk = (n) => {
    if (n.attributes) {
      [...n.attributes].forEach((a) => {
        if (a.name.startsWith("data-mjx")) n.removeAttribute(a.name);
      });
    }
    [...n.childNodes].forEach(walk);
  };
  walk(el);
}

// Convert the rendered equations inside a cloned content node, in place.
function transformMath(node, mode) {
  const mj = initMathJax();
  const katex = [...node.querySelectorAll(".katex")];
  for (const k of katex) {
    const display = !!k.closest(".katex-display");
    const target = display ? k.closest(".katex-display") || k : k;
    const ann = k.querySelector('annotation[encoding="application/x-tex"]');
    const latex = ann ? ann.textContent : "";
    if (!latex.trim()) { target.remove(); continue; }

    const out = mode === "mathml" ? mj.toMathml(latex, display) : mj.toSvg(latex, display);
    const frag = JSDOM.fragment(out);
    const el = frag.querySelector(mode === "mathml" ? "math" : "svg");
    if (!el) continue;
    const imported = doc.importNode(el, true);
    cleanMjx(imported);

    let replacement;
    if (display) {
      // Display math lives inside a <p>, so the wrapper must be inline-level
      // (a <span> shown as block via CSS) to stay valid XHTML.
      const span = doc.createElement("span");
      span.className = "eq";
      span.appendChild(imported);
      replacement = span;
    } else if (mode === "mathml") {
      replacement = imported; // <math> is phrasing content
    } else {
      const span = doc.createElement("span");
      span.className = "eq-inline";
      span.appendChild(imported);
      replacement = span;
    }
    target.replaceWith(replacement);
  }
}

// Resolve fragment links within a single output document. Cross-document
// "#top" links are repointed to the document's own root id; any other unknown
// fragment is unwrapped so the EPUB has no dangling internal links.
function fixAnchors(clone, rootId) {
  const ids = new Set([...clone.querySelectorAll("[id]")].map((e) => e.id));
  if (rootId) ids.add(rootId);
  clone.querySelectorAll('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    if (ids.has(id)) return;
    if (id === "top" && rootId) { a.setAttribute("href", "#" + rootId); return; }
    const text = doc.createTextNode(a.textContent || "");
    a.replaceWith(text);
  });
}

// Strip anything that only belongs to the interactive reader.
function stripReaderBits(node) {
  node.querySelectorAll("script,style,[data-no-epub]").forEach((n) => n.remove());
  // .xref is just a class on <strong>; harmless, but drop the affordance attrs.
  node.querySelectorAll("strong.xref").forEach((s) => {
    s.removeAttribute("data-ref-id");
    s.removeAttribute("title");
    s.classList.remove("xref");
    if (!s.getAttribute("class")) s.removeAttribute("class");
  });
}

function serializeChildren(node) {
  return [...node.childNodes].map((n) => xml.serializeToString(n)).join("");
}

/* ----------------------------------------------------------- documents --- */
const XHTML_HEAD = (title, cssHref = "../css/book.css") =>
  `<?xml version="1.0" encoding="utf-8"?>\n` +
  `<!DOCTYPE html>\n` +
  `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" ` +
  `lang="${META.language}" xml:lang="${META.language}">\n` +
  `<head>\n<meta charset="utf-8"/>\n<title>${esc(title)}</title>\n` +
  `<link rel="stylesheet" type="text/css" href="${cssHref}"/>\n</head>\n`;

function xhtmlDoc(title, bodyInner, bodyClass = "") {
  return (
    XHTML_HEAD(title) +
    `<body${bodyClass ? ` class="${bodyClass}"` : ""}>\n${bodyInner}\n</body>\n</html>\n`
  );
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// Title page: a clean, static prism (no animation/JS), plus the book's text.
function coverDoc() {
  // Full-bleed raster cover (the file Kindle/Apple Books show as the thumbnail).
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="100%" height="100%" viewBox="0 0 1600 2400" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" aria-label="Cover — ${esc(META.title)} by ${esc(META.creator)}">\n` +
    `<image width="1600" height="2400" xlink:href="../images/cover.jpg"/>\n</svg>`;
  return xhtmlDoc(META.title, `<section epub:type="cover" class="cover">\n${svg}\n</section>`, "cover");
}

function titlepageDoc() {
  const lede = doc.querySelector("header.titlepage .lede");
  const ledeHtml = lede ? serializeChildren(lede.cloneNode(true)) : "";
  const prism = `<svg xmlns="http://www.w3.org/2000/svg" class="cover-prism-art" viewBox="0 0 360 130" role="img" aria-label="A prism splitting a beam of white light into a spectrum.">
<defs><linearGradient id="spec" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#d65a5a"/><stop offset="17%" stop-color="#e0894a"/><stop offset="33%" stop-color="#e0c15a"/><stop offset="51%" stop-color="#3fae9f"/><stop offset="68%" stop-color="#4a90d9"/><stop offset="84%" stop-color="#5757c8"/><stop offset="100%" stop-color="#6b5bd0"/>
</linearGradient></defs>
<path d="M176,88 L352,46 L352,118 Z" fill="url(#spec)"/>
<path d="M150,26 L116,100 L184,100 Z" fill="none" stroke="${TOKENS.accent || "#34346b"}" stroke-width="2" stroke-linejoin="round"/>
<line x1="8" y1="72" x2="130" y2="72" stroke="${TOKENS.accent || "#34346b"}" stroke-width="2"/>
</svg>`;
  const body =
    `<section epub:type="titlepage" class="titlepage">\n${prism}\n` +
    `<p class="kicker">${esc(META.subtitle)}</p>\n` +
    `<h1 class="book-title">${esc(META.title)}</h1>\n` +
    `<span class="rule"></span>\n` +
    (ledeHtml ? `<p class="lede">${ledeHtml}</p>\n` : "") +
    `<p class="byline">${esc(META.creator)}</p>\n` +
    `<p class="imprint">Published by ${esc(META.publisher)} &#183; First published ${esc(META.publishedLong)}</p>\n` +
    `<p class="copyright">${esc(META.rights)}</p>\n</section>`;
  return xhtmlDoc(META.title, body, "frontmatter");
}

function sectionDoc(srcSection, { title, type, mathMode, bodyClass }) {
  const clone = srcSection.cloneNode(true);
  stripReaderBits(clone);
  transformMath(clone, mathMode);
  const rootId = srcSection.id || "";
  fixAnchors(clone, rootId);
  clone.removeAttribute("style");
  const epubType = type ? ` epub:type="${type}"` : "";
  const cls = srcSection.getAttribute("class") || "";
  const idAttr = rootId ? ` id="${esc(rootId)}"` : "";
  const inner = `<section${idAttr}${epubType} class="${esc(cls)}">\n${serializeChildren(clone)}\n</section>`;
  return xhtmlDoc(title, inner, bodyClass);
}

/* ----------------------------------------------------------------- zip --- */
// Minimal ZIP writer: store "mimetype" first (no compression), deflate the
// rest. Enough for a valid EPUB OCF container; no external dependency.
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const enc = (s) => Buffer.from(s, "utf8");
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n >>> 0); return b; };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

  for (const { name, data, store } of entries) {
    const nameBuf = enc(name);
    const content = Buffer.isBuffer(data) ? data : enc(data);
    const crc = crc32(content);
    const comp = store ? content : zlib.deflateRawSync(content, { level: 9 });
    const method = store ? 0 : 8;

    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(crc), u32(comp.length), u32(content.length),
      u16(nameBuf.length), u16(0), nameBuf,
    ]);
    chunks.push(local, comp);

    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(crc), u32(comp.length), u32(content.length),
      u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), nameBuf,
    ]));
    offset += local.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(cd.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...chunks, cd, end]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------ assemble --- */
function bookCss() {
  const litFaces = LIT.map((s) =>
    `@font-face{font-family:"${LITFAM}";font-style:normal;font-weight:400 700;font-display:swap;src:url("../fonts/${s.normal}") format("woff2");unicode-range:${s.range}}\n` +
    `@font-face{font-family:"${LITFAM}";font-style:italic;font-weight:400 700;font-display:swap;src:url("../fonts/${s.italic}") format("woff2");unicode-range:${s.range}}`
  ).join("\n");
  return `/* Everything That Glows - generated EPUB stylesheet */
${litFaces}
@page{margin:0}
html{height:100%}
html,body{margin:0;padding:0}
body.cover{margin:0;padding:0;height:100%}
.cover{margin:0;padding:0}
.cover svg{display:block;width:100%;height:100%}
body{font-family:"${LITFAM}",Iowan Old Style,Palatino,Georgia,serif;color:${TOKENS.ink || "#1b1b1f"};
  line-height:1.6;padding:1em 1.2em;hyphens:auto}
h1,h2,h3{font-weight:600;line-height:1.15;color:${TOKENS.ink || "#1b1b1f"}}
h1{font-size:1.7em;margin:1.2em 0 .6em;letter-spacing:-.01em}
h2{font-size:1.25em;margin:1.6em 0 .5em}
p{margin:0 0 1em;text-align:justify}
a{color:${TOKENS.accent || "#34346b"};text-decoration:none}
em,i{font-style:italic}
strong,b{font-weight:600}
sup.cite{font-size:.72em;line-height:0}
sup.cite a{color:${TOKENS.accent || "#34346b"}}
blockquote{margin:1.2em 1.4em;color:${TOKENS.muted || "#5f5d57"};font-style:italic}
.sources-section{margin-top:2.4em;border-top:1px solid ${TOKENS.rule || "#e3e0d6"};padding-top:1em;
  font-size:.9em;color:${TOKENS.muted || "#5f5d57"}}
.sources-section h2,.sources-section h3{font-size:1em;letter-spacing:.08em;text-transform:uppercase;
  color:${TOKENS.faint || "#8a877e"}}
ol,ul{padding-left:1.4em}
li{margin:.2em 0}
/* equations */
.eq{display:block;margin:1.1em 0;text-align:center;overflow-x:auto}
.eq math{display:block}
.eq-inline{white-space:nowrap}
.eq svg,.eq-inline svg{max-width:100%}
math{font-size:1.02em}
/* figures (diagrams) */
figure{margin:1.6em 0;text-align:center;page-break-inside:avoid}
figure svg{max-width:100%;height:auto}
figcaption{font-size:.86em;color:${TOKENS.muted || "#5f5d57"};margin-top:.6em;text-align:left;line-height:1.45}
/* title page */
body.frontmatter{display:block}
.titlepage{text-align:center;padding-top:2em}
.cover-prism-art{width:60%;max-width:280px;height:auto;margin:0 auto 1.4em;display:block}
.kicker{font-variant:small-caps;letter-spacing:.18em;color:${TOKENS.accent || "#34346b"};text-align:center}
.book-title{font-size:2.2em;text-align:center;margin:.2em 0 .4em}
.rule{display:block;width:42%;height:3px;margin:.8em auto 1.4em;
  background:linear-gradient(90deg,#d65a5a,#e0c15a,#3fae9f,#4a90d9,#6b5bd0)}
.lede{text-align:center;color:${TOKENS.muted || "#5f5d57"};font-size:1.05em;max-width:30em;margin:0 auto 2em}
.byline{text-align:center;font-size:1.1em;margin:1.6em 0 .2em}
.imprint{text-align:center;font-size:.85em;color:${TOKENS.muted || "#5f5d57"};margin:0 0 1.2em}
.copyright{text-align:center;font-size:.82em;color:${TOKENS.faint || "#8a877e"}}
/* figure styles carried from the source */
${figureCss}
`;
}

function buildEdition(mode, fileName, idSuffix) {
  const files = []; // {name, data, store, props, inSpine, navTitle}
  const add = (name, data, opts = {}) => files.push({ name, data, ...opts });

  // OCF
  add("mimetype", "application/epub+zip", { store: true, noManifest: true });
  add(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>\n`,
    { noManifest: true }
  );
  add("OEBPS/css/book.css", bookCss(), { id: "css", media: "text/css" });
  add("OEBPS/images/cover.jpg", coverImg, { id: "cover-image", media: "image/jpeg", props: "cover-image", store: true });
  // Embed the Literata reading serif (Apple Books/Kobo/Thorium use it; Kindle substitutes its own).
  for (const s of LIT) {
    add(`OEBPS/fonts/${s.normal}`, litRead(s.normal), { id: `font-${s.name}-n`, media: "font/woff2", store: true });
    add(`OEBPS/fonts/${s.italic}`, litRead(s.italic), { id: `font-${s.name}-i`, media: "font/woff2", store: true });
  }

  // Content documents
  const spine = []; // {id, props}
  const nav = []; // {href, title}
  const pushDoc = (name, xhtmlStr, id, navTitle) => {
    const props = [];
    if (/<math\b/.test(xhtmlStr)) props.push("mathml");
    if (/<svg\b/.test(xhtmlStr)) props.push("svg");
    add(`OEBPS/${name}`, xhtmlStr, {
      id,
      media: "application/xhtml+xml",
      props: props.join(" "),
    });
    spine.push({ id });
    if (navTitle) nav.push({ href: name, title: navTitle });
  };

  pushDoc("xhtml/cover.xhtml", coverDoc(), "cover", null);
  pushDoc("xhtml/titlepage.xhtml", titlepageDoc(), "titlepage", null);

  const foreword = doc.querySelector("section.foreword");
  if (foreword) {
    pushDoc(
      "xhtml/foreword.xhtml",
      sectionDoc(foreword, { title: "Foreword", type: "preamble", mathMode: mode }),
      "foreword",
      "Foreword"
    );
  }

  const chapters = [...doc.querySelectorAll("section.chapter")];
  chapters.forEach((ch, i) => {
    const h1 = ch.querySelector("h1");
    const title = h1 ? h1.textContent.trim() : `Chapter ${i + 1}`;
    const n = String(i + 1).padStart(2, "0");
    pushDoc(
      `xhtml/ch${n}.xhtml`,
      sectionDoc(ch, { title, type: "bodymatter chapter", mathMode: mode }),
      `ch${n}`,
      title
    );
  });

  const appendix = doc.querySelector("section.appendix");
  if (appendix) {
    const h1 = appendix.querySelector("h1");
    const title = (h1 && h1.textContent.trim()) || "Combined Bibliography";
    pushDoc(
      "xhtml/bibliography.xhtml",
      sectionDoc(appendix, { title, type: "bibliography", mathMode: mode }),
      "bibliography",
      title
    );
  }

  // nav.xhtml (EPUB3 navigation document)
  const navList = nav
    .map((e) => `      <li><a href="${e.href}">${esc(e.title)}</a></li>`)
    .join("\n");
  const navDoc =
    XHTML_HEAD("Contents", "css/book.css") +
    `<body>\n  <nav epub:type="toc" id="toc" role="doc-toc">\n    <h1>Contents</h1>\n    <ol>\n${navList}\n    </ol>\n  </nav>\n` +
    `  <nav epub:type="landmarks" hidden="hidden">\n    <h2>Guide</h2>\n    <ol>\n      <li><a epub:type="cover" href="xhtml/cover.xhtml">Cover</a></li>\n      <li><a epub:type="titlepage" href="xhtml/titlepage.xhtml">Title page</a></li>\n      <li><a epub:type="bodymatter" href="xhtml/ch01.xhtml">Begin reading</a></li>\n    </ol>\n  </nav>\n</body>\n</html>\n`;
  add("OEBPS/nav.xhtml", navDoc, {
    id: "nav",
    media: "application/xhtml+xml",
    props: "nav",
  });

  // package.opf
  const uid = "urn:uuid:" + deterministicUuid(META.title + "|" + idSuffix);
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const manifestItems = files
    .filter((f) => !f.noManifest && f.id)
    .map((f) => {
      const rel = f.name.replace(/^OEBPS\//, "");
      const props = f.props ? ` properties="${f.props}"` : "";
      return `    <item id="${f.id}" href="${rel}" media-type="${f.media}"${props}/>`;
    })
    .join("\n");
  const spineItems = spine.map((s) => `    <itemref idref="${s.id}"/>`).join("\n");
  const opf =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${META.language}">\n` +
    `  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `    <dc:identifier id="bookid">${uid}</dc:identifier>\n` +
    `    <dc:title>${esc(META.title)}</dc:title>\n` +
    `    <dc:creator>${esc(META.creator)}</dc:creator>\n` +
    `    <dc:language>${META.language}</dc:language>\n` +
    `    <dc:publisher>${esc(META.publisher)}</dc:publisher>\n` +
    `    <dc:rights>${esc(META.rights)}</dc:rights>\n` +
    `    <dc:date>${META.published}</dc:date>\n` +
    `    <meta name="cover" content="cover-image"/>\n` +
    `    <meta property="dcterms:modified">${modified}</meta>\n` +
    `    <meta property="schema:accessMode">textual</meta>\n` +
    `    <meta property="schema:accessMode">visual</meta>\n` +
    `  </metadata>\n` +
    `  <manifest>\n${manifestItems}\n  </manifest>\n` +
    `  <spine>\n${spineItems}\n  </spine>\n` +
    `</package>\n`;
  add("OEBPS/package.opf", opf, { noManifest: true });

  // Order entries: mimetype first, then everything else.
  const ordered = [
    files.find((f) => f.name === "mimetype"),
    ...files.filter((f) => f.name !== "mimetype"),
  ];
  const buf = zip(ordered);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, fileName);
  writeFileSync(out, buf);
  const eqCount = [...doc.querySelectorAll(".katex")].length;
  console.log(
    `  built ${fileName}  (${(buf.length / 1024).toFixed(0)} KB, ${chapters.length} chapters, ${eqCount} equations as ${mode === "mathml" ? "MathML" : "SVG"})`
  );
}

function deterministicUuid(seed) {
  const h = crypto.createHash("sha1").update(seed).digest("hex");
  return (
    h.slice(0, 8) + "-" + h.slice(8, 12) + "-5" + h.slice(13, 16) + "-a" +
    h.slice(17, 20) + "-" + h.slice(20, 32)
  );
}

/* ----------------------------------------------------------------- run --- */
try { rmSync(outDir, { recursive: true, force: true }); } catch {}
console.log("Building EPUB editions from read.html");
if (wantMathml) buildEdition("mathml", "everything-that-glows.epub", "mathml");
if (wantKindle) buildEdition("svg", "everything-that-glows-kindle.epub", "kindle");
console.log("Done. Output in tools/dist/. Validate with epubcheck (see README).");
