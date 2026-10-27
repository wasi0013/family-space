import { bn } from './bn';
import { en } from './en';
import type { Lang, Strings } from './strings';

export type { Lang, Strings } from './strings';

const STRINGS: Record<Lang, Strings> = { en, bn };
const KEY = 'family-space:lang';

function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'bn';
}

/** `?lang=` wins; otherwise the language last chosen in this browser; otherwise English. */
export function pickLang(param: string | null, remembered: string | null): Lang {
  if (isLang(param)) return param;
  return isLang(remembered) ? remembered : 'en';
}

function readLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const param = new URLSearchParams(window.location.search).get('lang');
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(KEY);
    // Remember a chosen language, so a shared `?lang=bn` link stays Bengali on later visits.
    if (isLang(param)) localStorage.setItem(KEY, param);
  } catch {
    // Storage is unavailable; the choice just won't be remembered.
  }
  return pickLang(param, remembered);
}

/** The language for this visit; switching takes a reload with `?lang=`. */
export const LANG: Lang = readLang();
export const t: Strings = STRINGS[LANG];
