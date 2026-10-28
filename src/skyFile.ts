/**
 * A sky as a file someone can keep or pass on, and the strict reading of one. Anything that
 * arrives from outside this browser, a file or a shared link, is read here and nowhere else: it
 * is treated as plain data, checked field by field, and rebuilt from only the fields a sky has.
 */
import type { Moment, Person, Profile } from './model';
import { MOMENT_KINDS, MOMENT_TITLE_MAX_LENGTH } from './moments';
import { MEMORY_MAX_LENGTH, PERSON_NAME_MAX_LENGTH } from './people';
import type { SavedSky } from './storage';

/** What a sky file says it is, so a stray JSON file is never mistaken for one. */
const APP = 'family-space';
/** Bump when the file's shape changes; older versions keep reading as they always did. */
const VERSION = 1;

export const PROFILE_NAME_MAX_LENGTH = 40;
export const MAX_PEOPLE = 100;
export const MAX_MOMENTS = 100;
/** Larger than any sky: the largest the checks allow, written out in Bengali, is about 170 KB. */
export const SKY_FILE_MAX_BYTES = 256 * 1024;
const MAX_AGE = 120;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
/**
 * Control characters and the invisible marks that reorder text, which could make a shared name
 * read as something else. Joiners stay: Bengali spelling needs them.
 */
const HIDDEN = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩﻿]/g;

export interface SkyFile {
  app: typeof APP;
  version: typeof VERSION;
  profile: Profile;
  people: Person[];
  moments: Moment[];
}

/** Why a file or link could not be opened; the screen puts it into words. */
export type SkyFileProblem = 'tooLarge' | 'notSky' | 'newer' | 'damaged' | 'oldBrowser';

export type SkyFileResult = { sky: SavedSky & { people: Person[] } } | { problem: SkyFileProblem };

/** The sky as a file, with only the fields a sky has, so nothing else is ever handed on. */
export function toSkyFile(sky: { profile: Profile; people: readonly Person[]; moments: readonly Moment[] }, keepWords = true): SkyFile {
  return {
    app: APP,
    version: VERSION,
    profile: { name: sky.profile.name, age: sky.profile.age },
    people: sky.people.map((p) => ({
      id: p.id,
      name: p.name,
      bond: p.bond,
      joinAge: p.joinAge,
      departAge: p.departAge,
      color: p.color,
      ...(keepWords && p.memory ? { memory: p.memory } : {}),
    })),
    moments: sky.moments.map((m) => ({
      id: m.id,
      title: m.title,
      age: m.age,
      kind: m.kind,
      ...(keepWords && m.note ? { note: m.note } : {}),
    })),
  };
}

/** Reads a file someone chose or dropped, refusing one too large to be a sky before reading it. */
export async function openSkyFile(file: Blob): Promise<SkyFileResult> {
  if (file.size > SKY_FILE_MAX_BYTES) return { problem: 'tooLarge' };
  try {
    return readSkyFile(await file.text());
  } catch {
    return { problem: 'damaged' };
  }
}

/** Reads text that claims to be a sky file. Never throws; anything doubtful is refused whole. */
export function readSkyFile(text: string): SkyFileResult {
  if (text.length > SKY_FILE_MAX_BYTES) return { problem: 'tooLarge' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { problem: 'notSky' };
  }
  if (!isRecord(data) || data.app !== APP) return { problem: 'notSky' };
  if (typeof data.version === 'number' && data.version > VERSION) return { problem: 'newer' };
  if (data.version !== VERSION) return { problem: 'damaged' };

  const profile = readProfile(data.profile);
  if (!profile || !Array.isArray(data.people) || !Array.isArray(data.moments)) return { problem: 'damaged' };
  if (data.people.length > MAX_PEOPLE || data.moments.length > MAX_MOMENTS) return { problem: 'damaged' };

  const ids = new Set<string>();
  const people: Person[] = [];
  for (const raw of data.people) {
    const person = readPerson(raw, profile.age, ids);
    if (!person) return { problem: 'damaged' };
    people.push(person);
  }
  const moments: Moment[] = [];
  for (const raw of data.moments) {
    const moment = readMoment(raw, profile.age, ids);
    if (!moment) return { problem: 'damaged' };
    moments.push(moment);
  }
  return { sky: { profile, people, moments } };
}

function readProfile(raw: unknown): Profile | null {
  if (!isRecord(raw)) return null;
  const name = readText(raw.name, PROFILE_NAME_MAX_LENGTH);
  if (!name || !isAge(raw.age) || raw.age < 1) return null;
  return { name, age: raw.age };
}

function readPerson(raw: unknown, maxAge: number, ids: Set<string>): Person | null {
  if (!isRecord(raw)) return null;
  const name = readText(raw.name, PERSON_NAME_MAX_LENGTH);
  const memory = raw.memory === undefined ? undefined : readText(raw.memory, MEMORY_MAX_LENGTH);
  const { joinAge, departAge } = raw;
  if (
    !name ||
    memory === null ||
    (raw.bond !== 'temporary' && raw.bond !== 'permanent') ||
    !isAge(joinAge) ||
    joinAge > maxAge ||
    (departAge !== null && (!isAge(departAge) || departAge <= joinAge || departAge > maxAge)) ||
    typeof raw.color !== 'string' ||
    !COLOR.test(raw.color)
  ) {
    return null;
  }
  const person: Person = { id: readId(raw.id, ids), name, bond: raw.bond, joinAge, departAge, color: raw.color.toLowerCase() };
  if (memory) person.memory = memory;
  return person;
}

function readMoment(raw: unknown, maxAge: number, ids: Set<string>): Moment | null {
  if (!isRecord(raw)) return null;
  const title = readText(raw.title, MOMENT_TITLE_MAX_LENGTH);
  const note = raw.note === undefined ? undefined : readText(raw.note, MEMORY_MAX_LENGTH);
  if (!title || note === null || !isAge(raw.age) || raw.age > maxAge || !MOMENT_KINDS.some((k) => k === raw.kind)) {
    return null;
  }
  const moment: Moment = { id: readId(raw.id, ids), title, age: raw.age, kind: raw.kind as Moment['kind'] };
  if (note) moment.note = note;
  return moment;
}

/**
 * Keeps an id that is short, plain and unused, since ids seed where each person orbits; any
 * other id is replaced, so two stars can never be confused for one.
 */
function readId(raw: unknown, ids: Set<string>): string {
  const id = typeof raw === 'string' && ID.test(raw) && !ids.has(raw) ? raw : crypto.randomUUID();
  ids.add(id);
  return id;
}

/** Text with hidden marks taken out and the ends trimmed; null if it is not text or too long. */
function readText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string' || raw.length > maxLength * 2) return null;
  const text = raw.replace(HIDDEN, '').trim();
  return text.length > maxLength ? null : text;
}

function isAge(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_AGE;
}

/** A plain JSON object; arrays and null are not. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
