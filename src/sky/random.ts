export type Rand = () => number;

/** Small seeded PRNG so the same seed always paints the same sky. */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: Rand): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type Noise2D = (x: number, y: number) => number;

/** Smooth value noise in [0, 1]. */
export function createNoise2D(seed: number): Noise2D {
  const rand = mulberry32(seed);
  const values = new Float32Array(256);
  const order = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0; i < 256; i++) values[i] = rand();
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = order[i & 255];

  const fade = (t: number) => t * t * (3 - 2 * t);

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const X = xi & 255;
    const Y = yi & 255;
    const a = values[perm[X + perm[Y]]];
    const b = values[perm[X + 1 + perm[Y]]];
    const c = values[perm[X + perm[Y + 1]]];
    const d = values[perm[X + 1 + perm[Y + 1]]];
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;
    return top + (bottom - top) * v;
  };
}

/** Fractal noise in [0, 1]: layered octaves give cloud-like detail. */
export function fbm(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}
