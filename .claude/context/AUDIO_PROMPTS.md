# Audio Prompts (Telugu)

> Load this when working on audio playback or adding new prompts.

All audio files in `public/audio/`. Format: MP3, mono, 22kHz, 64kbps (small files, clear voice). Recorded by a native Telugu speaker.

## File Inventory

| Filename | Telugu | Transliteration | When played |
|---|---|---|---|
| `welcome.mp3` | స్వాగతం | swāgataṁ | Optional ambient on idle |
| `look-at-camera.mp3` | కెమెరా వైపు చూడండి | kemerā vaipu chūḍaṇḍi | Capture screen mounts |
| `blink.mp3` | రెప్పవేయండి | reppavēyaṇḍi | Liveness: blink prompt |
| `turn-left.mp3` | ఎడమ వైపు తిరగండి | eḍama vaipu tiragaṇḍi | Liveness: turn left |
| `turn-right.mp3` | కుడి వైపు తిరగండి | kuḍi vaipu tiragaṇḍi | Liveness: turn right |
| `smile.mp3` | నవ్వండి | navvaṇḍi | Liveness: smile |
| `checkin-success.mp3` | చెక్-ఇన్ విజయవంతం | chek-in vijayavaṁtaṁ | Successful check-in |
| `checkout-success.mp3` | చెక్-అవుట్ విజయవంతం | chek-auṭ vijayavaṁtaṁ | Successful check-out |
| `try-again.mp3` | మళ్లీ ప్రయత్నించండి | mallī prayatniṁchaṇḍi | Retry needed |
| `use-pin.mp3` | మీ పిన్ నమోదు చేయండి | mī pin namōdu chēyaṇḍi | Fallback to PIN |
| `pin-success.mp3` | పిన్ నమోదు విజయవంతం | pin namōdu vijayavaṁtaṁ | PIN accepted |
| `pin-wrong.mp3` | తప్పు పిన్ | tappu pin | Wrong PIN |
| `offline.mp3` | ఆఫ్‌లైన్ మోడ్ | ǎflain mōḍ | Captured but offline |
| `error.mp3` | లోపం, సహాయం కోసం పిలవండి | lōpaṁ, sahāyaṁ kōsaṁ pilavaṇḍi | Generic error, call for help |

## Personalization

The success audio should also call out the employee's name. Two approaches:

**Approach A (Recommended for v1)**: Generic "checkin-success.mp3" plays. Name shown only visually.

**Approach B (Phase 2)**: Use Web Speech API to speak the employee's name in Telugu after the prompt. Quality depends on tablet's TTS engine. Test before committing.

```ts
const utterance = new SpeechSynthesisUtterance(employee.fullName);
utterance.lang = 'te-IN';
speechSynthesis.speak(utterance);
```

**Approach C (Phase 3)**: Pre-record name audio for each employee during onboarding (5 seconds, "Welcome Ramesh garu"). Stored in R2, fetched on success.

## Playback Logic

```ts
class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  
  async play(file: string) {
    this.stop();
    this.audio = new Audio(`/audio/${file}.mp3`);
    this.audio.preload = 'auto';
    try {
      await this.audio.play();
    } catch (e) {
      // Browsers block autoplay without user interaction
      // After first tap, audio works for the session
      console.warn('Audio playback blocked:', e);
    }
  }
  
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}
```

## Volume Considerations

- Boiler rooms are LOUD. Volume must be near max.
- Tablet built-in speaker may be insufficient → consider external small speaker via 3.5mm jack
- Test in actual boiler room conditions, not your living room
- Provide an admin slider to adjust volume per kiosk

## Recording Tips

When recording new prompts:
- Use a quiet room with minimal echo
- Speak clearly, slightly slower than natural pace
- Female voice often clearer in noisy environments
- Trim silence at start/end to keep files small
- Normalize volume across all prompts (ffmpeg `-filter:a loudnorm`)

## Generating Telugu Audio

For initial development without a recording, use:
1. **Google Translate TTS** (free, decent quality) — generate via `https://translate.google.com/?sl=te&text=...`
2. **gTTS Python library** — programmatic generation
3. **Eleven Labs** (paid) — best quality but costs money

For production, hire a native speaker for 30 minutes (₹500-1,000) to record all prompts professionally.
