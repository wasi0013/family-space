import { describe, expect, it } from 'vitest';
import { exampleSky } from './example';
import type { Moment, Person, Profile } from './model';
import { MAX_MOMENTS, MAX_PEOPLE, readSkyFile, SKY_FILE_MAX_BYTES, toSkyFile } from './skyFile';

const profile: Profile = { name: 'Alex', age: 40 };
const mom: Person = { id: 'mom', name: 'Mom', bond: 'permanent', joinAge: 0, departAge: 31, color: '#ff8a7a', memory: 'Sang while she cooked' };
const sam: Person = { id: 'sam', name: 'Sam', bond: 'temporary', joinAge: 5, departAge: null, color: '#8ff0d2' };
const moved: Moment = { id: 'm1', title: 'Moved to Chicago', age: 18, kind: 'home', note: 'Two suitcases' };
const sky = { profile, people: [mom, sam], moments: [moved] };

const file = (overrides: Record<string, unknown> = {}) => JSON.stringify({ ...toSkyFile(sky), ...overrides });
const withPerson = (person: unknown) => file({ people: [mom, person] });
const withMoment = (moment: unknown) => file({ moments: [moment] });
const opened = (text: string) => ('sky' in readSkyFile(text) ? (readSkyFile(text) as { sky: typeof sky }).sky : null);
const problem = (text: string) => ('problem' in readSkyFile(text) ? (readSkyFile(text) as { problem: string }).problem : null);

describe('a sky file', () => {
  it('opens to exactly the sky that was saved', () => {
    expect(opened(JSON.stringify(toSkyFile(sky)))).toEqual(sky);
  });

  it.each(['en', 'bn'] as const)('carries the whole example life in %s', (lang) => {
    const example = exampleSky(lang);
    expect(opened(JSON.stringify(toSkyFile(example)))).toEqual(example);
  });

  it('can leave out every memory and note', () => {
    const bare = toSkyFile(sky, false);
    expect(bare.people.some((p) => 'memory' in p)).toBe(false);
    expect(bare.moments.some((m) => 'note' in m)).toBe(false);
  });

  it('hands on only the fields a sky has', () => {
    const extra = { ...sky, profile: { ...profile, email: 'a@b.c' }, people: [{ ...mom, secret: 1 }], moments: [] };
    expect(JSON.stringify(toSkyFile(extra as typeof sky))).not.toMatch(/email|secret/);
  });
});

describe('reading a file from someone else', () => {
  it.each(['', '{not json', 'null', '[]', '42', '"sky"', JSON.stringify({ version: 1, profile, people: [], moments: [] })])(
    'refuses anything that is not a sky file: %s',
    (text) => expect(problem(text)).toBe('notSky'),
  );

  it('says when a file comes from a newer Family Space', () => {
    expect(problem(file({ version: 2 }))).toBe('newer');
  });

  it.each([0, '1', null])('refuses an unknown version %o', (version) => {
    expect(problem(file({ version }))).toBe('damaged');
  });

  it('refuses a file larger than any real sky before reading it', () => {
    expect(problem(file({ padding: 'x'.repeat(SKY_FILE_MAX_BYTES) }))).toBe('tooLarge');
  });

  it('refuses more people or moments than a sky can hold', () => {
    const crowd = Array.from({ length: MAX_PEOPLE + 1 }, (_, i) => ({ ...sam, id: `p${i}` }));
    const busy = Array.from({ length: MAX_MOMENTS + 1 }, (_, i) => ({ ...moved, id: `m${i}` }));
    expect(problem(file({ people: crowd }))).toBe('damaged');
    expect(problem(file({ moments: busy }))).toBe('damaged');
  });

  it.each([
    { name: '', age: 40 },
    { name: '   ', age: 40 },
    { name: 'x'.repeat(41), age: 40 },
    { name: 'Alex', age: 0 },
    { name: 'Alex', age: 121 },
    { name: 'Alex', age: 40.5 },
    { name: 'Alex', age: '40' },
    { name: ['Alex'], age: 40 },
    null,
    'Alex',
  ])('refuses an impossible profile %o', (bad) => {
    expect(problem(file({ profile: bad }))).toBe('damaged');
  });

  it.each([
    { ...sam, bond: 'sometimes' },
    { ...sam, name: '' },
    { ...sam, name: 'x'.repeat(25) },
    { ...sam, name: { toString: 'Sam' } },
    { ...sam, joinAge: -1 },
    { ...sam, joinAge: 41 },
    { ...sam, joinAge: 2.5 },
    { ...sam, joinAge: 1e400 },
    { ...sam, departAge: 5 },
    { ...sam, departAge: 41 },
    { ...sam, departAge: undefined },
    { ...sam, color: 'red' },
    { ...sam, color: 'url(javascript:alert(1))' },
    { ...sam, color: '#ff8a7a; background: red' },
    { ...sam, memory: 42 },
    { ...sam, memory: 'x'.repeat(201) },
    [],
    null,
  ])('refuses the whole file for one impossible person %o', (bad) => {
    expect(problem(withPerson(bad))).toBe('damaged');
  });

  it.each([
    { ...moved, kind: 'birthday' },
    { ...moved, kind: '__proto__' },
    { ...moved, age: 41 },
    { ...moved, age: 1.5 },
    { ...moved, title: '  ' },
    { ...moved, title: 'x'.repeat(61) },
    { ...moved, note: 7 },
  ])('refuses the whole file for one impossible moment %o', (bad) => {
    expect(problem(withMoment(bad))).toBe('damaged');
  });

  it('keeps only the fields a sky has, so planted ones go nowhere', () => {
    const text = file({ people: [JSON.parse(`{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},${JSON.stringify(sam).slice(1)}`)] });
    const read = opened(text)!;
    expect(read.people[0]).toEqual(sam);
    expect(Object.getPrototypeOf(read.people[0])).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(opened(file({ extra: '<script>' }))).toEqual(sky);
  });

  it('keeps text as text, markup and all, for the screen to show as written', () => {
    const name = '<img src=x onerror=alert(1)>';
    expect(opened(file({ profile: { name: name.slice(0, 40), age: 40 } }))?.profile.name).toBe(name.slice(0, 40));
  });

  it('takes out the hidden marks that could make a name read as something else', () => {
    const read = opened(withPerson({ ...sam, name: 'Sam‮gnp.exe\u0000', memory: '‏Hi⁦' }))!;
    expect(read.people[1].name).toBe('Samgnp.exe');
    expect(read.people[1].memory).toBe('Hi');
  });

  it('keeps the joiners Bengali spelling needs', () => {
    const name = 'র‍যাব';
    expect(opened(withPerson({ ...sam, name }))!.people[1].name).toBe(name);
  });

  it('gives a fresh id to any star whose id is missing, odd or taken', () => {
    const read = opened(file({ people: [mom, { ...sam, id: 'mom' }, { ...sam, id: 'a b<' }, { ...sam, id: 'x'.repeat(65) }, { ...sam, id: undefined }] }))!;
    const ids = read.people.map((p) => p.id);
    expect(ids[0]).toBe('mom');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))).toBe(true);
  });

  it('never lets a moment share an id with a person', () => {
    const read = opened(file({ moments: [{ ...moved, id: 'mom' }] }))!;
    expect(read.moments[0].id).not.toBe('mom');
  });
});
