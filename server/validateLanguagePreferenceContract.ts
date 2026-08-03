import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const preference = fs.readFileSync(path.join(root, 'src/lib/languagePreference.ts'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'src/lib/i18n.ts'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'src/pages/ProfilePage.tsx'), 'utf8');
const create = fs.readFileSync(path.join(root, 'src/pages/AIHealPage.tsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/pages/ConsumerHome.tsx'), 'utf8');
const explore = fs.readFileSync(path.join(root, 'src/pages/DiscoverPage.tsx'), 'utf8');
const sounds = fs.readFileSync(path.join(root, 'src/pages/StudioPage.tsx'), 'utf8');
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'src/components/BottomNav.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const domain = fs.readFileSync(path.join(root, 'src/lib/domain.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const recipe = fs.readFileSync(path.join(root, 'server/recipeV2.ts'), 'utf8');

const supportedLocales = ['zh', 'en', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'id', 'de', 'fr', 'ko', 'it', 'nl', 'zh-Hant', 'tr', 'pl', 'sv', 'th', 'vi', 'ms', 'he', 'da', 'no', 'fi'];
const localeUiNeedles: Record<string, string[]> = {
  zh: ['首页', '界面语言', '你今天需要什么？'],
  en: ['Home', 'Interface language', 'What do you need today?'],
  hi: ['होम', 'इंटरफ़ेस भाषा', 'आज आपको क्या चाहिए?'],
  es: ['Inicio', 'Idioma de la interfaz', '¿Qué necesitas hoy?'],
  ar: ['الرئيسية', 'لغة الواجهة', 'ماذا تحتاج اليوم؟'],
  bn: ['হোম', 'ইন্টারফেস ভাষা', 'আজ আপনার কী দরকার?'],
  pt: ['Início', 'Idioma da interface', 'Do que você precisa hoje?'],
  ru: ['Главная', 'Язык интерфейса', 'Что вам нужно сегодня?'],
  ja: ['ホーム', '表示言語', '今日はどんな音が必要ですか？'],
  id: ['Beranda', 'Bahasa antarmuka', 'Apa yang kamu butuhkan hari ini?'],
  de: ['Start', 'Oberflächensprache', 'Was brauchst du heute?'],
  fr: ['Accueil', 'Langue de l’interface', 'De quoi avez-vous besoin aujourd’hui ?'],
  ko: ['홈', '인터페이스 언어', '오늘 어떤 소리가 필요하세요?'],
  it: ['Inizio', 'Lingua dell’interfaccia', 'Di cosa hai bisogno oggi?'],
  nl: ['Start', 'Interfacetaal', 'Wat heb je vandaag nodig?'],
  'zh-Hant': ['首頁', '介面語言', '你今天需要什麼？'],
  tr: ['Ana sayfa', 'Arayüz dili', 'Bugün neye ihtiyacın var?'],
  pl: ['Start', 'Język interfejsu', 'Czego dziś potrzebujesz?'],
  sv: ['Hem', 'Gränssnittsspråk', 'Vad behöver du idag?'],
  th: ['หน้าแรก', 'ภาษาอินเทอร์เฟซ', 'วันนี้คุณต้องการอะไร?'],
  vi: ['Trang chủ', 'Ngôn ngữ giao diện', 'Hôm nay bạn cần gì?'],
  ms: ['Utama', 'Bahasa antara muka', 'Apa yang anda perlukan hari ini?'],
  he: ['בית', 'שפת ממשק', 'מה צריך היום?'],
  da: ['Hjem', 'Grænsefladesprog', 'Hvad har du brug for i dag?'],
  no: ['Hjem', 'Grensesnittspråk', 'Hva trenger du i dag?'],
  fi: ['Koti', 'Käyttöliittymän kieli', 'Mitä tarvitset tänään?'],
};

