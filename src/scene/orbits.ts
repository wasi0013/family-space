import type { Person } from '../model';
import { mulberry32 } from '../sky/random';

/** How many years of the person's life play per second. */
export const YEARS_PER_SECOND = 0.8;

/** Durations are in years of the person's life, so they scale with playback speed. */
export const ARRIVE_YEARS = 0.8;
export const SHOOT_YEARS = 1.2;
export const ASCEND_YEARS = 1.8;
/** How long the rising thread lingers once a memorial star settles. */
export const THREAD_FADE_YEARS = 1.5;

/** Orbits are circles seen at an angle; this flattens them into ellipses. */
export const TILT = 0.36;
/** Seconds for the innermost orbit to go round once; slow enough to read every label. */
const INNER_REVOLUTION_S = 90;
/** Room kept clear at the bottom of the screen for the age readout. */
const HUD_CLEARANCE = 150;
/** Within this distance of the self star, far-side bodies wash out in its glare. */
const GLARE_RADIUS = 70;
const ORBIT_TRAIL_POINTS = 32;
/** Longest arc a permanent person's orbit trail covers, so outer lanes stay calm too. */
const CALM_TRAIL_PX = 90;
const THREAD_POINTS = 28;
const WOBBLE_PX = 16;

export interface Point {
  x: number;
  y: number;
}

interface Track {
  person: Person;
  radius: number;
  /** Seconds per revolution. */
  period: number;
  phase: number;
  wobble: number;
  /** Where this person settles in the upper sky, for permanent people who have left. */
  slot: Point | null;
}

export interface Layout {
  cx: number;
  cy: number;
  maxRadius: number;
  tracks: Track[];
}

export type TrailKind = 'orbit' | 'streak' | 'thread';

/** Everything needed to draw one person at one moment. */
export interface BodyFrame {
  person: Person;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  labelAlpha: number;
  /** -1 on the far side of the orbit, 1 on the near side. */
  depth: number;
  /** Extra brightness, used for the head of a shooting star. */
  glow: number;
  /** Ordered tail → head. */
  trail: Point[];
  trailKind: TrailKind;
  trailAlpha: number;
  /** Set while the person is orbiting, for drawing the faint orbit path. */
  orbitRadius: number | null;
  memorial: boolean;
}

export function layoutScene(
  people: readonly Person[],
  width: number,
  height: number,
  selfY: number,
): Layout {
  const cx = width / 2;
  const cy = height * selfY;
  const maxRadius = Math.max(80, Math.min(width * 0.44, (height - cy - HUD_CLEARANCE) / TILT));
  const minRadius = Math.max(56, maxRadius * 0.28);
  const lanes = [...people].sort((a, b) => a.joinAge - b.joinAge);
  const memorials = people
    .filter((p) => p.bond === 'permanent' && p.departAge !== null)
    .sort((a, b) => a.departAge! - b.departAge!);
  const skyTop = Math.max(56, height * 0.08);
  const skyBottom = Math.max(skyTop + 24, cy - maxRadius * TILT - 48);

  const tracks = people.map((person) => {
    const rand = mulberry32(hashString(person.id));
    const phase = rand() * Math.PI * 2;
    const wobble = rand() * Math.PI * 2;
    const lane = lanes.indexOf(person);
    const radius =
      lanes.length === 1 ? minRadius : minRadius + ((maxRadius - minRadius) * lane) / (lanes.length - 1);
    const m = memorials.indexOf(person);
    const slot =
      m < 0
        ? null
        : {
            x: width * (0.12 + (0.76 * (m + 0.5)) / memorials.length) + (rand() - 0.5) * width * 0.04,
            y: skyTop + (skyBottom - skyTop) * rand(),
          };
    return { person, radius, period: INNER_REVOLUTION_S * (radius / minRadius), phase, wobble, slot };
  });

  return { cx, cy, maxRadius, tracks };
}

/** The age at which every departure up to `currentAge` has finished animating. */
export function settleAge(people: readonly Person[], currentAge: number): number {
  let end = currentAge;
  for (const { bond, departAge } of people) {
    if (departAge === null || departAge > currentAge) continue;
    end = Math.max(end, departAge + (bond === 'temporary' ? SHOOT_YEARS : ASCEND_YEARS + THREAD_FADE_YEARS));
  }
  return end;
}

/**
 * Where everyone is at `age`. Orbits turn at the same slow pace whether playback is running or
 * paused: their clock is the playback time for `age` plus `idleSeconds` spent paused.
 */
export function frameBodies(layout: Layout, age: number, idleSeconds: number): BodyFrame[] {
  const frames: BodyFrame[] = [];
  for (const track of layout.tracks) {
    const frame = frameBody(layout, track, age, idleSeconds);
    if (frame) frames.push(frame);
  }
  return frames;
}

