import { describe, expect, it } from 'vitest';
import type { Bond, Person } from '../model';
import {
  ARRIVE_YEARS,
  ASCEND_YEARS,
  CLOSE_RANKS_YEARS,
  frameBodies,
  layoutScene,
  settleAge,
  SHOOT_YEARS,
  THREAD_FADE_YEARS,
  type BodyFrame,
  type Layout,
} from './orbits';
import { samplePeople } from './samplePeople';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SELF_Y = 0.56;

function person(id: string, bond: Bond, joinAge: number, departAge: number | null): Person {
  return { id, name: id, bond, joinAge, departAge, color: '#ffffff' };
}

function layout(people: Person[], screen = DESKTOP): Layout {
  return layoutScene(people, screen.width, screen.height, SELF_Y);
}

function frameOf(scene: Layout, id: string, age: number, idleSeconds = 0): BodyFrame | undefined {
  return frameBodies(scene, age, idleSeconds).find((f) => f.person.id === id);
}

describe('settleAge', () => {
  it('is the current age when nobody has left yet', () => {
    expect(settleAge([person('mom', 'permanent', 0, null)], 30)).toBe(30);
  });

  it('runs past the current age so a recent departure can finish', () => {
    expect(settleAge([person('sam', 'temporary', 2, 30)], 30)).toBe(30 + SHOOT_YEARS);
    expect(settleAge([person('dad', 'permanent', 0, 30)], 30)).toBe(30 + ASCEND_YEARS + THREAD_FADE_YEARS);
  });

  it('ignores departures that happen after the current age', () => {
    expect(settleAge([person('dad', 'permanent', 0, 50)], 30)).toBe(30);
  });
});

describe('who is in the sky', () => {
  const people = [person('mom', 'permanent', 0, null), person('leo', 'permanent', 20, null)];

  it('leaves people out before they arrive', () => {
    expect(frameOf(layout(people), 'leo', 19.9)).toBeUndefined();
    expect(frameOf(layout(people), 'leo', 20.5)).toBeDefined();
  });

  it('fades people up as they arrive', () => {
    const scene = layout(people);
    expect(frameOf(scene, 'leo', 20.1)!.alpha).toBeLessThan(frameOf(scene, 'leo', 20 + ARRIVE_YEARS)!.alpha);
  });

  it('gives the same picture for the same moment', () => {
    expect(frameBodies(layout(people), 12.3, 4)).toEqual(frameBodies(layout(people), 12.3, 4));
  });

  it('keeps turning while paused without moving anyone between lanes', () => {
    const scene = layout(people);
    const before = frameOf(scene, 'mom', 10, 0)!;
    const after = frameOf(scene, 'mom', 10, 20)!;
    expect(after.x).not.toBeCloseTo(before.x, 1);
    expect(after.orbitRadius).toBeCloseTo(before.orbitRadius!, 6);
  });
});

describe('lanes', () => {
  // Grandpa holds the inner lane until he leaves at 10; Leo arrives later, outside him.
  const people = [person('grandpa', 'permanent', 0, 10), person('leo', 'permanent', 4, null)];

  it('puts later arrivals outside the people already there', () => {
    const scene = layout(people);
    expect(frameOf(scene, 'leo', 8)!.orbitRadius).toBeCloseTo(scene.minRadius + scene.laneGap, 6);
    expect(frameOf(scene, 'grandpa', 8)!.orbitRadius).toBeCloseTo(scene.minRadius, 6);
  });

  it('closes ranks once someone further in has left', () => {
    const scene = layout(people);
    expect(frameOf(scene, 'leo', 10 + CLOSE_RANKS_YEARS)!.orbitRadius).toBeCloseTo(scene.minRadius, 6);
  });

  it('moves inward smoothly, never jumping', () => {
    const scene = layout(people);
    let previous = frameOf(scene, 'leo', 9.9)!.orbitRadius!;
    for (let age = 9.91; age <= 10 + CLOSE_RANKS_YEARS + 0.1; age += 0.01) {
      const radius = frameOf(scene, 'leo', age)!.orbitRadius!;
      expect(radius).toBeLessThanOrEqual(previous + 1e-9);
      expect(previous - radius).toBeLessThan(scene.laneGap * 0.02);
      previous = radius;
    }
  });

  it('brings late arrivals close to the star even after many people have left', () => {
    const crowd = samplePeople(32, 'crowd');
    const scene = layout(crowd);
    const lateRadii = ['leo', 'nora', 'theo'].map((id) => frameOf(scene, id, 32)!.orbitRadius!);
    // Mom is the only earlier arrival still orbiting, so the three settle in lanes 2–4.
    expect(Math.max(...lateRadii)).toBeLessThanOrEqual(scene.minRadius + scene.laneGap * 3 + 1e-6);
  });

  it('stays compact on a wide screen', () => {
    const scene = layout(samplePeople(32));
    for (const frame of frameBodies(scene, 20, 0)) {
      if (frame.orbitRadius !== null) expect(frame.orbitRadius).toBeLessThanOrEqual(460);
    }
  });

  it('fits a busy life on a narrow phone', () => {
    const scene = layout(samplePeople(32, 'crowd'), PHONE);
    const settled = frameBodies(scene, 1 + ARRIVE_YEARS, 0).filter((f) => f.orbitRadius !== null);
    expect(settled.length).toBeGreaterThan(10);
    for (const frame of settled) expect(frame.orbitRadius!).toBeLessThanOrEqual(PHONE.width * 0.44 + 1e-6);
  });
});

