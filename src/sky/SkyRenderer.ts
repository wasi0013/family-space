import { paintBackground, paintGrain, paintMilkyWay, paintVignette } from './backdrop';
import { skyScroll } from './skyScroll';
import { drawStar, makeStarSprites } from './sprites';
import {
  generateStars,
  milkyWayBand,
  scintillation,
  STAR_TINTS,
  type Star,
  type Twinkle,
} from './starfield';

const RESIZE_DEBOUNCE_MS = 150;
const MAX_DPR = 3;
/** Field stars this close to the top or bottom are also drawn wrapped, so halos never clip. */
const WRAP_MARGIN = 16;
/** Brighter field stars read as nearer, so they drift faster than the faint ones. */
const NEAR_RADIUS = 0.55;
/** How fast the far layer drifts relative to the near one. */
const FAR_PARALLAX = 0.4;

type TwinklingStar = Star & { twinkle: Twinkle };

/**
 * Paints the night sky in layers, each baked once per resize. The fixed layer (gradient, Milky
 * Way, vignette, grain) never moves. The scattered field stars are split into a near and a far
 * layer that scroll with `skyScroll` at different speeds, wrapping vertically, so the sky has
 * depth when it moves. Each frame redraws only the stars that twinkle.
 */
export class SkyRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fixedLayer = document.createElement('canvas');
  private readonly nearLayer = document.createElement('canvas');
  private readonly farLayer = document.createElement('canvas');
  private readonly sprites = makeStarSprites(STAR_TINTS.map((t) => t.color));
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver = new ResizeObserver(() => this.scheduleResize());
  private twinklers: TwinklingStar[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frameId = 0;
  private resizeTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly seed = 1,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
  }

  start() {
    this.resize();
    this.resizeObserver.observe(this.canvas);
    this.motionQuery.addEventListener('change', this.play);
    this.play();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.resizeTimer);
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener('change', this.play);
  }

  private play = () => {
    cancelAnimationFrame(this.frameId);
    if (this.motionQuery.matches) {
      this.draw(0);
      return;
    }
    const tick = (now: number) => {
      this.draw(now / 1000);
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  };

  private scheduleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resize();
      if (this.motionQuery.matches) this.draw(0);
    }, RESIZE_DEBOUNCE_MS);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    for (const canvas of [this.canvas, this.fixedLayer, this.nearLayer, this.farLayer]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const band = milkyWayBand(width, height);
    const stars = generateStars(width, height, band, this.seed);
    this.twinklers = stars.filter((s): s is TwinklingStar => s.twinkle !== null);

    const fixed = this.fixedLayer.getContext('2d', { alpha: false })!;
    fixed.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(fixed, width, height);
    paintMilkyWay(fixed, width, height, band, this.seed);
    paintVignette(fixed, width, height);
    fixed.globalCompositeOperation = 'lighter';
    for (const star of stars) {
      if (!star.twinkle && !star.field) drawStar(fixed, star, this.sprites);
    }
    fixed.globalCompositeOperation = 'source-over';
    fixed.globalAlpha = 1;
    paintGrain(fixed, this.seed);

    const near = this.nearLayer.getContext('2d')!;
    const far = this.farLayer.getContext('2d')!;
    for (const layer of [near, far]) {
      layer.setTransform(dpr, 0, 0, dpr, 0, 0);
      layer.clearRect(0, 0, width, height);
      layer.globalCompositeOperation = 'lighter';
    }
    for (const star of stars) {
      if (star.twinkle || !star.field) continue;
      const layer = star.radius >= NEAR_RADIUS ? near : far;
      drawStar(layer, star, this.sprites);
      if (star.y < WRAP_MARGIN) drawStar(layer, { ...star, y: star.y + height }, this.sprites);
      if (star.y > height - WRAP_MARGIN) drawStar(layer, { ...star, y: star.y - height }, this.sprites);
    }
  }

  /** How far a layer has scrolled, wrapped into [0, height). */
  private shift(parallax: number): number {
    const { height } = this;
    return (((skyScroll.y * parallax) % height) + height) % height;
  }

  private draw(seconds: number) {
    const { ctx, dpr, height } = this;
    const nearShift = this.shift(1);
    const farShift = this.shift(FAR_PARALLAX);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.fixedLayer, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const [layer, shift] of [
      [this.farLayer, farShift],
      [this.nearLayer, nearShift],
    ] as const) {
      const deviceShift = Math.round(shift * dpr);
      ctx.drawImage(layer, 0, deviceShift);
      ctx.drawImage(layer, 0, deviceShift - this.canvas.height);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const star of this.twinklers) {
      const dim = star.twinkle.amp * scintillation(star.twinkle, seconds);
      const shift = star.radius >= NEAR_RADIUS ? nearShift : farShift;
      const drawn = star.field ? { ...star, y: (star.y + shift) % height } : star;
      drawStar(ctx, drawn, this.sprites, 1 - dim, 1 - dim * 0.25);
    }
  }
}
