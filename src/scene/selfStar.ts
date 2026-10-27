import { mulberry32 } from '../sky/random';
import { rgbText, stageAt, towardWhite, type RGB, type StarStage } from './stellar';

export interface Ignition {
  /** Core size, 0 → 1 with a slight overshoot. */
  grow: number;
  /** Brief burst of extra light as the star catches. */
  flash: number;
  /** Progress of the shockwave ring, 0 → 1; gone at 1. */
  ring: number;
}

/** A star that has finished igniting. */
export const SETTLED: Ignition = { grow: 1, flash: 0, ring: 1 };

/** Lets the previous screen's exit finish before the star appears. */
const IGNITE_DELAY_S = 0.35;

export function ignition(elapsed: number): Ignition {
  const t = elapsed - IGNITE_DELAY_S;
  if (t <= 0) return { grow: 0, flash: 0, ring: 0 };
  return {
    grow: easeOutBack(clamp01(t / 1.3)),
    flash: Math.exp(-(((t - 0.5) / 0.32) ** 2)),
    ring: clamp01((t - 0.3) / 1.9),
  };
}

/** A star in its prime, for drawing before a life is known (and as the default). */
const PRIME: StarStage = stageAt(40);
/** Slight tilt so the diffraction beams don't read as a plus sign. */
const SPIKE_TILT = 0.12;
const BREATH_PERIOD_S = 6;

/**
 * Paints your star the way bright starlight reaches the eye: a wide halo and bloom, a shimmering
 * corona of hair-fine rays, two soft diffraction beams, and the star's disc itself. Its colour
 * and size follow its stage of life, from a hot young star to a mottled red giant.
 */
export function drawSelfStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seconds: number,
  ig: Ignition,
  stage: StarStage = PRIME,
) {
  if (ig.grow <= 0) return;
  const breath = Math.sin((seconds * Math.PI * 2) / BREATH_PERIOD_S);
  const { giant, supergiant } = stage;
  // A supergiant pulses slowly and unevenly in size and light, as Betelgeuse does.
  const pulse = supergiant * (0.6 * Math.sin(seconds * 0.21) + 0.4 * Math.sin(seconds * 0.083 + 1.9));
  const size = radius * stage.scale * ig.grow * (1 + 0.035 * breath + 0.06 * pulse);
  const glow = (Math.min(1, ig.grow) * (0.92 + 0.08 * breath) + ig.flash * 0.9) * (1 + 0.12 * pulse);
  const tint = rgbText(stage.glow);
  // The halo and glare widen only gently with the star, so a giant fills the sky without
  // swallowing the people around it.
  const reach = radius * (1 + 0.35 * (stage.scale - 1));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  glowDisc(ctx, x, y, reach * 24 * (1 + ig.flash * 0.35), [
    [0, `rgba(${tint}, ${0.13 * glow})`],
    [0.2, `rgba(${tint}, ${0.05 * glow})`],
    [0.55, `rgba(${tint}, ${0.012 * glow})`],
    [1, `rgba(${tint}, 0)`],
  ]);
  if (supergiant > 0.01) drawEnvelope(ctx, x, y, size, seconds, stage);

  // Bloom: a gaussian falloff, so it has no visible edge however large the star grows.
  gaussianDisc(ctx, x, y, size * (5.5 + 1.5 * giant), rgbText(towardWhite(stage.glow, 0.5 - 0.3 * giant)), (0.6 - 0.25 * giant) * glow);

  drawGlare(ctx, x, y, reach * (10 + 2 * ig.flash), seconds, glow * (0.75 - 0.35 * giant), stage);

  // Diffraction: one long soft beam on each axis, and fainter ones between them.
  const beam = reach * (13 + 5 * ig.flash) * (0.96 + 0.08 * Math.sin(seconds * 1.3));
  const beamAlpha = (0.5 - 0.3 * giant) * glow;
  drawSpikes(ctx, x, y, beam, size * 0.32, SPIKE_TILT, beamAlpha, tint);
  drawSpikes(ctx, x, y, beam * 0.42, size * 0.22, SPIKE_TILT + Math.PI / 4, beamAlpha * 0.35, tint);

  // A faint ring of light just outside the disc, as a lens adds to a bright point; a giant's
  // light is too spread out to make one.
  const ringAlpha = 0.07 * glow * (1 - giant);
  if (ringAlpha > 0.005) {
    const ring = ctx.createRadialGradient(x, y, size * 2.1, x, y, size * 2.9);
    ring.addColorStop(0, `rgba(${tint}, 0)`);
    ring.addColorStop(0.5, `rgba(${tint}, ${ringAlpha})`);
    ring.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = ring;
    ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
  }

  drawDisc(ctx, x, y, size * 1.15, seconds, stage);

  if (ig.ring > 0 && ig.ring < 1) drawShockwave(ctx, x, y, radius, ig.ring, tint);
  ctx.restore();
}

