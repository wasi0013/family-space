import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_AGE, exampleSky, fitToAge } from './example';
import type { Lang } from './i18n';
import { MOMENT_TITLE_MAX_LENGTH } from './moments';
import { MEMORY_MAX_LENGTH, toDraft, toPerson } from './people';
import { loadSky, saveSky } from './storage';

const LANGS: Lang[] = ['en', 'bn'];

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('the example life', () => {
  it.each(LANGS)('is a full sixty-five years in %s', (lang) => {
    const { profile, people, moments } = exampleSky(lang);
    expect(profile.age).toBe(EXAMPLE_AGE);
    expect(EXAMPLE_AGE).toBe(65);
    // Every way a person can move through a sky shows up.
    expect(people.some((p) => p.bond === 'permanent' && p.departAge !== null)).toBe(true);
    expect(people.some((p) => p.bond === 'permanent' && p.departAge === null)).toBe(true);
    expect(people.some((p) => p.bond === 'temporary' && p.departAge !== null)).toBe(true);
    expect(people.some((p) => p.bond === 'temporary' && p.departAge === null)).toBe(true);
    // And every kind of moment.
    expect(new Set(moments.map((m) => m.kind))).toEqual(new Set(['milestone', 'home', 'love', 'hardship']));
  });

  it('includes a first child and grandchildren', () => {
    const { people, moments } = exampleSky('en');
    const born = (id: string) => people.find((p) => p.id === id)!.joinAge;
    expect(moments.find((m) => m.id === 'first-child')!.age).toBe(born('daughter'));
    expect(moments.find((m) => m.id === 'grandparent')!.age).toBe(born('granddaughter'));
    expect(born('grandson')).toBeGreaterThan(born('granddaughter'));
  });

  it('is the same life in both languages, word for word only', () => {
    const strip = (lang: Lang) => {
      const sky = exampleSky(lang);
      return {
        people: sky.people.map(({ name: _, memory: __, ...p }) => p),
        moments: sky.moments.map(({ title: _, note: __, ...m }) => m),
      };
    };
    expect(strip('bn')).toEqual(strip('en'));
  });

  it.each(LANGS)('could be typed into the app as it is, in %s', (lang) => {
    const { profile, people, moments } = exampleSky(lang);
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    expect(new Set(moments.map((m) => m.id)).size).toBe(moments.length);
    for (const person of people) {
      expect(toPerson(toDraft(person), profile.age, person)).toEqual(person);
      expect(person.name.length).toBeLessThanOrEqual(24);
      expect(person.memory!.length).toBeLessThanOrEqual(MEMORY_MAX_LENGTH);
    }
    for (const moment of moments) {
      expect(moment.title.length).toBeLessThanOrEqual(MOMENT_TITLE_MAX_LENGTH);
      expect(moment.note!.length).toBeLessThanOrEqual(MEMORY_MAX_LENGTH);
    }
  });

  it('keeps its moments a few years apart, so each can be read', () => {
    const ages = exampleSky('en').moments.map((m) => m.age);
    ages.slice(1).forEach((age, i) => expect(age - ages[i]).toBeGreaterThanOrEqual(2));
  });
});

describe('fitToAge', () => {
  const { people, moments } = exampleSky('en');

  it('keeps only what fits within the years lived', () => {
    const fitted = fitToAge(people, moments, 35);
    expect(fitted.people.every((p) => p.joinAge <= 35)).toBe(true);
    expect(fitted.people.map((p) => p.id)).toContain('son');
    expect(fitted.people.map((p) => p.id)).not.toContain('granddaughter');
    expect(fitted.moments.every((m) => m.age <= 35)).toBe(true);
  });

  it('keeps anyone who left later still here, the way they were', () => {
    const fitted = fitToAge(people, moments, 35);
    const find = (id: string) => fitted.people.find((p) => p.id === id)!;
    expect(find('dad')).toMatchObject({ bond: 'permanent', departAge: null });
    expect(find('mentor')).toMatchObject({ bond: 'temporary', departAge: null });
    expect(find('grandma').departAge).toBe(9);
  });

  it("leaves out the example's own memories and notes", () => {
    const fitted = fitToAge(people, moments, 65);
    expect(fitted.people.some((p) => 'memory' in p)).toBe(false);
    expect(fitted.moments.some((m) => 'note' in m)).toBe(false);
  });

  it.each(LANGS.flatMap((lang) => [1, 8, 20, 35, 45, 65, 90].map((age) => [lang, age] as const)))(
    'saves and loads back whole, in %s at %i',
    (lang, age) => {
      const sky = exampleSky(lang);
      const fitted = fitToAge(sky.people, sky.moments, age);
      const profile = { name: sky.profile.name, age };
      expect(saveSky({ profile, ...fitted })).toBe(true);
      expect(loadSky()).toEqual({ profile, ...fitted });
    },
  );
});
