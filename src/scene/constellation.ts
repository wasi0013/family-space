import { t } from '../i18n';
import { rhythmOf, twinkleDip } from './bodies';
import { ageX, type Constellation, type MomentPoint } from './momentSky';
import type { Point } from './orbits';
import { glowDisc } from './selfStar';

const STAR = '255, 226, 186';
const GOLD = '255, 207, 138';
const TITLE_PX = 14;
// Bengali has no true italics, so its titles stay upright.
const TITLE_FONT = `${t.lang === 'bn' ? '' : 'italic '}300 ${TITLE_PX}px "Cormorant Garamond", "Noto Serif Bengali", Georgia, serif`;
const TICK_FONT = '500 10px "Inter Variable", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Your life's constellation: a star for each moment, joined in order and running on to the gold
 * point that marks now, over faint ticks for the years.
 */
export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  c: Constellation,
  points: readonly MomentPoint[],
  now: Point,
  seconds: number,
  focusId: string | null,
) {
  drawTicks(ctx, c, now.x);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (points.length) {
    ctx.strokeStyle = `rgba(${STAR}, 0.26)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineTo(now.x, now.y);
    ctx.stroke();
  }

  for (const point of points) {
    // A hard time stays in the sky, a little dimmer than the rest.
    const strength = (point.moment.kind === 'hardship' ? 0.6 : 1) * point.lit;
    const shimmer = 1 - 0.3 * twinkleDip(seconds, rhythmOf(point.moment.id));
    const a = strength * shimmer;
    glowDisc(ctx, point.x, point.y, 13, [
      [0, `rgba(${STAR}, ${0.5 * a})`],
      [0.3, `rgba(${STAR}, ${0.15 * a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
    glowDisc(ctx, point.x, point.y, 2.8, [
      [0, `rgba(255, 255, 255, ${a})`],
      [0.5, `rgba(${STAR}, ${0.9 * a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
    if (point.moment.id === focusId) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 11 + 2 * Math.sin(seconds * 2.2), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${STAR}, 0.6)`;
      ctx.stroke();
    }
  }

  glowDisc(ctx, now.x, now.y, 9, [
    [0, `rgba(${GOLD}, 0.55)`],
    [1, `rgba(${GOLD}, 0)`],
  ]);
  glowDisc(ctx, now.x, now.y, 2.4, [
    [0, 'rgba(255, 255, 255, 1)'],
    [0.6, `rgba(${GOLD}, 1)`],
    [1, `rgba(${GOLD}, 0)`],
  ]);
  ctx.restore();

  drawTitles(ctx, points, focusId);
}

function drawTicks(ctx: CanvasRenderingContext2D, c: Constellation, nowX: number) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = TICK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let age = 0; age <= c.lifespan; age++) {
    const x = Math.round(ageX(c, age)) + 0.5;
    // Years still ahead of the moment being played are fainter.
    const ahead = x > nowX + 0.5;
    const decade = age % 10 === 0;
    ctx.strokeStyle = `rgba(200, 212, 255, ${(age % 5 === 0 ? 0.22 : 0.09) * (ahead ? 0.5 : 1)})`;
    ctx.beginPath();
    ctx.moveTo(x, c.baseline);
    ctx.lineTo(x, c.baseline + (age % 5 === 0 ? 6 : 3));
    ctx.stroke();
    if (decade) {
      ctx.fillStyle = `rgba(214, 222, 255, ${ahead ? 0.18 : 0.34})`;
      ctx.fillText(t.num(age), x, c.baseline + 9);
    }
  }
  ctx.restore();
}

/** Titles go above their star, or below when that space is taken, like people's names. */
function drawTitles(ctx: CanvasRenderingContext2D, points: readonly MomentPoint[], focusId: string | null) {
  ctx.save();
  ctx.font = TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const claimed: Box[] = [];
  const width = ctx.canvas.clientWidth || ctx.canvas.width;
  const order = [...points].sort((a, b) => Number(b.moment.id === focusId) - Number(a.moment.id === focusId));
  for (const point of order) {
    const half = ctx.measureText(point.moment.title).width / 2 + 4;
    // Near either edge a title shifts inward rather than running off the screen.
    const x = Math.min(Math.max(point.x, half + 4), width - half - 4);
    const spots = [point.y - 11, point.y + 11 + TITLE_PX];
    const boxAt = (baseline: number): Box => ({ left: x - half, right: x + half, top: baseline - TITLE_PX, bottom: baseline + 3 });
    const free = spots.find((baseline) => !claimed.some((box) => overlaps(box, boxAt(baseline))));
    if (free !== undefined) claimed.push(boxAt(free));
    // A title with no room is left unwritten; its star stays, and tapping it reads it.
    if (free === undefined && point.moment.id !== focusId) continue;
    const alpha = point.lit * (point.moment.id === focusId ? 1 : 0.78);
    ctx.fillStyle = `rgba(236, 239, 253, ${alpha})`;
    ctx.fillText(point.moment.title, x, free ?? spots[0]);
  }
  ctx.restore();
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
