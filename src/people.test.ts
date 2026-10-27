import { describe, expect, it } from 'vitest';
import type { Person } from './model';
import { asciiDigits, EMPTY_DRAFT, nextColor, toDraft, toPerson, type Draft } from './people';

const identity = { id: 'id-1', color: '#ff8a7a' };
const draft = (patch: Partial<Draft>): Draft => ({ ...EMPTY_DRAFT, ...patch });

describe('toPerson', () => {
  it('turns a bare name into someone with you since birth and still here', () => {
    expect(toPerson(draft({ name: '  Mom ' }), 32, identity)).toEqual({
      ...identity,
      name: 'Mom',
      bond: 'permanent',
      joinAge: 0,
      departAge: null,
    });
  });

  it('makes people who drifted away temporary and people who became stars permanent', () => {
    const drifted = toPerson(draft({ name: 'Sam', arrival: 'later', joinAge: '5', ending: 'drifted', departAge: '16' }), 32, identity);
    const star = toPerson(draft({ name: 'Grandma', ending: 'star', departAge: '8' }), 32, identity);
    expect(drifted).toMatchObject({ bond: 'temporary', joinAge: 5, departAge: 16 });
    expect(star).toMatchObject({ bond: 'permanent', joinAge: 0, departAge: 8 });
  });

  it('keeps a memory when someone is edited', () => {
    const grandma: Person = { ...identity, name: 'Grandma', bond: 'permanent', joinAge: 0, departAge: 8, memory: 'Baked bread' };
    const edited = toPerson({ ...toDraft(grandma), departAge: '9' }, 32, grandma);
    expect(edited).toMatchObject({ departAge: 9, memory: 'Baked bread' });
  });

  it('asks for a name', () => {
    expect(toPerson(draft({ name: '   ' }), 32, identity)).toEqual({ kind: 'name' });
  });

  it('reads ages typed in Bengali digits', () => {
    expect(toPerson(draft({ name: 'দাদি', ending: 'star', departAge: '১২' }), 32, identity)).toMatchObject({ departAge: 12 });
    expect(asciiDigits('৩২ বছর')).toBe('32 বছর');
  });

  it('keeps ages within the life so far', () => {
    expect(toPerson(draft({ name: 'Leo', arrival: 'later', joinAge: '40' }), 32, identity)).toEqual({ kind: 'arrival', max: 32 });
    expect(toPerson(draft({ name: 'Leo', arrival: 'later', joinAge: '' }), 32, identity)).toEqual({ kind: 'arrival', max: 32 });
    expect(toPerson(draft({ name: 'Dad', ending: 'star', departAge: '33' }), 32, identity)).toEqual({
      kind: 'departure',
      ending: 'star',
      from: 1,
      max: 32,
    });
  });

  it('needs someone to leave after they arrived', () => {
    expect(
      toPerson(draft({ name: 'Maya', arrival: 'later', joinAge: '18', ending: 'drifted', departAge: '18' }), 32, identity),
    ).toEqual({ kind: 'departure', ending: 'drifted', from: 19, max: 32 });
  });

  it('explains when someone arrived too recently to have left', () => {
    expect(
      toPerson(draft({ name: 'Nora', arrival: 'later', joinAge: '32', ending: 'drifted', departAge: '32' }), 32, identity),
    ).toEqual({ kind: 'tooRecent', joinAge: 32 });
  });
});

describe('toDraft', () => {
  it.each([
    draft({ name: 'Mom' }),
    draft({ name: 'Sam', arrival: 'later', joinAge: '5', ending: 'drifted', departAge: '16' }),
    draft({ name: 'Grandma', ending: 'star', departAge: '8' }),
  ])('loads $name back into the form exactly as entered', (entered) => {
    const person = toPerson(entered, 32, identity) as Person;
    expect(toDraft(person)).toEqual(entered);
  });
});

describe('nextColor', () => {
  const withColor = (color: string): Person => ({ ...identity, color, name: 'x', bond: 'permanent', joinAge: 0, departAge: null });

  it('hands out a different color to each new person', () => {
    const first = nextColor([]);
    const second = nextColor([withColor(first)]);
    expect(second).not.toBe(first);
  });

  it('reuses a color once its person has been removed', () => {
    const first = nextColor([]);
    expect(nextColor([withColor('#123456')])).toBe(first);
  });
});
