/**
 * Your star ages with you, as a real star does: hot and blue-white when young, a sun-like yellow
 * through midlife, then after about 55 it cools to orange and slowly swells into a red giant.
 * Everything is worked out from the age being played.
 */

export type RGB = readonly [number, number, number];

export interface StarStage {
  /** Surface temperature in kelvin. */
  kelvin: number;
  /** The colour of the star's light. */
  light: RGB;
  /** The same hue, richer, for the glow around it. */
  glow: RGB;
  /** Size relative to a star in its prime. */
  scale: number;
  /** 0 → 1: how far it has become a red giant, with a softer, larger, mottled glow. */
  giant: number;
}

/** Temperature through a life: [age, kelvin]. */
const TEMPERATURE: [number, number][] = [
  [0, 11000],
  [12, 8000],
  [25, 6300],
  [40, 5600],
  [55, 5250],
  [65, 4500],
  [75, 3800],
  [88, 3300],
];

/** Size through a life: [age, scale]. */
const SIZE: [number, number][] = [
  [0, 0.72],
  [18, 0.9],
  [30, 1],
  [55, 1.06],
  [65, 1.35],
  [75, 1.85],
  [90, 2.35],
];

export function stageAt(age: number): StarStage {
  const kelvin = along(TEMPERATURE, age);
  const light = kelvinToRgb(kelvin);
  return {
    kelvin,
    light,
    glow: saturate(light, 1.9),
    scale: along(SIZE, age),
    giant: smooth(clamp01((5250 - kelvin) / 1700)),
  };
}

/** The colour of a blackbody at this temperature, after Tanner Helland's fit. */
export function kelvinToRgb(kelvin: number): RGB {
  const t = kelvin / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [byte(red), byte(green), byte(blue)];
}

/** Pushes a colour away from white, so a near-white starlight still reads as its hue. */
export function saturate([r, g, b]: RGB, amount: number): RGB {
  const top = Math.max(r, g, b);
  return [r, g, b].map((c) => byte(top - (top - c) * amount)) as unknown as RGB;
}

export function rgbText([r, g, b]: RGB): string {
  return `${r}, ${g}, ${b}`;
}

/** Mixes a colour toward white by `amount`, 0 → 1. */
export function towardWhite([r, g, b]: RGB, amount: number): RGB {
  return [r, g, b].map((c) => byte(c + (255 - c) * amount)) as unknown as RGB;
}

/** Smooth interpolation through keyframes, flat beyond either end. */
function along(keys: readonly [number, number][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i];
    const [x0, y0] = keys[i - 1];
    if (x <= x1) return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0));
  }
  return keys[keys.length - 1][1];
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function byte(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}
