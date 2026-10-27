import { describe, expect, it } from 'vitest';
import type { Moment } from '../model';
import {
  ageX,
  captionAt,
  layoutConstellation,
  litMoments,
  momentPoint,
  momentProgress,
  momentsSettleAge,
  MOMENT_YEARS,
  playbackSpeed,
  SPARK_YEARS,
} from './momentSky';

const moved: Moment = { id: 'a', title: 'Moved to Dhaka', age: 13, kind: 'home' };
const graduated: Moment = { id: 'b', title: 'Graduated', age: 22, kind: 'milestone' };
const married: Moment = { id: 'c', title: 'Married', age: 26, kind: 'love' };
const moments = [graduated, moved, married];
const constellation = layoutConstellation(1440, 900, 600, 32);

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

describe('constellation', () => {
  it('runs from birth at the left to today at the right', () => {
    expect(ageX(constellation, 0)).toBeCloseTo(1440 * 0.08, 6);
    expect(ageX(constellation, 32)).toBeCloseTo(1440 * 0.92, 6);
  });

  it('keeps each moment’s star in place when others are added', () => {
    const alone = momentPoint(constellation, graduated);
    const withOthers = litMoments(constellation, moments, 30).find((p) => p.moment === graduated)!;
    expect(withOthers.x).toBeCloseTo(alone.x, 6);
    expect(withOthers.y).toBeCloseTo(alone.y, 6);
  });

  it('lights stars in order as their moments arrive', () => {
    expect(litMoments(constellation, moments, 20).map((p) => p.moment.title)).toEqual(['Moved to Dhaka']);
    expect(litMoments(constellation, moments, 30).map((p) => p.moment.title)).toEqual(['Moved to Dhaka', 'Graduated', 'Married']);
  });

  it('lights a milestone only once its spark has landed', () => {
    expect(litMoments(constellation, [graduated], 22 + SPARK_YEARS - 0.01)).toHaveLength(0);
    expect(litMoments(constellation, [graduated], 22 + SPARK_YEARS + 0.01)).toHaveLength(1);
  });

  it('stays between the solar system and the age readout', () => {
    expect(constellation.mid - constellation.wander).toBeGreaterThan(600);
    expect(constellation.mid + constellation.wander).toBeLessThan(900 - 200);
  });
});