/**
 * A supergiant's vast envelope: gas and dust thrown off over its life, a faint uneven red haze
 * several times its size, with lopsided plumes that drift slowly around it.
 */
function drawEnvelope(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seconds: number, stage: StarStage) {
  const red = rgbText(stage.glow);
  const strength = stage.supergiant;
  gaussianDisc(ctx, x, y, size * 9, red, 0.13 * strength);
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.26 + seconds * (0.012 + 0.004 * i) + Math.sin(seconds * 0.05 + i) * 0.3;
    const distance = size * (1.6 + 0.5 * Math.sin(seconds * 0.07 + i * 2.1));
    gaussianDisc(ctx, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, size * (2.6 + 0.6 * (i % 2)), red, 0.07 * strength);
  }
}

/**
 * The star's disc: white-hot through and through while young; as a giant, a cooler glowing face
 * that darkens toward its edge, with great convection cells slowly churning across it.
 */
function drawDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seconds: number, stage: StarStage) {
  const { giant } = stage;
  // A giant's face is cooler than its glow suggests: deep gold at the centre, ember at the rim.
  const core = rgbText(towardWhite(giant > 0 ? mix(stage.light, stage.glow, giant) : stage.light, 1 - 0.72 * giant));
  const body = rgbText(towardWhite(mix(stage.light, stage.glow, giant), 0.5 - 0.45 * giant));
  // Limb darkening: bright at the centre, easing smoothly to a dimmer rim.
  glowDisc(ctx, x, y, r, [
    [0, `rgba(${core}, 1)`],
    [0.3 - 0.1 * giant, `rgba(${core}, 0.97)`],
    [0.55, `rgba(${body}, ${0.92 - 0.1 * giant})`],
    [0.78, `rgba(${body}, ${0.6 - 0.1 * giant})`],
    [1, `rgba(${body}, 0)`],
  ]);
  if (giant <= 0.02) return;
  const cell = rgbText(towardWhite(stage.light, 0.35));
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4 + seconds * (0.025 + 0.01 * (i % 3));
    const distance = r * 0.42 * (0.35 + 0.65 * ((i * 0.37) % 1));
    const pulse = 0.6 + 0.4 * Math.sin(seconds * 0.4 + i * 1.7);
    glowDisc(ctx, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, r * 0.38, [
      [0, `rgba(${cell}, ${0.32 * giant * pulse})`],
      [1, `rgba(${cell}, 0)`],
    ]);
  }
}

const GLARE_PX = 384;
const GLARE_RAYS = 900;
/** White glare textures, made once: two, so they can shimmer against each other. */
let glareTextures: HTMLCanvasElement[] | null = null;
/** Recently used tinted copies; a star's colour changes slowly, so a few are plenty. */
const tintedGlare = new Map<string, HTMLCanvasElement>();
const TINT_CACHE = 6;

