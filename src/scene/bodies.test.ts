import { describe, expect, it } from 'vitest';
import { rhythmOf, twinkleDip } from './bodies';

describe('twinkleDip', () => {
  const samples = (phase: number, tempo = 1) => Array.from({ length: 6000 }, (_, i) => twinkleDip(i * 0.01, { phase, tempo }));

  it('stays between fully bright and fully dimmed', () => {
    for (const dip of samples(1.3)) {
      expect(dip).toBeGreaterThanOrEqual(0);
      expect(dip).toBeLessThanOrEqual(1);
    }
  });

  it('holds steady most of the time, then dims and comes back', () => {
    const dips = samples(0.4);
    const steady = dips.filter((d) => d === 0).length / dips.length;
    expect(steady).toBeGreaterThan(0.4);
    expect(Math.max(...dips)).toBeGreaterThan(0.6);
  });

  it('spreads people with similar names across the rhythm', () => {
    const phases = ['grandma', 'grandpa', 'dad', 'mom', 'nana', 'pop'].map((id) => rhythmOf(id).phase).sort((a, b) => a - b);
    const gaps = phases.slice(1).map((p, i) => p - phases[i]);
    // Six phases bunched within a quarter turn would twinkle almost together.
    expect(phases.at(-1)! - phases[0]).toBeGreaterThan(Math.PI);
    expect(Math.min(...gaps)).toBeGreaterThan(0.05);
  });

  it('lets stars that start in step drift apart', () => {
    const a = samples(1, 0.9);
    const b = samples(1, 1.15);
    const late = (xs: number[]) => xs.slice(3000);
    const same = late(a).filter((d, i) => Math.abs(d - late(b)[i]) < 1e-3).length / 3000;
    expect(same).toBeLessThan(0.6);
  });

  it('twinkles each star on its own rhythm', () => {
    const a = samples(0.4);
    const b = samples(2.9);
    const same = a.filter((d, i) => Math.abs(d - b[i]) < 1e-3).length / a.length;
    expect(same).toBeLessThan(0.6);
  });
});
