/** Rules for adding moments to the sky. Their wording lives in ./i18n. */
import type { Moment, MomentKind } from './model';
import { asciiDigits } from './people';

export const MOMENT_KINDS = ['milestone', 'home', 'love', 'hardship'] as const satisfies readonly MomentKind[];
export const MOMENT_TITLE_MAX_LENGTH = 60;

/**
 * Words that suggest what kind of moment someone is describing, in English and Bengali. English
 * entries match at the start of a word ("moved", "moving" both match "mov"); Bengali entries
 * match anywhere, since Bengali words take endings without spaces.
 */
const HINTS: [MomentKind, { en: string[]; bn: string[] }][] = [
  // Hard times come first: "lost my job" is a hard time, not a milestone.
  [
    'hardship',
    {
      en: ['lost', 'loss', 'losing', 'sick', 'ill ', 'illness', 'cancer', 'hospital', 'divorc', 'fired', 'laid off', 'accident', 'grief', 'depress', 'broke up', 'breakup', 'surgery', 'injur'],
      bn: ['অসুস্থ', 'হাসপাতাল', 'হারা', 'দুর্ঘটনা', 'ডিভোর্স', 'তালাক', 'কঠিন', 'অপারেশন', 'বিচ্ছেদ', 'শোক'],
    },
  ],
  [
    'home',
    {
      en: ['mov', 'relocat', 'new home', 'new house', 'new flat', 'new apartment', 'shifted', 'emigrat', 'immigrat'],
      bn: ['বাসা', 'বাড়ি', 'শিফট', 'স্থানান্তর', 'চলে এলাম', 'চলে গেলাম', 'নতুন ঠিকানা', 'প্রবাস'],
    },
  ],
  [
    'love',
    {
      en: ['married', 'marry', 'marriage', 'wedding', 'wed ', 'engaged', 'fell in love', 'love', 'met my'],
      bn: ['বিয়ে', 'বিবাহ', 'প্রেম', 'ভালোবাসা', 'বাগদান'],
    },
  ],
  [
    'milestone',
    {
      en: ['graduat', 'degree', 'passed', 'job', 'promot', 'award', 'won', 'started', 'school', 'universit', 'college', 'first', 'became', 'retire', 'launched', 'founded'],
      bn: ['পাস', 'চাকরি', 'স্কুল', 'বিশ্ববিদ্যালয়', 'কলেজ', 'ভর্তি', 'পুরস্কার', 'স্নাতক', 'পদোন্নতি', 'প্রথম', 'শুরু'],
    },
  ],
];

/** The kind of moment a title most likely describes, or null if nothing in it suggests one. */
export function guessKind(title: string): MomentKind | null {
  const text = ` ${title.toLowerCase()} `;
  for (const [kind, { en, bn }] of HINTS) {
    if (en.some((word) => text.includes(` ${word}`)) || bn.some((word) => text.includes(word))) return kind;
  }
  return null;
}

export interface MomentDraft {
  title: string;
  age: string;
  kind: MomentKind;
}

export const EMPTY_MOMENT: MomentDraft = { title: '', age: '', kind: 'milestone' };

/** What still needs fixing in a moment draft; the screen puts it into words. */
export type MomentProblem = { kind: 'title' } | { kind: 'age'; max: number };

export function isMomentProblem(result: Moment | MomentProblem): result is MomentProblem {
  return !('id' in result);
}

/** Turns a draft into a moment, or returns what still needs fixing. */
export function toMoment(draft: MomentDraft, maxAge: number, identity: { id: string; note?: string }): Moment | MomentProblem {
  const title = draft.title.trim();
  if (!title) return { kind: 'title' };
  const digits = asciiDigits(draft.age.trim());
  const age = /^\d{1,3}$/.test(digits) ? Number(digits) : NaN;
  if (!Number.isInteger(age) || age > maxAge) return { kind: 'age', max: maxAge };
  const moment: Moment = { id: identity.id, title, age, kind: draft.kind };
  if (identity.note) moment.note = identity.note;
  return moment;
}

export function toMomentDraft(moment: Moment): MomentDraft {
  return { title: moment.title, age: String(moment.age), kind: moment.kind };
}

/** Moments in the order they happened. */
export function byAge(moments: readonly Moment[]): Moment[] {
  return [...moments].sort((a, b) => a.age - b.age);
}
