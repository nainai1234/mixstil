import { readFile } from 'node:fs/promises';

const path = new URL('../docs/meditation-script-drafts-v1-2026-07-12.md', import.meta.url);
const markdown = await readFile(path, 'utf8');
const prohibited = [/治愈|治疗|保证|诊断|清除创伤|必须服从|无法醒来/i, /cure|treat|guarantee|diagnos|trauma release|must obey|cannot wake/i];
const errors: string[] = [];

if (!markdown.includes('## A. 睡前身体扫描')) errors.push('missing bedtime body scan draft');
if (!markdown.includes('## B. 夜醒回睡')) errors.push('missing return-to-sleep draft');
if (!markdown.includes('## C. 短时压力安放')) errors.push('missing stress-settling draft');
if (!markdown.includes('人声退出') || !markdown.includes('Voice exits')) errors.push('each script family must define voice exit');
const scriptRows = markdown.split('\n').filter((line) => /^\|\s*\d{2}:\d{2}\s*\|/.test(line)).join('\n');
for (const pattern of prohibited) if (pattern.test(scriptRows)) errors.push(`prohibited language matched ${pattern}`);

const pauseValues = [...markdown.matchAll(/\|\s*(\d+(?:\.\d+)?)s\s*\|/g)].map((match) => Number(match[1]));
if (pauseValues.length < 20) errors.push(`expected sentence-level pauses, found ${pauseValues.length}`);
if (pauseValues.some((value) => value < 3)) errors.push('a meditation pause is shorter than 3 seconds');
if (!markdown.includes('待专业人员')) errors.push('draft must remain blocked pending professional review');

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ passed: true, pauseCount: pauseValues.length, professionalReviewRequired: true }, null, 2));
}
