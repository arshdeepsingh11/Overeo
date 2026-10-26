import { useCallback } from "react";
import { translate, type TKey } from "./i18n";
import { space, useSpace } from "./space";

/** t("nav.today") in her language; falls back to English. */
export function useT() {
  const lang = useSpace((s) => s.prefs.lang);
  return useCallback((k: TKey, vars?: Record<string, string | number>) => translate(lang, k, vars), [lang]);
}

export const tNow = (k: TKey, vars?: Record<string, string | number>) => translate(space.get().prefs.lang, k, vars);
