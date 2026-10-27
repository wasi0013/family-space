/**
 * What the life scene asks of the sky behind it, read by the sky renderer every frame:
 * - `y`: how far the field stars have drifted down, in CSS pixels, as the system travels forward;
 * - `dim`: how much darker the whole sky is, 0 → 1, as in a hard time;
 * - `angle`: how far the sky has turned around your star, in radians, after moving home;
 * - `pivotY`: where your star sits, as a fraction of the screen height, for the sky to turn around;
 * - `redraw`: set by the sky while it holds still (reduced motion), so the scene can repaint it.
 */
export const skyScroll = { y: 0, dim: 0, angle: 0, pivotY: 0.5, redraw: null as (() => void) | null };
