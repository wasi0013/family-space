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

/** The language for this visit; switching reloads the page with a different `?lang=`. */
export const LANG: Lang = readLang();
export const t: Strings = STRINGS[LANG];

const RESUME_KEY = 'family-space:resume';

/** Marks this tab to reopen the sky after switching language, rather than the title screen. */
export function resumeAfterSwitch() {
  try {
    sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    // Without storage the title screen shows, which still leads back to the sky.
  }
}

/** True once, on the load that follows a language switch. */
export function takeResume(): boolean {
  try {
    const resume = sessionStorage.getItem(RESUME_KEY) === '1';
    sessionStorage.removeItem(RESUME_KEY);
    return resume;
  } catch {
    return false;
  }
}

/** The same page in the other language: `?lang=bn` for Bengali, no `lang` for English. */
export function switchLanguageUrl(href: string = window.location.href): string {
  const url = new URL(href);
  if (LANG === 'bn') url.searchParams.delete('lang');
  else url.searchParams.set('lang', 'bn');
  return url.toString();
}
