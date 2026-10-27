import { describe, expect, it } from 'vitest';
import { kelvinToRgb, saturate, stageAt } from './stellar';

describe('kelvinToRgb', () => {
  it('turns blue-white when hot and red when cool', () => {
    const [hr, , hb] = kelvinToRgb(11000);
    const [cr, cg, cb] = kelvinToRgb(3400);
    expect(hb).toBeGreaterThan(hr);
    expect(cr).toBe(255);
    expect(cb).toBeLessThan(cg);
    expect(cg).toBeLessThan(cr);
  });

  it('is close to white for a sun-like star', () => {
    const [r, g, b] = kelvinToRgb(6500);
    expect(Math.min(r, g, b)).toBeGreaterThan(235);
  });
});

describe('saturate', () => {
  it('keeps the hue but moves it away from white', () => {
    const [r, g, b] = saturate([255, 240, 220], 2);
    expect([r, g, b]).toEqual([255, 225, 185]);
  });
});

describe('stageAt', () => {
  it('cools steadily through a life', () => {
    let previous = Infinity;
    for (let age = 0; age <= 95; age += 0.5) {
      const { kelvin } = stageAt(age);
      expect(kelvin).toBeLessThanOrEqual(previous);
      previous = kelvin;
    }
  });

  it('grows slowly, never shrinking', () => {
    let previous = stageAt(0).scale;
    for (let age = 0; age <= 95; age += 0.5) {
      const { scale } = stageAt(age);
      expect(scale).toBeGreaterThanOrEqual(previous);
      // Never a jump, even as it swells into a supergiant.
      expect(scale - previous).toBeLessThan(0.06);
      previous = scale;
    }
  });

  it('is a young blue-white star in childhood and a sun-like star in its prime', () => {
    const child = stageAt(8);
    expect(child.light[2]).toBeGreaterThanOrEqual(child.light[0]);
    expect(stageAt(30).giant).toBe(0);
  });

  it('starts becoming a red giant around 40', () => {
    expect(stageAt(36).giant).toBe(0);
    expect(stageAt(45).giant).toBeGreaterThan(0);
    expect(stageAt(70).giant).toBe(1);
    const [r, g, b] = stageAt(70).glow;
    expect(r).toBe(255);
    expect(g).toBeLessThan(170);
    expect(b).toBeLessThan(110);
  });

  it('is a colossal red supergiant by 100, like Betelgeuse', () => {
    expect(stageAt(75).supergiant).toBe(0);
    expect(stageAt(100).supergiant).toBe(1);
    expect(stageAt(100).scale).toBeGreaterThanOrEqual(4.5);
    expect(stageAt(100).kelvin).toBeLessThan(3200);
  });
});
