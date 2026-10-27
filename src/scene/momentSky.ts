/** Where moments sit and how they unfold, as pure functions of age like the orbits. */
import type { Moment, MomentKind } from '../model';
import { clamp01, type Point } from './orbits';

/** How long each kind of moment plays across the sky, in years of the life. */
export const MOMENT_YEARS: Record<MomentKind, number> = { milestone: 1, home: 2, love: 2.2, hardship: 1.5 };
/** Playback slows to this share of its speed through a moment, so it can be felt and read. */
const SLOW_SHARE = 0.44;
/** The caption naming a moment shows for this long after it begins. */
const CAPTION_YEARS = 1.4;
/** A milestone's spark takes this long to reach the constellation and light its star. */
export const SPARK_YEARS = 0.6;
/** Space kept below the constellation for the age readout and its caption. */
const HUD_CLEARANCE = 236;

/** 1 normally, easing down shortly before each moment and back up as its year passes. */
export function playbackSpeed(moments: readonly Moment[], age: number): number {
  let speed = 1;
  for (const moment of moments) {
    const t = age - moment.age;
    const within = smoothstep(-0.25, 0, t) * (1 - smoothstep(0.9, 1.3, t));
    speed = Math.min(speed, 1 - (1 - SLOW_SHARE) * within);
  }
  return speed;
}

/** The moment whose caption shows at `age`: the latest one begun within the caption's time. */
export function captionAt(moments: readonly Moment[], age: number): Moment | null {
  let current: Moment | null = null;
  for (const moment of moments) {
    const t = age - moment.age;
    if (t >= 0 && t < CAPTION_YEARS && (!current || moment.age >= current.age)) current = moment;
  }
  return current;
}

/** Progress through a moment, 0 → 1, or null outside it. */
export function momentProgress(moment: Moment, age: number): number | null {
  const t = (age - moment.age) / MOMENT_YEARS[moment.kind];
  return t >= 0 && t <= 1 ? t : null;
}

/** The age at which every moment up to `currentAge` has finished playing. */
export function momentsSettleAge(moments: readonly Moment[], currentAge: number): number {
  let end = currentAge;
  for (const moment of moments) {
    if (moment.age <= currentAge) end = Math.max(end, moment.age + MOMENT_YEARS[moment.kind]);
  }
  return end;
}

/**
 * The constellation runs low across the sky, birth at the left edge and today at the right, in a
 * band between the solar system and the age readout.
 */
export interface Constellation {
  left: number;
  right: number;
  mid: number;
  /** How far stars wander above and below the middle of the band. */
  wander: number;
  baseline: number;
  lifespan: number;
}

export function layoutConstellation(
  width: number,
  height: number,
  systemBottom: number,
  lifespan: number,
): Constellation {
  const bottom = height - HUD_CLEARANCE;
  // Keep at least a narrow band even when a crowded system reaches low on a short screen.
  const top = Math.min(systemBottom + 36, bottom - 40);
  return {
    left: width * 0.08,
    right: width * 0.92,
    mid: (top + bottom) / 2,
    wander: Math.min(16, (bottom - top) * 0.25),
    baseline: bottom + 8,
    lifespan: Math.max(1, lifespan),
  };
}

export interface MomentPoint extends Point {
  moment: Moment;
  /** How lit the star is, 0 → 1: it appears as its moment begins (a milestone's when its spark lands). */
  lit: number;
}

export function ageX(c: Constellation, age: number): number {
  return c.left + ((c.right - c.left) * Math.min(age, c.lifespan)) / c.lifespan;
}

function seed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

/** Where a moment's star sits; its height wanders, seeded by the moment so it never moves. */
export function momentPoint(c: Constellation, moment: Moment): Point {
  return { x: ageX(c, moment.age), y: c.mid + Math.sin(moment.age * 0.7 + seed(moment.id)) * c.wander };
}

/** The stars lit by `age`, in the order they happened. */
export function litMoments(c: Constellation, moments: readonly Moment[], age: number): MomentPoint[] {
  const points: MomentPoint[] = [];
  for (const moment of [...moments].sort((a, b) => a.age - b.age)) {
    const delay = moment.kind === 'milestone' ? SPARK_YEARS : 0;
    const lit = clamp01((age - moment.age - delay) / 0.3);
    if (age >= moment.age + delay) points.push({ ...momentPoint(c, moment), moment, lit });
  }
  return points;
}

/** The gold point marking "now" on the constellation. */
export function nowPoint(c: Constellation, age: number): Point {
  return { x: ageX(c, age), y: c.mid };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
