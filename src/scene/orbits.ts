import type { Person } from '../model';
import { mulberry32 } from '../sky/random';

/** How many years of the person's life play per second. */
export const YEARS_PER_SECOND = 0.8;

/** Durations are in years of the person's life, so they scale with playback speed. */
export const ARRIVE_YEARS = 0.8;
export const SHOOT_YEARS = 1.2;
export const ASCEND_YEARS = 1.8;
/** Once a memorial star settles its glow fades over these years, to a faint glow that stays. */
export const HALO_FADE_YEARS = 3;
export const HALO_REST = 0.2;
/** How long the rising thread lingers once a memorial star settles. */
export const THREAD_FADE_YEARS = 1.5;

/** Orbits are circles seen at an angle; this flattens them into ellipses. Tall screens see more. */
const TILT = 0.36;
const PORTRAIT_TILT = 0.5;
/** Screens narrower than this are the smallest phones, where every pixel of the system counts. */
export const COMPACT_WIDTH = 360;
/** Seconds for the innermost orbit to go round once; slow enough to read every label. */
const INNER_REVOLUTION_S = 90;
/** Once someone leaves, the people outside them close ranks over this many years. */
export const CLOSE_RANKS_YEARS = 1.5;
/** Widest the system may grow, however many people orbit at once. */
const MAX_SYSTEM_RADIUS = 460;
/** Room kept clear at the bottom of the screen for the age readout. */
const HUD_CLEARANCE = 150;
/** Within this distance of the self star, far-side bodies wash out in its glare. */
const GLARE_RADIUS = 70;
/** However deep in the glare, a name keeps at least this much of its light. */
const LABEL_GLARE_FLOOR = 0.65;
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
  /** People who arrived before this one; while they orbit, they keep the lanes further in. */
  earlier: Person[];
  /** Seconds per revolution, fixed per person so moving between lanes never makes them jump. */
  period: number;
  phase: number;
  wobble: number;
  /** Where this person settles in the upper sky, for permanent people who have left. */
  slot: Point | null;
  /** For people passing through: the single pass they make around your star. */
  comet: Comet | null;
}

/**
 * Someone passing through your life makes one pass by your star: straight in from the outer sky,
 * a swing part of the way round you, and straight out on a new heading.
 */
interface Comet {
  /** How far out the swing runs, as a share of the innermost lane. */
  closest: number;
  /** Where on the circle around your star the swing begins. */
  entry: number;
  /** How far round the swing carries them, in radians: about half a turn. */
  arc: number;
  /** 1 to swing anticlockwise, -1 clockwise. */
  spin: number;
  /** When the pass ends: when they left, or for someone still passing through, a time ahead. */
  end: number;
}

export interface Layout {
  cx: number;
  cy: number;
  tilt: number;
  /** The innermost lane, clear of the self star's glare. */
  minRadius: number;
  /** The outermost lane in use at the busiest moment of the life. */
  outerRadius: number;
  laneGap: number;
  /** How far a shooting star flies before it fades; enough to leave the screen. */
  reach: number;
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
  /** How much of its soft glow the star keeps, 0 → 1; a memorial's settles away. Full if unset. */
  halo?: number;
}

