/* Languages ECHO can translate into. `name` is for prompts, `native` for her. */
export interface Lang {
  code: string;
  name: string;
  native: string;
  rtl?: boolean;
}

export const LANGS: Lang[] = [
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "fa", name: "Persian (Farsi)", native: "فارسی", rtl: true },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "pa", name: "Punjabi (Gurmukhi script)", native: "ਪੰਜਾਬੀ" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "zh", name: "Simplified Chinese", native: "简体中文" },
  { code: "zh-Hant", name: "Traditional Chinese", native: "繁體中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "tl", name: "Tagalog (Filipino)", native: "Tagalog" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
];

export const langByCode = (c: string) => LANGS.find((l) => l.code === c);

/** Her likely language: the app's language, else the browser's, else Spanish. */
export function guessLang(appLang?: string): string {
  if (appLang && appLang !== "en" && langByCode(appLang)) return appLang;
  try {
    for (const l of navigator.languages ?? [navigator.language]) {
      const full = langByCode(l);
      if (full) return full.code;
      const base = l.split("-")[0];
      if (base !== "en" && langByCode(base)) return base;
    }
  } catch {}
  return "es";
}
