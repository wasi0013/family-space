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

export function ageX(c: Pick<Constellation, 'left' | 'right' | 'lifespan'>, age: number): number {
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

/*
 * On a phone there is no room for a constellation of named moments between the solar system and
 * the age, so the years become a lifeline instead: one thread of light just above the age, with a
 * bead for each moment. As a moment plays its light rises from the bead into the sky, where the
 * moments gather as a constellation of their own, straight above their years and named only when
 * tapped.
 */

/** Narrower than this, moments take the lifeline and the sky instead of the constellation. */
export const LIFELINE_MAX_WIDTH = 640;
/** How far above the bottom of the screen the lifeline runs, clear of the age readout. */
const LIFELINE_LIFT = 212;
/** How long a moment's light takes to rise from the lifeline to its place in the sky. */
export const RISE_YEARS = 0.7;

export function usesLifeline(width: number): boolean {
  return width < LIFELINE_MAX_WIDTH;
}

export interface Lifeline {
  left: number;
  right: number;
  y: number;
  lifespan: number;
}

export function layoutLifeline(width: number, height: number, lifespan: number): Lifeline {
  return { left: width * 0.08, right: width * 0.92, y: height - LIFELINE_LIFT, lifespan: Math.max(1, lifespan) };
}

/** A region of the sky to keep clear, such as a departed person's star and name. */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Up to this much clearance counts; beyond it every spot is as good as another. */
const ENOUGH_CLEARANCE = 20;
/** Closer than this to another star or a name, a moment's star would crowd it. */
const MIN_CLEARANCE = 10;

/**
 * Where each moment's star sits in the sky: straight above its year, at the height in the band
 * between `top` and `bottom` that keeps it clearest of `avoid` and of the moments before it,
 * drifting up and down from one to the next so they read as a constellation rather than a row.
 */
export function placeSkyMoments(
  line: Lifeline,
  moments: readonly Moment[],
  top: number,
  bottom: number,
  avoid: readonly Box[],
): Map<string, Point> {
  const placed = new Map<string, Point>();
  const span = Math.max(0, bottom - top);
  for (const moment of [...moments].sort((a, b) => a.age - b.age)) {
    const x = ageX(line, moment.age);
    const target = top + span * (0.5 + 0.42 * Math.sin(moment.age * 0.9 + seed(moment.id)));
    let best: Point = { x, y: target };
    let bestScore = -Infinity;
    for (let i = 0; i <= 12; i++) {
      const y = top + (span * i) / 12;
      const clear = Math.min(
        ENOUGH_CLEARANCE,
        ...avoid.map((box) => distanceToBox(x, y, box)),
        ...[...placed.values()].map((p) => Math.hypot(p.x - x, p.y - y)),
      );
      // Sitting on another star or a name is never worth it; beyond that, follow the drift.
      const score = clear - 0.3 * Math.abs(y - target) - (clear < MIN_CLEARANCE ? 100 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    placed.set(moment.id, best);
  }
  return placed;
}

function distanceToBox(x: number, y: number, box: Box): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
}

export interface LifelineMoment {
  moment: Moment;
  /** Its bead on the lifeline. */
  bead: Point;
  /** Its star in the sky. */
  star: Point;
  /** How lit the bead is, 0 → 1, from the moment it begins. */
  beadLit: number;
  /** How lit the sky star is, 0 → 1, once its light has risen. */
  starLit: number;
  /** Progress of the light rising from bead to star, or null when not on its way. */
  rise: number | null;
}

/** The moments begun by `age`, in the order they happened, with where they are on their way. */
export function lifelineMoments(
  line: Lifeline,
  stars: ReadonlyMap<string, Point>,
  moments: readonly Moment[],
  age: number,
): LifelineMoment[] {
  const shown: LifelineMoment[] = [];
  for (const moment of [...moments].sort((a, b) => a.age - b.age)) {
    const t = age - moment.age;
    const star = stars.get(moment.id);
    if (t < 0 || !star) continue;
    shown.push({
      moment,
      bead: { x: ageX(line, moment.age), y: line.y },
      star,
      beadLit: clamp01(t / 0.3),
      starLit: clamp01((t - RISE_YEARS) / 0.3),
      rise: t > 0 && t < RISE_YEARS ? t / RISE_YEARS : null,
    });
  }
  return shown;
}
