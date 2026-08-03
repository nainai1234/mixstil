import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LOCALES, type ResolvedLanguage } from '../src/lib/languagePreference';
import { tForLocale, type TranslationKey } from '../src/lib/i18n';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const sourceFiles = [
  'src/pages/ConsumerHome.tsx',
  'src/pages/AIHealPage.tsx',
  'src/pages/PlayerPage.tsx',
  'src/pages/StudioPage.tsx',
  'src/pages/DiscoverPage.tsx',
  'src/pages/ProfilePage.tsx',
  'src/pages/OnboardingPage.tsx',
  'src/pages/AudioCreditsPage.tsx',
  'src/pages/SharedWorkPage.tsx',
  'src/pages/PublicWorkPage.tsx',
  'src/pages/BillingUpgrade.tsx',
  'src/components/BottomNav.tsx',
  'src/components/PaywallModal.tsx',
  'src/components/AudioRecipeModal.tsx',
  'src/lib/generationSupply.ts',
  'src/lib/soundGroupVolumes.ts',
].map((file) => [file, read(file)] as const);

const criticalKeys: TranslationKey[] = [
  'nav.home',
  'nav.explore',
  'nav.create',
  'nav.sounds',
  'nav.profile',
  'create.generatedSummary',
  'create.generationProgress',
  'create.whyApprovedFallback',
  'create.avoidIntro',
  'player.customSoundscape',
  'player.supplyDecision',
  'player.supplyInventoryDescription',
  'player.supplyOneMissingDescription',
  'player.supplyBlockedDescription',
  'player.saveToSounds',
  'player.savedToSounds',
  'player.group.music.title',
  'player.group.environment.title',
  'player.group.masking.title',
  'player.group.details.title',
  'player.role.environment',
  'player.role.music',
  'player.role.background',
  'paywall.generation_limit.title',
  'paywall.session_length.title',
  'paywall.saved_sounds.title',
  'paywall.community_preview.title',
  'paywall.seePlus',
  'paywall.maybeLater',
  'common.close',
];

const pageKeyContracts: Array<[string, string, string]> = [
  ['src/pages/ConsumerHome.tsx', "t('create.avoidIntro')", 'Home avoid shortcuts use localized visible prompt'],
  ['src/pages/AIHealPage.tsx', "t('create.generatedSummary')", 'Create summary aria label is localized'],
  ['src/pages/AIHealPage.tsx', "t('create.generationProgress')", 'Create progress aria label is localized'],
  ['src/pages/OnboardingPage.tsx', 'onboardingCopy as unknown as Record', 'Onboarding setup screen uses the resolved locale'],
  ['src/pages/OnboardingPage.tsx', 'copy.prompts[goal]', 'Onboarding create prompt uses localized intent copy'],
  ['src/pages/AudioCreditsPage.tsx', 'audioCreditsCopy as unknown as Record', 'Audio credits page uses the resolved locale'],
  ['src/pages/AudioCreditsPage.tsx', 'copy.releaseBody', 'Audio credits release explanation is localized'],
  ['src/pages/SharedWorkPage.tsx', 'sharedWorkCopy as unknown as Record', 'Shared listener page uses the resolved locale'],
  ['src/pages/SharedWorkPage.tsx', 'formatMinutes(durationSeconds)', 'Shared listener page formats duration through i18n'],
  ['src/pages/PublicWorkPage.tsx', 'publicWorkCopy as unknown as Record', 'Public work listener page uses the resolved locale'],
  ['src/pages/PublicWorkPage.tsx', 'formatMinutes(work.recipeData.durationSeconds)', 'Public work listener page formats duration through i18n'],
  ['src/pages/BillingUpgrade.tsx', 'billingCopy as unknown as Record', 'Plus waiting page uses the resolved locale'],
  ['src/pages/BillingUpgrade.tsx', 'copy.unavailable', 'Plus page states purchase is unavailable instead of starting payment'],
  ['src/pages/PlayerPage.tsx', "t('player.supplyDecision')", 'Player supply decision aria label is localized'],
  ['src/pages/PlayerPage.tsx', "t('player.groupVolume'", 'Player sound group volume labels are localized'],
  ['src/pages/PlayerPage.tsx', "t('player.layerVolume'", 'Player layer volume labels are localized'],
  ['src/components/PaywallModal.tsx', "t('paywall.seePlus')", 'Paywall primary action is localized'],
  ['src/components/PaywallModal.tsx', "t('paywall.maybeLater')", 'Paywall secondary action is localized'],
  ['src/components/AudioRecipeModal.tsx', "t('create.generatedSummary')", 'Recipe modal heading is localized'],
  ['src/lib/generationSupply.ts', "t('player.supplyInventoryDescription')", 'Supply inventory summary is localized'],
  ['src/lib/soundGroupVolumes.ts', "roles: ['music']", 'Sound group model no longer stores user-visible English'],
];

