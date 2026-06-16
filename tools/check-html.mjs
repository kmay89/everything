/* HTML integrity checks for Everything That Glows.
 *
 * Catches the class of structural breakage that renders a blank/black page:
 * an unclosed raw-text element (<style>/<script>) swallows the rest of the
 * document, so the <body> ends up empty. Plain syntax linting (node --check
 * on the scripts) does NOT catch this, because the scripts are still well
 * formed; only actually parsing the HTML into a DOM reveals it.
 *
 * Run: node check-html.mjs   (exits non-zero on any failure)
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);
const ok = (file, msg) => console.log(`  ok   ${file}: ${msg}`);

// Pages to check, with the minimum number of top-level <body> children we
// expect once the document parses correctly (a generous floor, not a tripwire).
const PAGES = [
  { file: "index.html", minBody: 3 },
  { file: "read.html", minBody: 10, chapters: 12 },
  { file: "privacy.html", minBody: 1 },
  { file: "404.html", minBody: 1 },
];

function countTag(html, tag) {
  const open = (html.match(new RegExp(`<${tag}(\\s|>)`, "gi")) || []).length;
  const close = (html.match(new RegExp(`</${tag}\\s*>`, "gi")) || []).length;
  return { open, close };
}

function checkScripts(file, html) {
  // Extract inline <script> bodies (skip those with a src) and compile each to
  // surface syntax errors without executing anything.
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0, bad = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    // Only lint actual JavaScript. Skip data blocks like JSON-LD
    // (type="application/ld+json"), import maps, templates, etc.
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "";
    const JS = ["", "text/javascript", "application/javascript", "module", "text/ecmascript"];
    if (!JS.includes(type)) continue;
    const code = m[2];
    if (!code.trim()) continue;
    n++;
    try {
      new vm.Script(code, { filename: `${file}#script${n}` });
    } catch (e) {
      bad++;
      fail(file, `inline script #${n} has a syntax error: ${e.message}`);
    }
  }
  if (!bad) ok(file, `${n} inline script(s) parse`);
}

function checkPage(p) {
  const path = join(root, p.file);
  if (!existsSync(path)) {
    fail(p.file, "file not found");
    return;
  }
  const html = readFileSync(path, "utf8");

  // 1) Raw-text elements must be balanced. This is the exact check that catches
  //    a missing </style> (the black-screen bug) or a stray </script>.
  for (const tag of ["style", "script"]) {
    const { open, close } = countTag(html, tag);
    if (open !== close) {
      fail(p.file, `unbalanced <${tag}>: ${open} open vs ${close} close`);
    }
  }

  // 2) Parse into a real DOM and confirm the body actually populated. If a
  //    raw-text element is left open, the body collapses to (near) empty.
  const vc = new VirtualConsole(); // swallow jsdom's CSS parse warnings
  let dom;
  try {
    dom = new JSDOM(html, { virtualConsole: vc });
  } catch (e) {
    fail(p.file, `jsdom could not parse the document: ${e.message}`);
    return;
  }
  const doc = dom.window.document;
  const bodyKids = doc.body ? doc.body.children.length : 0;
  if (bodyKids < p.minBody) {
    fail(
      p.file,
      `<body> has only ${bodyKids} element(s) (expected >= ${p.minBody}). ` +
        `An unclosed <style>/<script> can cause this.`
    );
  } else {
    ok(p.file, `<body> has ${bodyKids} element(s)`);
  }

  // 3) read.html structural invariants the EPUB build relies on.
  if (p.chapters != null) {
    const chapters = doc.querySelectorAll("section.chapter").length;
    if (chapters !== p.chapters) {
      fail(p.file, `found ${chapters} section.chapter (expected ${p.chapters})`);
    } else {
      ok(p.file, `${chapters} chapters present`);
    }

    // Every rendered equation must carry its MathML + LaTeX source, or the
    // EPUB export silently loses math.
    const eqs = [...doc.querySelectorAll(".katex")];
    const missing = eqs.filter(
      (k) =>
        !k.querySelector(".katex-mathml math") ||
        !k.querySelector('annotation[encoding="application/x-tex"]')
    );
    if (eqs.length === 0) {
      ok(p.file, "no equations to check");
    } else if (missing.length) {
      fail(
        p.file,
        `${missing.length}/${eqs.length} equation(s) lack MathML or LaTeX source`
      );
    } else {
      ok(p.file, `${eqs.length} equations carry MathML + LaTeX`);
    }

    // Figures should be inline SVG with a title (accessibility + EPUB images).
    const figs = [...doc.querySelectorAll("figure.diagram")];
    const figBad = figs.filter((f) => !f.querySelector("svg title"));
    if (figBad.length) {
      fail(p.file, `${figBad.length}/${figs.length} figures missing <svg><title>`);
    } else {
      ok(p.file, `${figs.length} figures have accessible titles`);
    }
  }

  // 4) Inline script syntax.
  checkScripts(p.file, html);
}

console.log("HTML integrity checks");
for (const p of PAGES) checkPage(p);

if (failures.length) {
  console.error("\nFAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nAll HTML integrity checks passed.");
