import { t } from '../i18n';

/** Exports are capped at 1080p so videos encode smoothly and stay a sensible size. */
const MAX_EXPORT_WIDTH = 1920;
const MAX_EXPORT_HEIGHT = 1080;
const VIDEO_FPS = 30;
/** The address in the corner of every export, so a shared video leads back to the book's home. */
export const EXPORT_ADDRESS = 'raisingthegiftedmind.com';

/** The address on the closing card, where viewers can make their own sky, in their language. */
export function appAddress(lang: string): string {
  return lang === 'bn' ? 'familyspace.raisingthegiftedmind.com/bn' : 'familyspace.raisingthegiftedmind.com';
}
const VIDEO_BITRATE = 8_000_000;
/** Preferred first: MP4 plays everywhere; Chrome and Firefox record WebM instead. */
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

// Bengali fonts follow the Latin ones, so Bengali names and words render properly too.
const FONT_UI = '"Inter Variable", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif';
const FONT_DISPLAY = '"Cormorant Garamond", "Noto Serif Bengali", Georgia, serif';
/** Wide tracking breaks Bengali conjuncts apart, so it only applies to Latin text. */
const tracking = (px: number) => (t.lang === 'bn' ? '0px' : `${px}px`);

export interface Layers {
  sky: HTMLCanvasElement;
  scene: HTMLCanvasElement;
}

/** The words written into an export, mirroring the age readout on screen. */
export interface Caption {
  name: string;
  age: number;
  /** The moment playing now, named above the age as on screen. */
  moment?: string;
  /** Progress through the closing card at the end of a recording, 0 → 1; absent before it. */
  card?: number;
}

function videoType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function canRecord(): boolean {
  return videoType() !== null && 'captureStream' in HTMLCanvasElement.prototype;
}

/** Sizes `target` to the export resolution for these layers and returns its scale from CSS px. */
function fit(target: HTMLCanvasElement, layers: Layers): number {
  const { sky } = layers;
  const scale = Math.min(1, MAX_EXPORT_WIDTH / sky.width, MAX_EXPORT_HEIGHT / sky.height);
  // Video encoders want even dimensions.
  target.width = Math.round((sky.width * scale) / 2) * 2;
  target.height = Math.round((sky.height * scale) / 2) * 2;
  return target.width / sky.clientWidth;
}

