import type { Moment, Person, Profile } from '../model';
import { skyScroll } from '../sky/skyScroll';
import { drawBody, drawFocus, drawLabels, drawOrbitPath, drawTrail } from './bodies';
import { drawLifeline, drawSkyMoments } from './lifeline';
import {
  auroraStrength,
  drawAurora,
  drawLoveGlow,
  drawShadow,
  drawNova,
  griefAt,
  flareAt,
  HARDSHIP_PULL,
  hardshipDepth,
  loveGlow,
  novaProgress,
  remnantAt,
  skyAngle,
} from './phenomena';
import {
  captionAt,
  layoutLifeline,
  lifelineMoments,
  momentsSettleAge,
  placeSkyMoments,
  playbackSpeed,
  type Box,
  type Lifeline,
  type LifelineMoment,
} from './momentSky';
import {
  COMPACT_WIDTH,
  frameBodies,
  layoutScene,
  settleAge,
  YEARS_PER_SECOND,
  type BodyFrame,
  type Layout,
} from './orbits';
import { drawSelfStar, ignition, SETTLED, type Ignition } from './selfStar';
import { stageAt, type StarStage } from './stellar';

/** Beyond 2× the extra pixels cost far more than they show, in stars that are soft glows anyway. */
const MAX_DPR = 2;
/** Between frames while the years move, in milliseconds: at most 60 a second, even on faster screens. */
const MOVING_FRAME_MS = 1000 / 60;
/** Between frames while nothing but twinkling moves, in milliseconds: about 30 a second. */
const IDLE_FRAME_MS = 1000 / 30;
/** How long the self star takes to ignite, in seconds. */
const IGNITE_S = 3;
/** Holding a skip button sweeps through the years this many times faster than playing. */
const SCAN_SPEED = 2;
/** Going back within this many years of a moment's start passes it, to the moment before. */
const SKIP_BACK_GRACE = 0.6;
/** How far above, below and past the ends of the timeline a touch still takes hold of it. */
const TIMELINE_SLOP = 26;
/** How close a tap must land to a person to pick them, in CSS pixels. */
const HIT_RADIUS = 24;
/** Vertical position of the person's star as a fraction of the viewport; leaves the upper sky open. */
export const SELF_Y = 0.5;
/** On the smallest phones a little higher still, so the system can be large enough to read. */
const COMPACT_SELF_Y = 0.47;
const LIFELINE_CLEARANCE = 236;
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

/** "#ff8a7a" → "255, 138, 122". */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

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
  /** Called with the moment to caption as one begins, and null once its caption has passed. */
  onMoment: (moment: Moment | null) => void;
}

/**
 * Draws the life scene over the sky on a transparent canvas. The scene is a function of `age`:
 * a small clock plays it from 0 to the person's current age.
 */
