import fs from 'node:fs';
import path from 'node:path';
import { LANGUAGE_OPTIONS, SUPPORTED_LOCALES } from '../src/lib/languagePreference';
import {
  PAID_LANGUAGE_COVERAGE_ROADMAP,
  PAID_LANGUAGE_COVERAGE_TARGET,
  plannedPaidCoverageLocales,
} from '../src/lib/paidLanguageCoverage';

const root = process.cwd();
const doc = fs.readFileSync(path.join(root, 'docs/paid-language-coverage-plan-v1.md'), 'utf8');
const failures: string[] = [];

const expectedActive = ['zh', 'en', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'id', 'de', 'fr', 'ko', 'it', 'nl', 'zh-Hant', 'tr', 'pl', 'sv', 'th', 'vi', 'ms', 'he', 'da', 'no', 'fi'];
const expectedBatch1 = ['de', 'fr', 'ko', 'it', 'nl'];
const expectedBatch2 = ['zh-Hant', 'tr', 'pl', 'sv', 'th'];
const expectedBatch3 = ['vi', 'ms', 'he', 'da', 'no', 'fi'];
const expectedRoadmap = expectedActive;

const active = [...SUPPORTED_LOCALES];
if (JSON.stringify(active) !== JSON.stringify(expectedActive)) {
  failures.push(`active supported locales changed unexpectedly: ${active.join(', ')}`);
}

const selectorLocales = LANGUAGE_OPTIONS.map((language) => language.value);
if (JSON.stringify(selectorLocales) !== JSON.stringify(expectedActive)) {
  failures.push(`Profile selector should expose only active locales, found: ${selectorLocales.join(', ')}`);
}

const roadmapLocales = PAID_LANGUAGE_COVERAGE_ROADMAP.map((language) => language.locale);
if (JSON.stringify(roadmapLocales) !== JSON.stringify(expectedRoadmap)) {
  failures.push(`paid roadmap order mismatch: ${roadmapLocales.join(', ')}`);
}

const roadmapRanks = PAID_LANGUAGE_COVERAGE_ROADMAP.map((language) => language.priorityRank);
for (let index = 0; index < roadmapRanks.length; index += 1) {
  if (roadmapRanks[index] !== index + 1) failures.push(`priority rank ${roadmapRanks[index]} at index ${index} should be ${index + 1}`);
}

const batch1 = PAID_LANGUAGE_COVERAGE_TARGET.nextBatchLocales;
if (batch1.length !== 0) {
  failures.push(`all paid coverage batches should be active, found pending: ${batch1.join(', ')}`);
}

if (PAID_LANGUAGE_COVERAGE_TARGET.targetPaidCoveragePercent !== 90) {
  failures.push('paid coverage target must remain 90 percent');
}

for (const locale of plannedPaidCoverageLocales) {
  if (selectorLocales.includes(locale as any)) {
    failures.push(`${locale} is planned but should not be exposed in Profile before full localization`);
  }
}

for (const phrase of [
  'Do not implement payment',
  'Do not expose a language in Profile',
  'Do not call English fallback a completed localization',
  'de, fr, ko, it, nl',
  'zh-Hant, tr, pl, sv, th',
  'vi, ms, he, da, no, fi',
]) {
  if (!doc.includes(phrase)) failures.push(`paid language coverage doc missing: ${phrase}`);
}

for (const language of PAID_LANGUAGE_COVERAGE_ROADMAP) {
  if (!language.nativeLabel.trim()) failures.push(`${language.locale} missing native label`);
  if (!language.englishLabel.trim()) failures.push(`${language.locale} missing English label`);
  if (!language.paidCoverageRationale.trim()) failures.push(`${language.locale} missing paid coverage rationale`);
  if (!language.releaseGate.trim()) failures.push(`${language.locale} missing release gate`);
}

if (failures.length) {
  throw new Error(`Paid language coverage plan validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  targetPaidCoveragePercent: PAID_LANGUAGE_COVERAGE_TARGET.targetPaidCoveragePercent,
  activeLocales: expectedActive,
  activatedBatch1Locales: expectedBatch1,
  activatedBatch2Locales: expectedBatch2,
  activatedBatch3Locales: expectedBatch3,
  nextBatchLocales: [],
  plannedLocales: plannedPaidCoverageLocales,
  releasePolicy: PAID_LANGUAGE_COVERAGE_TARGET.releasePolicy,
}, null, 2));