/** Hundreds of hair-fine radial streaks of uneven length, like eyelashes catching the light. */
function makeGlare(seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GLARE_PX;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);
  const c = GLARE_PX / 2;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < GLARE_RAYS; i++) {
    const angle = rand() * Math.PI * 2;
    // Mostly short rays, with a few long ones reaching far out.
    const length = c * (0.12 + 0.88 * rand() ** 2.6);
    const start = c * 0.04;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const gradient = ctx.createLinearGradient(c + cos * start, c + sin * start, c + cos * length, c + sin * length);
    const strength = 0.05 + 0.2 * rand() ** 2;
    gradient.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
    gradient.addColorStop(0.35, `rgba(255, 255, 255, ${strength * 0.35})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.5 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(c + cos * start, c + sin * start);
    ctx.lineTo(c + cos * length, c + sin * length);
    ctx.stroke();
  }
  return canvas;
}

function glareIn(index: number, stage: StarStage): HTMLCanvasElement {
  glareTextures ??= [makeGlare(7), makeGlare(19)];
  // Rays are lit by the star but paler than its glow, as fine light reads nearly white.
  const [r, g, b] = towardWhite(stage.glow, 0.45).map((v) => Math.round(v / 12) * 12);
  const key = `${index}|${r},${g},${b}`;
  let tinted = tintedGlare.get(key);
  if (!tinted) {
    tinted = document.createElement('canvas');
    tinted.width = tinted.height = GLARE_PX;
    const ctx = tinted.getContext('2d')!;
    ctx.drawImage(glareTextures[index], 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, GLARE_PX, GLARE_PX);
    tintedGlare.set(key, tinted);
    if (tintedGlare.size > TINT_CACHE) tintedGlare.delete(tintedGlare.keys().next().value!);
  }
  return tinted;
}

/** Two coronas turning slowly in opposite directions and fading against each other, so it shimmers. */
function drawGlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seconds: number,
  alpha: number,
  stage: StarStage,
) {
  if (alpha <= 0.01 || radius <= 0) return;
  const swap = 0.5 + 0.5 * Math.sin(seconds * 0.55);
  for (const [index, turn, weight] of [
    [0, seconds * 0.012, 0.45 + 0.55 * swap],
    [1, -seconds * 0.009 + 1.3, 1 - 0.55 * swap],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.globalAlpha = alpha * weight;
    ctx.drawImage(glareIn(index, stage), -radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }
}

/**
 * Light spikes, as a telescope's vanes spread a bright star: soft beams that fade away from a
 * crisp centre along their length and across their width. Each beam runs both ways, so two make
 * the four spikes.
 */
export function drawSpikes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  alpha: number,
  rgb = '255, 220, 170',
) {
  if (alpha <= 0.005 || length <= 0) return;
  const halfWidth = Math.max(0.6, width * 2.4);
  for (const turn of [angle, angle + Math.PI / 2]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.scale(length, halfWidth);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(255, 250, 240, ${alpha})`);
    gradient.addColorStop(0.04, `rgba(${rgb}, ${alpha * 0.55})`);
    gradient.addColorStop(0.16, `rgba(${rgb}, ${alpha * 0.2})`);
    gradient.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.05})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
}

/** A soft wavefront of light rolling outward from the newly lit star. */
function drawShockwave(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, progress: number, tint: string) {
  const eased = 1 - (1 - progress) ** 3;
  const reach = radius * (3 + 40 * eased);
  const thickness = reach * (0.35 - 0.2 * eased);
  const fade = (1 - progress) ** 2;
  const front = ctx.createRadialGradient(x, y, Math.max(0, reach - thickness), x, y, reach);
  front.addColorStop(0, `rgba(${tint}, 0)`);
  front.addColorStop(0.75, `rgba(${tint}, ${0.16 * fade})`);
  front.addColorStop(1, `rgba(${tint}, 0)`);
  ctx.fillStyle = front;
  ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
}

/** A soft disc whose brightness falls off like a gaussian, with no visible edge. */
function gaussianDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number) {
  glowDisc(
    ctx,
    x,
    y,
    radius,
    [0, 0.1, 0.2, 0.32, 0.45, 0.6, 0.78, 1].map((o) => [o, `rgba(${rgb}, ${alpha * Math.exp(-7 * o * o) * (1 - o)})`] as [number, string]),
  );
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as unknown as RGB;
}

export function glowDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly [number, string][],
) {
  if (radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeOutBack(t: number): number {
  const overshoot = 1.6;
  const u = t - 1;
  return 1 + (overshoot + 1) * u ** 3 + overshoot * u ** 2;
}