const requiredContracts = [
  [preference, 'LANGUAGE_PREFERENCE_KEY', 'language preference storage key'],
  [preference, 'SUPPORTED_LOCALES', 'supported locale registry'],
  [preference, 'LANGUAGE_OPTIONS', 'language selector options'],
  [preference, 'LANGUAGE_PREFERENCE_EVENT', 'language change event'],
  [preference, 'navigator.language', 'system language source'],
  [preference, "return 'system'", 'System fallback language'],
  [preference, 'resolveLanguagePreference', 'resolved language helper'],
  [i18n, 'const zh = {', 'Chinese base dictionary'],
  [i18n, 'overrides', 'non-Chinese dictionary overrides'],
  [i18n, 'useI18n', 'consumer i18n hook'],
  [nav, 'useI18n', 'bottom navigation localized'],
  [home, 'useI18n', 'Home localized'],
  [explore, 'useI18n', 'Explore localized'],
  [sounds, 'useI18n', 'My Sounds localized'],
  [player, 'useI18n', 'Player localized'],
  [profile, 'readLanguagePreference', 'Profile reads preference'],
  [profile, 'writeLanguagePreference', 'Profile writes manual override'],
  [profile, 'data-testid="profile-language-setting"', 'Profile exposes compact first-level language setting'],
  [profile, 'data-testid="profile-language-select"', 'Profile uses compact language dropdown'],
  [profile, 'LANGUAGE_OPTIONS.map', 'Profile dropdown renders all supported language options'],
  [create, 'readLanguagePreference()', 'Create reads language preference'],
  [create, 'resolveLanguagePreference(languagePreference)', 'Create resolves system language'],
  [create, 'languagePreference, resolvedLanguage', 'Create sends language fields'],
  [api, "languagePreference?: 'system' | 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi'", 'API quickCreate language preference type'],
  [api, "resolvedLanguage?: 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi'", 'API quickCreate resolved language type'],
  [server, 'normalizeLanguagePreference', 'server normalizes language preference'],
  [server, 'normalizeResolvedLanguage', 'server normalizes resolved language'],
  [server, 'supportedUiLanguages', 'server supports top UI languages'],
  [server, 'languagePreference,', 'server passes languagePreference into recipe'],
  [server, 'resolvedLanguage,', 'server passes resolvedLanguage into recipe'],
  [recipe, 'languagePreference?: LanguagePreference', 'Recipe V2 accepts languagePreference'],
  [recipe, 'resolvedLanguage?: ResolvedLanguage', 'Recipe V2 accepts resolvedLanguage'],
  [recipe, "languagePreference: input.languagePreference ?? 'system'", 'Recipe V2 stores languagePreference'],
  [recipe, "resolvedLanguage: input.resolvedLanguage ?? 'zh'", 'Recipe V2 stores resolvedLanguage'],
  [domain, "languagePreference?: 'system' | 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi'", 'client MixRecipe exposes languagePreference'],
  [domain, "resolvedLanguage?: 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi'", 'client MixRecipe exposes resolvedLanguage'],
] as const;

const missing: string[] = requiredContracts
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

for (const locale of supportedLocales) {
  if (!preference.includes(`'${locale}'`)) missing.push(`languagePreference supports ${locale}` as string);
  if (!server.includes(`'${locale}'`)) missing.push(`server supports ${locale}` as string);
  if (!recipe.includes(`'${locale}'`)) missing.push(`recipe supports ${locale}` as string);
  if (!api.includes(`'${locale}'`)) missing.push(`api supports ${locale}` as string);
  if (!domain.includes(`'${locale}'`)) missing.push(`domain supports ${locale}` as string);
  for (const needle of localeUiNeedles[locale] ?? []) {
    if (!i18n.includes(needle)) missing.push(`i18n has ${locale} UI phrase: ${needle}` as string);
  }
}

if (missing.length) throw new Error(`Language preference contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  supportedLocales,
  contracts: [
    'system-language-default',
    'manual-language-override',
    'top-10-ui-language-options',
    'consumer-shell-localization',
    'quick-create-language-context',
    'recipe-v2-language-metadata',
  ],
}, null, 2));
