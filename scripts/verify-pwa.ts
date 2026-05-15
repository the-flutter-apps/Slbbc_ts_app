#!/usr/bin/env tsx
/**
 * PWA verification script.
 *
 * Verifies post-build that all PWA assets are present and valid.
 * Runs after `npm run build` to catch issues before deployment.
 */

import { promises as fs } from 'fs';
import path from 'path';

const DIST_DIR = path.join(process.cwd(), 'dist');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function addCheck(name: string, passed: boolean, message: string) {
  checks.push({ name, passed, message });
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function checkFile(
  name: string,
  relativePath: string,
  description: string,
): Promise<boolean> {
  const filepath = path.join(DIST_DIR, relativePath);
  const exists = await fileExists(filepath);

  if (exists) {
    addCheck(name, true, `✓ ${description}`);
  } else {
    addCheck(name, false, `✗ ${description} (missing: ${relativePath})`);
  }

  return exists;
}

async function checkManifest(): Promise<boolean> {
  const manifestPath = path.join(DIST_DIR, 'manifest.webmanifest');
  const exists = await fileExists(manifestPath);

  if (!exists) {
    addCheck('manifest-exists', false, '✗ manifest.webmanifest missing');
    return false;
  }

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    // Check required fields
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
    const missingFields = requiredFields.filter((field) => !manifest[field]);

    if (missingFields.length > 0) {
      addCheck(
        'manifest-fields',
        false,
        `✗ manifest missing required fields: ${missingFields.join(', ')}`,
      );
      return false;
    }

    // Check icons array
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      addCheck('manifest-icons', false, '✗ manifest has no icons array');
      return false;
    }

    // Check for required icon sizes
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    const requiredSizes = ['192x192', '512x512'];
    const missingSizes = requiredSizes.filter((size) => !sizes.includes(size));

    if (missingSizes.length > 0) {
      addCheck(
        'manifest-icon-sizes',
        false,
        `✗ manifest missing icon sizes: ${missingSizes.join(', ')}`,
      );
      return false;
    }

    addCheck('manifest-valid', true, '✓ manifest.webmanifest is valid');
    return true;
  } catch (error) {
    addCheck('manifest-parse', false, `✗ manifest.webmanifest is invalid JSON: ${error}`);
    return false;
  }
}

async function main() {
  console.log('\n🔍 Verifying PWA build...\n');

  // Check dist directory exists
  if (!(await fileExists(DIST_DIR))) {
    console.error(`✗ dist/ directory not found. Run 'npm run build' first.\n`);
    process.exit(1);
  }

  // Check service worker
  await checkFile('sw', 'sw.js', 'Service worker (sw.js)');

  // Check manifest
  await checkManifest();

  // Check offline fallback
  await checkFile('offline', 'offline.html', 'Offline fallback page');

  // Check icons
  await checkFile('icon-192', 'icons/icon-192.png', 'Icon 192x192');
  await checkFile('icon-512', 'icons/icon-512.png', 'Icon 512x512');
  await checkFile('icon-maskable', 'icons/icon-512-maskable.png', 'Maskable icon 512x512');
  await checkFile('apple-icon', 'apple-touch-icon.png', 'Apple touch icon');
  await checkFile('favicon', 'favicon.ico', 'Favicon');

  // Check app shell
  await checkFile('index', 'index.html', 'Index HTML');

  // Print results
  console.log('Results:\n');

  const failed = checks.filter((c) => !c.passed);
  const passed = checks.filter((c) => c.passed);

  passed.forEach((c) => console.log(`  ${c.message}`));
  failed.forEach((c) => console.log(`  ${c.message}`));

  console.log(`\n${passed.length} passed, ${failed.length} failed\n`);

  if (failed.length > 0) {
    console.error('❌ PWA verification failed\n');
    process.exit(1);
  }

  console.log('✅ PWA verification passed\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error during verification:', error);
  process.exit(1);
});
