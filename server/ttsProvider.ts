import { spawn } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type TtsRequest = { text: string; language: 'en' | 'zh'; voice?: string; outputDir: string; outputId: string };
export type TtsResult = {
  provider: 'macos-say-preview' | 'edge-tts' | 'openai' | 'elevenlabs';
  model: string;
  voice: string;
  outputPath: string;
  costUsd: number;
  commercialUseAllowed: boolean;
  licenseName: string;
  voiceCues?: Array<{ text: string; startTime: number; speechDuration: number; pauseAfterSeconds: number }>;
};

const run = (command: string, args: string[]) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} exited with code ${code}`)));
});

const capture = (command: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `${command} exited with code ${code}`)));
});

export const generateTtsPreview = async (request: TtsRequest): Promise<TtsResult> => {
  await mkdir(request.outputDir, { recursive: true });
  const voice = request.voice ?? (request.language === 'zh' ? 'Tingting' : 'Samantha');
  const aiffPath = path.join(request.outputDir, `${request.outputId}.aiff`);
  const outputPath = path.join(request.outputDir, `${request.outputId}.mp3`);
  try {
    await run('/usr/bin/say', ['-v', voice, '-r', request.language === 'zh' ? '145' : '135', '-o', aiffPath, request.text]);
    await run('ffmpeg', ['-y', '-i', aiffPath, '-af', 'highpass=f=70,lowpass=f=11000,loudnorm=I=-28:TP=-6:LRA=8', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', outputPath]);
  } finally {
    await unlink(aiffPath).catch(() => undefined);
  }
  return {
    provider: 'macos-say-preview', model: 'macOS system voice', voice, outputPath, costUsd: 0,
    commercialUseAllowed: false, licenseName: 'Local Preview Only - Rights Review Required',
  };
};

const configuredCommercialUse = () => process.env.TTS_COMMERCIAL_USE_CONFIRMED === 'true';
const outputPathFor = (request: TtsRequest) => path.join(request.outputDir, `${request.outputId}.mp3`);

const generateEdgeTtsPreview = async (request: TtsRequest): Promise<TtsResult> => {
  await mkdir(request.outputDir, { recursive: true });
  const outputPath = outputPathFor(request);
  const rawPath = path.join(request.outputDir, `${request.outputId}.edge.mp3`);
  const concatPath = path.join(request.outputDir, `${request.outputId}.concat.txt`);
  const silencePath = path.join(request.outputDir, `${request.outputId}.silence.mp3`);
  const voice = request.voice ?? (request.language === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-AvaMultilingualNeural');
  const sentencePaths: string[] = [];
  const voiceCues: NonNullable<TtsResult['voiceCues']> = [];
  try {
    // Meditation preview speech needs deliberate space between phrases; keep this
    // conservative default overridable for provider experiments without changing
    // the recipe or the voice script itself.
    const rate = process.env.TTS_RATE ?? '-45%';
    const sentences = request.text.split(/(?<=[。！？.!?])\s*/u).map((part) => part.trim()).filter(Boolean);
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', request.language === 'zh' ? '4.5' : '4', '-codec:a', 'libmp3lame', '-b:a', '128k', silencePath]);
    for (const [index, sentence] of sentences.entries()) {
      const sentencePath = path.join(request.outputDir, `${request.outputId}.sentence-${index}.mp3`);
      sentencePaths.push(sentencePath);
      await run('python3', ['-m', 'edge_tts', '-t', sentence, '-v', voice, `--rate=${rate}`, '--pitch=+0Hz', '--write-media', sentencePath]);
      const speechDuration = Number(await capture('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', sentencePath]));
      const pauseAfterSeconds = index < sentences.length - 1 ? (request.language === 'zh' ? 7 : 6) : 0;
      const previous = voiceCues.at(-1);
      const startTime = previous ? previous.startTime + previous.speechDuration + previous.pauseAfterSeconds : 0;
      voiceCues.push({ text: sentence, startTime, speechDuration, pauseAfterSeconds });
    }
    const concatEntries = sentencePaths.flatMap((sentencePath, index) => [
      `file '${sentencePath.replaceAll("'", "'\\''")}'`,
      ...(index < sentencePaths.length - 1 ? [`file '${silencePath.replaceAll("'", "'\\''")}'`] : []),
    ]);
    await writeFile(concatPath, `${concatEntries.join('\n')}\n`, 'utf8');
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', rawPath]);
    // Keep the neural voice timbre intact. Only normalize delivery level; do not
    // apply broad EQ or pitch shaping that can make speech sound artificial.
    await run('ffmpeg', ['-y', '-i', rawPath, '-af', 'loudnorm=I=-28:TP=-6:LRA=8', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', outputPath]);
  } finally {
    await Promise.all([rawPath, concatPath, silencePath, ...sentencePaths].map((file) => unlink(file).catch(() => undefined)));
  }
  return {
    provider: 'edge-tts', model: 'Microsoft Edge Neural Voice', voice, outputPath, costUsd: 0,
    commercialUseAllowed: false, licenseName: 'Internal Preview Only - Commercial Rights Not Confirmed', voiceCues,
  };
};

const generateOpenAiSpeech = async (request: TtsRequest): Promise<TtsResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('TTS_PROVIDER=openai requires OPENAI_API_KEY.');
  const response = await fetch(`${(process.env.OPENAI_BASE_URL ?? 'https://api.openai.com').replace(/\/$/, '')}/v1/audio/speech`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
      voice: request.voice ?? (request.language === 'zh' ? 'alloy' : 'alloy'),
      input: request.text,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) throw new Error(`OpenAI TTS failed (${response.status}).`);
  const outputPath = outputPathFor(request);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  return {
    provider: 'openai', model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
    voice: request.voice ?? 'alloy', outputPath, costUsd: 0,
    commercialUseAllowed: configuredCommercialUse(),
    licenseName: configuredCommercialUse() ? 'OpenAI API Terms - Commercial Use Confirmed' : 'OpenAI API Terms - Rights Confirmation Required',
  };
};

const generateElevenLabsSpeech = async (request: TtsRequest): Promise<TtsResult> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = request.voice ?? process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error('TTS_PROVIDER=elevenlabs requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: request.text, model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2' }),
  });
  if (!response.ok) throw new Error(`ElevenLabs TTS failed (${response.status}).`);
  const outputPath = outputPathFor(request);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  return {
    provider: 'elevenlabs', model: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2',
    voice: voiceId, outputPath, costUsd: 0,
    commercialUseAllowed: configuredCommercialUse(),
    licenseName: configuredCommercialUse() ? 'ElevenLabs Terms - Commercial Use Confirmed' : 'ElevenLabs Terms - Rights Confirmation Required',
  };
};

export const generateTts = async (request: TtsRequest): Promise<TtsResult> => {
  const provider = (process.env.TTS_PROVIDER ?? 'edge-tts').toLowerCase();
  if (provider === 'openai') return generateOpenAiSpeech(request);
  if (provider === 'elevenlabs') return generateElevenLabsSpeech(request);
  if (provider === 'edge-tts') return generateEdgeTtsPreview(request);
  return generateTtsPreview(request);
};
