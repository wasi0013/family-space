import { describe, expect, it } from 'vitest';
import { byAge, EMPTY_MOMENT, guessKind, toMoment, toMomentDraft } from './moments';

describe('guessKind', () => {
  it.each([
    ['Moved to Dhaka', 'home'],
    ['Moving to Toronto', 'home'],
    ['Married Rumana', 'love'],
    ['Our wedding', 'love'],
    ['Graduated from BUET', 'milestone'],
    ['First job', 'milestone'],
    ['Started school', 'milestone'],
    ['Lost my job', 'hardship'],
    ['Dad got sick', 'hardship'],
    ['ঢাকায় নতুন বাসায় উঠলাম', 'home'],
    ['বিয়ে', 'love'],
    ['এসএসসি পাস করলাম', 'milestone'],
    ['চাকরি হারালাম', 'hardship'],
  ])('reads “%s” as %s', (title, kind) => {
    expect(guessKind(title)).toBe(kind);
  });

  it('guesses nothing from words that only look like a hint', () => {
    expect(guessKind('A skilled summer')).toBeNull();
    expect(guessKind('Will and Grace')).toBeNull();
    expect(guessKind('')).toBeNull();
  });
});

describe('toMoment', () => {
  const identity = { id: 'm1' };

  it('turns a title and an age into a moment', () => {
    expect(toMoment({ title: ' Moved to Dhaka ', age: '13', kind: 'home' }, 32, identity)).toEqual({
      id: 'm1',
      title: 'Moved to Dhaka',
      age: 13,
      kind: 'home',
    });
  });

  it('reads ages typed in Bengali digits', () => {
    expect(toMoment({ title: 'বিয়ে', age: '২৬', kind: 'love' }, 32, identity)).toMatchObject({ age: 26 });
  });

  it('asks for a title and an age within the life so far', () => {
    expect(toMoment({ ...EMPTY_MOMENT, age: '5' }, 32, identity)).toEqual({ kind: 'title' });
    expect(toMoment({ ...EMPTY_MOMENT, title: 'Graduated', age: '' }, 32, identity)).toEqual({ kind: 'age', max: 32 });
    expect(toMoment({ ...EMPTY_MOMENT, title: 'Graduated', age: '33' }, 32, identity)).toEqual({ kind: 'age', max: 32 });
  });

  it('keeps a note when a moment is edited', () => {
    const graduated = { id: 'm2', title: 'Graduated', age: 22, kind: 'milestone' as const, note: 'Ammu cried' };
    expect(toMoment({ ...toMomentDraft(graduated), age: '23' }, 32, graduated)).toEqual({ ...graduated, age: 23 });
  });
});

describe('byAge', () => {
  it('puts moments in the order they happened', () => {
    const moments = [22, 6, 13].map((age, i) => ({ id: String(i), title: 'x', age, kind: 'milestone' as const }));
    expect(byAge(moments).map((m) => m.age)).toEqual([6, 13, 22]);
  });
});
