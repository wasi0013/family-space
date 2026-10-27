import { describe, expect, it } from 'vitest';
import type { Person } from '../model';
import { bn, objective, possessive } from './bn';
import { en } from './en';
import { pickLang } from './index';
import type { Strings } from './strings';

const base = { id: 'x', color: '#ffffff' };
const grandma: Person = { ...base, name: 'Grandma', bond: 'permanent', joinAge: 0, departAge: 8 };
const sam: Person = { ...base, name: 'Sam', bond: 'temporary', joinAge: 5, departAge: 16 };
const mom: Person = { ...base, name: 'Mom', bond: 'permanent', joinAge: 0, departAge: null };

describe('choosing the language', () => {
  it('is Bengali only when the link asks for it', () => {
    expect(pickLang('bn')).toBe('bn');
    expect(pickLang(null)).toBe('en');
    expect(pickLang('en')).toBe('en');
    expect(pickLang('fr')).toBe('en');
  });

  it('is Bengali on the /bn page', () => {
    expect(pickLang(null, '/bn/')).toBe('bn');
    expect(pickLang(null, '/bn')).toBe('bn');
    expect(pickLang(null, '/')).toBe('en');
    expect(pickLang(null, '/bnx')).toBe('en');
  });
});

describe('English', () => {
  it('summarises a life span for the chips', () => {
    expect(en.lifeSpan(grandma)).toBe('birth–8 ✦');
    expect(en.lifeSpan(sam)).toBe('5–16 ↗');
    expect(en.lifeSpan(mom)).toBe('birth–now');
  });

  it('tells someone’s place in your life for the memory card', () => {
    expect(en.journeyLine(grandma)).toBe('From birth until 8 · now a star');
    expect(en.journeyLine(sam)).toBe('From 5 until 16 · drifted away');
    expect(en.journeyLine(mom)).toBe('With you since birth');
    expect(en.journeyLine({ ...mom, joinAge: 22 })).toBe('With you since you were 22');
  });

  it('describes someone passing through', () => {
    const rafi: Person = { ...base, name: 'Rafi', bond: 'temporary', joinAge: 28, departAge: null };
    expect(en.lifeSpan(rafi)).toBe('28–now ☄');
    expect(en.journeyLine(rafi)).toBe('Passing through, since you were 28');
    expect(bn.journeyLine(rafi)).toBe('২৮ বছর বয়স থেকে আপনার সাথে · কিছুদিনের সঙ্গী');
  });

  it('describes someone in a full sentence', () => {
    expect(en.describe(grandma)).toBe('Grandma, with you since birth, became a star at 8');
    expect(en.describe(sam)).toBe('Sam, with you since you were 5, drifted away at 16');
  });

  it('puts each problem with a draft into words', () => {
    expect(en.problem({ kind: 'name' })).toBe('Give them a name.');
    expect(en.problem({ kind: 'departure', ending: 'drifted', from: 19, max: 32 })).toBe(
      'Enter the age they drifted away, from 19 to 32.',
    );
  });
});

describe('Bengali', () => {
  it('writes numbers in Bengali digits', () => {
    expect(bn.num(2024)).toBe('২০২৪');
    expect(bn.num('0:07')).toBe('০:০৭');
    expect(bn.step(1, 3)).toBe('১ / ৩');
  });

  it('summarises a life span for the chips', () => {
    expect(bn.lifeSpan(grandma)).toBe('জন্ম–৮ ✦');
    expect(bn.lifeSpan(sam)).toBe('৫–১৬ ↗');
    expect(bn.lifeSpan(mom)).toBe('জন্ম–এখন');
  });

  it('tells someone’s place in your life for the memory card', () => {
    expect(bn.journeyLine(grandma)).toBe('জন্ম থেকে ৮ বছর বয়স পর্যন্ত · এখন একটি তারা');
    expect(bn.journeyLine(sam)).toBe('৫ থেকে ১৬ বছর বয়স পর্যন্ত · দূরে সরে গেছেন');
    expect(bn.journeyLine(mom)).toBe('জন্ম থেকে আপনার সাথে');
  });

  it('puts problems into words with Bengali digits', () => {
    expect(bn.problem({ kind: 'departure', ending: 'star', from: 1, max: 32 })).toBe(
      'কত বছর বয়সে তারা হয়ে গেছেন, তা ১ থেকে ৩২-এর মধ্যে লিখুন।',
    );
  });

  it('joins case endings to Bengali names, and hyphenates others', () => {
    expect(objective('মা')).toBe('মাকে');
    expect(objective('রহিম')).toBe('রহিমকে');
    expect(objective('Alex')).toBe('Alex-কে');
    expect(possessive('মা')).toBe('মার');
    expect(possessive('দাদি')).toBe('দাদির');
    expect(possessive('রহিম')).toBe('রহিমের');
    expect(possessive('Alex')).toBe('Alex-এর');
    expect(bn.memoryPlaceholder('দাদি')).toBe('দাদির একটি স্মৃতি…');
  });
});

describe('both languages', () => {
  const people = [grandma, sam, mom];

  it.each([
    ['en', en],
    ['bn', bn],
  ] as [string, Strings][])('%s has every phrase filled in', (_, strings) => {
    const empty = Object.entries(strings).filter(([, value]) => value === '' || (Array.isArray(value) && value.some((v) => !v)));
    expect(empty).toEqual([]);
    for (const person of people) {
      for (const phrase of [strings.lifeSpan(person), strings.describe(person), strings.journeyLine(person)]) {
        expect(phrase.length).toBeGreaterThan(0);
        expect(phrase).not.toContain('undefined');
      }
    }
  });

  it('keeps Bengali free of stray English words', () => {
    const phrases = [
      bn.tagline,
      bn.askName,
      bn.askAge,
      bn.askPeople,
      bn.peopleLede,
      bn.recordJourney,
      ...people.flatMap((p) => [bn.describe(p).replace(p.name, ''), bn.journeyLine(p), bn.lifeSpan(p)]),
    ];
    for (const phrase of phrases) expect(phrase).not.toMatch(/[A-Za-z]/);
  });
});
