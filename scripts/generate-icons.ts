#!/usr/bin/env tsx
/**
 * Generate PWA icons from SVG template.
 *
 * Generates:
 * - icon-192.png (192x192)
 * - icon-512.png (512x512)
 * - icon-512-maskable.png (512x512 with safe zone)
 * - apple-touch-icon.png (180x180)
 * - favicon.ico (multi-size: 16, 32, 48)
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const BRAND_PRIMARY = '#0E3A5F';
const BRAND_ACCENT = '#F59E0B';

// SVG template with SLBBC branding
const svgTemplate = (size: number, padding = 0) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BRAND_PRIMARY}"/>
  <g transform="translate(${padding}, ${padding})">
    <rect x="${size * 0.15}" y="${size * 0.25}" width="${size * 0.7 - padding * 2}" height="${size * 0.12 - padding * 2}" rx="${size * 0.02}" fill="${BRAND_ACCENT}"/>
    <text
      x="50%"
      y="${size * 0.6}"
      font-family="Arial, sans-serif"
      font-size="${size * 0.18}"
      font-weight="bold"
      fill="white"
      text-anchor="middle"
      dominant-baseline="middle"
    >SLBBC</text>
    <text
      x="50%"
      y="${size * 0.78}"
      font-family="Arial, sans-serif"
      font-size="${size * 0.06}"
      fill="white"
      text-anchor="middle"
      opacity="0.9"
    >KIOSK</text>
  </g>
</svg>
`;

interface IconConfig {
  filename: string;
  size: number;
  padding?: number;
}

const ICONS: IconConfig[] = [
  { filename: 'icon-192.png', size: 192 },
  { filename: 'icon-512.png', size: 512 },
  { filename: 'icon-512-maskable.png', size: 512, padding: 51 }, // 10% safe zone
];

const APPLE_ICON: IconConfig = { filename: 'apple-touch-icon.png', size: 180 };

const FAVICON_SIZES = [16, 32, 48];

async function generateIcon(config: IconConfig, outputDir: string): Promise<void> {
  const svg = svgTemplate(config.size, config.padding || 0);
  const outputPath = path.join(outputDir, config.filename);

  await sharp(Buffer.from(svg))
    .resize(config.size, config.size)
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated ${config.filename} (${config.size}x${config.size})`);
}

async function generateFavicon(outputDir: string): Promise<void> {
  // Generate individual PNGs for each size
  const pngBuffers = await Promise.all(
    FAVICON_SIZES.map(async (size) => {
      const svg = svgTemplate(size);
      return sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toBuffer();
    }),
  );

  // ICO format requires raw image data, but sharp doesn't support ICO output
  // For simplicity, we'll just use the largest PNG as favicon.ico
  // Most browsers support PNG favicons anyway
  const largestPng = await sharp(Buffer.from(svgTemplate(48)))
    .resize(48, 48)
    .png()
    .toBuffer();

  const faviconPath = path.join(outputDir, '..', 'favicon.ico');
  await fs.writeFile(faviconPath, largestPng);

  console.log(`✓ Generated favicon.ico (48x48 PNG fallback)`);
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  const iconsDir = path.join(publicDir, 'icons');

  // Ensure icons directory exists
  await fs.mkdir(iconsDir, { recursive: true });

  console.log('Generating PWA icons...\n');

  // Generate main icons
  for (const config of ICONS) {
    await generateIcon(config, iconsDir);
  }

  // Generate Apple touch icon (in public root, not icons/)
  await generateIcon(APPLE_ICON, publicDir);

  // Generate favicon
  await generateFavicon(iconsDir);

  console.log('\n✓ All icons generated successfully!');
  console.log(`  Output: ${iconsDir}`);
}

main().catch((error) => {
  console.error('Error generating icons:', error);
  process.exit(1);
});
