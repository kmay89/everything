// Build social / web branding images from the book cover:
//   ../cover-web.jpg   a light web thumbnail for the landing page
//   ../og-image.png    the 1200×630 Open Graph / Twitter share card
// Run after the cover changes:  node build-social.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const coverB64 = fs.readFileSync(path.join(root, "cover.jpg")).toString("base64");
const coverURI = `data:image/jpeg;base64,${coverB64}`;
// font-family lists with fallbacks, so regeneration works without Liberation fonts
const SERIF = "Liberation Serif, DejaVu Serif, Georgia, Times New Roman, serif";
const SANS = "Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif";

function renderPng(svg, w) {
  return new Resvg(svg, { fitTo: { mode: "width", value: w }, font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Serif" } }).render();
}

/* ---- web thumbnail (440×660, ~2× the 200px display size) ---- */
{
  const W = 440, H = 660;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><image href="${coverURI}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/></svg>`;
  const r = renderPng(svg, W);
  const jpg = jpeg.encode({ data: Buffer.from(r.pixels), width: r.width, height: r.height }, 82);
  fs.writeFileSync(path.join(root, "cover-web.jpg"), jpg.data);
  console.log(`cover-web.jpg  ${r.width}×${r.height}  ${(jpg.data.length / 1024).toFixed(0)} KB`);
}

/* ---- Open Graph card (1200×630) ---- */
{
  const W = 1200, H = 630;
  const cx = 64, cy = 35, ch = 560, cw = Math.round((ch * 2) / 3); // 2:3 cover
  const tx = cx + cw + 90; // text column
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15151c"/><stop offset="1" stop-color="#0a0a0d"/></linearGradient>
  <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d65a5a"/><stop offset="0.33" stop-color="#e0c15a"/><stop offset="0.6" stop-color="#3fae9f"/><stop offset="1" stop-color="#6b5bd0"/></linearGradient>
  <clipPath id="cc"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="10"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<image href="${coverURI}" x="${cx}" y="${cy}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc)"/>
<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="10" fill="none" stroke="#2c2c34" stroke-width="2"/>
<text x="${tx}" y="168" font-family="${SANS}" font-size="29" letter-spacing="7" fill="#caa765">EVERYTHING THAT GLOWS</text>
<g font-family="${SERIF}" fill="#f4ede1">
  <text x="${tx}" y="262" font-size="52">The world is, underneath,</text>
  <text x="${tx}" y="328" font-size="52">made of information.</text>
</g>
<rect x="${tx}" y="372" width="300" height="6" rx="3" fill="url(#rule)"/>
<text x="${tx}" y="452" font-family="${SANS}" font-size="30" fill="#b7b3aa">Free to read in your browser.</text>
<text x="${tx}" y="512" font-family="${SANS}" font-size="28" letter-spacing="2" fill="#8f8b82">Karl Meves  ·  Errerlabs</text>
<text x="${tx}" y="566" font-family="${SANS}" font-size="25" letter-spacing="1" fill="#6f6b62">everythingthatglows.com</text>
</svg>`;
  const r = renderPng(svg, W);
  const jpg = jpeg.encode({ data: Buffer.from(r.pixels), width: r.width, height: r.height }, 86);
  fs.writeFileSync(path.join(root, "og-image.jpg"), jpg.data);
  console.log(`og-image.jpg   ${r.width}×${r.height}  ${(jpg.data.length / 1024).toFixed(0)} KB`);
}
