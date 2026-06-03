import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '中文' },
];

const SETTINGS_KEY = 'aiof.settings.v1';

/** Read the persisted language without importing the settings store (avoids a
 *  circular import: the store imports nothing from i18n, and i18n is init'd
 *  before React renders). Defaults to English. */
function initialLanguage(): Language {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { language?: string };
      if (parsed.language === 'zh' || parsed.language === 'en') {
        return parsed.language;
      }
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switch the active UI language at runtime. Persistence is handled by the
 *  caller via the settings store. */
export function setLanguage(lng: Language): void {
  void i18n.changeLanguage(lng);
}

export default i18n;