export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver = new ResizeObserver(() => this.resize());
  /** Playback runs a little past the current age so recent departures and moments can finish. */
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
  /** Whether the self star plays its ignition; a seeked scene opens already lit. */
  private igniting: boolean;
  private igniteStart = -1;
  private lastNow = -1;
  private shownAge = -1;
  private shownPlaying: boolean | null = null;
  /** Everyone as last drawn, for finding who was tapped. */
  private lastFrames: BodyFrame[] = [];
  /** The lifeline, where each moment's star sits in the sky, and both as last drawn. */
  private lifeline: Lifeline | null = null;
  private skyStars = new Map<string, { x: number; y: number }>();
  private lastShown: LifelineMoment[] = [];
  private selfY = SELF_Y;
  /** Set while a skip button is held: sweeping back (-1) or forward (1) through the years. */
  private scanDirection: -1 | 0 | 1 = 0;
  /** Whether the journey was playing when the sweep began, so letting go carries on as before. */
  private scanResume = false;
  private focusId: string | null = null;
  private shownMoment: Moment | null | undefined = undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly profile: Profile,
    private readonly people: readonly Person[],
    private readonly moments: readonly Moment[],
    private readonly options: SceneOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.endAge = Math.max(settleAge(people, profile.age), momentsSettleAge(moments, profile.age));
    this.autoplay = options.initialAge === undefined;
    this.igniting = options.initialAge === undefined;
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
    skyScroll.dim = 0;
    skyScroll.angle = 0;
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener('change', this.play);
  }

  get currentAge(): number {
    return this.age;
  }

  /** The title of the moment captioned now, for exports. */
  get momentCaption(): string | null {
    return captionAt(this.moments, this.age)?.title ?? null;
  }

  /** Lets the caller size a scrub gesture to the whole life. */
  get lifespan(): number {
    return this.endAge;
  }

  /** True once the life has played through and every departure has settled. */
  get finished(): boolean {
    return this.age >= this.endAge && !this.playing && !this.autoplay;
  }

  /** Starts the journey over from birth, with the star igniting again, as for a recording. */
  restart() {
    this.age = 0;
    this.idleSeconds = 0;
    this.playing = false;
    this.autoplay = true;
    this.igniting = true;
    this.igniteStart = -1;
    this.reportAge();
    this.reportPlaying();
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

  /**
   * Sweeps through the years at twice the playing speed while a skip button is held, back or
   * forward; 0 lets go, and the journey carries on as it was before.
   */
  scan(direction: -1 | 0 | 1) {
    if (this.motionQuery.matches || direction === this.scanDirection) return;
    if (this.scanDirection === 0) this.scanResume = this.playing || this.autoplay;
    this.autoplay = false;
    this.playing = direction === 0 && this.scanResume && this.age < this.endAge;
    this.scanDirection = direction;
    this.reportPlaying();
  }

  /**
   * Goes to the next moment, or back to the one before; past the last it goes to today, and before
   * the first to birth. Playing carries on from there.
   */
  skip(direction: -1 | 1) {
    const ages = [...new Set(this.moments.map((m) => m.age))].sort((a, b) => a - b);
    // Going back from just after a moment passes it, to the one before, as a "previous" should.
    const target =
      direction > 0
        ? (ages.find((a) => a > this.age + 0.05) ?? this.profile.age)
        : (ages.filter((a) => a < this.age - SKIP_BACK_GRACE).pop() ?? 0);
    this.age = Math.min(this.endAge, Math.max(0, target));
    if (this.autoplay) {
      this.autoplay = false;
      this.playing = true;
    }
    if (this.age >= this.endAge) this.playing = false;
    this.reportAge();
    this.reportPlaying();
    this.redrawIfStill();
  }

  pause() {
    this.autoplay = false;
    this.playing = false;
    this.reportPlaying();
  }

  /** Rings one person, as while their memory card is open; null clears it. */
  setFocus(id: string | null) {
    this.focusId = id;
    this.redrawIfStill();
  }

  /** The person drawn nearest a point on screen, if a tap there would pick them. */
  personAt(x: number, y: number): { person: Person; x: number; y: number } | null {
    let nearest: BodyFrame | null = null;
    let nearestDistance = HIT_RADIUS;
    for (const frame of this.lastFrames) {
      // Skip people too faint to see: just arriving, or fading out as a shooting star.
      if (frame.alpha < 0.25) continue;
      const distance = Math.hypot(frame.x - x, frame.y - y);
      if (distance < nearestDistance) {
        nearest = frame;
        nearestDistance = distance;
      }
    }
    return nearest && { person: nearest.person, x: nearest.x, y: nearest.y };
  }

  /** The moment star drawn nearest a point on screen, if a tap there would pick it. */
  momentAt(x: number, y: number): { moment: Moment; x: number; y: number } | null {
    // Either the moment's star in the sky or its bead on the lifeline.
    let found: { moment: Moment; x: number; y: number } | null = null;
    let foundDistance = HIT_RADIUS;
    for (const shown of this.lastShown) {
      for (const [point, lit] of [
        [shown.star, shown.starLit],
        [shown.bead, shown.beadLit],
      ] as const) {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (lit > 0.25 && distance < foundDistance) {
          found = { moment: shown.moment, x: point.x, y: point.y };
          foundDistance = distance;
        }
      }
    }
    return found;
  }

  /**
   * The age at a point on the lifeline, or null when the point is off it: only the lifeline
   * travels through the years, so a stray touch elsewhere on the sky never does.
   */
  timelineAgeAt(x: number, y: number): number | null {
    const line = this.lifeline;
    if (!line || x < line.left - TIMELINE_SLOP || x > line.right + TIMELINE_SLOP || Math.abs(y - line.y) > TIMELINE_SLOP) return null;
    return this.timelineAge(x);
  }

  /** The age along the lifeline under `x`, wherever the finger has drifted above or below it. */
  timelineAge(x: number): number {
    const line = this.lifeline;
    if (!line) return this.age;
    return Math.min(1, Math.max(0, (x - line.left) / (line.right - line.left))) * this.profile.age;
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
      this.frameId = requestAnimationFrame(tick);
      if (this.igniteStart < 0) this.igniteStart = now;
      const sinceIgnite = (now - this.igniteStart) / 1000;
      // Full speed only while the years are moving; a still sky only twinkles and drifts, and
      // half the frames are plenty for that.
      const moving = this.playing || this.autoplay || this.scanDirection !== 0 || (this.igniting && sinceIgnite < IGNITE_S);
      // 120 Hz screens would otherwise draw twice as often for motion no smoother to the eye.
      if (this.lastNow >= 0 && now - this.lastNow < (moving ? MOVING_FRAME_MS - 2 : IDLE_FRAME_MS - 1)) return;
      const dt = this.lastNow < 0 ? 0 : Math.min(0.1, (now - this.lastNow) / 1000);
      this.lastNow = now;
      if (this.autoplay && sinceIgnite >= PLAY_DELAY_S) {
        this.autoplay = false;
        this.playing = true;
      }
      this.advance(dt);
      const ig = this.igniting ? ignition(sinceIgnite) : SETTLED;
      this.draw(now / 1000, ig);
    };
    this.frameId = requestAnimationFrame(tick);
  };

  private advance(dt: number) {
    if (this.scanDirection !== 0) {
      this.age = Math.min(this.endAge, Math.max(0, this.age + this.scanDirection * dt * YEARS_PER_SECOND * SCAN_SPEED));
    } else if (this.playing) {
      // Time slows around each moment so it can be felt and its caption read.
      const speed = YEARS_PER_SECOND * playbackSpeed(this.moments, this.age);
      this.age = Math.min(this.endAge, this.age + dt * speed);
      if (this.age >= this.endAge) this.playing = false;
    } else {
      this.idleSeconds += dt;
    }
    // While sweeping, the sky drifts with the years, backward too.
    const target =
      this.scanDirection !== 0 ? DRIFT_PLAYING * SCAN_SPEED * this.scanDirection : this.playing ? DRIFT_PLAYING : DRIFT_SETTLED;
    this.driftSpeed += (target - this.driftSpeed) * Math.min(1, dt * DRIFT_EASE);
    skyScroll.y += this.driftSpeed * dt;
    this.reportAge();
    this.reportPlaying();
  }

  private reportMoment() {
    const moment = captionAt(this.moments, this.age);
    if (moment === this.shownMoment) return;
    this.shownMoment = moment;
    this.options.onMoment(moment);
  }

  private reportPlaying() {
    // A sweep through the years counts as playing, so the buttons stay out of the way.
    const running = this.playing || this.autoplay || this.scanDirection !== 0;
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
    this.selfY = this.width < COMPACT_WIDTH ? COMPACT_SELF_Y : SELF_Y;
    // The sky turns around your star when you move home.
    skyScroll.pivotY = this.selfY;
    this.layout = layoutScene(this.people, this.width, this.height, this.selfY, this.profile.age, LIFELINE_CLEARANCE);
    // There is always a lifeline, even with no moments, as the one place to travel through the years.
    this.lifeline = layoutLifeline(this.width, this.height, this.profile.age);
    this.skyStars = this.placeSkyStars(this.lifeline, this.layout);
    this.redrawIfStill();
  }

  private redrawIfStill() {
    if (this.motionQuery.matches) this.drawStill();
  }

  private drawStill() {
    this.draw(0, SETTLED);
    skyScroll.redraw?.();
  }

  private draw(seconds: number, ig: Ignition) {
    const { ctx, width, height, dpr, layout } = this;
    if (!layout) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    skyScroll.angle = skyAngle(this.moments, this.age);
    drawLoveGlow(ctx, width, height, loveGlow(this.moments, this.age));
    drawAurora(ctx, width, height, auroraStrength(this.moments, this.age), seconds);

    // A hard time darkens the sky and draws the people around you closer and brighter.
    const hardship = hardshipDepth(this.moments, this.age);
    skyScroll.dim = 0.42 * hardship;
    // As your star swells into a giant, everyone's orbit widens to make room.
    const starRadius = selfStarRadius(width, height);
    const frames = frameBodies(layout, this.age, this.idleSeconds, (lane, age) => {
      const swell = starRadius * (this.stageAt(age).scale - 1) * 2.4;
      return (lane + swell) * (1 - HARDSHIP_PULL * hardshipDepth(this.moments, age));
    });
    if (hardship > 0) for (const frame of frames) if (frame.orbitRadius !== null) frame.scale *= 1 + 0.3 * hardship;
    this.lastFrames = frames;
    this.reportMoment();

    if (this.lifeline) {
      this.lastShown = lifelineMoments(this.lifeline, this.skyStars, this.moments, this.age);
      drawSkyMoments(ctx, this.lastShown, seconds, this.focusId);
      drawLifeline(ctx, this.lifeline, this.lastShown, this.age, seconds, this.focusId);
    }
    const far = frames.filter((f) => f.depth < 0);
    const near = frames.filter((f) => f.depth >= 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const frame of frames) drawOrbitPath(ctx, layout, frame);
    this.drawBodies(far, seconds);
    ctx.restore();

    // The star ages with you, flares at a milestone, and dims in a hard time and in grief.
    const stage = this.stageAt(this.age);
    const radius = selfStarRadius(width, height);
    const grief = griefAt(this.people, this.age);
    // Grief makes the light waver as well as fade.
    const waver = grief * (0.5 + 0.5 * Math.sin(seconds * 3.1) * Math.sin(seconds * 1.3 + 0.7));
    const self = { x: width / 2, y: height * this.selfY };
    const flare = flareAt(this.moments, this.age);
    const lit = flare && ig.ring >= 1 ? { ...ig, flash: Math.max(ig.flash, flare.flash), ring: flare.ring } : ig;
    ctx.save();
    ctx.globalAlpha = (1 - 0.6 * hardship) * (1 - 0.75 * grief - 0.15 * waver);
    drawSelfStar(ctx, self.x, self.y, radius * (1 - 0.15 * hardship - 0.1 * grief), seconds, lit, stage);
    ctx.restore();
    drawShadow(ctx, self.x, self.y, radius * stage.scale, hardship);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawBodies(near, seconds);
    const focus = frames.find((f) => f.person.id === this.focusId);
    if (focus) drawFocus(ctx, focus, seconds);
    ctx.restore();

    drawLabels(ctx, frames, this.focusId);
  }

  /**
   * Moments' stars share the upper sky with the stars of those who have died, so each is placed
   * clear of them and their names, and above the system even once the star has swollen.
   */
  private placeSkyStars(line: Lifeline, layout: Layout) {
    const swell = selfStarRadius(this.width, this.height) * (this.stageAt(this.profile.age).scale - 1) * 2.4;
    // The smallest phones have little sky to spare, so it starts just under the buttons.
    const compact = this.width < COMPACT_WIDTH;
    const top = compact ? 58 : Math.max(84, this.height * 0.11);
    const bottom = Math.max(top + 24, layout.cy - (layout.outerRadius + swell) * layout.tilt - (compact ? 26 : 36));
    const avoid: Box[] = [];
    for (const track of layout.tracks) {
      if (!track.slot) continue;
      // The star and its name above it, about as wide as the name is drawn.
      const half = track.person.name.length * 3.4 + 4;
      avoid.push({ left: track.slot.x - half, right: track.slot.x + half, top: track.slot.y - 27, bottom: track.slot.y + 6 });
    }
    return placeSkyMoments(line, this.moments, top, bottom, avoid);
  }

  /** The star's stage at an age, its size capped so a supergiant never crowds out a small screen. */
  private stageAt(age: number): StarStage {
    const stage = stageAt(age);
    const cap = (Math.min(this.width, this.height) * 0.065) / (selfStarRadius(this.width, this.height) * 1.15);
    return stage.scale > cap ? { ...stage, scale: cap } : stage;
  }

  private drawBodies(frames: readonly BodyFrame[], seconds: number) {
    for (const frame of frames) {
      drawTrail(this.ctx, frame);
      if (frame.memorial) {
        // Someone reaching their place among the stars bursts as a nova, then keeps its nebula.
        const { person } = frame;
        drawNova(this.ctx, frame.x, frame.y, rgbOf(person.color), novaProgress(person, this.age), remnantAt(person, this.age), seconds);
      }
      drawBody(this.ctx, frame, seconds);
    }
  }
}
