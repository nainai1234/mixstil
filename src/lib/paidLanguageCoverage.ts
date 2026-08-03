import { SUPPORTED_LOCALES, type ResolvedLanguage } from './languagePreference';

export type PaidCoverageLocale =
  | ResolvedLanguage;

export type PaidCoverageLanguageStatus =
  | 'active_full_ui'
  | 'planned_full_ui'
  | 'planned_regional_variant';

export type PaidCoverageLanguage = {
  locale: PaidCoverageLocale;
  nativeLabel: string;
  englishLabel: string;
  priorityRank: number;
  batch: 'active-core' | 'paid-coverage-1' | 'paid-coverage-2' | 'paid-coverage-3';
  status: PaidCoverageLanguageStatus;
  paidCoverageRationale: string;
  releaseGate: string;
};

const activeCoreLanguages: PaidCoverageLanguage[] = [
  { locale: 'zh', nativeLabel: '简体中文', englishLabel: 'Simplified Chinese', priorityRank: 1, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large existing internet and payment market, plus Chinese-speaking diaspora.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'en', nativeLabel: 'English', englishLabel: 'English', priorityRank: 2, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Highest digital subscription ARPU and global fallback language.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'hi', nativeLabel: 'हिन्दी', englishLabel: 'Hindi', priorityRank: 3, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large mobile internet reach in a growing subscription market.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'es', nativeLabel: 'Español', englishLabel: 'Spanish', priorityRank: 4, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large paid opportunity across the US, Spain, and Latin America.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic', priorityRank: 5, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Covers high-income Gulf markets plus broad regional reach.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'bn', nativeLabel: 'বাংলা', englishLabel: 'Bengali', priorityRank: 6, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large internet population and long-run mobile growth.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'pt', nativeLabel: 'Português', englishLabel: 'Portuguese', priorityRank: 7, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Brazil plus Portugal and diaspora coverage.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'ru', nativeLabel: 'Русский', englishLabel: 'Russian', priorityRank: 8, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large internet language with cross-border reach.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'ja', nativeLabel: '日本語', englishLabel: 'Japanese', priorityRank: 9, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'High mobile subscription spending and mature wellness category.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'id', nativeLabel: 'Bahasa Indonesia', englishLabel: 'Indonesian', priorityRank: 10, batch: 'active-core', status: 'active_full_ui', paidCoverageRationale: 'Large mobile-first market with growing paid app behavior.', releaseGate: 'Already active in Profile language selector.' },
  { locale: 'de', nativeLabel: 'Deutsch', englishLabel: 'German', priorityRank: 11, batch: 'paid-coverage-1', status: 'active_full_ui', paidCoverageRationale: 'Germany, Austria, and Switzerland add high-ARPU subscription coverage.', releaseGate: 'Activated after consumer shell, Create, Player, My Sounds, Profile, Explore, support, privacy, credits, share pages, and Plus waiting page localization.' },
  { locale: 'fr', nativeLabel: 'Français', englishLabel: 'French', priorityRank: 12, batch: 'paid-coverage-1', status: 'active_full_ui', paidCoverageRationale: 'France, Canada, Belgium, Switzerland, and long-run francophone reach.', releaseGate: 'Activated after full consumer UI and lifecycle copy localization.' },
  { locale: 'ko', nativeLabel: '한국어', englishLabel: 'Korean', priorityRank: 13, batch: 'paid-coverage-1', status: 'active_full_ui', paidCoverageRationale: 'South Korea is a high mobile-spend, high-subscription market.', releaseGate: 'Activated after full consumer UI localization; App Store and Play Store listing copy remain a later store-release task.' },
  { locale: 'it', nativeLabel: 'Italiano', englishLabel: 'Italian', priorityRank: 14, batch: 'paid-coverage-1', status: 'active_full_ui', paidCoverageRationale: 'Italy adds mature Western European subscription coverage.', releaseGate: 'Activated after full consumer UI, support, and privacy copy localization.' },
  { locale: 'nl', nativeLabel: 'Nederlands', englishLabel: 'Dutch', priorityRank: 15, batch: 'paid-coverage-1', status: 'active_full_ui', paidCoverageRationale: 'Netherlands and Belgium add small but high-payment-density coverage.', releaseGate: 'Activated after full consumer UI and paywall boundary copy localization.' },
  { locale: 'zh-Hant', nativeLabel: '繁體中文', englishLabel: 'Traditional Chinese', priorityRank: 16, batch: 'paid-coverage-2', status: 'active_full_ui', paidCoverageRationale: 'Taiwan and Hong Kong are high-value paid markets and should not be treated as Simplified Chinese only.', releaseGate: 'Activated for consumer UI, Profile selector, and zh-TW/zh-HK/zh-MO system-language mapping.' },
  { locale: 'tr', nativeLabel: 'Türkçe', englishLabel: 'Turkish', priorityRank: 17, batch: 'paid-coverage-2', status: 'active_full_ui', paidCoverageRationale: 'Large mobile internet population with meaningful subscription potential.', releaseGate: 'Activated after consumer UI localization and Plus boundary copy.' },
  { locale: 'pl', nativeLabel: 'Polski', englishLabel: 'Polish', priorityRank: 18, batch: 'paid-coverage-2', status: 'active_full_ui', paidCoverageRationale: 'Poland is a strong Central/Eastern European paid app market.', releaseGate: 'Activated after consumer UI localization.' },
  { locale: 'sv', nativeLabel: 'Svenska', englishLabel: 'Swedish', priorityRank: 19, batch: 'paid-coverage-2', status: 'active_full_ui', paidCoverageRationale: 'Nordic ARPU and subscription behavior are strong; Swedish is the first Nordic entry.', releaseGate: 'Activated after consumer UI localization and Nordic copy boundary.' },
  { locale: 'th', nativeLabel: 'ไทย', englishLabel: 'Thai', priorityRank: 20, batch: 'paid-coverage-2', status: 'active_full_ui', paidCoverageRationale: 'Thailand combines mature mobile behavior, digital payments, and wellness demand.', releaseGate: 'Activated after consumer UI localization and Thai text-fit boundary.' },
  { locale: 'vi', nativeLabel: 'Tiếng Việt', englishLabel: 'Vietnamese', priorityRank: 21, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Vietnam is a large, young, mobile-first growth market.', releaseGate: 'Activated after consumer UI localization and mobile text-fit boundary.' },
  { locale: 'ms', nativeLabel: 'Bahasa Melayu', englishLabel: 'Malay', priorityRank: 22, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Malaysia adds Southeast Asian paid coverage beyond English and Chinese.', releaseGate: 'Activated after consumer UI localization.' },
  { locale: 'he', nativeLabel: 'עברית', englishLabel: 'Hebrew', priorityRank: 23, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Israel is small but high-ARPU and technologically receptive.', releaseGate: 'Activated after consumer UI localization; full RTL visual QA remains a physical-device release gate.' },
  { locale: 'da', nativeLabel: 'Dansk', englishLabel: 'Danish', priorityRank: 24, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Completes more Nordic high-ARPU coverage after Swedish.', releaseGate: 'Activated after consumer UI localization.' },
  { locale: 'no', nativeLabel: 'Norsk', englishLabel: 'Norwegian', priorityRank: 25, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Adds Norway as a high-ARPU subscription market.', releaseGate: 'Activated after consumer UI localization and nb/nn system-language mapping.' },
  { locale: 'fi', nativeLabel: 'Suomi', englishLabel: 'Finnish', priorityRank: 26, batch: 'paid-coverage-3', status: 'active_full_ui', paidCoverageRationale: 'Adds Finland as part of high-ARPU Nordic completion.', releaseGate: 'Activated after consumer UI localization.' },
];

export const PAID_LANGUAGE_COVERAGE_ROADMAP: PaidCoverageLanguage[] = [
  ...activeCoreLanguages,
];

export const PAID_LANGUAGE_COVERAGE_TARGET = {
  targetPaidCoveragePercent: 90,
  metric: 'estimated addressable paid internet and app-subscription audience, not raw speaker population',
  activeLocales: [...SUPPORTED_LOCALES],
  nextBatchLocales: PAID_LANGUAGE_COVERAGE_ROADMAP
    .filter((language) => language.status !== 'active_full_ui')
    .map((language) => language.locale),
  releasePolicy: 'Do not expose a locale in Profile until all critical consumer surfaces are localized and validated.',
} as const;

export const plannedPaidCoverageLocales = PAID_LANGUAGE_COVERAGE_ROADMAP
  .filter((language) => language.status !== 'active_full_ui')
  .map((language) => language.locale);
