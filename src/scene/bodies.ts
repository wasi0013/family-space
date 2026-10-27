import type { BodyFrame, Layout } from './orbits';
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

export function drawBody(ctx: CanvasRenderingContext2D, frame: BodyFrame, seconds: number) {
  if (frame.alpha <= 0.01) return;
  const color = rgb(frame.person.color);
  const twinkle = frame.memorial ? 0.85 + 0.15 * Math.sin(seconds * 1.7 + frame.x) : 1;
  const a = frame.alpha * twinkle;
  const size = frame.scale * (1 + frame.glow * 0.8) * (frame.memorial ? 1.2 : 1);
  glowDisc(ctx, frame.x, frame.y, 18 * size, [
    [0, `rgba(${color}, ${0.6 * a})`],
    [0.25, `rgba(${color}, ${0.2 * a})`],
    [1, `rgba(${color}, 0)`],
  ]);
  if (frame.memorial) drawSpikes(ctx, frame.x, frame.y, 16 * size * twinkle, 0.9, 0.12, 0.55 * a, color);
  glowDisc(ctx, frame.x, frame.y, 3.6 * size, [
    [0, `rgba(255, 255, 255, ${a})`],
    [0.45, `rgba(${rgb(frame.person.color, 0.55)}, ${0.95 * a})`],
    [1, `rgba(${color}, 0)`],
  ]);
}

const LABEL_FONT = `500 ${LABEL_PX}px "Inter Variable", ui-sans-serif, system-ui, sans-serif`;
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
export function drawLabels(ctx: CanvasRenderingContext2D, frames: readonly BodyFrame[]) {
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const claimed: Box[] = [];
  const visible = frames.filter((f) => f.labelAlpha > 0.01).sort((a, b) => b.labelAlpha - a.labelAlpha);

  for (const frame of visible) {
    const half = ctx.measureText(frame.person.name).width / 2 + 3;
    const offset = 14 * frame.scale;
    const spots = [frame.y - offset, frame.y + offset + LABEL_PX];
    const boxAt = (baseline: number): Box => ({
      left: frame.x - half,
      right: frame.x + half,
      top: baseline - LABEL_PX,
      bottom: baseline + 3,
    });
    const free = spots.find((baseline) => !claimed.some((box) => overlaps(box, boxAt(baseline))));
    const baseline = free ?? spots[0];
    if (free !== undefined) claimed.push(boxAt(free));
    const alpha = frame.labelAlpha * (free === undefined ? CROWDED_LABEL_ALPHA : 1);
    ctx.fillStyle = `rgba(${rgb(frame.person.color, 0.3)}, ${0.92 * alpha})`;
    ctx.fillText(frame.person.name, frame.x, baseline);
  }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
