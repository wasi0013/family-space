import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Person, Profile } from './model';
import { clearSky, loadSky, saveSky } from './storage';

const KEY = 'family-space:sky';
const profile: Profile = { name: 'Wasi', age: 32 };
const mom: Person = { id: 'a', name: 'Mom', bond: 'permanent', joinAge: 0, departAge: null, color: '#ff8a7a' };
const sam: Person = { id: 'b', name: 'Sam', bond: 'temporary', joinAge: 5, departAge: 16, color: '#8ff0d2' };

/** A plain in-memory stand-in for the browser's localStorage. */
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

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const store = (value: unknown) => storage.setItem(KEY, JSON.stringify(value));

describe('saving the sky', () => {
  it('loads back exactly what was saved', () => {
    expect(saveSky({ profile, people: [mom, sam] })).toBe(true);
    expect(loadSky()).toEqual({ profile, people: [mom, sam] });
  });

  it('keeps memories', () => {
    const remembered = { ...sam, memory: 'Built a treehouse with me' };
    saveSky({ profile, people: [mom, remembered] });
    expect(loadSky()?.people).toEqual([mom, remembered]);
  });

  it('remembers someone who stopped before adding people', () => {
    saveSky({ profile, people: null });
    expect(loadSky()).toEqual({ profile, people: null });
  });

  it('finds nothing on a first visit', () => {
    expect(loadSky()).toBeNull();
  });

  it('forgets everything when starting a new sky', () => {
    saveSky({ profile, people: [mom] });
    clearSky();
    expect(loadSky()).toBeNull();
  });

  it('reports when the browser refuses to store anything', () => {
    storage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    expect(saveSky({ profile, people: [mom] })).toBe(false);
  });
});

describe('reading damaged or foreign data', () => {
  it('ignores data that is not JSON', () => {
    storage.setItem(KEY, '{not json');
    expect(loadSky()).toBeNull();
  });

  it('ignores a different save version', () => {
    store({ version: 99, profile, people: [mom] });
    expect(loadSky()).toBeNull();
  });

  it.each([
    { name: '', age: 32 },
    { name: 'Wasi', age: 0 },
    { name: 'Wasi', age: 121 },
    { name: 'Wasi', age: 3.5 },
    { name: 42, age: 32 },
  ])('rejects an impossible profile %o', (bad) => {
    store({ version: 1, profile: bad, people: [] });
    expect(loadSky()).toBeNull();
  });

  it.each([
    { ...mom, bond: 'sometimes' },
    { ...sam, departAge: 5 },
    { ...mom, joinAge: -1 },
    { ...mom, color: 'red' },
    { ...mom, id: undefined },
    { ...mom, memory: 42 },
    { ...mom, memory: 'x'.repeat(201) },
  ])('keeps the profile but drops a damaged people list %o', (bad) => {
    store({ version: 1, profile, people: [mom, bad] });
    expect(loadSky()).toEqual({ profile, people: null });
  });
});