const forbiddenUserEnglish = [
  'You have used your free creations',
  'Generated soundscape',
  'Generated result summary',
  'Soundscape generation progress',
  'This result was arranged from approved layers',
  'Supply decision',
  'This result came from approved inventory only',
  'Help me with a soundscape',
  'Custom Soundscape',
  'It is private by default',
  'Melody and musical bed',
  'Ambient scene layer',
  'Quiet background coverage',
  'Small accents and transitions',
  'Play Soundscape',
  'Fine-tune in Mixer',
  'Content supply:',
  'No water.',
  'No rain.',
  'No wind.',
  'No voices.',
  'No birds.',
  'No music.',
  'Subscribe now',
  'Start trial',
  'Checkout',
  'Purchase Plus',
];

const failures: string[] = [];
const sampleValuesForKey = (key: TranslationKey) => {
  if (key.includes('OneMissingDescription')) return { role: 'layer' };
  return undefined;
};

for (const [file, needle, label] of pageKeyContracts) {
  const source = sourceFiles.find(([name]) => name === file)?.[1] ?? '';
  if (!source.includes(needle)) failures.push(`${label}: missing ${needle} in ${file}`);
}

for (const [file, source] of sourceFiles) {
  if (file !== 'src/components/BottomNav.tsx' && !source.includes('useI18n') && file.startsWith('src/pages/')) {
    failures.push(`${file} is a consumer page but does not use useI18n`);
  }
  for (const phrase of forbiddenUserEnglish) {
    if (source.includes(phrase)) failures.push(`${file} still contains user-visible English residue: ${phrase}`);
  }
}

for (const locale of SUPPORTED_LOCALES) {
  for (const key of criticalKeys) {
    const localized = tForLocale(locale, key, sampleValuesForKey(key)).trim();
    if (!localized) failures.push(`${locale}.${key} is empty`);
    if (localized.includes('{')) failures.push(`${locale}.${key} leaves an unreplaced placeholder in default call: ${localized}`);
  }
}

const english = (key: TranslationKey) => tForLocale('en', key, sampleValuesForKey(key));
const mustDifferFromEnglish = criticalKeys.filter((key) => ![
  'common.close',
].includes(key));

for (const locale of SUPPORTED_LOCALES.filter((item): item is Exclude<ResolvedLanguage, 'en'> => item !== 'en')) {
  for (const key of mustDifferFromEnglish) {
    if (tForLocale(locale, key, sampleValuesForKey(key)) === english(key)) {
      failures.push(`${locale}.${key} falls back to English`);
    }
  }
}

if (failures.length) {
  throw new Error(`Consumer localization contract failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  supportedLocales: SUPPORTED_LOCALES,
  checkedKeys: criticalKeys.length,
  checkedSourceFiles: sourceFiles.map(([file]) => file),
  contracts: [
    'top-10-consumer-copy',
    'localized-create-player-paywall',
    'no-consumer-english-residue-outside-i18n',
    'sound-group-labels-not-stored-in-domain-model',
  ],
}, null, 2));