export function layoutScene(
  people: readonly Person[],
  width: number,
  height: number,
  selfY: number,
  /** The profile owner's age now, for timing passes of people still passing through. */
  currentAge = Infinity,
  /** Room kept below the system for what is drawn under it. */
  clearance = HUD_CLEARANCE,
): Layout {
  const cx = width / 2;
  const cy = height * selfY;
  const tilt = width < height * 0.8 ? PORTRAIT_TILT : TILT;
  const maxRadius = Math.max(80, Math.min(width * 0.44, (height - cy - clearance) / tilt, MAX_SYSTEM_RADIUS));
  // The first lane stays clear of the self star's glare and light spikes.
  // On the smallest phones lanes start closer in, so they can sit far enough apart to read.
  const compact = width < COMPACT_WIDTH;
  const minRadius = Math.min(96, Math.max(compact ? 44 : 56, Math.min(width, height) * 0.1));
  // Lanes sit a fixed step apart so the system stays compact, tightening only if the busiest
  // moment of the life would not otherwise fit.
  const busiest = peakPresence(people);
  const laneGap = Math.min(
    Math.min(38, Math.max(compact ? 14 : 18, Math.min(width, height) * 0.045)),
    (maxRadius - minRadius) / Math.max(1, busiest - 1),
  );
  const outerRadius = minRadius + laneGap * Math.max(0, busiest - 1);

  const byArrival = [...people].sort((a, b) => a.joinAge - b.joinAge);
  const memorials = people
    .filter((p) => p.bond === 'permanent' && p.departAge !== null)
    .sort((a, b) => a.departAge! - b.departAge!);
  const skyTop = Math.max(56, height * 0.08);
  const skyBottom = Math.max(skyTop + 24, cy - outerRadius * tilt - 48);
  // Many memorials share the sky in staggered rows so their names don't collide.
  const rows = memorials.length > 6 ? 3 : memorials.length > 3 ? 2 : 1;
  const rowHeight = (skyBottom - skyTop) / rows;

  const tracks = people.map((person) => {
    const rand = mulberry32(hashString(person.id));
    const phase = rand() * Math.PI * 2;
    const wobble = rand() * Math.PI * 2;
    // Comets cross the orbits rather than holding one, so only permanent people take lanes.
    const earlier = byArrival.slice(0, byArrival.indexOf(person)).filter((p) => p.bond === 'permanent');
    // Outer people turn a little slower, set by where they first settled.
    const settledAt = minRadius + laneGap * rankAt(earlier, person.joinAge + ARRIVE_YEARS);
    const period = INNER_REVOLUTION_S * (settledAt / minRadius) ** 0.6 * (0.9 + 0.2 * rand());
    const m = memorials.indexOf(person);
    const slot =
      m < 0
        ? null
        : {
            x: width * (0.12 + (0.76 * (m + 0.5)) / memorials.length) + (rand() - 0.5) * width * 0.03,
            y: skyTop + rowHeight * ((m % rows) + 0.5 + (rand() - 0.5) * 0.5),
          };
    const comet =
      person.bond === 'temporary'
        ? {
            end: person.departAge ?? passingEnd(person, currentAge),
            closest: 0.85 + 0.55 * rand(),
            entry: rand() * Math.PI * 2,
            arc: Math.PI * (0.72 + 0.24 * rand()),
            spin: rand() < 0.5 ? -1 : 1,
          }
        : null;
    return { person, earlier, period, phase, wobble, slot, comet };
  });

  return { cx, cy, tilt, minRadius, outerRadius, laneGap, reach: Math.hypot(width, height) * 0.4, tracks };
}

/**
 * When the pass of someone still passing through would end. It is timed so the present falls a
 * little past the middle of their swing, so they are close by and partway round now; someone
 * who has only just arrived is still on their way in.
 */
function passingEnd(person: Person, currentAge: number): number {
  const now = Number.isFinite(currentAge) ? currentAge : person.joinAge + 10;
  return Math.max(person.joinAge + 1, now + Math.max(1, (now - person.joinAge) * 0.8));
}

/** How fully someone occupies their lane at `age`: easing in as they arrive, out once they leave. */
function presence(person: Person, age: number): number {
  if (age < person.joinAge) return 0;
  const arrived = smoothstep(0, ARRIVE_YEARS, age - person.joinAge);
  if (person.departAge === null || age < person.departAge) return arrived;
  return arrived * (1 - smoothstep(0, CLOSE_RANKS_YEARS, age - person.departAge));
}

/** Lanes taken further in at `age`, counting part of a lane for anyone arriving or leaving. */
function rankAt(earlier: readonly Person[], age: number): number {
  let rank = 0;
  for (const person of earlier) rank += presence(person, age);
  return rank;
}

/** The most people orbiting at once at any point in the life; comets passing through don't count. */
function peakPresence(people: readonly Person[]): number {
  const orbiting = people.filter((p) => p.bond === 'permanent');
  const lastAge = Math.max(0, ...orbiting.map((p) => (p.departAge ?? p.joinAge) + CLOSE_RANKS_YEARS));
  let peak = 1;
  for (let age = 0; age <= lastAge; age += 0.25) {
    let count = 0;
    for (const person of orbiting) count += presence(person, age);
    peak = Math.max(peak, count);
  }
  return Math.ceil(peak - 0.01);
}