function frameBody(layout: Layout, track: Track, age: number, idleSeconds: number): BodyFrame | null {
  const { person } = track;
  if (age < person.joinAge) return null;
  const angleAt = (a: number) => track.phase + ((a / YEARS_PER_SECOND + idleSeconds) / track.period) * Math.PI * 2;
  const depart = person.departAge;

  if (depart === null || age < depart) {
    // Arriving bodies spiral in from a wider orbit as they fade up.
    const e = easeOutCubic(clamp01((age - person.joinAge) / ARRIVE_YEARS));
    const radius = track.radius * (1 + 0.9 * (1 - e));
    const theta = angleAt(age) - (1 - e) * 1.2;
    const pos = orbitPoint(layout, radius, theta);
    const depth = Math.sin(theta);
    const near = (depth + 1) / 2;
    // Temporary people trail a long comet tail; permanent ones keep a short, calm trace.
    const span = (person.bond === 'temporary' ? 2.3 : Math.min(0.7, CALM_TRAIL_PX / track.radius)) * e;
    const trail: Point[] = [];
    for (let k = ORBIT_TRAIL_POINTS; k >= 0; k--) {
      trail.push(orbitPoint(layout, radius, theta - (span * k) / ORBIT_TRAIL_POINTS));
    }
    return {
      person,
      ...pos,
      scale: 0.75 + 0.25 * near,
      alpha: e * (0.55 + 0.45 * near) * glare(layout, pos, depth),
      labelAlpha: e * (0.5 + 0.5 * near) * glare(layout, pos, depth),
      depth,
      glow: 0,
      trail,
      trailKind: 'orbit',
      trailAlpha: e,
      orbitRadius: radius,
      memorial: false,
    };
  }

  const since = age - depart;
  const theta = angleAt(depart);
  const origin = orbitPoint(layout, track.radius, theta);

  if (person.bond === 'temporary') {
    if (since >= SHOOT_YEARS) return null;
    // Break away along the orbit's tangent and accelerate off into the dark.
    let tx = -Math.sin(theta);
    let ty = TILT * Math.cos(theta);
    const length = Math.hypot(tx, ty);
    tx /= length;
    ty /= length;
    const travel = layout.maxRadius * (0.3 * since + 2.4 * since * since);
    const head = { x: origin.x + tx * travel, y: origin.y + ty * travel };
    const tailLength = Math.min(travel, layout.maxRadius * (0.25 + 0.6 * since));
    const fade = 1 - smoothstep(0.6, SHOOT_YEARS, since);
    return {
      person,
      ...head,
      scale: 1,
      alpha: fade,
      labelAlpha: 1 - clamp01(since / 0.35),
      depth: 1,
      glow: 1 - clamp01(since / 0.5),
      trail: [{ x: head.x - tx * tailLength, y: head.y - ty * tailLength }, head],
      trailKind: 'streak',
      trailAlpha: fade,
      orbitRadius: null,
      memorial: false,
    };
  }

  // Permanent: rise along a gently wavering thread to a fixed place in the upper sky.
  const slot = track.slot!;
  const rise = origin.y - slot.y;
  const c1 = { x: origin.x, y: origin.y - rise * 0.55 };
  const c2 = { x: slot.x, y: slot.y + rise * 0.45 };
  const path = (u: number): Point => {
    const p = cubicBezier(origin, c1, c2, slot, u);
    return { x: p.x + Math.sin(u * Math.PI * 3 + track.wobble) * WOBBLE_PX * Math.sin(Math.PI * u), y: p.y };
  };
  const settled = since >= ASCEND_YEARS;
  const u = easeInOutCubic(clamp01(since / ASCEND_YEARS));
  const from = settled ? 0.55 : Math.max(0, u - 0.45);
  const trail: Point[] = [];
  for (let k = 0; k <= THREAD_POINTS; k++) trail.push(path(from + ((u - from) * k) / THREAD_POINTS));

  return {
    person,
    ...path(u),
    scale: 1,
    alpha: 1,
    labelAlpha: 0.7 + 0.3 * u,
    depth: 1,
    glow: 0,
    trail,
    trailKind: 'thread',
    trailAlpha: settled ? 1 - clamp01((since - ASCEND_YEARS) / THREAD_FADE_YEARS) : 1,
    orbitRadius: null,
    memorial: true,
  };
}

function orbitPoint(layout: Layout, radius: number, theta: number): Point {
  return { x: layout.cx + radius * Math.cos(theta), y: layout.cy + radius * TILT * Math.sin(theta) };
}

/** Far-side bodies passing behind the self star are lost in its light. */
function glare(layout: Layout, pos: Point, depth: number): number {
  if (depth >= 0) return 1;
  const distance = Math.hypot(pos.x - layout.cx, pos.y - layout.cy);
  return 0.2 + 0.8 * clamp01(distance / GLARE_RADIUS);
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
