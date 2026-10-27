import { gaussian, mulberry32, type Rand } from './random';

export type RGB = readonly [number, number, number];

/** Rough blackbody tints from hot blue to cool orange, weighted by how often the eye sees each. */
export const STAR_TINTS: readonly { color: RGB; weight: number }[] = [
  { color: [157, 180, 255], weight: 0.07 },
  { color: [196, 212, 255], weight: 0.18 },
  { color: [240, 242, 255], weight: 0.32 },
  { color: [255, 244, 232], weight: 0.22 },
  { color: [255, 222, 180], weight: 0.14 },
  { color: [255, 196, 140], weight: 0.07 },
];

/**
 * The background sky stays quiet so people and memorial stars stand out against it.
 * Scales every star's opacity; radius is capped separately below.
 */
const SKY_BRIGHTNESS = 0.55;

export interface Twinkle {
  amp: number;
  slow: number;
  fast: number;
  slowPhase: number;
  fastPhase: number;
}

export interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  tint: number;
  fill: string;
  twinkle: Twinkle | null;
  /** Field stars drift with parallax; Milky Way stars sit fixed with the far-off haze. */
  field: boolean;
}

/** The Milky Way: a soft diagonal band across the sky. */
export interface Band {
  cx: number;
  cy: number;
  angle: number;
  width: number;
}

export function milkyWayBand(width: number, height: number): Band {
  return {
    cx: width * 0.52,
    cy: height * 0.4,
    angle: -Math.atan2(height, width) * 0.85,
    width: Math.hypot(width, height) * 0.09,
  };
}

export function generateStars(width: number, height: number, band: Band, seed: number): Star[] {
  const rand = mulberry32(seed);
  const area = width * height;
  const stars: Star[] = [];

  for (let i = 0, n = Math.round(area / 420); i < n; i++) {
    stars.push({ ...makeStar(rand, rand() * width, rand() * height, 12), field: true });
  }

  // The galactic plane is crowded with faint stars that read as texture rather than points.
  const ux = Math.cos(band.angle);
  const uy = Math.sin(band.angle);
  const reach = Math.hypot(width, height) / 2;
  for (let i = 0, n = Math.round(area / 260); i < n; i++) {
    const along = (rand() * 2 - 1) * reach;
    const across = gaussian(rand) * band.width * 0.4;
    const x = band.cx + ux * along - uy * across;
    const y = band.cy + uy * along + ux * across;
    if (x < 0 || y < 0 || x > width || y > height) continue;
    stars.push({ ...makeStar(rand, x, y, 18, 0.22), field: false });
  }

  return stars;
}

/**
 * `skew` shapes the brightness power law: higher means more faint stars and fewer bright ones.
 * `ceiling` caps the brightest a star can be.
 */
function makeStar(rand: Rand, x: number, y: number, skew: number, ceiling = 1): Omit<Star, 'field'> {
  const brightness = rand() ** skew * ceiling;
  const tint = pickTint(rand());
  // Faint stars look colorless to the eye; only bright ones show their tint.
  const saturation = 0.2 + 0.8 * Math.min(1, brightness * 2.5);
  const [r, g, b] = STAR_TINTS[tint].color.map((c) => Math.round(c + (255 - c) * (1 - saturation)));
  const twinkles = brightness > 0.2 || rand() < 0.06;

  return {
    x,
    y,
    radius: 0.36 + 0.9 * brightness,
    alpha: SKY_BRIGHTNESS * (0.2 + 0.8 * brightness ** 0.4 * (0.75 + 0.25 * rand())),
    tint,
    fill: `rgb(${r}, ${g}, ${b})`,
    twinkle: twinkles
      ? {
          amp: 0.15 + 0.3 * rand(),
          slow: 0.6 + 1.4 * rand(),
          fast: 2.5 + 3.5 * rand(),
          slowPhase: rand() * Math.PI * 2,
          fastPhase: rand() * Math.PI * 2,
        }
      : null,
  };
}

function pickTint(roll: number): number {
  for (let i = 0; i < STAR_TINTS.length; i++) {
    roll -= STAR_TINTS[i].weight;
    if (roll <= 0) return i;
  }
  return STAR_TINTS.length - 1;
}

/** Atmospheric scintillation as a 0–1 dimming factor: two detuned waves so it never looks periodic. */
export function scintillation(twinkle: Twinkle, seconds: number): number {
  const wave =
    0.6 * Math.sin(seconds * twinkle.slow + twinkle.slowPhase) +
    0.4 * Math.sin(seconds * twinkle.fast + twinkle.fastPhase);
  return 0.5 + 0.5 * wave;
}