/** The lane someone holds at `age`, drifting inward as people further in leave. */
function laneRadius(layout: Layout, track: Track, age: number): number {
  return layout.minRadius + layout.laneGap * rankAt(track.earlier, age);
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
export function frameBodies(
  layout: Layout,
  age: number,
  idleSeconds: number,
  /** Moves a lane in or out at an age, as when people draw close or a swelling star pushes them out. */
  reshape: (radius: number, age: number) => number = (radius) => radius,
): BodyFrame[] {
  const frames: BodyFrame[] = [];
  for (const track of layout.tracks) {
    const frame = frameBody(layout, track, age, idleSeconds, reshape);
    if (frame) frames.push(frame);
  }
  return frames;
}

function frameBody(
  layout: Layout,
  track: Track,
  age: number,
  idleSeconds: number,
  reshape: (radius: number, age: number) => number,
): BodyFrame | null {
  const { person } = track;
  if (age < person.joinAge) return null;
  const angleAt = (a: number) => track.phase + ((a / YEARS_PER_SECOND + idleSeconds) / track.period) * Math.PI * 2;
  const depart = person.departAge;

  if (track.comet && (depart === null || age < depart)) return cometFrame(layout, track, track.comet, age, reshape);

  if (depart === null || age < depart) {
    // Arriving bodies spiral in from a wider orbit as they fade up.
    const e = easeOutCubic(clamp01((age - person.joinAge) / ARRIVE_YEARS));
    const lane = reshape(laneRadius(layout, track, age), age);
    const radius = lane * (1 + 0.9 * (1 - e));
    const theta = angleAt(age) - (1 - e) * 1.2;
    const pos = orbitPoint(layout, radius, theta);
    const depth = Math.sin(theta);
    const near = (depth + 1) / 2;
    // Temporary people trail a long comet tail; permanent ones keep a short, calm trace.
    const span = (person.bond === 'temporary' ? 2.3 : Math.min(0.7, CALM_TRAIL_PX / lane)) * e;
    const trail: Point[] = [];
    for (let k = ORBIT_TRAIL_POINTS; k >= 0; k--) {
      trail.push(orbitPoint(layout, radius, theta - (span * k) / ORBIT_TRAIL_POINTS));
    }
    return {
      person,
      ...pos,
      scale: 0.75 + 0.25 * near,
      alpha: e * (0.55 + 0.45 * near) * glare(layout, pos, depth),
      // Names on the far side stay readable; only the body itself dims away and into the glare.
      labelAlpha: e * (0.78 + 0.22 * near) * Math.max(LABEL_GLARE_FLOOR, glare(layout, pos, depth)),
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
  const pass = track.comet && cometDeparture(layout, track.comet, track.person, reshape);
  const origin = pass ? pass.pos : orbitPoint(layout, reshape(laneRadius(layout, track, depart), depart), theta);

  if (person.bond === 'temporary') {
    if (since >= SHOOT_YEARS) return null;
    // Break away along the way they were heading, and accelerate off into the dark.
    let tx = pass ? pass.heading.x : -Math.sin(theta);
    let ty = pass ? pass.heading.y : layout.tilt * Math.cos(theta);
    const length = Math.hypot(tx, ty);
    tx /= length;
    ty /= length;
    const travel = layout.reach * (0.3 * since + 2.4 * since * since);
    const head = { x: origin.x + tx * travel, y: origin.y + ty * travel };
    const tailLength = Math.min(travel, layout.reach * (0.25 + 0.6 * since));
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
    // Bright as it arrives, then settling into a crisp point of light among the stars.
    halo: settled ? HALO_REST + (1 - HALO_REST) * (1 - easeInOutCubic(clamp01((since - ASCEND_YEARS) / HALO_FADE_YEARS))) : 1,
  };
}

/** How far the straight runs in and out reach, as a share of the sky's reach. */
const COMET_RUN = 0.7;
/**
 * How the pass is paced: low values crowd the time into the swing, so the straight runs go
 * quickly and most of the stay is spent close by. Speed never jumps.
 */
const COMET_LINGER = 0.15;
/** How long a comet's trail is, measured back along the path it has flown. */
const COMET_TRAIL_PX = 130;
const COMET_TAIL_POINTS = 28;

interface Pass {
  /** Where on its path a comet is, measured from the start in plane pixels. */
  at: number;
  /** The whole path's length. */
  length: number;
  pointAt: (distance: number) => { pos: Point; angle: number };
}

/** The comet's path in the orbits' plane: a straight run in, an arc around you, a straight run out. */
function cometPass(
  layout: Layout,
  comet: Comet,
  person: Person,
  age: number,
  reshape: (radius: number, age: number) => number,
): Pass {
  const radius = reshape(layout.minRadius * comet.closest, age);
  const run = layout.reach * COMET_RUN;
  const swing = comet.arc * radius;
  const length = run * 2 + swing;
  const { spin } = comet;
  // Moving round the circle, the way along it at angle θ.
  const along = (theta: number) => ({ x: -spin * Math.sin(theta), y: spin * Math.cos(theta) });
  const onCircle = (theta: number) => ({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
  const exit = comet.entry + spin * comet.arc;
  const toScreen = (p: Point) => ({ x: layout.cx + p.x, y: layout.cy + p.y * layout.tilt });

  const pointAt = (distance: number) => {
    let p: Point;
    if (distance < run) {
      // The straight run in, meeting the circle along its edge so there is no kink.
      const back = run - distance;
      const start = onCircle(comet.entry);
      const way = along(comet.entry);
      p = { x: start.x - way.x * back, y: start.y - way.y * back };
    } else if (distance < run + swing) {
      p = onCircle(comet.entry + (spin * (distance - run)) / radius);
    } else {
      const out = distance - run - swing;
      const start = onCircle(exit);
      const way = along(exit);
      p = { x: start.x + way.x * out, y: start.y + way.y * out };
    }
    return { pos: toScreen(p), angle: Math.atan2(p.y, p.x) };
  };

  const span = comet.end - person.joinAge;
  const x = 2 * clamp01((age - person.joinAge) / Math.max(0.01, span)) - 1;
  const paced = Math.sign(x) * (COMET_LINGER * Math.abs(x) + (1 - COMET_LINGER) * Math.abs(x) ** 3);
  return { at: (length * (1 + paced)) / 2, length, pointAt };
}

function cometFrame(
  layout: Layout,
  track: Track,
  comet: Comet,
  age: number,
  reshape: (radius: number, age: number) => number,
): BodyFrame {
  const { person } = track;
  const pass = cometPass(layout, comet, person, age, reshape);
  const { pos, angle } = pass.pointAt(pass.at);
  const appear = smoothstep(0, Math.min(ARRIVE_YEARS, (comet.end - person.joinAge) * 0.15), age - person.joinAge);
  const depth = Math.sin(angle);
  const near = (depth + 1) / 2;

  // The trail is the path just flown: straight on the way in, curving through the swing.
  const trail: Point[] = [];
  const from = Math.max(0, pass.at - COMET_TRAIL_PX);
  for (let k = 0; k <= COMET_TAIL_POINTS; k++) trail.push(pass.pointAt(from + ((pass.at - from) * k) / COMET_TAIL_POINTS).pos);

  const washout = glare(layout, pos, depth);
  return {
    person,
    ...pos,
    scale: 0.8 + 0.2 * near,
    alpha: appear * (0.6 + 0.4 * near) * washout,
    labelAlpha: appear * (0.78 + 0.22 * near) * Math.max(LABEL_GLARE_FLOOR, washout),
    depth,
    glow: 0,
    trail,
    trailKind: 'orbit',
    trailAlpha: appear,
    orbitRadius: null,
    memorial: false,
  };
}

/** Where a comet is as it leaves, and which way it is heading then. */
function cometDeparture(
  layout: Layout,
  comet: Comet,
  person: Person,
  reshape: (radius: number, age: number) => number,
): { pos: Point; heading: Point } {
  const pass = cometPass(layout, comet, person, comet.end, reshape);
  const end = pass.pointAt(pass.length).pos;
  const before = pass.pointAt(pass.length - 1).pos;
  return { pos: end, heading: { x: end.x - before.x, y: end.y - before.y } };
}

function orbitPoint(layout: Layout, radius: number, theta: number): Point {
  return { x: layout.cx + radius * Math.cos(theta), y: layout.cy + radius * layout.tilt * Math.sin(theta) };
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
