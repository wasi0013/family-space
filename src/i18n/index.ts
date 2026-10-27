import { bn } from './bn';
import { en } from './en';
import type { Lang, Strings } from './strings';

export type { Lang, Strings } from './strings';

const STRINGS: Record<Lang, Strings> = { en, bn };
/** Earlier versions remembered the language here; it is now chosen only by the link. */
const OLD_KEY = 'family-space:lang';

/** Bengali only when the link asks for it with `?lang=bn`; English otherwise. */
export function pickLang(param: string | null): Lang {
  return param === 'bn' ? 'bn' : 'en';
}

function readLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Storage is unavailable, so nothing was remembered.
  }
  return pickLang(new URLSearchParams(window.location.search).get('lang'));
}

/** The language for this visit, set by the link. */
export const LANG: Lang = readLang();
export const t: Strings = STRINGS[LANG];