/** Paints one frame: the sky, the scene's light added over it, then the caption. */
function compose(ctx: CanvasRenderingContext2D, layers: Layers, caption: Caption, k: number) {
  const { width, height } = ctx.canvas;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(layers.sky, 0, 0, width, height);
  // The scene canvas is screen-blended over the sky on the page; match that here.
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(layers.scene, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  const card = caption.card ?? 0;
  // The age and the corner marks give way to the closing card, which carries the address itself.
  ctx.globalAlpha = 1 - ease(card / 0.2);
  drawCaption(ctx, caption, k);
  ctx.globalAlpha = 1;
  if (card > 0) drawClosingCard(ctx, card, Math.max(k, ctx.canvas.width / 1100));
}

/** Seconds-free easing in [0, 1] for the card's fades. */
function ease(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

/**
 * The card that closes a recorded journey: the sky dims, and an invitation to make your own sky
 * rises into the middle with the address, beneath a small star in the gold of your own.
 */
function drawClosingCard(ctx: CanvasRenderingContext2D, progress: number, m: number) {
  const { width, height } = ctx.canvas;
  const veil = ease(progress / 0.2);
  const invite = ease((progress - 0.12) / 0.22);
  const rise = (1 - invite) * 12 * m;
  ctx.save();
  ctx.fillStyle = `rgba(3, 4, 11, ${0.78 * veil})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = invite;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const middle = height * 0.5 + rise;
  const star = middle - 58 * m;
  const glow = ctx.createRadialGradient(width / 2, star, 0, width / 2, star, 22 * m);
  glow.addColorStop(0, 'rgba(255, 240, 210, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 207, 138, 0.4)');
  glow.addColorStop(1, 'rgba(255, 207, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(width / 2 - 22 * m, star - 22 * m, 44 * m, 44 * m);

  // Bengali has no capitals and its conjuncts need normal spacing.
  const bengali = t.lang === 'bn';
  ctx.font = `500 ${(bengali ? 17 : 14) * m}px ${FONT_UI}`;
  ctx.letterSpacing = tracking(3.6 * m);
  ctx.fillStyle = 'rgba(220, 228, 255, 0.7)';
  ctx.fillText(bengali ? t.makeYourOwnSky : t.makeYourOwnSky.toUpperCase(), width / 2, middle);

  ctx.letterSpacing = '0px';
  ctx.font = `italic 300 ${30 * m}px ${FONT_DISPLAY}`;
  ctx.fillStyle = 'rgba(255, 226, 186, 0.96)';
  ctx.shadowColor = 'rgba(255, 207, 138, 0.35)';
  ctx.shadowBlur = 20 * m;
  const addressBaseline = middle + 50 * m;
  const address = appAddress(t.lang);
  const addressWidth = ctx.measureText(address).width;
  const book = 28 * m;
  const gap = 12 * m;
  const start = width / 2 - (addressWidth + book + gap) / 2;
  ctx.textAlign = 'left';
  ctx.fillText(address, start + book + gap, addressBaseline);
  ctx.shadowBlur = 0;
  drawBook(ctx, start, addressBaseline - 23 * m, book, 'rgba(255, 226, 186, 0.96)');
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: Caption, k: number) {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(255, 200, 140, 0.35)';
  ctx.shadowBlur = 24 * k;

  const ageBaseline = height - 60 * k;
  ctx.font = `300 ${56 * k}px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#fff6e8';
  ctx.fillText(t.num(caption.age), width / 2, ageBaseline);

  ctx.shadowBlur = 0;
  ctx.font = `500 ${10 * k}px ${FONT_UI}`;
  ctx.letterSpacing = tracking(3.2 * k);
  ctx.fillStyle = 'rgba(220, 228, 255, 0.5)';
  ctx.fillText(t.ageCaption(caption.name).toUpperCase(), width / 2, ageBaseline - 52 * k);

  if (caption.moment) {
    ctx.letterSpacing = '0px';
    ctx.font = `${t.lang === 'bn' ? '' : 'italic '}300 ${21 * k}px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(255, 246, 232, 0.94)';
    ctx.shadowColor = 'rgba(255, 207, 138, 0.35)';
    ctx.shadowBlur = 18 * k;
    ctx.fillText(caption.moment, width / 2, ageBaseline - 74 * k);
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = 'left';
  // The marks along the bottom are sized to the export itself, not the screen: a shared video is
  // usually watched shrunk to a phone's width, where screen-sized text would be unreadable.
  const m = Math.max(k, width / 1100);
  const margin = 22 * m;
  ctx.font = `500 ${12 * m}px ${FONT_UI}`;
  // The brand is Latin in every language, so it keeps its tracking.
  ctx.letterSpacing = `${3.4 * m}px`;
  ctx.fillStyle = 'rgba(220, 228, 255, 0.5)';
  ctx.fillText('FAMILY SPACE', margin, height - margin);

  // Opposite the brand, the address beside a small open book, as in the page's footer.
  const address = EXPORT_ADDRESS;
  ctx.textAlign = 'right';
  ctx.letterSpacing = '0px';
  ctx.font = `italic 300 ${17 * m}px ${FONT_DISPLAY}`;
  ctx.fillStyle = 'rgba(240, 230, 210, 0.78)';
  const right = width - margin;
  const baseline = height - margin + 1 * m;
  ctx.fillText(address, right, baseline);
  drawBook(ctx, right - ctx.measureText(address).width - 9 * m - 17 * m, baseline - 14 * m, 17 * m);
  ctx.restore();
}

/** The footer's open book, drawn at `size` with its top-left at (x, y). */
function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color = 'rgba(240, 230, 210, 0.78)') {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12 6.5C10.2 5.2 7.6 4.6 4 4.8v12.6c3.6-.2 6.2.4 8 1.7 1.8-1.3 4.4-1.9 8-1.7V4.8c-3.6-.2-6.2.4-8 1.7Zm0 0v12.6'));
  ctx.restore();
}

export function snapshot(layers: Layers, caption: Caption): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const k = fit(canvas, layers);
  compose(canvas.getContext('2d')!, layers, caption, k);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), 'image/png'),
  );
}

/**
 * Records the page's sky and scene into a video, composing a fresh frame on every animation
 * frame until stopped.
 */
export class JourneyRecorder {
  private readonly canvas = document.createElement('canvas');
  private readonly chunks: Blob[] = [];
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private frameId = 0;

  constructor(
    private readonly layers: Layers,
    private readonly caption: () => Caption,
  ) {}

  /** File extension matching what the browser actually records. */
  readonly extension = videoType()?.startsWith('video/mp4') ? 'mp4' : 'webm';

  start() {
    const type = videoType();
    if (!type) throw new Error('This browser cannot record video');
    const k = fit(this.canvas, this.layers);
    const ctx = this.canvas.getContext('2d')!;
    const paint = () => {
      compose(ctx, this.layers, this.caption(), k);
      this.frameId = requestAnimationFrame(paint);
    };
    paint();

    this.stream = this.canvas.captureStream(VIDEO_FPS);
    this.recorder = new MediaRecorder(this.stream, { mimeType: type, videoBitsPerSecond: VIDEO_BITRATE });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(1000);
  }

  stop(): Promise<Blob> {
    cancelAnimationFrame(this.frameId);
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(new Blob(this.chunks));
    return new Promise((resolve) => {
      recorder.onstop = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        resolve(new Blob(this.chunks, { type: recorder.mimeType }));
      };
      recorder.stop();
    });
  }

  /** Stops without keeping anything, as when leaving the scene mid-recording. */
  discard() {
    cancelAnimationFrame(this.frameId);
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
  }
}

export type Delivery = 'shared' | 'downloaded' | 'cancelled';

/** Opens the share sheet on touch devices that can share files; otherwise downloads the file. */
export async function deliver(blob: Blob, filename: string): Promise<Delivery> {
  const file = new File([blob], filename, { type: blob.type });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Family Space' });
      return 'shared';
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return 'cancelled';
      // Sharing failed for another reason; fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** "Alex Rivera" → "alex-rivera", for friendly file names. Keeps every script's letters intact. */
export function slug(text: string): string {
  // Combining marks (\p{M}) are part of letters in many scripts, such as Bengali vowel signs.
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'my-sky';
}
