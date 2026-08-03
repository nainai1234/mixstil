import { SUPPORTED_LOCALES, type ResolvedLanguage } from '../src/lib/languagePreference';
import { tForLocale, type TranslationKey } from '../src/lib/i18n';

const sampleValues = {
  count: 3,
  duration: '15 min',
  exclusions: 'rain',
  goal: 'sleep',
  query: 'rain',
  scene: 'bedtime',
  sounds: 'rain',
  title: 'Quiet Night',
};

const mainTabKeys: TranslationKey[] = [
  'nav.home',
  'nav.explore',
  'nav.sounds',
  'nav.profile',
  'home.describe.title',
  'home.describe.subtitle',
  'home.defaults.kicker',
  'home.defaults.sleep',
  'home.defaults.calm',
  'home.defaults.focus',
  'home.upgradeTitle',
  'home.settingsProfile',
  'home.checkin.title',
  'home.checkin.subtitle',
  'home.need.sleep.tag',
  'home.need.calm.tag',
  'home.need.focus.tag',
  'home.continue.title',
  'home.recent.title',
  'explore.kicker',
  'explore.subtitle',
  'explore.search',
  'explore.createVersion',
  'explore.save',
  'explore.saved',
  'sounds.kicker',
  'sounds.create.title',
  'sounds.create.subtitle',
  'sounds.create.action',
  'sounds.replayed.title',
  'sounds.useCase.title',
  'sounds.search',
  'sounds.createSimilar',
  'sounds.setDefault',
  'profile.title',
  'profile.language',
  'profile.followSystem',
  'create.prompt.sleep',
  'create.prompt.calm',
  'create.prompt.focus',
  'create.prompt.like',
  'create.prompt.avoid',
  'create.prompt.similar',
  'create.prompt.search',
  'create.prompt.inspired',
];

const visibleRouteMarkers: Record<ResolvedLanguage, {
  listen: string;
  explore: string;
  sounds: string;
  profile: string;
}> = {
  zh: { listen: '描述你需要的声音', explore: '发现', sounds: '你的有效声音', profile: '我的' },
  en: { listen: 'Describe the sound you need', explore: 'Explore', sounds: 'Your effective sounds', profile: 'Profile' },
  hi: { listen: 'अपनी जरूरत बताएं', explore: 'खोजें', sounds: 'आपके असरदार साउंड', profile: 'प्रोफ़ाइल' },
  es: { listen: 'Describe', explore: 'Explorar', sounds: 'Mis sonidos', profile: 'Perfil' },
  ar: { listen: 'صف', explore: 'استكشف', sounds: 'أصواتي', profile: 'الملف' },
  bn: { listen: 'আপনার দরকার বলুন', explore: 'অন্বেষণ', sounds: 'আপনার কার্যকর সাউন্ড', profile: 'প্রোফাইল' },
  pt: { listen: 'Descreva o que precisa', explore: 'Explorar', sounds: 'Seus sons eficazes', profile: 'Perfil' },
  ru: { listen: 'Опишите, что нужно', explore: 'Обзор', sounds: 'Ваши эффективные звуки', profile: 'Профиль' },
  ja: { listen: '必要な音を説明', explore: '探す', sounds: 'あなたに効くサウンド', profile: 'プロフィール' },
  id: { listen: 'Jelaskan suara yang kamu butuhkan', explore: 'Jelajahi', sounds: 'Suara efektifmu', profile: 'Profil' },
  de: { listen: 'Beschreibe, was du brauchst', explore: 'Entdecken', sounds: 'Deine wirksamen Klänge', profile: 'Profil' },
  fr: { listen: 'Décrivez ce dont vous avez besoin', explore: 'Explorer', sounds: 'Vos sons utiles', profile: 'Profil' },
  ko: { listen: '필요한 소리를 설명하세요', explore: '탐색', sounds: '내게 효과 있는 소리', profile: '프로필' },
  it: { listen: 'Descrivi cosa ti serve', explore: 'Esplora', sounds: 'I tuoi suoni efficaci', profile: 'Profilo' },
  nl: { listen: 'Beschrijf wat je nodig hebt', explore: 'Ontdekken', sounds: 'Je werkende geluiden', profile: 'Profiel' },
  'zh-Hant': { listen: '描述你需要的聲音', explore: '發現', sounds: '你的有效聲音', profile: '我的' },
  tr: { listen: 'İhtiyacınız olan sesi anlatın', explore: 'Keşfet', sounds: 'İşe yarayan sesleriniz', profile: 'Profil' },
  pl: { listen: 'Opisz, czego potrzebujesz', explore: 'Odkrywaj', sounds: 'Twoje skuteczne dźwięki', profile: 'Profil' },
  sv: { listen: 'Beskriv vad du behöver', explore: 'Utforska', sounds: 'Dina effektiva ljud', profile: 'Profil' },
  th: { listen: 'อธิบายเสียงที่คุณต้องการ', explore: 'สำรวจ', sounds: 'เสียงที่ได้ผลของคุณ', profile: 'โปรไฟล์' },
  vi: { listen: 'Mô tả âm thanh bạn cần', explore: 'Khám phá', sounds: 'Âm thanh hiệu quả của bạn', profile: 'Hồ sơ' },
  ms: { listen: 'Terangkan bunyi yang anda perlukan', explore: 'Teroka', sounds: 'Bunyi berkesan anda', profile: 'Profil' },
  he: { listen: 'תארו את הצליל שאתם צריכים', explore: 'גילוי', sounds: 'הצלילים שעובדים בשבילך', profile: 'פרופיל' },
  da: { listen: 'Beskriv den lyd, du har brug for', explore: 'Udforsk', sounds: 'Dine virksomme lyde', profile: 'Profil' },
  no: { listen: 'Beskriv lyden du trenger', explore: 'Utforsk', sounds: 'Dine effektive lyder', profile: 'Profil' },
  fi: { listen: 'Kuvaile tarvitsemasi ääni', explore: 'Tutki', sounds: 'Toimivat äänesi', profile: 'Profiili' },
};

const allowedSameAsEnglish = new Set<TranslationKey>([
  'profile.title',
]);

const failures: string[] = [];

for (const locale of SUPPORTED_LOCALES) {
  for (const key of mainTabKeys) {
    const localized = tForLocale(locale, key, sampleValues).trim();
    if (!localized) failures.push(`${locale}.${key} is empty`);
    if (localized.includes('{')) failures.push(`${locale}.${key} has unreplaced placeholder: ${localized}`);
    if (locale !== 'en' && !allowedSameAsEnglish.has(key) && localized === tForLocale('en', key, sampleValues)) {
      failures.push(`${locale}.${key} falls back to English`);
    }
  }

  for (const [route, marker] of Object.entries(visibleRouteMarkers[locale])) {
    if (!marker.trim()) failures.push(`${locale}.${route} marker is empty`);
    if (locale !== 'en' && Object.values(visibleRouteMarkers.en).includes(marker)) {
      failures.push(`${locale}.${route} marker still uses English: ${marker}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Main tab language consistency failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  supportedLocales: SUPPORTED_LOCALES,
  checkedKeys: mainTabKeys.length,
  checkedRouteMarkers: Object.keys(visibleRouteMarkers).length * 4,
  contracts: [
    'home-explore-sounds-profile-main-copy',
    'create-prompts-localized-from-main-tabs',
    'zh-Hant-not-english-main-tab-regression',
    'paid-coverage-languages-not-shell-only',
  ],
}, null, 2));
