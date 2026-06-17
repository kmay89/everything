// Embed Literata into read.html as inline base64 @font-face rules (keeps the
// reader self-contained / offline) and set the serif token to prefer it.
// Idempotent: re-running replaces the block between the markers.
//   node build-fonts.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILY, SUBSETS, read } from "./literata.mjs";

const path = join(dirname(fileURLToPath(import.meta.url)), "..", "read.html");
let html = readFileSync(path, "utf8");

const face = (style, file, range) =>
  `@font-face{font-family:"${FAMILY}";font-style:${style};font-weight:400 700;font-display:swap;` +
  `src:url(data:font/woff2;base64,${read(file).toString("base64")}) format("woff2");unicode-range:${range}}`;

const START = "/*ETG-FONTS-START*/", END = "/*ETG-FONTS-END*/";
let block = START;
for (const s of SUBSETS) block += face("normal", s.normal, s.range);
for (const s of SUBSETS) block += face("italic", s.italic, s.range);
block += END;

if (html.includes(START) && html.includes(END)) {
  html = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
} else {
  const anchor = '@font-face{font-display:block;font-family:KaTeX_AMS';
  if (!html.includes(anchor)) throw new Error("KaTeX @font-face anchor not found in read.html");
  html = html.replace(anchor, block + "\n" + anchor);
}
// prefer Literata in the serif stack (idempotent)
html = html.replace('--serif:"Iowan Old Style"', '--serif:"Literata","Iowan Old Style"');

writeFileSync(path, html);
console.log(`embedded ${FAMILY} into read.html (+${(block.length / 1024) | 0} KB of base64)`);
