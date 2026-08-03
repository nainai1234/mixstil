import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GoogleAuth } from 'google-auth-library';

export type LyriaRequest = {
  prompt: string;
  model?: string;
  projectId?: string;
  location?: string;
  endpoint?: string;
  accessToken?: string;
};

export type LyriaAudioOutput = {
  type: 'audio';
  data: string;
  mime_type: string;
};

export type LyriaGenerationResult = {
  provider: 'google-cloud-vertex-ai';
  product: 'lyria-music-generation';
  projectId: string;
  location: string;
  model: string;
  endpoint: string;
  prompt: string;
  mimeType: string;
  outputPath: string;
  temporaryDirectory: string;
  bytes: number;
};

const DEFAULT_PROJECT_ID = 'project-a8dea3a9-cd9d-40dd-867';
const DEFAULT_LOCATION = 'global';
const DEFAULT_MODEL = 'lyria-3-clip-preview';
const endpointFor = (projectId: string, location: string) =>
  `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/interactions`;

const run = (command: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `${command} exited with code ${code}`)));
});

const getAccessToken = async (overrideToken?: string) => {
  const explicit = overrideToken ?? process.env.GOOGLE_CLOUD_ACCESS_TOKEN ?? process.env.GOOGLE_APPLICATION_CREDENTIALS_TOKEN ?? '';
  if (explicit.trim()) return explicit.trim();

  // In production GOOGLE_APPLICATION_CREDENTIALS points at a private Service
  // Account key. GoogleAuth exchanges it for a short-lived OAuth token.
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (token.token?.trim()) return token.token.trim();
  } catch {
    // Developer machines can still use gcloud ADC if no service account file is mounted.
  }

  try {
    return await run('gcloud', ['auth', 'application-default', 'print-access-token']);
  } catch {
    try {
      return await run('gcloud', ['auth', 'print-access-token']);
    } catch {
      throw new Error('Could not acquire a Google access token. Set GOOGLE_APPLICATION_CREDENTIALS to a Service Account JSON key in the server environment, or provide GOOGLE_CLOUD_ACCESS_TOKEN for a short-lived override.');
    }
  }
};

const mimeToExtension = (mimeType: string) => {
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/mp3') return 'mp3';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  if (mimeType === 'audio/ogg') return 'ogg';
  return 'bin';
};

export const buildLyriaRequestBody = (prompt: string, model = DEFAULT_MODEL) => ({
  model,
  input: [
    {
      type: 'text',
      text: prompt,
    },
  ],
});

export const extractLyriaAudioOutput = (responseBody: any): LyriaAudioOutput => {
  const outputs = Array.isArray(responseBody?.outputs) ? responseBody.outputs : [];
  const audio = outputs.find((item: any) => item?.type === 'audio') as Partial<LyriaAudioOutput> | undefined;
  if (!audio?.data || !audio?.mime_type) {
    throw new Error('Lyria response did not contain an audio output.');
  }
  return {
    type: 'audio',
    data: String(audio.data),
    mime_type: String(audio.mime_type),
  };
};

export const generateLyriaMusic = async (request: LyriaRequest): Promise<LyriaGenerationResult> => {
  const prompt = String(request.prompt ?? '').trim();
  if (!prompt) throw new Error('Lyria prompt is required.');

  const projectId = request.projectId ?? process.env.GOOGLE_LYRIA_PROJECT_ID ?? DEFAULT_PROJECT_ID;
  const location = request.location ?? process.env.GOOGLE_LYRIA_LOCATION ?? DEFAULT_LOCATION;
  const model = request.model ?? process.env.GOOGLE_LYRIA_MODEL ?? DEFAULT_MODEL;
  const endpoint = request.endpoint ?? process.env.GOOGLE_LYRIA_ENDPOINT ?? endpointFor(projectId, location);
  const accessToken = await getAccessToken(request.accessToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(buildLyriaRequestBody(prompt, model)),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Lyria request failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }

  const body = await response.json();
  const audio = extractLyriaAudioOutput(body);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'snooze-lyria-'));
  const extension = mimeToExtension(audio.mime_type);
  const outputPath = path.join(temporaryDirectory, `lyria-${Date.now()}.${extension}`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(audio.data, 'base64'));

  return {
    provider: 'google-cloud-vertex-ai',
    product: 'lyria-music-generation',
    projectId,
    location,
    model,
    endpoint,
    prompt,
    mimeType: audio.mime_type,
    outputPath,
    temporaryDirectory,
    bytes: Buffer.byteLength(Buffer.from(audio.data, 'base64')),
  };
};
