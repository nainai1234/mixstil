import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tForLocale } from '../src/lib/i18n';
import { SUPPORTED_LOCALES, type ResolvedLanguage } from '../src/lib/languagePreference';

const storeLocale: Record<ResolvedLanguage, string> = {
  zh: 'zh-Hans', en: 'en-US', hi: 'hi-IN', es: 'es-ES', ar: 'ar-SA', bn: 'bn-BD', pt: 'pt-BR', ru: 'ru-RU', ja: 'ja-JP', id: 'id-ID',
  de: 'de-DE', fr: 'fr-FR', ko: 'ko-KR', it: 'it-IT', nl: 'nl-NL', 'zh-Hant': 'zh-Hant', tr: 'tr-TR', pl: 'pl-PL', sv: 'sv-SE', th: 'th-TH',
  vi: 'vi-VN', ms: 'ms-MY', he: 'he-IL', da: 'da-DK', no: 'no-NO', fi: 'fi-FI',
};

const nonMedicalBoundary: Record<ResolvedLanguage, string> = {
  zh: 'MixStil 不提供诊断、治疗或治愈，也不保证健康结果。',
  en: 'MixStil does not diagnose, treat, cure, or guarantee health outcomes.',
  hi: 'MixStil निदान, उपचार या इलाज नहीं करता और स्वास्थ्य परिणामों की गारंटी नहीं देता।',
  es: 'MixStil no diagnostica, trata ni cura, ni garantiza resultados de salud.',
  ar: 'لا يشخّص MixStil الحالات الصحية ولا يعالجها أو يشفيها ولا يضمن نتائج صحية.',
  bn: 'MixStil রোগ নির্ণয়, চিকিৎসা বা নিরাময় করে না এবং স্বাস্থ্যগত ফলের নিশ্চয়তা দেয় না।',
  pt: 'O MixStil não diagnostica, trata ou cura e não garante resultados de saúde.',
  ru: 'MixStil не диагностирует, не лечит и не гарантирует результаты для здоровья.',
  ja: 'MixStil は診断、治療、治癒を行わず、健康上の結果を保証しません。',
  id: 'MixStil tidak mendiagnosis, mengobati, menyembuhkan, atau menjamin hasil kesehatan.',
  de: 'MixStil diagnostiziert, behandelt oder heilt nicht und garantiert keine gesundheitlichen Ergebnisse.',
  fr: 'MixStil ne diagnostique, ne traite et ne guérit pas, et ne garantit aucun résultat de santé.',
  ko: 'MixStil는 진단, 치료 또는 치유를 제공하지 않으며 건강 결과를 보장하지 않습니다.',
  it: 'MixStil non diagnostica, tratta o cura e non garantisce risultati di salute.',
  nl: 'MixStil stelt geen diagnose, behandelt of geneest niet en garandeert geen gezondheidsresultaten.',
  'zh-Hant': 'MixStil 不提供診斷、治療或治癒，也不保證健康結果。',
  tr: 'MixStil teşhis, tedavi veya iyileştirme sunmaz ve sağlık sonucu garanti etmez.',
  pl: 'MixStil nie diagnozuje, nie leczy ani nie gwarantuje rezultatów zdrowotnych.',
  sv: 'MixStil diagnostiserar, behandlar eller botar inte och garanterar inga hälsoresultat.',
  th: 'MixStil ไม่ได้วินิจฉัย บำบัด หรือรักษาโรค และไม่รับประกันผลลัพธ์ด้านสุขภาพ',
  vi: 'MixStil không chẩn đoán, điều trị, chữa bệnh hoặc bảo đảm kết quả sức khỏe.',
  ms: 'MixStil tidak mendiagnosis, merawat atau menyembuhkan dan tidak menjamin hasil kesihatan.',
  he: 'MixStil אינו מאבחן, מטפל או מרפא ואינו מבטיח תוצאות בריאותיות.',
  da: 'MixStil diagnosticerer, behandler eller helbreder ikke og garanterer ingen sundhedsresultater.',
  no: 'MixStil diagnostiserer, behandler eller kurerer ikke og garanterer ingen helseresultater.',
  fi: 'MixStil ei diagnosoi, hoida tai paranna eikä takaa terveysvaikutuksia.',
};

const fit = (preferred: string, fallback: string, maximum: number) => preferred.length <= maximum ? preferred : fallback;

const localizations = SUPPORTED_LOCALES.map((locale) => {
  const goals = [tForLocale(locale, 'goal.sleep'), tForLocale(locale, 'goal.calm'), tForLocale(locale, 'goal.focus')];
  const subtitle = fit(goals.join(' · '), tForLocale(locale, 'create.title'), 30);
  const homeSubtitle = tForLocale(locale, 'home.subtitle');
  const shortDescription = fit(
    locale !== 'en' && homeSubtitle === tForLocale('en', 'home.subtitle') ? tForLocale(locale, 'home.title') : homeSubtitle,
    tForLocale(locale, 'home.title'),
    80,
  );
  const promotionalText = fit(
    `${tForLocale(locale, 'home.describe.title')}. ${tForLocale(locale, 'home.describe.subtitle')}`,
    `${tForLocale(locale, 'home.title')} ${tForLocale(locale, 'create.title')}`,
    170,
  );
  return {
    locale,
    storeLocale: storeLocale[locale],
    nativeReviewStatus: locale === 'en' ? 'source_baseline' : 'pending_native_review',
    apple: {
      name: 'MixStil',
      subtitle,
      promotionalText,
      keywords: [...new Set([...goals, 'MixStil'])].join(','),
    },
    googlePlay: {
      name: 'MixStil',
      shortDescription,
    },
    fullDescription: [
      tForLocale(locale, 'home.describe.title'),
      tForLocale(locale, 'create.whyApprovedFallback'),
      tForLocale(locale, 'player.saveToSounds'),
      nonMedicalBoundary[locale],
    ].join('\n\n'),
    screenshots: [
      { id: 'onboarding', title: tForLocale(locale, 'profile.preferences') },
      { id: 'create', title: tForLocale(locale, 'home.describe.title') },
      { id: 'player-refine', title: tForLocale(locale, 'player.customSoundscape') },
      { id: 'layer-adjustment', title: tForLocale(locale, 'player.adjustTitle') },
      { id: 'my-sounds', title: tForLocale(locale, 'nav.sounds') },
      { id: 'profile', title: tForLocale(locale, 'nav.profile') },
    ],
  };
});

const outputPath = path.join(process.cwd(), 'data', 'mobile-store-listing-localizations.json');
await writeFile(outputPath, `${JSON.stringify({ version: 1, generatedFrom: 'consumer i18n plus localized non-medical boundary', localizations }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, localeCount: localizations.length }, null, 2));
