/** Rules for adding someone to the sky. Their wording lives in ./i18n. */
import type { Person } from './model';

/** Each person's light, handed out in order; distinct hues that glow well on the night sky. */
const PERSON_COLORS = [
  '#ff8a7a',
  '#7ea6ff',
  '#b7a6ff',
  '#8ff0d2',
  '#ff9fd0',
  '#ffd27a',
  '#9fe7ff',
  '#ffb48a',
  '#c8f08f',
  '#cfe9ff',
];

export type Arrival = 'birth' | 'later';
/**
 * Where someone is in the story now, which decides how they move through the sky: staying in
 * orbit, passing by as a comet, gone as a shooting star, or a star among the stars.
 */
export type Ending = 'here' | 'passing' | 'drifted' | 'star';

export interface Draft {
  name: string;
  arrival: Arrival;
  joinAge: string;
  ending: Ending;
  departAge: string;
}

export const EMPTY_DRAFT: Draft = { name: '', arrival: 'birth', joinAge: '', ending: 'here', departAge: '' };

/** Bengali digits typed into an age field count the same as ASCII ones. */
export function asciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
}

function parseAge(text: string): number | null {
  const digits = asciiDigits(text.trim());
  return /^\d{1,3}$/.test(digits) ? Number(digits) : null;
}

/** What still needs fixing in a draft; the screen puts it into words in the chosen language. */
export type DraftProblem =
  | { kind: 'name' }
  | { kind: 'arrival'; max: number }
  | { kind: 'tooRecent'; joinAge: number }
  | { kind: 'departure'; ending: 'drifted' | 'star'; from: number; max: number };

export function isProblem(result: Person | DraftProblem): result is DraftProblem {
  return 'kind' in result;
}

/** Turns a draft into a person, or returns what still needs fixing. */
export function toPerson(draft: Draft, maxAge: number, identity: { id: string; color: string }): Person | DraftProblem {
  const name = draft.name.trim();
  if (!name) return { kind: 'name' };

  let joinAge = 0;
  if (draft.arrival === 'later') {
    const age = parseAge(draft.joinAge);
    if (age === null || age > maxAge) return { kind: 'arrival', max: maxAge };
    joinAge = age;
  }

  let departAge: number | null = null;
  if (draft.ending === 'drifted' || draft.ending === 'star') {
    const age = parseAge(draft.departAge);
    if (joinAge >= maxAge) return { kind: 'tooRecent', joinAge };
    if (age === null || age <= joinAge || age > maxAge) {
      return { kind: 'departure', ending: draft.ending, from: joinAge + 1, max: maxAge };
    }
    departAge = age;
  }

  const bond = draft.ending === 'drifted' || draft.ending === 'passing' ? 'temporary' : 'permanent';
  return { ...identity, name, bond, joinAge, departAge };
}

export function toDraft(person: Person): Draft {
  return {
    name: person.name,
    arrival: person.joinAge > 0 ? 'later' : 'birth',
    joinAge: person.joinAge > 0 ? String(person.joinAge) : '',
    ending:
      person.departAge === null
        ? person.bond === 'temporary'
          ? 'passing'
          : 'here'
        : person.bond === 'temporary'
          ? 'drifted'
          : 'star',
    departAge: person.departAge === null ? '' : String(person.departAge),
  };
}

export function nextColor(people: readonly Person[]): string {
  return PERSON_COLORS.find((c) => !people.some((p) => p.color === c)) ?? PERSON_COLORS[people.length % PERSON_COLORS.length];
}

/** Longest name someone can be given in the sky; longer ones crowd their label. */
export const PERSON_NAME_MAX_LENGTH = 24;
/** Longest memory kept for one person: a line, not a letter. */
export const MEMORY_MAX_LENGTH = 200;
