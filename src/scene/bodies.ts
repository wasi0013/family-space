import { clamp01, COMPACT_WIDTH, HALO_REST, type BodyFrame, type Layout, type Point } from './orbits';
import { drawSpikes, glowDisc } from './selfStar';

const LABEL_PX = 12;
const rgbCache = new Map<string, string>();

/** "r, g, b" for a hex color, optionally mixed toward white. */
function rgb(hex: string, lighten = 0): string {
  const key = `${hex}/${lighten}`;
  let value = rgbCache.get(key);
  if (!value) {
    const n = parseInt(hex.slice(1), 16);
    value = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((c) => Math.round(c + (255 - c) * lighten))
      .join(', ');
    rgbCache.set(key, value);
  }
  return value;
}

export function drawOrbitPath(ctx: CanvasRenderingContext2D, layout: Layout, frame: BodyFrame) {
  if (frame.orbitRadius === null) return;
  ctx.beginPath();
  ctx.ellipse(layout.cx, layout.cy, frame.orbitRadius, frame.orbitRadius * layout.tilt, 0, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb(frame.person.color)}, ${0.07 * frame.trailAlpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawTrail(ctx: CanvasRenderingContext2D, frame: BodyFrame) {
  const { trail, trailAlpha } = frame;
  if (trail.length < 2 || trailAlpha <= 0.01) return;
  const color = rgb(frame.person.color);
  ctx.lineCap = 'round';

  if (frame.trailKind === 'streak') {
    const tail = trail[0];
    const head = trail[trail.length - 1];
    const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    gradient.addColorStop(0, `rgba(${color}, 0)`);
    gradient.addColorStop(0.7, `rgba(${color}, ${0.45 * trailAlpha})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, ${0.95 * trailAlpha})`);
    ctx.strokeStyle = gradient;
    for (const [width, alpha] of [
      [7, 0.18],
      [2, 1],
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Orbit arcs and rising threads: brightest at the head, fading toward the tail.
  // A comet's tail also burns white near its head.
  const comet = frame.trailKind === 'orbit' && frame.person.bond === 'temporary';
  const strength = frame.trailKind === 'thread' || comet ? 0.8 : 0.45;
  const segments = trail.length - 1;
  for (const [width, glow] of [
    [4.5, 0.14],
    [comet ? 1.6 : 1.2, 1],
  ]) {
    ctx.lineWidth = width * frame.scale;
    for (let k = 0; k < segments; k++) {
      const fade = ((k + 1) / segments) ** 1.6;
      const tint = comet ? rgb(frame.person.color, Math.round(fade ** 3 * 6) / 10) : color;
      ctx.strokeStyle = `rgba(${tint}, ${strength * glow * fade * trailAlpha * frame.alpha})`;
      ctx.beginPath();
      ctx.moveTo(trail[k].x, trail[k].y);
      ctx.lineTo(trail[k + 1].x, trail[k + 1].y);
      ctx.stroke();
    }
  }
}

/** How deeply a star can dim when it twinkles: memorial stars like real ones, orbiters gently. */
const MEMORIAL_TWINKLE = 0.6;
/** How far a departed star's resting glow swells and ebbs either way as it breathes. */
const HALO_BREATH = 0.55;
const ORBIT_TWINKLE = 0.22;
const rhythmCache = new Map<string, Rhythm>();

/** Each person's own twinkle: where in the cycle they start, and how fast it runs. */
export interface Rhythm {
  phase: number;
  tempo: number;
}

/** A steady per-person rhythm, so no two stars twinkle in step. */
export function rhythmOf(id: string): Rhythm {
  let rhythm = rhythmCache.get(id);
  if (rhythm === undefined) {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
    // Mix the bits, or names that differ by a letter ("grandma", "grandpa") twinkle in step.
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    const bits = hash >>> 0;
    // Low bits set the phase and high bits the tempo, so the two don't move together.
    rhythm = { phase: ((bits & 0xffff) / 0x10000) * Math.PI * 2, tempo: 0.75 + 0.5 * ((bits >>> 16) / 0x10000) };
    rhythmCache.set(id, rhythm);
  }
  return rhythm;
}

/**
 * Scintillation as a 0–1 dip: three detuned waves, so the star holds steady most of the time,
 * then dims and comes back the way starlight does through moving air.
 */
export function twinkleDip(seconds: number, { phase, tempo }: Rhythm): number {
  seconds *= tempo;
  const wave =
    0.55 * Math.sin(seconds * 0.83 + phase) +
    0.3 * Math.sin(seconds * 2.17 + phase * 1.7) +
    0.15 * Math.sin(seconds * 5.3 + phase * 2.9);
  return Math.max(0, -wave) ** 1.4;
}

export function drawBody(ctx: CanvasRenderingContext2D, frame: BodyFrame, seconds: number) {
  if (frame.alpha <= 0.01) return;
  const color = rgb(frame.person.color);
  const depth = frame.memorial ? MEMORIAL_TWINKLE : ORBIT_TWINKLE;
  const dip = twinkleDip(seconds, rhythmOf(frame.person.id));
  const twinkle = 1 - depth * dip;
  const a = frame.alpha * twinkle;
  // The glow draws in a little as the star dims, as a real one does.
  const size = frame.scale * (1 + frame.glow * 0.8) * (frame.memorial ? 1.2 : 1) * (1 - 0.18 * depth * dip);
  // The soft glow, which a star among the departed lets go of as it settles, keeping a faint one
  // that slowly breathes, each in its own rhythm.
  const settled = frame.memorial ? clamp01((1 - (frame.halo ?? 1)) / (1 - HALO_REST)) : 0;
  const breath = 1 + HALO_BREATH * settled * Math.sin(seconds * 0.7 * rhythmOf(frame.person.id).tempo + rhythmOf(frame.person.id).phase);
  const halo = (frame.halo ?? 1) * breath;
  glowDisc(ctx, frame.x, frame.y, 18 * size * (0.55 + 0.45 * halo), [
    [0, `rgba(${color}, ${0.6 * a * halo})`],
    [0.25, `rgba(${color}, ${0.2 * a * halo})`],
    [1, `rgba(${color}, 0)`],
  ]);
  if (frame.memorial) drawSpikes(ctx, frame.x, frame.y, 16 * size * twinkle, 0.9, 0.12, 0.55 * a, color);
  glowDisc(ctx, frame.x, frame.y, 3.6 * size, [
    [0, `rgba(255, 255, 255, ${a})`],
    [0.45, `rgba(${rgb(frame.person.color, 0.55)}, ${0.95 * a})`],
    [1, `rgba(${color}, 0)`],
  ]);
}

const LABEL_FAMILY = '"Inter Variable", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif';
const LABEL_FONT = `500 ${LABEL_PX}px ${LABEL_FAMILY}`;
/** Names on the smallest phones: a touch smaller, and free to sit beside their star. */
const COMPACT_LABEL_PX = 11;
/** Labels that can't find clear space fade back to this much of their opacity. */
const CROWDED_LABEL_ALPHA = 0.3;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Names go above their star, or below it when that space is taken, so passing people never
 * print over each other. The most visible labels claim space first; any that still can't fit
 * fade back.
 */
export function drawLabels(ctx: CanvasRenderingContext2D, frames: readonly BodyFrame[], focusId: string | null = null) {
  const compact = (ctx.canvas.clientWidth || ctx.canvas.width) < COMPACT_WIDTH;
  const px = compact ? COMPACT_LABEL_PX : LABEL_PX;
  ctx.font = compact ? `500 ${px}px ${LABEL_FAMILY}` : LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const claimed: Box[] = [];
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  // The person being remembered is fully lit and claims space before anyone else.
  const strength = (f: BodyFrame) => (f.person.id === focusId ? 2 : f.labelAlpha);
  const visible = frames.filter((f) => f.labelAlpha > 0.01).sort((a, b) => strength(b) - strength(a));

  for (const frame of visible) {
    const half = ctx.measureText(frame.person.name).width / 2 + 3;
    const offset = 14 * frame.scale;
    // Above the star, then below; on the smallest phones also to its right or left.
    const side = 9 * frame.scale + half;
    // Near an edge a name shifts inward rather than running off the screen: always for someone
    // orbiting, whose lane can reach past a phone's edge; a comet or shooting star leaving the
    // screen takes its name with it.
    const stays = frame.trailKind === 'orbit' || (frame.x >= 0 && frame.x <= width);
    const inward = (x: number) => (stays ? Math.min(Math.max(x, half + 4), width - half - 4) : x);
    const spots: Point[] = [
      { x: inward(frame.x), y: frame.y - offset },
      { x: inward(frame.x), y: frame.y + offset + px },
      ...(compact
        ? [
            { x: frame.x + side, y: frame.y + px * 0.35 },
            { x: frame.x - side, y: frame.y + px * 0.35 },
          ]
        : []),
    ];
    const boxAt = (spot: Point): Box => ({
      left: spot.x - half,
      right: spot.x + half,
      top: spot.y - px,
      bottom: spot.y + 3,
    });
    const free = spots.find((spot) => !claimed.some((box) => overlaps(box, boxAt(spot))));
    if (free !== undefined) claimed.push(boxAt(free));
    const focused = frame.person.id === focusId;
    // With no room on the smallest phones a name waits for its star to move on; a tap still names it.
    if (free === undefined && compact && !focused) continue;
    const spot = free ?? spots[0];
    const lit = focused ? 1 : frame.labelAlpha;
    const alpha = lit * (free === undefined ? CROWDED_LABEL_ALPHA : 1);
    ctx.fillStyle = `rgba(${rgb(frame.person.color, 0.3)}, ${0.92 * alpha})`;
    ctx.fillText(frame.person.name, spot.x, spot.y);
  }
}

/** A soft pulsing ring around the person whose memory card is open. */
export function drawFocus(ctx: CanvasRenderingContext2D, frame: BodyFrame, seconds: number) {
  const pulse = 0.5 + 0.5 * Math.sin(seconds * 2.2);
  ctx.beginPath();
  ctx.arc(frame.x, frame.y, (13 + 2.5 * pulse) * frame.scale, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb(frame.person.color, 0.2)}, ${0.35 + 0.3 * pulse})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
