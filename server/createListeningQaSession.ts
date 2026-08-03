import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pool, query } from './db';
import { defaultRecipes } from './contentCatalog';

type MixRow = {
  id: string;
  title: string;
  rendered_audio_url: string;
  render_status: string;
};

type QaRow = {
  rendered_audio_url: string;
  duration_seconds: number;
  peak_db: number;
  integrated_lufs: number | null;
  abnormal_silence_count: number;
  passed: boolean;
  created_at: string;
};

const catalogMixId = (recipeId: string) => `mix_catalog_${recipeId.replace(/-/g, '_')}`;

const markdownEscape = (value: string) => value.replaceAll('|', '\\|');

const currentDate = () => new Date().toISOString().slice(0, 10);

const formatNumber = (value: unknown, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '';
};

const publicFilePath = (publicUrl: string) => path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''));

const runProcessCapture = (command: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(output.trim() || `${command} exited with code ${code}`)));
});

const lastNumber = (output: string, pattern: RegExp) => {
  const matches = Array.from(output.matchAll(pattern));
  return matches.length > 0 ? Number(matches[matches.length - 1][1]) : null;
};

const countInteriorSilences = (output: string, durationSeconds: number) => {
  const starts = Array.from(output.matchAll(/silence_start:\s*([\d.]+)/g)).map((match) => Number(match[1]));
  const ends = Array.from(output.matchAll(/silence_end:\s*([\d.]+)/g)).map((match) => Number(match[1]));
  return starts.filter((start, index) => {
    const end = ends[index] ?? durationSeconds;
    return start > 2 && end < durationSeconds - 2;
  }).length;
};

const analyzeExistingRender = async (renderedAudioUrl: string) => {
  const filePath = publicFilePath(renderedAudioUrl);
  if (!existsSync(filePath)) return null;
  const probeOutput = await runProcessCapture('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const durationSeconds = Number(probeOutput.trim());
  if (!(durationSeconds > 0)) return null;
  const volumeOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-']);
  const loudnessOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const silenceOutput = await runProcessCapture('ffmpeg', ['-hide_banner', '-i', filePath, '-af', 'silencedetect=noise=-50dB:d=1', '-f', 'null', '-']);
  const peakDb = lastNumber(volumeOutput, /max_volume:\s*(-?[\d.]+) dB/g);
  const integratedLufs = lastNumber(loudnessOutput, /I:\s*(-?[\d.]+) LUFS/g);
  const abnormalSilenceCount = countInteriorSilences(silenceOutput, durationSeconds);
  return {
    rendered_audio_url: renderedAudioUrl,
    duration_seconds: durationSeconds,
    peak_db: peakDb ?? 0,
    integrated_lufs: integratedLufs,
    abnormal_silence_count: abnormalSilenceCount,
    passed: abnormalSilenceCount === 0 && (peakDb === null || peakDb <= -1),
    created_at: new Date().toISOString(),
  } satisfies QaRow;
};

const createCatalogRows = async () => {
  const rows: string[] = [];
  for (const recipe of defaultRecipes) {
    const mixId = catalogMixId(recipe.id);
    const mixResult = await query<MixRow>(
      `select id, title, rendered_audio_url, render_status
       from mixes
       where id = $1`,
      [mixId],
    );
    const qaResult = await query<QaRow>(
      `select rendered_audio_url, duration_seconds, peak_db, integrated_lufs,
              abnormal_silence_count, passed, created_at
       from render_qa_reports
       where mix_id = $1
       order by created_at desc
       limit 1`,
      [mixId],
    );
    const mix = mixResult.rows[0];
    const qa = qaResult.rows[0] ?? (mix?.rendered_audio_url ? await analyzeExistingRender(mix.rendered_audio_url) : null);
    rows.push([
      markdownEscape(recipe.id),
      markdownEscape(recipe.name),
      recipe.goal,
      recipe.scene,
      `${Math.round(recipe.durationSeconds / 60)}m`,
      mix?.id ?? mixId,
      mix?.rendered_audio_url ? `[MP3](${mix.rendered_audio_url})` : 'missing',
      qa ? (qa.passed ? 'auto-pass' : 'auto-fail') : 'missing',
      qa ? formatNumber(qa.duration_seconds, 3) : '',
      qa ? formatNumber(qa.peak_db, 1) : '',
      qa ? String(qa.abnormal_silence_count) : '',
      '',
      '',
      '',
      '',
      '',
      '',
      'pending',
      '',
    ].join(' | '));
  }
  return rows;
};

const createReport = async () => {
  const catalogRows = await createCatalogRows();
  const generatedAt = new Date().toISOString();
  const content = `# Listening QA Session

Generated: ${generatedAt}

Checklist standard: [docs/listening-qa-checklist.md](../docs/listening-qa-checklist.md)

## Session metadata

- Reviewer:
- Playback device:
- Listening environment:
- System volume:
- Notes:

## Ten standard Recipe V2 works

Fill the empty score columns with 1-5. Verdict must be one of \`pass\`, \`needs_fix\`, or \`reject\`.

| Recipe ID | Name | Goal | Scene | Duration | Mix ID | Render | Auto QA | Render seconds | Peak dB | Silence count | Scene fit | Balance | Loop smoothness | Transient safety | Fatigue risk | Blocking issue? | Verdict | Notes |
| --- | --- | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
${catalogRows.map((row) => `| ${row} |`).join('\n')}

## Controlled voice preview path

Create a temporary draft through Quick Create with guided voice, generate a local TTS preview, then review it in Mixer Workbench before any production voice promotion.

| Check | Expected result | Actual | Verdict | Notes |
| --- | --- | --- | --- | --- |
| Voice script source | Approved script block or safe whitelisted edit |  | pending |  |
| Voice preview status | Stem remains \`needs_review\` before review |  | pending |  |
| Export check before QA | Blocked by QA/rights/commercial/derivative gates |  | pending |  |
| Live Mix label | Voice lane shows real preview stem name, not Unknown Stem |  | pending |  |
| Default pacing | Comfortable and intelligible |  | pending |  |
| Slower edit | \`人声更慢\` sets playbackRate 0.9 and increases visible duration |  | pending |  |
| Ducking comfort | Background lowers naturally under voice and recovers smoothly |  | pending |  |
| Voice QA approval | Only complete script/pronunciation/rights/commercial/derivative approval allows export |  | pending |  |

## Follow-up issues

| Priority | Area | Issue | Evidence | Owner | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
`;

  const outputPath = path.join(process.cwd(), 'reports', `listening-qa-session-${currentDate()}.md`);
  await writeFile(outputPath, content, 'utf8');
  console.log(outputPath);
};

createReport()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
