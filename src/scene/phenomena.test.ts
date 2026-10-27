import { describe, expect, it } from 'vitest';
import type { Moment, Person } from '../model';
import { ASCEND_YEARS } from './orbits';
import { MOMENT_YEARS, SPARK_YEARS } from './momentSky';
import {
  auroraStrength,
  flareAt,
  GRIEF_YEARS,
  griefAt,
  hardshipDepth,
  loveGlow,
  NOVA_YEARS,
  novaProgress,
  remnantAt,
  REMNANT_YEARS,
  skyAngle,
  sparkProgress,
} from './phenomena';

const graduated: Moment = { id: 'g', title: 'Graduated', age: 22, kind: 'milestone' };
const lostJob: Moment = { id: 'l', title: 'Lost my job', age: 29, kind: 'hardship' };
const moved: Moment = { id: 'm', title: 'Moved', age: 13, kind: 'home' };
const moments = [graduated, lostJob, moved];

describe('milestone flare', () => {
  it('flashes brightest just after the milestone, then settles', () => {
    expect(flareAt(moments, 21.9)).toBeNull();
    expect(flareAt(moments, 22.12)!.flash).toBeCloseTo(0.9, 2);
    expect(flareAt(moments, 22.6)!.flash).toBeLessThan(0.05);
    expect(flareAt(moments, 22 + MOMENT_YEARS.milestone + 0.01)).toBeNull();
  });

  it('only flares for milestones', () => {
    expect(flareAt(moments, 13.1)).toBeNull();
    expect(flareAt(moments, 29.1)).toBeNull();
  });

  it('sends its spark down until the star is lit', () => {
    expect(sparkProgress(graduated, 22.3)).toBeCloseTo(0.3 / SPARK_YEARS, 6);
    expect(sparkProgress(graduated, 22 + SPARK_YEARS + 0.01)).toBeNull();
    expect(sparkProgress(moved, 13.2)).toBeNull();
  });
});

describe('hard time', () => {
  it('settles in, holds, and lifts', () => {
    expect(hardshipDepth(moments, 28.9)).toBe(0);
    expect(hardshipDepth(moments, 29.7)).toBe(1);
    expect(hardshipDepth(moments, 29 + MOMENT_YEARS.hardship)).toBe(0);
  });

  it('darkens and lifts gradually, never in a jump', () => {
    let previous = 0;
    for (let age = 28.9; age < 31; age += 0.01) {
      const depth = hardshipDepth(moments, age);
      expect(Math.abs(depth - previous)).toBeLessThan(0.06);
      previous = depth;
    }
  });
});

describe('new home', () => {
  const another: Moment = { id: 'n', title: 'Moved again', age: 20, kind: 'home' };

  it('turns the sky gently over two years and holds the new angle', () => {
    expect(skyAngle([moved], 12)).toBe(0);
    const settled = skyAngle([moved], 13 + MOMENT_YEARS.home);
    expect(Math.abs(settled)).toBeGreaterThan(0.4);
    expect(skyAngle([moved], 40)).toBeCloseTo(settled, 9);
  });

  it('adds up the turns from every move', () => {
    expect(skyAngle([moved, another], 40)).toBeCloseTo(skyAngle([moved], 40) + skyAngle([another], 40), 9);
  });

  it('turns smoothly, never in a jump', () => {
    let previous = 0;
    for (let age = 12.9; age < 15.2; age += 0.01) {
      const angle = skyAngle([moved], age);
      expect(Math.abs(angle - previous)).toBeLessThan(0.01);
      previous = angle;
    }
  });
});

describe('love', () => {
  const married: Moment = { id: 'w', title: 'Married', age: 26, kind: 'love' };

  it('fills the sky with an aurora that fades into a lasting glow', () => {
    expect(auroraStrength([married], 25.9)).toBe(0);
    expect(auroraStrength([married], 27)).toBe(1);
    expect(auroraStrength([married], 26 + MOMENT_YEARS.love)).toBe(0);
    expect(loveGlow([married], 26.5)).toBe(0);
    expect(loveGlow([married], 40)).toBeCloseTo(0.5, 9);
  });
});

describe('grief and nova', () => {
  const grandma: Person = { id: 'g', name: 'Grandma', bond: 'permanent', joinAge: 0, departAge: 20, color: '#b7a6ff' };
  const friend: Person = { id: 'f', name: 'Sam', bond: 'temporary', joinAge: 5, departAge: 20, color: '#8ff0d2' };

  it('dims your star when someone close becomes a star, and lets the light come back', () => {
    expect(griefAt([grandma], 19.9)).toBe(0);
    expect(griefAt([grandma], 20.5)).toBeCloseTo(0.6, 6);
    expect(griefAt([grandma], 20 + GRIEF_YEARS)).toBe(0);
  });

  it('weighs losses close together more, without ever going fully dark', () => {
    const both = griefAt([grandma, { ...grandma, id: 'p' }], 20.5);
    expect(both).toBeGreaterThan(griefAt([grandma], 20.5));
    expect(both).toBeLessThan(1);
  });

  it('does not grieve someone who drifted away', () => {
    expect(griefAt([friend], 20.5)).toBe(0);
    expect(novaProgress(friend, 22)).toBeNull();
  });

  it('bursts as a nova when they reach the sky', () => {
    expect(novaProgress(grandma, 20 + ASCEND_YEARS - 0.01)).toBeNull();
    expect(novaProgress(grandma, 20 + ASCEND_YEARS + NOVA_YEARS / 2)).toBeCloseTo(0.5, 6);
  });

  it('leaves a nebula that thins over the years and is gone after twenty', () => {
    const burst = 20 + ASCEND_YEARS;
    expect(remnantAt(grandma, burst)).toBe(0);
    expect(remnantAt(grandma, burst + NOVA_YEARS)).toBe(1);
    expect(remnantAt(grandma, burst + 10)).toBeGreaterThan(0.3);
    expect(remnantAt(grandma, burst + 10)).toBeLessThan(0.7);
    expect(remnantAt(grandma, burst + REMNANT_YEARS)).toBeCloseTo(0, 9);
    expect(remnantAt(grandma, burst + 40)).toBe(0);
    let previous = 1;
    for (let age = burst + NOVA_YEARS; age <= burst + REMNANT_YEARS; age += 0.1) {
      const remnant = remnantAt(grandma, age);
      expect(remnant).toBeLessThanOrEqual(previous + 1e-9);
      previous = remnant;
    }
  });
});
