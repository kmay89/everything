// Prepare the raster book cover from a source image → ../cover.jpg
// (1600×2400, JPEG, RGB) — the cover embedded in both EPUBs and shown as the
// Kindle / Apple Books thumbnail. Run when the cover art changes:
//
//   node prepare-cover.mjs <source-image.(png|jpg)>
//
// The source is scaled to a 2:3 portrait (a 1024×1536 source maps exactly).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) {
  console.error("usage: node prepare-cover.mjs <source-image.(png|jpg)>");
  process.exit(1);
}
const buf = fs.readFileSync(src);
const isPng = buf.slice(0, 8).toString("hex").startsWith("89504e47");
const mime = isPng ? "image/png" : "image/jpeg";

const W = 1600, H = 2400; // 2:3 portrait; Kindle/Apple-friendly, ≥1600px tall
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<image href="data:${mime};base64,${buf.toString("base64")}" x="0" y="0" ` +
  `width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/></svg>`;

const r = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render();
const jpg = jpeg.encode({ data: Buffer.from(r.pixels), width: r.width, height: r.height }, 92);
const out = path.join(__dirname, "..", "cover.jpg");
fs.writeFileSync(out, jpg.data);
console.log(`wrote ${out}  ${r.width}×${r.height}  ${(jpg.data.length / 1024).toFixed(0)} KB`);
