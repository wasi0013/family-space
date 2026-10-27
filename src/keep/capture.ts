/** Exports are capped at 1080p so videos encode smoothly and stay a sensible size. */
const MAX_EXPORT_WIDTH = 1920;
const MAX_EXPORT_HEIGHT = 1080;
const VIDEO_FPS = 30;
const VIDEO_BITRATE = 8_000_000;
/** Preferred first: MP4 plays everywhere; Chrome and Firefox record WebM instead. */
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

const FONT_UI = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';
const FONT_DISPLAY = '"Cormorant Garamond", Georgia, serif';

export interface Layers {
  sky: HTMLCanvasElement;
  scene: HTMLCanvasElement;
}

/** The words written into an export, mirroring the age readout on screen. */
export interface Caption {
  name: string;
  age: number;
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
  drawCaption(ctx, caption, k);
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
  ctx.fillText(String(caption.age), width / 2, ageBaseline);

  ctx.shadowBlur = 0;
  ctx.font = `500 ${10 * k}px ${FONT_UI}`;
  ctx.letterSpacing = `${3.2 * k}px`;
  ctx.fillStyle = 'rgba(220, 228, 255, 0.5)';
  ctx.fillText(`${caption.name} · age`.toUpperCase(), width / 2, ageBaseline - 52 * k);

  ctx.textAlign = 'left';
  ctx.font = `500 ${11 * k}px ${FONT_UI}`;
  ctx.letterSpacing = `${3.7 * k}px`;
  ctx.fillStyle = 'rgba(220, 228, 255, 0.42)';
  ctx.fillText('FAMILY SPACE', 16 * k, height - 18 * k);
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

/** "Alex Rivera" → "alex-rivera", for friendly file names. */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'my-sky';
}
