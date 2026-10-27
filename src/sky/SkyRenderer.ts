import { paintBackground, paintGrain, paintMilkyWay, paintVignette } from './backdrop';
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

type TwinklingStar = Star & { twinkle: Twinkle };

/**
 * Paints the night sky. Everything that never changes is baked into an offscreen layer once per
 * resize; each frame only blits that layer and redraws the stars that twinkle.
 */
export class SkyRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly staticLayer = document.createElement('canvas');
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

    this.canvas.width = this.staticLayer.width = Math.round(width * dpr);
    this.canvas.height = this.staticLayer.height = Math.round(height * dpr);

    const band = milkyWayBand(width, height);
    const stars = generateStars(width, height, band, this.seed);
    this.twinklers = stars.filter((s): s is TwinklingStar => s.twinkle !== null);

    const ctx = this.staticLayer.getContext('2d', { alpha: false })!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(ctx, width, height);
    paintMilkyWay(ctx, width, height, band, this.seed);
    paintVignette(ctx, width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (const star of stars) {
      if (!star.twinkle) drawStar(ctx, star, this.sprites);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    paintGrain(ctx, this.seed);
  }

  private draw(seconds: number) {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.staticLayer, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.twinklers) {
      const dim = star.twinkle.amp * scintillation(star.twinkle, seconds);
      drawStar(ctx, star, this.sprites, 1 - dim, 1 - dim * 0.25);
    }
  }
}
