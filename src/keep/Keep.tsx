import { useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../i18n';
import type { Moment, Person, Profile } from '../model';
import type { SceneRenderer } from '../scene/SceneRenderer';
import { shareLink } from '../shareLink';
import { readSkyFile, toSkyFile } from '../skyFile';
import { canRecord, deliver, JourneyRecorder, slug, snapshot, type Caption, type Layers } from './capture';

/** Settled sky kept at the end of a recording before it stops on its own. */
const ENDING_HOLD_MS = 3500;
/** How long the closing card plays at the end of every recording. */
const CARD_MS = 4500;
const NOTICE_MS = 3500;

interface KeepProps {
  profile: Profile;
  skyRef: RefObject<HTMLCanvasElement | null>;
  sceneRef: RefObject<HTMLCanvasElement | null>;
  rendererRef: RefObject<SceneRenderer | null>;
  /** Your own sky's people and moments, which can be passed on as a link or a file; unset for anyone else's. */
  own?: { people: readonly Person[]; moments: readonly Moment[] };
}

/** The home page in this language, where a shared link opens. */
const home = () => `${window.location.origin}${t.lang === 'bn' ? '/bn/' : '/'}`;

/**
 * Keep the sky: record the journey as a video, or save the present moment as an image; and for
 * your own sky, pass it on as a link or keep it as a file.
 */
export function Keep({ profile, skyRef, sceneRef, rendererRef, own }: KeepProps) {
  const [open, setOpen] = useState(false);
  /** The menu's second page: what a link shares, before one is made. */
  const [sharing, setSharing] = useState(false);
  const [includeWords, setIncludeWords] = useState(true);
  /**
   * The link, made as soon as the share page opens: a phone shares or copies only straight
   * after a tap, so nothing slow may come between the tap and the hand-off.
   */
  const [link, setLink] = useState<string | null>(null);
  /** Set when the clipboard refused the link, which is then shown to copy by hand. */
  const [refused, setRefused] = useState(false);
  const [recording, setRecording] = useState<{ startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const recorderRef = useRef<JourneyRecorder | null>(null);
  /** When the closing card began, or 0 before it. */
  const cardStartRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const recordable = canRecord() && !reducedMotion;

  const layers = (): Layers | null =>
    skyRef.current && sceneRef.current ? { sky: skyRef.current, scene: sceneRef.current } : null;
  const caption = (): Caption => ({
    name: profile.name,
    age: Math.min(profile.age, Math.floor(rendererRef.current?.currentAge ?? profile.age)),
    moment: rendererRef.current?.momentCaption ?? undefined,
    card: cardStartRef.current ? Math.min(1, (Date.now() - cardStartRef.current) / CARD_MS) : undefined,
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
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
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
      } else if (!cardStartRef.current && Date.now() - settledSince >= ENDING_HOLD_MS) {
        cardStartRef.current = Date.now();
      }
      if (cardStartRef.current && Date.now() - cardStartRef.current >= CARD_MS) void finishRecording();
    }, 250);
    return () => clearInterval(timer);
    // finishRecording only reads refs, so the interval need not restart when it changes.
  }, [recording, rendererRef]);

  // Leaving the scene mid-recording drops the recording rather than leaving it running.
  useEffect(() => () => recorderRef.current?.discard(), []);

  // Stopping early still ends the video on its closing card; stopping during the card ends it now.
  const stop = () => {
    if (cardStartRef.current) void finishRecording();
    else cardStartRef.current = Date.now();
  };

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
    cardStartRef.current = 0;
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

  const closeMenu = () => {
    setOpen(false);
    setSharing(false);
    setRefused(false);
  };

  /** The sky as it would leave this browser, checked as a recipient would check it. */
  const skyToShare = (keepWords: boolean) => {
    if (!own) return null;
    const file = toSkyFile({ profile, people: own.people, moments: own.moments }, keepWords);
    return 'sky' in readSkyFile(JSON.stringify(file)) ? file : null;
  };

  useEffect(() => {
    if (!sharing) return;
    let current = true;
    setLink(null);
    setRefused(false);
    const file = skyToShare(includeWords);
    // Without a sky that would open on the other side, or the browser's own compression, there is no link.
    if (!file || typeof CompressionStream === 'undefined') {
      closeMenu();
      tell(t.cannotShare);
      return;
    }
    shareLink(file, home()).then(
      (made) => current && setLink(made),
      () => {
        if (!current) return;
        closeMenu();
        tell(t.cannotShare);
      },
    );
    return () => {
      current = false;
    };
    // The sky can't change while its menu is open; only the page and the choice of words matter.
  }, [sharing, includeWords]);

  const sendLink = async () => {
    if (!link) return;
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
      try {
        await navigator.share({ url: link, title: 'Family Space' });
        closeMenu();
        tell(t.linkSent);
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return;
        // The share sheet failed for another reason; fall back to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      closeMenu();
      tell(t.linkCopied);
    } catch {
      setRefused(true);
    }
  };

  const saveSkyFile = async () => {
    const file = skyToShare(true);
    closeMenu();
    if (!file) {
      tell(t.cannotShare);
      return;
    }
    const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: 'application/json' });
    const result = await deliver(blob, `family-space-${slug(profile.name)}.json`);
    if (result !== 'cancelled') tell(result === 'shared' ? t.imageReady : t.skyFileSaved);
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
          <button type="button" className="recording-stop" onClick={stop}>
            {t.stop}
          </button>
        </div>
      ) : (
        <button type="button" className="scene-action" aria-expanded={open} onClick={() => (open ? closeMenu() : setOpen(true))}>
          {t.keep}
        </button>
      )}

      {open && sharing && (
        <div className="keep-menu keep-share" role="dialog" aria-labelledby="keep-share-title">
          <p className="keep-option-title" id="keep-share-title">
            {t.shareLink}
          </p>
          <p className="keep-share-warning">{t.shareWarning}</p>
          <label className="keep-share-words">
            <input type="checkbox" checked={includeWords} onChange={(event) => setIncludeWords(event.target.checked)} />
            {t.includeWords}
          </label>
          {refused && link ? (
            <label className="keep-share-link">
              <span>{t.copyThisLink}</span>
              <input readOnly value={link} autoFocus onFocus={(event) => event.target.select()} />
            </label>
          ) : (
            <button type="button" className="keep-share-send" disabled={!link} onClick={() => void sendLink()}>
              {window.matchMedia('(pointer: coarse)').matches && 'share' in navigator ? t.sendLink : t.copyLink}
            </button>
          )}
        </div>
      )}

      {open && !sharing && (
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
          {own && (
            <>
              <button type="button" role="menuitem" className="keep-option" onClick={() => setSharing(true)}>
                <span className="keep-option-title">{t.shareLink}</span>
                <span className="keep-option-note">{t.shareLinkNote}</span>
              </button>
              <button type="button" role="menuitem" className="keep-option" onClick={() => void saveSkyFile()}>
                <span className="keep-option-title">{t.saveSkyFile}</span>
                <span className="keep-option-note">{t.saveSkyFileNote}</span>
              </button>
            </>
          )}
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
