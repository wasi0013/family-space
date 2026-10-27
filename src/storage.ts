import type { Moment, Person, Profile } from './model';
import { MOMENT_KINDS, MOMENT_TITLE_MAX_LENGTH } from './moments';
import { MEMORY_MAX_LENGTH } from './people';

/** The sky is kept in this browser only. Bump the version if the saved shape changes. */
const KEY = 'family-space:sky';
const VERSION = 2;

export interface SavedSky {
  profile: Profile;
  /** Null until the person has finished the people step. */
  people: Person[] | null;
  moments: Moment[];
}

export function loadSky(): SavedSky | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Version 1 skies came before moments; they load with none.
    if ((data?.version !== VERSION && data?.version !== 1) || !isProfile(data.profile)) return null;
    const people = Array.isArray(data.people) && data.people.every(isPerson) ? (data.people as Person[]) : null;
    const moments =
      Array.isArray(data.moments) && data.moments.every((m: unknown) => isMoment(m, data.profile.age))
        ? (data.moments as Moment[])
        : [];
    return { profile: data.profile, people, moments };
  } catch {
    return null;
  }
}

/** Returns false when the browser refuses to store anything, such as in some private windows. */
export function saveSky(sky: SavedSky): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...sky }));
    return true;
  } catch {
    return false;
  }
}

export function clearSky() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage is unavailable, so there is nothing saved to clear.
  }
}

function isProfile(value: unknown): value is Profile {
  const p = value as Profile;
  return typeof p?.name === 'string' && p.name.trim() !== '' && Number.isInteger(p.age) && p.age >= 1 && p.age <= 120;
}

function isPerson(value: unknown): value is Person {
  const p = value as Person;
  return (
    typeof p?.id === 'string' &&
    typeof p.name === 'string' &&
    (p.bond === 'temporary' || p.bond === 'permanent') &&
    Number.isFinite(p.joinAge) &&
    p.joinAge >= 0 &&
    (p.departAge === null || (Number.isFinite(p.departAge) && p.departAge > p.joinAge)) &&
    typeof p.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(p.color) &&
    (p.memory === undefined || (typeof p.memory === 'string' && p.memory.length <= MEMORY_MAX_LENGTH))
  );
}

function isMoment(value: unknown, maxAge: number): value is Moment {
  const m = value as Moment;
  return (
    typeof m?.id === 'string' &&
    typeof m.title === 'string' &&
    m.title.trim() !== '' &&
    m.title.length <= MOMENT_TITLE_MAX_LENGTH &&
    Number.isInteger(m.age) &&
    m.age >= 0 &&
    m.age <= maxAge &&
    (MOMENT_KINDS as readonly string[]).includes(m.kind) &&
    (m.note === undefined || (typeof m.note === 'string' && m.note.length <= MEMORY_MAX_LENGTH))
  );
}
