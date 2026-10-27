import { describe, expect, it } from 'vitest';
import type { Moment } from '../model';
import {
  ageX,
  captionAt,
  layoutLifeline,
  lifelineMoments,
  momentProgress,
  momentsSettleAge,
  MOMENT_YEARS,
  placeSkyMoments,
  playbackSpeed,
  RISE_YEARS,
} from './momentSky';

const moved: Moment = { id: 'a', title: 'Moved to Dhaka', age: 13, kind: 'home' };
const graduated: Moment = { id: 'b', title: 'Graduated', age: 22, kind: 'milestone' };
const married: Moment = { id: 'c', title: 'Married', age: 26, kind: 'love' };
const moments = [graduated, moved, married];

describe('playback around moments', () => {
  it('runs at full speed away from any moment', () => {
    expect(playbackSpeed(moments, 5)).toBe(1);
    expect(playbackSpeed(moments, 18)).toBe(1);
  });

  it('slows through a moment’s year and recovers after', () => {
    expect(playbackSpeed(moments, 22.5)).toBeCloseTo(0.44, 6);
    expect(playbackSpeed(moments, 23.5)).toBe(1);
  });

  it('changes speed smoothly, never with a jump', () => {
    let previous = playbackSpeed(moments, 21);
    for (let age = 21.01; age < 24; age += 0.01) {
      const speed = playbackSpeed(moments, age);
      expect(Math.abs(speed - previous)).toBeLessThan(0.05);
      previous = speed;
    }
  });
});

describe('captions', () => {
  it('names a moment as it begins and lets it go after a while', () => {
    expect(captionAt(moments, 12.9)).toBeNull();
    expect(captionAt(moments, 13.2)).toBe(moved);
    expect(captionAt(moments, 15)).toBeNull();
  });

  it('shows the newer of two overlapping moments', () => {
    const both = [moved, { ...graduated, age: 14 }];
    expect(captionAt(both, 14.2)?.title).toBe('Graduated');
  });
});

describe('moment timing', () => {
  it('measures progress through each kind’s own length', () => {
    expect(momentProgress(moved, 12)).toBeNull();
    expect(momentProgress(moved, 14)).toBeCloseTo(0.5, 6);
    expect(momentProgress(moved, 13 + MOMENT_YEARS.home + 0.01)).toBeNull();
  });

  it('lets playback run on until a recent moment has finished', () => {
    expect(momentsSettleAge([{ ...married, age: 32 }], 32)).toBe(32 + MOMENT_YEARS.love);
    expect(momentsSettleAge(moments, 32)).toBe(32);
  });
});

describe('the lifeline', () => {
  const line = layoutLifeline(390, 714, 32);
  const departed = { left: 220, right: 290, top: 120, bottom: 160 };
  const stars = placeSkyMoments(line, moments, 90, 240, [departed]);

  it('keeps a comfortable span on wide screens, centred', () => {
    const wide = layoutLifeline(1920, 1080, 32);
    expect(wide.right - wide.left).toBe(1000);
    expect(wide.left).toBe(460);
  });

  it('runs above the age readout, birth to today across the screen', () => {
    expect(line.y).toBeLessThan(714 - 180);
    expect(ageX(line, 0)).toBeCloseTo(390 * 0.08);
    expect(ageX(line, 32)).toBeCloseTo(390 * 0.92);
  });

  it('puts each moment in the sky straight above its year, inside the band', () => {
    for (const moment of moments) {
      const star = stars.get(moment.id)!;
      expect(star.x).toBeCloseTo(ageX(line, moment.age));
      expect(star.y).toBeGreaterThanOrEqual(90);
      expect(star.y).toBeLessThanOrEqual(240);
    }
  });

  it('keeps clear of the stars and names of those who have died', () => {
    const inside = (p: { x: number; y: number }) =>
      p.x > departed.left && p.x < departed.right && p.y > departed.top && p.y < departed.bottom;
    // Graduated, at 22, sits right under that name.
    expect(ageX(line, 22)).toBeGreaterThan(departed.left);
    expect(ageX(line, 22)).toBeLessThan(departed.right);
    for (const star of stars.values()) expect(inside(star)).toBe(false);
  });

  it('is placed the same way every time', () => {
    expect(placeSkyMoments(line, [...moments].reverse(), 90, 240, [departed])).toEqual(stars);
  });

  it("lights a moment's bead as it begins, then its star once the light has risen", () => {
    const at = (age: number) => lifelineMoments(line, stars, moments, age).find((m) => m.moment.id === moved.id);
    expect(at(12.9)).toBeUndefined();
    expect(at(13.1)).toMatchObject({ starLit: 0 });
    expect(at(13.1)!.rise).toBeGreaterThan(0);
    expect(at(13.4)!.beadLit).toBe(1);
    expect(at(13 + RISE_YEARS + 0.3)).toMatchObject({ beadLit: 1, starLit: 1, rise: null });
    expect(lifelineMoments(line, stars, moments, 30).map((m) => m.moment.id)).toEqual(['a', 'b', 'c']);
  });
});
