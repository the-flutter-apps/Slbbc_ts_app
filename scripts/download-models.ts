/**
 * Downloads face-api.js model files from official repository.
 * Run with: pnpm models:download
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const MODELS_REPO_BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master';
const MODELS_DIR = join(process.cwd(), 'public', 'models');

const MODELS = [
  {
    name: 'tiny_face_detector',
    files: ['tiny_face_detector_model-weights_manifest.json', 'tiny_face_detector_model-shard1'],
  },
  {
    name: 'face_landmark_68',
    files: ['face_landmark_68_model-weights_manifest.json', 'face_landmark_68_model-shard1'],
  },
  {
    name: 'face_recognition',
    files: ['face_recognition_model-weights_manifest.json', 'face_recognition_model-shard1', 'face_recognition_model-shard2'],
  },
  {
    name: 'face_expression',
    files: ['face_expression_model-weights_manifest.json', 'face_expression_model-shard1'],
  },
];

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  await writeFile(dest, Buffer.from(buffer));
}

async function main() {
  console.log('📦 Downloading face-api.js models...\n');

  // Create models directory if it doesn't exist
  if (!existsSync(MODELS_DIR)) {
    await mkdir(MODELS_DIR, { recursive: true });
    console.log(`✓ Created ${MODELS_DIR}\n`);
  }

  let totalSize = 0;

  for (const model of MODELS) {
    console.log(`Downloading ${model.name}...`);
    const startTime = Date.now();

    for (const file of model.files) {
      const url = `${MODELS_REPO_BASE}/${model.name}/${file}`;
      const dest = join(MODELS_DIR, file);

      try {
        await downloadFile(url, dest);
        const stats = await import('fs').then((fs) => fs.promises.stat(dest));
        const sizeKB = (stats.size / 1024).toFixed(1);
        totalSize += stats.size;
        console.log(`  ✓ ${file} (${sizeKB} KB)`);
      } catch (error) {
        console.error(`  ✗ Failed to download ${file}:`, error);
        throw error;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`  Done in ${elapsed}ms\n`);
  }

  const totalMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`✅ All models downloaded successfully!`);
  console.log(`📊 Total size: ${totalMB} MB`);
  console.log(`📁 Location: ${MODELS_DIR}`);
}

main().catch((error) => {
  console.error('\n❌ Download failed:', error);
  process.exit(1);
});
