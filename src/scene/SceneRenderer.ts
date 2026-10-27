import type { Person, Profile } from '../model';
import { skyScroll } from '../sky/skyScroll';
import { drawBody, drawLabel, drawOrbitPath, drawTrail } from './bodies';
import {
  clamp01,
  frameBodies,
  layoutScene,
  settleAge,
  YEARS_PER_SECOND,
  type BodyFrame,
  type Layout,
} from './orbits';
import { drawSelfStar, ignition, SETTLED, type Ignition } from './selfStar';

const MAX_DPR = 3;
/** Vertical position of the person's star as a fraction of the viewport; leaves the upper sky open. */
export const SELF_Y = 0.56;
/** Playback starts once the self star has finished igniting. */
const PLAY_DELAY_S = 2.6;
/**
 * The system travels upward through space, shown by the nearer background stars sliding down
 * past it: faster while the life plays, a slow steady drift once it settles (px per second).
 */
const DRIFT_PLAYING = 18;
const DRIFT_SETTLED = 5;
/** How quickly the drift eases between those speeds, per second. */
const DRIFT_EASE = 1.2;

export function selfStarRadius(width: number, height: number): number {
  return Math.min(11, Math.max(6, Math.min(width, height) * 0.014));
}

export interface SceneOptions {
  /** Open paused at this age instead of playing from 0. */
  initialAge?: number;
  /** Called with the whole-year age whenever it changes. */
  onAge: (age: number) => void;
  /** Called when playback starts or stops, counting a pending autoplay as playing. */
  onPlayingChange: (playing: boolean) => void;
}

/**
 * Draws the life scene over the sky on a transparent canvas. The scene is a function of `age`:
 * a small clock plays it from 0 to the person's current age.
 */
export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver = new ResizeObserver(() => this.resize());
  /** Playback runs a little past the current age so recent departures can finish. */
  private readonly endAge: number;
  private layout: Layout | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frameId = 0;
  private age: number;
  /** Time spent paused, which keeps the orbits turning. */
  private idleSeconds = 0;
  private driftSpeed = 0;
  private playing = false;
  private autoplay: boolean;
  private igniteStart = -1;
  private lastNow = -1;
  private shownAge = -1;
  private shownPlaying: boolean | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly profile: Profile,
    private readonly people: readonly Person[],
    private readonly options: SceneOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.endAge = settleAge(people, profile.age);
    this.autoplay = options.initialAge === undefined;
    this.age = options.initialAge === undefined ? 0 : Math.min(this.endAge, Math.max(0, options.initialAge));
  }

  start() {
    this.resize();
    this.resizeObserver.observe(this.canvas);
    this.motionQuery.addEventListener('change', this.play);
    // Labels are canvas text; repaint a still frame once the web font is ready.
    document.fonts.ready.then(() => this.redrawIfStill());
    this.play();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener('change', this.play);
  }

  get currentAge(): number {
    return this.age;
  }

  /** Lets the caller size a scrub gesture to the whole life. */
  get lifespan(): number {
    return this.endAge;
  }

  togglePlay() {
    if (this.motionQuery.matches) return;
    // Pausing before playback has even started cancels the autoplay.
    const wasRunning = this.playing || this.autoplay;
    this.autoplay = false;
    if (this.age >= this.endAge) {
      this.age = 0;
      this.playing = true;
    } else {
      this.playing = !wasRunning;
    }
    this.reportPlaying();
  }

  step(years: number) {
    this.seek(Math.min(this.profile.age, Math.round(this.age) + years));
  }

  /** Jumps to an age and holds there, as when scrubbing through the years. */
  seek(age: number) {
    this.autoplay = false;
    this.playing = false;
    this.age = Math.min(this.endAge, Math.max(0, age));
    this.reportAge();
    this.reportPlaying();
    this.redrawIfStill();
  }

  private play = () => {
    cancelAnimationFrame(this.frameId);
    if (this.motionQuery.matches) {
      if (this.autoplay) this.age = this.endAge;
      this.autoplay = false;
      this.playing = false;
      this.reportAge();
      this.reportPlaying();
      this.drawStill();
      return;
    }
    this.lastNow = -1;
    const tick = (now: number) => {
      const dt = this.lastNow < 0 ? 0 : Math.min(0.1, (now - this.lastNow) / 1000);
      this.lastNow = now;
      if (this.igniteStart < 0) this.igniteStart = now;
      const sinceIgnite = (now - this.igniteStart) / 1000;
      if (this.autoplay && sinceIgnite >= PLAY_DELAY_S) {
        this.autoplay = false;
        this.playing = true;
      }
      this.advance(dt);
      const ig = this.options.initialAge === undefined ? ignition(sinceIgnite) : SETTLED;
      this.draw(now / 1000, ig);
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  };

  private advance(dt: number) {
    if (this.playing) {
      this.age = Math.min(this.endAge, this.age + dt * YEARS_PER_SECOND);
      if (this.age >= this.endAge) this.playing = false;
    } else {
      this.idleSeconds += dt;
    }
    const target = this.playing ? DRIFT_PLAYING : DRIFT_SETTLED;
    this.driftSpeed += (target - this.driftSpeed) * Math.min(1, dt * DRIFT_EASE);
    skyScroll.y += this.driftSpeed * dt;
    this.reportAge();
    this.reportPlaying();
  }

  private reportPlaying() {
    const running = this.playing || this.autoplay;
    if (running === this.shownPlaying) return;
    this.shownPlaying = running;
    this.options.onPlayingChange(running);
  }

  private reportAge() {
    const shown = Math.min(this.profile.age, Math.floor(this.age));
    if (shown === this.shownAge) return;
    this.shownAge = shown;
    this.options.onAge(shown);
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.layout = layoutScene(this.people, this.width, this.height, SELF_Y);
    this.redrawIfStill();
  }

  private redrawIfStill() {
    if (this.motionQuery.matches) this.drawStill();
  }

  private drawStill() {
    this.draw(0, SETTLED);
  }

  private draw(seconds: number, ig: Ignition) {
    const { ctx, width, height, dpr, layout } = this;
    if (!layout) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const frames = frameBodies(layout, this.age, this.idleSeconds);
    const far = frames.filter((f) => f.depth < 0);
    const near = frames.filter((f) => f.depth >= 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const frame of frames) drawOrbitPath(ctx, layout, frame);
    this.drawBodies(far, seconds);
    ctx.restore();

    // The star swells a little as its life goes on.
    const growth = 0.55 + 0.45 * clamp01(this.age / Math.max(1, this.profile.age));
    drawSelfStar(ctx, width / 2, height * SELF_Y, selfStarRadius(width, height) * growth, seconds, ig);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawBodies(near, seconds);
    ctx.restore();

    for (const frame of frames) drawLabel(ctx, frame);
  }

  private drawBodies(frames: readonly BodyFrame[], seconds: number) {
    for (const frame of frames) {
      drawTrail(this.ctx, frame);
      drawBody(this.ctx, frame, seconds);
    }
  }
}
