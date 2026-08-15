/**
 * BakeSync PWA Icon Generator
 * Run: node scripts/generate-icons.mjs
 *
 * Requires: npm install (sharp must be installed)
 * Source:   public/icons/logo-source.jpeg
 * Output:   public/icons/*.png  +  public/icons/apple-touch-icon.png
 */

import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");
const SRC       = resolve(ROOT, "public/icons/BakeSync App Logo.png");
const OUT_DIR   = resolve(ROOT, "public/icons");

if (!existsSync(SRC)) {
  console.error("❌  Source logo not found at public/icons/BakeSync App Logo.png");
  process.exit(1);
}

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcon(size, filename) {
  const outPath = resolve(OUT_DIR, filename);
  await sharp(SRC)
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 251, b: 235, alpha: 1 }, // #FFFBEB cream
    })
    .png()
    .toFile(outPath);
  console.log(`✅  ${filename}  (${size}×${size})`);
}

console.log("🎨  Generating BakeSync PWA icons…\n");

await Promise.all([
  ...SIZES.map((s) => generateIcon(s, `icon-${s}x${s}.png`)),
  generateIcon(180, "apple-touch-icon.png"),
]);

console.log("\n🎉  All icons generated in public/icons/");
