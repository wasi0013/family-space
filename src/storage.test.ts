import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Moment, Person, Profile } from './model';
import { clearSky, loadSky, saveSky } from './storage';

const KEY = 'family-space:sky';
const profile: Profile = { name: 'Wasi', age: 32 };
const mom: Person = { id: 'a', name: 'Mom', bond: 'permanent', joinAge: 0, departAge: null, color: '#ff8a7a' };
const sam: Person = { id: 'b', name: 'Sam', bond: 'temporary', joinAge: 5, departAge: 16, color: '#8ff0d2' };
const moved: Moment = { id: 'm1', title: 'Moved to Dhaka', age: 13, kind: 'home' };
const graduated: Moment = { id: 'm2', title: 'Graduated', age: 22, kind: 'milestone', note: 'Ammu cried' };

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
    expect(saveSky({ profile, people: [mom, sam], moments: [] })).toBe(true);
    expect(loadSky()).toEqual({ profile, people: [mom, sam], moments: [] });
  });

  it('keeps memories', () => {
    const remembered = { ...sam, memory: 'Built a treehouse with me' };
    saveSky({ profile, people: [mom, remembered], moments: [] });
    expect(loadSky()?.people).toEqual([mom, remembered]);
  });

  it('keeps moments', () => {
    saveSky({ profile, people: [mom], moments: [moved, graduated] });
    expect(loadSky()?.moments).toEqual([moved, graduated]);
  });

  it('opens a sky saved before moments existed, with none', () => {
    store({ version: 1, profile, people: [mom] });
    expect(loadSky()).toEqual({ profile, people: [mom], moments: [] });
  });

  it('remembers someone who stopped before adding people', () => {
    saveSky({ profile, people: null, moments: [] });
    expect(loadSky()).toEqual({ profile, people: null, moments: [] });
  });

  it('finds nothing on a first visit', () => {
    expect(loadSky()).toBeNull();
  });

  it('forgets everything when starting a new sky', () => {
    saveSky({ profile, people: [mom], moments: [] });
    clearSky();
    expect(loadSky()).toBeNull();
  });

  it('reports when the browser refuses to store anything', () => {
    storage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    expect(saveSky({ profile, people: [mom], moments: [] })).toBe(false);
  });
});

describe('reading damaged or foreign data', () => {
  it.each([
    { ...moved, kind: 'birthday' },
    { ...moved, age: 33 },
    { ...moved, age: 1.5 },
    { ...moved, title: '  ' },
    { ...moved, title: 'x'.repeat(61) },
    { ...moved, note: 7 },
  ])('keeps the rest of the sky but drops damaged moments %o', (bad) => {
    store({ version: 2, profile, people: [mom], moments: [moved, bad] });
    expect(loadSky()).toEqual({ profile, people: [mom], moments: [] });
  });

  it('ignores data that is not JSON', () => {
    storage.setItem(KEY, '{not json');
    expect(loadSky()).toBeNull();
  });

  it('ignores a different save version', () => {
    store({ version: 99, profile, people: [mom], moments: [] });
    expect(loadSky()).toBeNull();
  });

  it.each([
    { name: '', age: 32 },
    { name: 'Wasi', age: 0 },
    { name: 'Wasi', age: 121 },
    { name: 'Wasi', age: 3.5 },
    { name: 42, age: 32 },
  ])('rejects an impossible profile %o', (bad) => {
    store({ version: 2, profile: bad, people: [], moments: [] });
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
    store({ version: 2, profile, people: [mom, bad], moments: [] });
    expect(loadSky()).toEqual({ profile, people: null, moments: [] });
  });
});