describe('departures', () => {
  const people = [person('sam', 'temporary', 2, 12), person('dad', 'permanent', 0, 20)];

  it('lets a temporary person leave from where they were, with no jump', () => {
    const scene = layout(people);
    const before = frameOf(scene, 'sam', 12 - 1e-6)!;
    const after = frameOf(scene, 'sam', 12 + 1e-6)!;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
    expect(after.trailKind).toBe('streak');
  });

  it('fades a shooting star out and then lets it go', () => {
    const scene = layout(people);
    expect(frameOf(scene, 'sam', 12 + SHOOT_YEARS * 0.9)!.alpha).toBeLessThan(0.2);
    expect(frameOf(scene, 'sam', 12 + SHOOT_YEARS + 0.01)).toBeUndefined();
  });

  it('lets a permanent person rise from where they were, with no jump', () => {
    const scene = layout(people);
    const before = frameOf(scene, 'dad', 20 - 1e-6)!;
    const after = frameOf(scene, 'dad', 20 + 1e-6)!;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  });

  it('settles a permanent person at their own place in the upper sky, and keeps them', () => {
    const scene = layout(people);
    const slot = scene.tracks.find((t) => t.person.id === 'dad')!.slot!;
    for (const age of [20 + ASCEND_YEARS, 40, 80]) {
      const frame = frameOf(scene, 'dad', age)!;
      expect(frame.memorial).toBe(true);
      expect(frame.x).toBeCloseTo(slot.x, 6);
      expect(frame.y).toBeCloseTo(slot.y, 6);
    }
    expect(slot.y).toBeLessThan(scene.cy);
  });

  it('only gives a place in the sky to permanent people who leave', () => {
    const scene = layout([...people, person('mom', 'permanent', 0, null)]);
    const slots = Object.fromEntries(scene.tracks.map((t) => [t.person.id, t.slot]));
    expect(slots.dad).not.toBeNull();
    expect(slots.sam).toBeNull();
    expect(slots.mom).toBeNull();
  });

  it('spreads many memorial stars so none share a place', () => {
    const scene = layout(samplePeople(32, 'crowd'));
    const slots = scene.tracks.flatMap((t) => (t.slot ? [t.slot] : []));
    expect(slots).toHaveLength(10);
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThan(40);
      }
    }
  });
});

describe('people passing through', () => {
  const sam = person('sam', 'temporary', 10, 20);
  const mom = person('mom', 'permanent', 0, null);
  const distance = (scene: Layout, age: number) => {
    const f = frameOf(scene, 'sam', age)!;
    return Math.hypot(f.x - scene.cx, (f.y - scene.cy) / scene.tilt);
  };

  it('pass by once like a comet: in from far away, close in the middle, out again', () => {
    const scene = layout([mom, sam]);
    const start = distance(scene, 10);
    const middle = distance(scene, 15);
    const end = distance(scene, 20 - 1e-6);
    expect(start).toBeGreaterThan(scene.reach * 0.9);
    expect(middle).toBeLessThan(scene.minRadius * 1.5);
    expect(end).toBeGreaterThan(scene.reach * 0.5);
    expect(end).toBeLessThan(start);
  });

  it('spend most of their stay swinging close by', () => {
    const scene = layout([mom, sam]);
    const close = Array.from({ length: 101 }, (_, i) => distance(scene, 10 + i / 10)).filter((d) => d < scene.reach * 0.4);
    expect(close.length).toBeGreaterThan(50);
  });

  it('never take an orbit, so permanent people keep theirs', () => {
    const withComet = layout([sam, person('leo', 'permanent', 12, null)]);
    expect(frameOf(withComet, 'leo', 15)!.orbitRadius).toBeCloseTo(withComet.minRadius, 6);
    expect(frameOf(withComet, 'sam', 15)!.orbitRadius).toBeNull();
  });

  it('carry a tail that points away from your star', () => {
    const scene = layout([sam]);
    const f = frameOf(scene, 'sam', 15)!;
    const tailEnd = f.trail[0];
    const fromStar = Math.hypot(f.x - scene.cx, f.y - scene.cy);
    expect(Math.hypot(tailEnd.x - scene.cx, tailEnd.y - scene.cy)).toBeGreaterThan(fromStar);
  });

  it('move smoothly along their pass', () => {
    const scene = layout([sam]);
    let previous = frameOf(scene, 'sam', 10.5)!;
    for (let age = 10.51; age < 19.5; age += 0.01) {
      const f = frameOf(scene, 'sam', age)!;
      expect(Math.hypot(f.x - previous.x, f.y - previous.y)).toBeLessThan(8);
      previous = f;
    }
  });
});

describe('samplePeople', () => {
  it('names the sample family in Bengali without moving anyone in the sky', () => {
    const english = samplePeople(32, 'crowd');
    const bengali = samplePeople(32, 'crowd', 'bn');
    expect(bengali.map((p) => p.id)).toEqual(english.map((p) => p.id));
    expect(bengali.every((p) => /^[\u0980-\u09ff ]+$/.test(p.name))).toBe(true);
    expect(frameBodies(layout(bengali), 20, 0).map((f) => [f.x, f.y])).toEqual(
      frameBodies(layout(english), 20, 0).map((f) => [f.x, f.y]),
    );
  });

  it.each([1, 2, 5, 32, 90])('makes a valid life for a %i-year-old', (age) => {
    for (const p of [...samplePeople(age), ...samplePeople(age, 'crowd')]) {
      expect(p.joinAge).toBeGreaterThanOrEqual(0);
      if (p.departAge !== null) expect(p.departAge).toBeGreaterThan(p.joinAge);
    }
  });
});
