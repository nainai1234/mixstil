export const SUPPORTED_LOCALES = ['zh', 'en', 'hi', 'es', 'ar', 'bn', 'pt', 'ru', 'ja', 'id', 'de', 'fr', 'ko', 'it', 'nl', 'zh-Hant', 'tr', 'pl', 'sv', 'th', 'vi', 'ms', 'he', 'da', 'no', 'fi'] as const;

export type ResolvedLanguage = typeof SUPPORTED_LOCALES[number];
export type LanguagePreference = 'system' | ResolvedLanguage;

export const LANGUAGE_PREFERENCE_KEY = 'snooze:language-preference';
export const LANGUAGE_PREFERENCE_EVENT = 'snooze:language-preference-changed';

export const LANGUAGE_OPTIONS: Array<{ value: ResolvedLanguage; nativeLabel: string; englishLabel: string }> = [
  { value: 'zh', nativeLabel: '简体中文', englishLabel: 'Chinese' },
  { value: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { value: 'hi', nativeLabel: 'हिन्दी', englishLabel: 'Hindi' },
  { value: 'es', nativeLabel: 'Español', englishLabel: 'Spanish' },
  { value: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic' },
  { value: 'bn', nativeLabel: 'বাংলা', englishLabel: 'Bengali' },
  { value: 'pt', nativeLabel: 'Português', englishLabel: 'Portuguese' },
  { value: 'ru', nativeLabel: 'Русский', englishLabel: 'Russian' },
  { value: 'ja', nativeLabel: '日本語', englishLabel: 'Japanese' },
  { value: 'id', nativeLabel: 'Bahasa Indonesia', englishLabel: 'Indonesian' },
  { value: 'de', nativeLabel: 'Deutsch', englishLabel: 'German' },
  { value: 'fr', nativeLabel: 'Français', englishLabel: 'French' },
  { value: 'ko', nativeLabel: '한국어', englishLabel: 'Korean' },
  { value: 'it', nativeLabel: 'Italiano', englishLabel: 'Italian' },
  { value: 'nl', nativeLabel: 'Nederlands', englishLabel: 'Dutch' },
  { value: 'zh-Hant', nativeLabel: '繁體中文', englishLabel: 'Traditional Chinese' },
  { value: 'tr', nativeLabel: 'Türkçe', englishLabel: 'Turkish' },
  { value: 'pl', nativeLabel: 'Polski', englishLabel: 'Polish' },
  { value: 'sv', nativeLabel: 'Svenska', englishLabel: 'Swedish' },
  { value: 'th', nativeLabel: 'ไทย', englishLabel: 'Thai' },
  { value: 'vi', nativeLabel: 'Tiếng Việt', englishLabel: 'Vietnamese' },
  { value: 'ms', nativeLabel: 'Bahasa Melayu', englishLabel: 'Malay' },
  { value: 'he', nativeLabel: 'עברית', englishLabel: 'Hebrew' },
  { value: 'da', nativeLabel: 'Dansk', englishLabel: 'Danish' },
  { value: 'no', nativeLabel: 'Norsk', englishLabel: 'Norwegian' },
  { value: 'fi', nativeLabel: 'Suomi', englishLabel: 'Finnish' },
];

const normalizeLanguageCode = (language: string): ResolvedLanguage | null => {
  const normalized = language.toLowerCase().replace('_', '-');
  const primary = normalized.split('-')[0];
  if (normalized === 'zh-hant' || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo')) return 'zh-Hant';
  if (primary === 'zh') return 'zh';
  if (primary === 'nb' || primary === 'nn') return 'no';
  if (SUPPORTED_LOCALES.includes(primary as ResolvedLanguage)) return primary as ResolvedLanguage;
  return null;
};

export const resolveSystemLanguage = (): ResolvedLanguage => {
  if (typeof navigator === 'undefined') return 'zh';
  const languages = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map((language) => language.toLowerCase());
  for (const language of languages) {
    const supported = normalizeLanguageCode(language);
    if (supported) return supported;
  }
  return 'zh';
};

export const readLanguagePreference = (): LanguagePreference => {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  if (!stored) return 'system';
  if (stored === 'system') return stored;
  return normalizeLanguageCode(stored ?? '') ?? 'system';
};

export const writeLanguagePreference = (preference: LanguagePreference) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  window.dispatchEvent(new CustomEvent(LANGUAGE_PREFERENCE_EVENT, { detail: { preference } }));
};

export const resolveLanguagePreference = (preference = readLanguagePreference()): ResolvedLanguage =>
  preference === 'system' ? resolveSystemLanguage() : preference;

export const languagePreferenceLabel = (preference: LanguagePreference) => {
  const option = LANGUAGE_OPTIONS.find((item) => item.value === resolveLanguagePreference(preference));
  return option?.nativeLabel ?? (preference === 'system' ? 'System' : preference.toUpperCase());
};
