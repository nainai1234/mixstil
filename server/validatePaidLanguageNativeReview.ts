import fs from 'node:fs';
import path from 'node:path';
import { tForLocale, type TranslationKey } from '../src/lib/i18n';
import type { ResolvedLanguage } from '../src/lib/languagePreference';

type ReviewRow = {
  locale: string;
  batch: number;
  machineStatus: 'passed' | 'failed';
  nativeStatus: 'pending_native_review' | 'approved';
  reviewer: string | null;
  reviewedAt: string | null;
};

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data', 'paid-language-native-review.json'), 'utf8')) as {
  policy: string;
  locales: ReviewRow[];
};
const expected = ['de', 'fr', 'ko', 'it', 'nl', 'zh-Hant', 'tr', 'pl', 'sv', 'th', 'vi', 'ms', 'he', 'da', 'no', 'fi'];
const criticalKeys: TranslationKey[] = [
  'nav.home', 'nav.explore', 'nav.create', 'nav.sounds', 'nav.profile',
  'home.title', 'create.generatedSummary', 'create.generationProgress',
  'player.customSoundscape', 'player.supplyDecision', 'player.supplyInventoryDescription',
  'player.supplyOneMissingDescription', 'player.supplyBlockedDescription',
  'player.saveToSounds', 'player.savedToSounds', 'profile.language',
  'paywall.generation_limit.title', 'paywall.session_length.title',
  'paywall.saved_sounds.title', 'paywall.seePlus', 'paywall.maybeLater',
];
const failures: string[] = [];
const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

if (!registry.policy.includes('cannot approve')) failures.push('registry policy must keep machine and native approval separate');
if (JSON.stringify(registry.locales.map((row) => row.locale)) !== JSON.stringify(expected)) {
  failures.push('native review registry locale order or coverage is incomplete');
}

for (const row of registry.locales) {
  if (row.machineStatus !== 'passed') failures.push(`${row.locale} machine review is not passed`);
  if (row.nativeStatus === 'approved' && (!row.reviewer || !row.reviewedAt)) {
    failures.push(`${row.locale} native approval requires reviewer and reviewedAt`);
  }
  for (const key of criticalKeys) {
    const localized = tForLocale(row.locale as ResolvedLanguage, key);
    const english = tForLocale('en', key);
    if (!localized.trim()) failures.push(`${row.locale}.${key} is empty`);
    if (localized === english) failures.push(`${row.locale}.${key} falls back to English`);
    if (JSON.stringify(placeholders(localized)) !== JSON.stringify(placeholders(english))) {
      failures.push(`${row.locale}.${key} placeholder mismatch`);
    }
    if (row.locale !== 'zh-Hant' && /[\u3400-\u9fff]/u.test(localized)) {
      failures.push(`${row.locale}.${key} contains unexpected Han-script residue`);
    }
  }
}

if (failures.length) throw new Error(`Paid language native review readiness failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  machineReadyLocales: registry.locales.length,
  nativeApprovedLocales: registry.locales.filter((row) => row.nativeStatus === 'approved').length,
  pendingNativeReviewLocales: registry.locales.filter((row) => row.nativeStatus === 'pending_native_review').map((row) => row.locale),
  rtlLocales: ['ar', 'he'],
}, null, 2));
