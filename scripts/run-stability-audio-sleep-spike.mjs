#!/usr/bin/env node
/**
 * Stability Audio sleep/calm/focus candidate spike.
 *
 * This is an isolated background-content experiment, not a product runtime path.
 * It requires a Stability API key and keeps all outputs in experiments/.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = process.env.STABILITY_AUDIO_OUTPUT_DIR
  || path.join(ROOT, 'experiments/audio-model-lab/outputs/stability-audio-sleep-spike-001');
const ENDPOINT = process.env.STABILITY_AUDIO_ENDPOINT
  || 'https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio';
const API_KEY = process.env.STABILITY_API_KEY || process.env.STABILITY_AUDIO_API_KEY || '';

const PROMPTS = [
  {
    id: 'sleep_dry_electric_piano_no_motion_001',
    goal: 'sleep',
    duration: 30,
    prompt:
      'minimal instrumental sleep background, 48 BPM, C major, 4/4, very low energy, soft low electric piano, faint warm support tone, sparse notes with long gaps, flat harmony, no melodic lead, dry tight production, close mic, short room only, controlled top end, no song structure, no chorus, no build, no drop, no climax, no vocals, no spoken voice, no fake voice, no choir, no humming, no chanting, no drums, no beat, no percussion, no pulse, no arpeggio, no strong tune, no emotional lift, no large reverb, no ambient wash',
    negative_prompt:
      'rock, guitar riff, drums, beat, percussion, bass groove, cinematic trailer, epic, intense, energetic, uplifting, pop song, jazz lounge, chillhop, arpeggio, strong melody, vocal, choir, chanting, humming, spoken word, horror, suspense, noisy, chaotic, busy, distorted',
  },
  {
    id: 'sleep_warm_pad_sparse_keys_002',
    goal: 'sleep',
    duration: 30,
    prompt:
      'deeply calm sleep music bed, very sparse soft electric piano, warm low support pad, extremely slow harmonic movement, long silent gaps, gentle rounded attacks, no rhythm, no pulse, no drums, no vocals, no lead melody, no build, no emotional lift, quiet bedtime background, restful and still',
    negative_prompt:
      'rock, pop, lounge, jazz, beat, drums, percussion, pulse, arpeggio, busy notes, fast movement, climax, chorus, vocals, choir, human voice, cinematic tension, distortion, bright high end, aggressive, energetic',
  },
  {
    id: 'calm_still_meditation_room_003',
    goal: 'calm',
    duration: 30,
    prompt:
      'still meditation background, quiet warm room tone, sparse soft piano-like notes, very low density, no forward motion, no percussion, no beat, no song structure, no chorus, no hook, no vocals, close and intimate, controlled high frequencies, soft low-mid warmth, peaceful and grounded',
    negative_prompt:
      'rock, guitars, band, drums, rhythm, pulse, energetic, dramatic, trailer, club, lounge, jazz solo, pop, rap, vocals, choir, chanting, humming, strong tune, complex harmony, busy arrangement, noisy texture',
  },
];

function cliArg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function safeError(error) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}

async function writeManifest(manifest) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

async function main() {
  const limit = Number(cliArg('limit', process.env.STABILITY_AUDIO_LIMIT || PROMPTS.length));
  const outputFormat = cliArg('format', process.env.STABILITY_AUDIO_FORMAT || 'mp3');
  const selected = PROMPTS.slice(0, Number.isFinite(limit) && limit > 0 ? limit : PROMPTS.length);

  const manifest = {
    createdAt: new Date().toISOString(),
    provider: 'stability-ai',
    endpoint: ENDPOINT,
    modelRoute: 'stable-audio-2-text-to-audio',
    outputDir: OUTPUT_DIR,
    outputFormat,
    status: 'pending',
    licenseBoundary:
      'Outputs are candidates only. Confirm Stability account plan, API terms, commercial-use rights, and redistribution rights before promotion.',
    candidates: [],
  };

  if (!API_KEY) {
    manifest.status = 'blocked';
    manifest.blockedReason =
      'Missing STABILITY_API_KEY or STABILITY_AUDIO_API_KEY. No request was sent.';
    const manifestPath = await writeManifest(manifest);
    console.error(`Blocked: ${manifest.blockedReason}`);
    console.error(`Wrote ${manifestPath}`);
    process.exitCode = 2;
    return;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const item of selected) {
    const form = new FormData();
    form.set('prompt', item.prompt);
    form.set('negative_prompt', item.negative_prompt);
    form.set('duration', String(item.duration));
    form.set('output_format', outputFormat);

    const outputFile = path.join(OUTPUT_DIR, `${item.id}.${outputFormat}`);
    const candidate = {
      ...item,
      outputFile,
      status: 'pending',
    };
    manifest.candidates.push(candidate);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: 'audio/*',
        },
        body: form,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 1200)}`);
      }
      if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
        const text = await response.text();
        throw new Error(`Expected audio response, got ${contentType}: ${text.slice(0, 1200)}`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputFile, data);
      candidate.status = 'generated';
      candidate.bytes = data.length;
      console.log(`Generated ${outputFile}`);
    } catch (error) {
      candidate.status = 'failed';
      candidate.error = safeError(error);
      console.error(`Failed ${item.id}: ${candidate.error.message}`);
    }
  }

  manifest.status = manifest.candidates.some((c) => c.status === 'generated')
    ? 'generated'
    : 'failed';
  const manifestPath = await writeManifest(manifest);
  console.log(`Wrote ${manifestPath}`);
}

main().catch(async (error) => {
  const manifest = {
    createdAt: new Date().toISOString(),
    provider: 'stability-ai',
    endpoint: ENDPOINT,
    status: 'failed',
    error: safeError(error),
  };
  const manifestPath = await writeManifest(manifest);
  console.error(`Fatal: ${manifest.error.message}`);
  console.error(`Wrote ${manifestPath}`);
  process.exitCode = 1;
});
