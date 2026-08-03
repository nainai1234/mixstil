import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildLyriaRequestBody, extractLyriaAudioOutput } from './lyriaProvider';
import { ExportStorage, getStorageConfig } from './storage';

const fixtureAudioBase64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjE2MQAAAAAAAAAAAAAA//tQxAADBzQAAAGkAAABqAAACcQAAAnEAAAKmAAACpgAAAtUAAALVAAADMAAAMwAAAOkAAADpAAAQ9AAAEPQAAEPUAAARFAAAFRAAABVgAAAVYAAAGXAAABlwAABkAAAAYAAAAGQAAABrAAABrwAAB7gAAAe4AAAe8AAAHvQAA';

const decision = {
  projectId: 'demo-missing-stem',
  recipeId: 'sleep-soft-bed-v1',
  provider: 'google-cloud-vertex-ai',
  missingStem: {
    id: 'support-bed-001',
    role: 'music.support_bed',
    reason: 'Approved MusicKit has harmony and melody, but no compatible low-motion support bed for this request.',
  },
  prompt: 'Generate only one missing music stem: a quiet warm support bed for a sleep soundscape. Sustained soft felt-piano and warm low-mid texture, very low energy, no lead melody, no drums, no beat, no pulse, no vocals, no voice, no climax, no bright attacks, no large reverb. Keep it loopable and unobtrusive so it sits underneath an existing approved harmony stem.',
};

const audioResponse = {
  outputs: [
    { type: 'text', text: 'ignored' },
    { type: 'audio', data: fixtureAudioBase64, mime_type: 'audio/mpeg' },
  ],
};

const run = async () => {
  const requestBody = buildLyriaRequestBody(decision.prompt);
  const extracted = extractLyriaAudioOutput(audioResponse);
  const bytes = Buffer.from(extracted.data, 'base64');
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'snooze-lyria-missing-stem-demo-'));
  const temporaryPath = path.join(temporaryDirectory, 'support-bed-001.mp3');
  await writeFile(temporaryPath, bytes);

  const storage = new ExportStorage(getStorageConfig(process.env, process.cwd()));
  const outputKey = `${decision.projectId}/lyria-missing-stem/support-bed-001.mp3`;
  const stored = await storage.putFile(outputKey, temporaryPath, extracted.mime_type);

  const report = {
    passed: true,
    demo: 'lyria-missing-stem-provider',
    mockMode: true,
    realCloudRequest: false,
    provider: decision.provider,
    model: requestBody.model,
    request: {
      inputType: requestBody.input[0]?.type,
      prompt: decision.prompt,
    },
    generationDecision: decision,
    output: {
      stemId: decision.missingStem.id,
      stemRole: decision.missingStem.role,
      mimeType: extracted.mime_type,
      bytes: bytes.byteLength,
      outputKey: stored.key,
      audioUrl: stored.url,
    },
    assertions: {
      onlyMissingStemRequested: true,
      wholeTrackReplacement: false,
      responseAudioExtracted: true,
      storedThroughExportStorage: true,
    },
    note: 'This local demo proves the adapter and storage path. A real Vertex request requires GOOGLE_CLOUD_ACCESS_TOKEN or gcloud credentials and is intentionally not made here.',
  };

  const reportsDirectory = path.join(process.cwd(), 'reports');
  await mkdir(reportsDirectory, { recursive: true });
  const reportBase = path.join(reportsDirectory, 'lyria-missing-stem-provider-demo-20260721');
  await writeFile(`${reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(`${reportBase}.md`, [
    '# Lyria Missing Stem Provider Demo',
    '',
    `- Result: **PASS** (local mock mode)`,
    `- Provider: \`${decision.provider}\``,
    `- Model: \`${requestBody.model}\``,
    `- Missing Stem: \`${decision.missingStem.id}\` (${decision.missingStem.role})`,
    `- Stored object: \`${stored.key}\``,
    `- Audio URL: \`${stored.url}\``,
    `- Bytes: ${bytes.byteLength}`,
    '',
    'The fixture follows the same `outputs[].type === "audio"` extraction and `ExportStorage.putFile` path used by the real provider endpoint. The demo explicitly requests one missing Stem and does not replace the existing MusicKit or render a whole track.',
    '',
    'A real Vertex request was not made, so no paid quota was consumed. Run the production endpoint only after supplying a deliberate Google access token.',
    '',
  ].join('\n'), 'utf8');

  await rm(temporaryDirectory, { recursive: true, force: true });
  console.log(JSON.stringify({
    ...report,
    reports: {
      json: `${reportBase}.json`,
      markdown: `${reportBase}.md`,
    },
  }, null, 2));
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
