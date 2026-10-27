import { useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../i18n';
import type { Profile } from '../model';
import type { SceneRenderer } from '../scene/SceneRenderer';
import { canRecord, deliver, JourneyRecorder, slug, snapshot, type Caption, type Layers } from './capture';

/** Settled sky kept at the end of a recording before it stops on its own. */
const ENDING_HOLD_MS = 3500;
const NOTICE_MS = 3500;

interface KeepProps {
  profile: Profile;
  skyRef: RefObject<HTMLCanvasElement | null>;
  sceneRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<SceneRenderer | null>;
}

/** Keep the sky: record the journey as a video, or save the present moment as an image. */
export function Keep({ profile, skyRef, sceneRef, rendererRef }: KeepProps) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<{ startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const recorderRef = useRef<JourneyRecorder | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const recordable = canRecord() && !reducedMotion;

  const layers = (): Layers | null =>
    skyRef.current && sceneRef.current ? { sky: skyRef.current, scene: sceneRef.current } : null;
  const caption = (): Caption => ({
    name: profile.name,
    age: Math.min(profile.age, Math.floor(rendererRef.current?.currentAge ?? profile.age)),
    moment: rendererRef.current?.momentCaption ?? undefined,
  });

  const tell = (message: string) => setNotice(message);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Close the menu on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const finishRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setRecording(null);
    const video = await recorder.stop();
    const result = await deliver(video, `family-space-${slug(profile.name)}.${recorder.extension}`);
    if (result !== 'cancelled') tell(result === 'shared' ? t.journeyReady : t.journeySaved);
  };

  // While recording, tick the timer and stop on our own once the life has settled.
  useEffect(() => {
    if (!recording) return;
    let settledSince = 0;
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - recording.startedAt);
      if (!rendererRef.current?.finished) {
        settledSince = 0;
      } else if (!settledSince) {
        settledSince = Date.now();
      } else if (Date.now() - settledSince >= ENDING_HOLD_MS) {
        void finishRecording();
      }
    }, 250);
    return () => clearInterval(timer);
    // finishRecording only reads refs, so the interval need not restart when it changes.
  }, [recording, rendererRef]);

  // Leaving the scene mid-recording drops the recording rather than leaving it running.
  useEffect(() => () => recorderRef.current?.discard(), []);

  const record = () => {
    const sources = layers();
    const renderer = rendererRef.current;
    if (!sources || !renderer) return;
    setOpen(false);
    renderer.restart();
    const recorder = new JourneyRecorder(sources, caption);
    try {
      recorder.start();
    } catch {
      tell(t.cannotRecord);
      return;
    }
    recorderRef.current = recorder;
    setElapsed(0);
    setRecording({ startedAt: Date.now() });
  };

  const saveImage = async () => {
    const sources = layers();
    if (!sources) return;
    setOpen(false);
    const moment = caption();
    // Encoding a large image can take a moment; say so straight away.
    tell(t.savingImage);
    try {
      const image = await snapshot(sources, moment);
      const result = await deliver(image, `family-space-${slug(profile.name)}-age-${moment.age}.png`);
      if (result !== 'cancelled') tell(result === 'shared' ? t.imageReady : t.imageSaved);
    } catch (error) {
      console.error('Saving the image failed', error);
      tell(t.imageFailed);
    }
  };

  const seconds = Math.floor(elapsed / 1000);

  return (
    <div className="keep" ref={rootRef}>
      {recording ? (
        <div className="recording" role="status">
          <span className="recording-dot" aria-hidden="true" />
          <span>
            {t.recording}{' '}
            <span className="recording-time">{t.num(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)}</span>
          </span>
          <button type="button" className="recording-stop" onClick={() => void finishRecording()}>
            {t.stop}
          </button>
        </div>
      ) : (
        <button type="button" className="scene-action" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t.keep}
        </button>
      )}

      {open && (
        <div className="keep-menu" role="menu">
          {recordable && (
            <button type="button" role="menuitem" className="keep-option" onClick={record}>
              <span className="keep-option-title">{t.recordJourney}</span>
              <span className="keep-option-note">{t.recordJourneyNote}</span>
            </button>
          )}
          <button type="button" role="menuitem" className="keep-option" onClick={() => void saveImage()}>
            <span className="keep-option-title">{t.saveMoment}</span>
            <span className="keep-option-note">{t.saveMomentNote}</span>
          </button>
        </div>
      )}

      {notice && (
        <p className="keep-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
