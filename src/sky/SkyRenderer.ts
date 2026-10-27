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
/** Field stars this close to an edge are also drawn wrapped, so halos never clip at a seam. */
const WRAP_MARGIN = 16;
/** Brighter field stars read as nearer, so they drift faster than the faint ones. */
const NEAR_RADIUS = 0.55;
/** How fast the far layer drifts relative to the near one. */
const FAR_PARALLAX = 0.4;

type TwinklingStar = Star & { twinkle: Twinkle };

/** The Milky Way layer is large, so it caps its pixel density to keep memory in check. */
const BAND_MAX_DPR = 2;

/**
 * Paints the night sky in layers, each baked once per resize:
 * - the horizon (gradient and airglow), which never moves;
 * - the Milky Way with its crowded stars, big enough to turn around your star with no gaps;
 * - near and far field stars, tiled so they cover the screen at any angle, drifting down at
 *   different speeds for depth;
 * - the vignette and grain on top.
 * Each frame redraws only the stars that twinkle.
 */
export class SkyRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly baseLayer = document.createElement('canvas');
  private readonly bandLayer = document.createElement('canvas');
  private readonly nearLayer = document.createElement('canvas');
  private readonly farLayer = document.createElement('canvas');
  private readonly overlayLayer = document.createElement('canvas');
  private readonly sprites = makeStarSprites(STAR_TINTS.map((t) => t.color));
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver = new ResizeObserver(() => this.scheduleResize());
  private fieldTwinklers: TwinklingStar[] = [];
  private bandTwinklers: TwinklingStar[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;
  /** Half the Milky Way layer's side: the farthest any screen corner sits from the pivot. */
  private reach = 0;
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
    skyScroll.redraw = null;
  }

  private play = () => {
    cancelAnimationFrame(this.frameId);
    if (this.motionQuery.matches) {
      skyScroll.redraw = () => this.draw(0);
      this.draw(0);
      return;
    }
    skyScroll.redraw = null;
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

  private pivot(): { x: number; y: number } {
    return { x: this.width / 2, y: this.height * skyScroll.pivotY };
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    for (const canvas of [this.canvas, this.baseLayer, this.nearLayer, this.farLayer, this.overlayLayer]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const base = this.baseLayer.getContext('2d', { alpha: false })!;
    base.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackground(base, width, height);

    const overlay = this.overlayLayer.getContext('2d')!;
    overlay.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlay.clearRect(0, 0, width, height);
    paintVignette(overlay, width, height);
    paintGrain(overlay, this.seed);

    this.paintBand();
    this.paintField();
  }

  /** The Milky Way, laid out as on screen but in a square that can turn around the pivot. */
  private paintBand() {
    const { width, height } = this;
    const pivot = this.pivot();
    const reach = Math.ceil(
      Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - pivot.x, y - pivot.y))),
    );
    this.reach = reach;
    const side = reach * 2;
    const dpr = Math.min(this.dpr, BAND_MAX_DPR);
    this.bandLayer.width = this.bandLayer.height = Math.round(side * dpr);

    const onScreen = milkyWayBand(width, height);
    const band = { ...onScreen, cx: reach + onScreen.cx - pivot.x, cy: reach + onScreen.cy - pivot.y };
    const stars = generateStars(side, side, band, this.seed + 7).filter((s) => !s.field);
    this.bandTwinklers = stars.filter((s): s is TwinklingStar => s.twinkle !== null);

    const ctx = this.bandLayer.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, side, side);
    paintMilkyWay(ctx, side, side, band, this.seed);
    ctx.globalCompositeOperation = 'lighter';
    for (const star of stars) if (!star.twinkle) drawStar(ctx, star, this.sprites);
  }

  /** Scattered stars, wrapping on every edge so the layers tile seamlessly at any angle. */
  private paintField() {
    const { width, height, dpr } = this;
    const stars = generateStars(width, height, milkyWayBand(width, height), this.seed).filter((s) => s.field);
    this.fieldTwinklers = stars.filter((s): s is TwinklingStar => s.twinkle !== null);
    const near = this.nearLayer.getContext('2d')!;
    const far = this.farLayer.getContext('2d')!;
    for (const layer of [near, far]) {
      layer.setTransform(dpr, 0, 0, dpr, 0, 0);
      layer.clearRect(0, 0, width, height);
      layer.globalCompositeOperation = 'lighter';
    }
    for (const star of stars) {
      if (star.twinkle) continue;
      const layer = star.radius >= NEAR_RADIUS ? near : far;
      for (const dx of wraps(star.x, width)) {
        for (const dy of wraps(star.y, height)) drawStar(layer, { ...star, x: star.x + dx, y: star.y + dy }, this.sprites);
      }
    }
  }

  /** Where a field layer's tiles start, in its own turned frame, so its stars drift straight down the screen. */
  private offset(parallax: number): { x: number; y: number } {
    const distance = skyScroll.y * parallax;
    return {
      x: mod(distance * Math.sin(skyScroll.angle), this.width),
      y: mod(distance * Math.cos(skyScroll.angle), this.height),
    };
  }

  /** Each tile of a field layer, in its turned frame, that can show on screen. */
  private tiles(offset: { x: number; y: number }): { x: number; y: number }[] {
    const { width, height, reach } = this;
    const pivot = this.pivot();
    const tiles = [];
    for (let i = Math.floor((pivot.x - reach - offset.x) / width); i * width + offset.x < pivot.x + reach; i++) {
      for (let j = Math.floor((pivot.y - reach - offset.y) / height); j * height + offset.y < pivot.y + reach; j++) {
        tiles.push({ x: offset.x + i * width, y: offset.y + j * height });
      }
    }
    return tiles;
  }

  private draw(seconds: number) {
    const { ctx, dpr, width, height } = this;
    const pivot = this.pivot();
    const angle = skyScroll.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    /** From the sky's turned frame onto the screen. */
    const toScreen = (x: number, y: number) => ({
      x: pivot.x + (x - pivot.x) * cos - (y - pivot.y) * sin,
      y: pivot.y + (x - pivot.x) * sin + (y - pivot.y) * cos,
    });
    const onScreen = (p: { x: number; y: number }) => p.x > -8 && p.y > -8 && p.x < width + 8 && p.y < height + 8;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.baseLayer, 0, 0);

    // Everything above the horizon turns together around your star.
    ctx.globalCompositeOperation = 'lighter';
    ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * pivot.x, dpr * pivot.y);
    ctx.drawImage(this.bandLayer, -this.reach, -this.reach, this.reach * 2, this.reach * 2);
    const near = this.offset(1);
    const far = this.offset(FAR_PARALLAX);
    for (const [layer, offset] of [
      [this.farLayer, far],
      [this.nearLayer, near],
    ] as const) {
      for (const tile of this.tiles(offset)) ctx.drawImage(layer, tile.x - pivot.x, tile.y - pivot.y, width, height);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const star of this.fieldTwinklers) {
      const dim = star.twinkle.amp * scintillation(star.twinkle, seconds);
      const offset = star.radius >= NEAR_RADIUS ? near : far;
      for (const tile of this.tiles(offset)) {
        const p = toScreen(tile.x + star.x, tile.y + star.y);
        if (onScreen(p)) drawStar(ctx, { ...star, ...p }, this.sprites, 1 - dim, 1 - dim * 0.25);
      }
    }
    for (const star of this.bandTwinklers) {
      const p = toScreen(pivot.x + star.x - this.reach, pivot.y + star.y - this.reach);
      if (!onScreen(p)) continue;
      const dim = star.twinkle.amp * scintillation(star.twinkle, seconds);
      drawStar(ctx, { ...star, ...p }, this.sprites, 1 - dim, 1 - dim * 0.25);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.overlayLayer, 0, 0);
    if (skyScroll.dim > 0.001) {
      ctx.fillStyle = `rgba(1, 2, 6, ${skyScroll.dim})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

/** Offsets at which a star near an edge is drawn again, so it shows across the seam. */
function wraps(position: number, size: number): number[] {
  if (position < WRAP_MARGIN) return [0, size];
  if (position > size - WRAP_MARGIN) return [0, -size];
  return [0];
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}
