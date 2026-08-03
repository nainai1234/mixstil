import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateLyriaMusic } from './lyriaProvider';
import { ExportStorage, getStorageConfig } from './storage';

const decision = {
  projectId: 'provider-demo',
  recipeId: 'sleep-soft-bed-v1',
  missingStem: {
    id: 'support-bed-001',
    role: 'music.support_bed',
    reason: 'The approved MusicKit has a harmony stem and melody stem but lacks a compatible low-motion support bed.',
  },
  prompt: 'Generate only one missing music stem, not a complete song: a quiet warm support bed for a sleep soundscape. Sustained soft felt-piano tone and low-mid warmth, very low energy, sparse and loopable, with no lead melody, no drums, no beat, no pulse, no vocals, no voice, no climax, no bright attacks, and no large reverb. It must sit underneath an existing approved harmony stem without competing for attention.',
};

const run = async () => {
  const generation = await generateLyriaMusic({
    prompt: decision.prompt,
    projectId: process.env.GOOGLE_LYRIA_PROJECT_ID || 'project-a8dea3a9-cd9d-40dd-867',
  });

  try {
    const storage = new ExportStorage(getStorageConfig(process.env, process.cwd()));
    const extension = path.extname(generation.outputPath) || '.audio';
    const outputKey = `${decision.projectId}/lyria-missing-stem/${decision.missingStem.id}-${Date.now()}${extension}`;
    const stored = await storage.putFile(outputKey, generation.outputPath, generation.mimeType);
    const report = {
      passed: true,
      demo: 'lyria-missing-stem-provider-real',
      mockMode: false,
      realCloudRequest: true,
      provider: generation.provider,
      model: generation.model,
      generationDecision: decision,
      output: {
        stemId: decision.missingStem.id,
        stemRole: decision.missingStem.role,
        mimeType: generation.mimeType,
        bytes: stored.bytes,
        outputKey: stored.key,
        audioUrl: stored.url,
      },
      assertions: {
        onlyMissingStemRequested: true,
        wholeTrackReplacement: false,
        responseAudioExtracted: true,
        storedThroughExportStorage: true,
      },
    };
    const reportsDirectory = path.join(process.cwd(), 'reports');
    await mkdir(reportsDirectory, { recursive: true });
    const reportPath = path.join(reportsDirectory, 'lyria-missing-stem-provider-real-demo-latest.json');
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await rm(generation.temporaryDirectory, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
