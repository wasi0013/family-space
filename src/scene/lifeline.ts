import { t } from '../i18n';
import { rhythmOf, twinkleDip } from './bodies';
import { ageX, type Lifeline, type LifelineMoment } from './momentSky';
import type { Point } from './orbits';
import { glowDisc } from './selfStar';

const STAR = '255, 226, 186';
const GOLD = '255, 207, 138';
const TITLE_PX = 15;
// Bengali has no true italics, so its titles stay upright.
const TITLE_FONT = `${t.lang === 'bn' ? '' : 'italic '}400 ${TITLE_PX}px "Cormorant Garamond", "Noto Serif Bengali", Georgia, serif`;
const TICK_FONT = '500 10.5px "Inter Variable", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif';

/**
 * The lifeline: a thread of light across the years, brighter where they have been lived, with a
 * bead for each moment and the gold point of now travelling along it.
 */
export function drawLifeline(
  ctx: CanvasRenderingContext2D,
  line: Lifeline,
  shown: readonly LifelineMoment[],
  age: number,
  seconds: number,
  focusId: string | null,
) {
  const now = ageX(line, age);
  ctx.save();
  ctx.lineCap = 'round';

  // The years ahead, faint; then the years lived, warm and a touch brighter toward now.
  ctx.strokeStyle = 'rgba(200, 212, 255, 0.13)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(now, line.y);
  ctx.lineTo(line.right, line.y);
  ctx.stroke();
  if (now > line.left) {
    const lived = ctx.createLinearGradient(line.left, 0, now, 0);
    lived.addColorStop(0, `rgba(${STAR}, 0.16)`);
    lived.addColorStop(1, `rgba(${STAR}, 0.5)`);
    ctx.strokeStyle = lived;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(line.left, line.y);
    ctx.lineTo(now, line.y);
    ctx.stroke();
  }

  // A tick every five years, and the decades numbered beneath.
  ctx.font = TICK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  for (let year = 0; year <= line.lifespan; year += 5) {
    const x = Math.round(ageX(line, year)) + 0.5;
    const ahead = x > now + 0.5;
    ctx.strokeStyle = `rgba(200, 212, 255, ${ahead ? 0.1 : 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, line.y + 3);
    ctx.lineTo(x, line.y + (year % 10 === 0 ? 7 : 5));
    ctx.stroke();
    if (year % 10 === 0) {
      ctx.fillStyle = `rgba(214, 222, 255, ${ahead ? 0.4 : 0.66})`;
      ctx.fillText(t.num(year), x, line.y + 10);
    }
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const { moment, bead, beadLit } of shown) {
    const a = beadLit * (moment.kind === 'hardship' ? 0.6 : 1) * (1 - 0.25 * twinkleDip(seconds, rhythmOf(moment.id)));
    glowDisc(ctx, bead.x, bead.y, 7, [
      [0, `rgba(${STAR}, ${0.45 * a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
    glowDisc(ctx, bead.x, bead.y, 2, [
      [0, `rgba(255, 255, 255, ${a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
    if (moment.id === focusId) ring(ctx, bead, 7, seconds);
  }

  glowDisc(ctx, now, line.y, 10, [
    [0, `rgba(${GOLD}, 0.6)`],
    [1, `rgba(${GOLD}, 0)`],
  ]);
  glowDisc(ctx, now, line.y, 2.6, [
    [0, 'rgba(255, 255, 255, 1)'],
    [0.6, `rgba(${GOLD}, 1)`],
    [1, `rgba(${GOLD}, 0)`],
  ]);
  ctx.restore();
}

/**
 * The moments' own constellation in the sky: each star straight above its year, joined in the
 * order they happened. Only a tapped star is named; the one playing is named by the caption.
 */
export function drawSkyMoments(
  ctx: CanvasRenderingContext2D,
  shown: readonly LifelineMoment[],
  seconds: number,
  focusId: string | null,
) {
  const lit = shown.filter((m) => m.starLit > 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1;
  for (let i = 1; i < lit.length; i++) {
    const [a, b] = [lit[i - 1], lit[i]];
    ctx.strokeStyle = `rgba(${STAR}, ${0.16 * b.starLit})`;
    ctx.beginPath();
    ctx.moveTo(a.star.x, a.star.y);
    ctx.lineTo(b.star.x, b.star.y);
    ctx.stroke();
  }

  for (const { moment, bead, star, rise, starLit } of shown) {
    if (rise !== null) drawRise(ctx, bead, star, rise);
    if (starLit <= 0) continue;
    const a = starLit * (moment.kind === 'hardship' ? 0.6 : 1) * (1 - 0.3 * twinkleDip(seconds, rhythmOf(moment.id)));
    glowDisc(ctx, star.x, star.y, 12, [
      [0, `rgba(${STAR}, ${0.5 * a})`],
      [0.3, `rgba(${STAR}, ${0.14 * a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
    glowDisc(ctx, star.x, star.y, 2.6, [
      [0, `rgba(255, 255, 255, ${a})`],
      [0.5, `rgba(${STAR}, ${0.9 * a})`],
      [1, `rgba(${STAR}, 0)`],
    ]);
  }
  ctx.restore();

  const focused = shown.find((m) => m.moment.id === focusId && m.starLit > 0);
  if (focused) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, focused.star, 11, seconds);
    ctx.restore();
    ctx.save();
    ctx.font = TITLE_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const half = ctx.measureText(focused.moment.title).width / 2;
    const width = ctx.canvas.clientWidth || ctx.canvas.width;
    const x = Math.min(Math.max(focused.star.x, half + 8), width - half - 8);
    ctx.fillStyle = 'rgba(244, 240, 232, 0.95)';
    ctx.fillText(focused.moment.title, x, focused.star.y - 16);
    ctx.restore();
  }
}

/** A moment's light rising from its bead on the lifeline to its place in the sky. */
function drawRise(ctx: CanvasRenderingContext2D, from: Point, to: Point, progress: number) {
  // Quick off the line, settling gently into place.
  const u = 1 - (1 - progress) ** 3;
  const at = (v: number): Point => ({ x: from.x + (to.x - from.x) * v, y: from.y + (to.y - from.y) * v });
  const head = at(u);
  const tail = at(Math.max(0, u - 0.3));
  const fade = 1 - Math.max(0, (progress - 0.8) / 0.2);
  const trail = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  trail.addColorStop(0, `rgba(${STAR}, 0)`);
  trail.addColorStop(1, `rgba(255, 236, 206, ${0.7 * fade})`);
  ctx.strokeStyle = trail;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  glowDisc(ctx, head.x, head.y, 10, [
    [0, `rgba(255, 240, 215, ${0.85 * fade})`],
    [0.3, `rgba(255, 220, 170, ${0.25 * fade})`],
    [1, 'rgba(255, 210, 160, 0)'],
  ]);
}

function ring(ctx: CanvasRenderingContext2D, at: Point, radius: number, seconds: number) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius + 2 * Math.sin(seconds * 2.2), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${STAR}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.stroke();
}
