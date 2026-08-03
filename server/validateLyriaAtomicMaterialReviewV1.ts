import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reportPath = join(root, 'reports/lyria-missing-stem-provider-real-demo-latest.json');
const htmlPath = join(root, 'public/review/lyria-atomic-material-gate-v1/index.html');
const audioPath = join(root, 'public/review/lyria-atomic-material-gate-v1/audio/support-bed-001.mp3');
const fail = (message: string): never => { throw new Error(`Lyria atomic material review validation failed: ${message}`); };
if (!existsSync(reportPath) || !existsSync(htmlPath) || !existsSync(audioPath)) fail('real provider report, review page, or audio is missing');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const html = readFileSync(htmlPath, 'utf8');
if (report.mockMode !== false || report.realCloudRequest !== true) fail('report is not a real Cloud request');
if (report.assertions?.onlyMissingStemRequested !== true || report.assertions?.wholeTrackReplacement !== false) fail('provider scope assertions are invalid');
if (report.output?.mimeType !== 'audio/mpeg') fail('unexpected output MIME type');
if (statSync(audioPath).size < 100_000) fail('review audio is unexpectedly small');
for (const required of ['data-field="isolated"', 'data-field="voice"', 'data-field="melody"', 'data-field="beat"', 'data-field="usable"', 'data-field="decision"', 'localStorage', 'lyria-atomic-material-gate-result-v1.json']) if (!html.includes(required)) fail(`missing review contract ${required}`);
if (/selected(?:=|\s)/.test(html)) fail('review page must not preselect a decision');
console.log('PASS: real Lyria output is isolated in a human Gate page; production promotion remains manual.');
