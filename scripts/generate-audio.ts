/**
 * Generate Telugu audio files for kiosk prompts using Google TTS.
 *
 * Usage: pnpm audio:generate
 *
 * Generates 14 MP3 files in public/audio/
 * These are dev-quality placeholders; production will use professionally recorded audio.
 */

import { getAudioBase64 } from 'google-tts-api';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface AudioPrompt {
  filename: string;
  telugu: string;
  description: string;
}

const PROMPTS: AudioPrompt[] = [
  { filename: 'welcome', telugu: 'స్వాగతం', description: 'Welcome' },
  { filename: 'look-at-camera', telugu: 'కెమెరా వైపు చూడండి', description: 'Look at camera' },
  { filename: 'blink', telugu: 'రెప్పవేయండి', description: 'Blink' },
  { filename: 'turn-left', telugu: 'ఎడమ వైపు తిరగండి', description: 'Turn left' },
  { filename: 'turn-right', telugu: 'కుడి వైపు తిరగండి', description: 'Turn right' },
  { filename: 'smile', telugu: 'నవ్వండి', description: 'Smile' },
  { filename: 'checkin-success', telugu: 'చెక్-ఇన్ విజయవంతం', description: 'Check-in success' },
  { filename: 'checkout-success', telugu: 'చెక్-అవుట్ విజయవంతం', description: 'Check-out success' },
  { filename: 'try-again', telugu: 'మళ్లీ ప్రయత్నించండి', description: 'Try again' },
  { filename: 'use-pin', telugu: 'మీ పిన్ నమోదు చేయండి', description: 'Enter your PIN' },
  { filename: 'pin-success', telugu: 'పిన్ నమోదు విజయవంతం', description: 'PIN success' },
  { filename: 'pin-wrong', telugu: 'తప్పు పిన్', description: 'Wrong PIN' },
  { filename: 'offline', telugu: 'ఆఫ్‌లైన్ మోడ్', description: 'Offline mode' },
  { filename: 'error', telugu: 'లోపం, సహాయం కోసం పిలవండి', description: 'Error, call for help' },
];

const OUTPUT_DIR = join(__dirname, '..', 'public', 'audio');

async function generateAudio(prompt: AudioPrompt): Promise<void> {
  console.log(`Generating ${prompt.filename}.mp3 (${prompt.description})...`);

  try {
    // Google TTS API - Telugu language code
    const base64 = await getAudioBase64(prompt.telugu, {
      lang: 'te',
      slow: false,
      host: 'https://translate.google.com',
    });

    // Decode base64 to buffer
    const buffer = Buffer.from(base64, 'base64');

    // Write to file
    const outputPath = join(OUTPUT_DIR, `${prompt.filename}.mp3`);
    writeFileSync(outputPath, buffer);

    console.log(`  ✓ ${prompt.filename}.mp3 generated`);
  } catch (error) {
    console.error(`  ✗ Failed to generate ${prompt.filename}.mp3:`, error);
    throw error;
  }
}

async function generateAll(): Promise<void> {
  console.log('Generating Telugu audio prompts for SLBBC Kiosk...\n');

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let successCount = 0;
  let failCount = 0;

  for (const prompt of PROMPTS) {
    try {
      await generateAudio(prompt);
      successCount++;
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      failCount++;
      console.error(`Failed to generate ${prompt.filename}:`, error);
    }
  }

  console.log(`\n✓ Generated ${successCount}/${PROMPTS.length} audio files`);
  if (failCount > 0) {
    console.log(`✗ Failed: ${failCount} files`);
    process.exit(1);
  }
  console.log(`\nFiles saved to: ${OUTPUT_DIR}`);
  console.log('\nNote: These are dev-quality placeholders. Replace with professional recordings for production.');
}

generateAll().catch((error) => {
  console.error('Audio generation failed:', error);
  process.exit(1);
});
