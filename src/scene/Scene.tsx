import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { t } from '../i18n';
import { Keep } from '../keep/Keep';
import type { Moment, Person, Profile } from '../model';
import { EditMenu } from './EditMenu';
import { MemoryCard } from './MemoryCard';
import { SceneRenderer } from './SceneRenderer';

/** Moment stars and their cards share one warm starlight color. */
const MOMENT_COLOR = '#ffe2ba';
/** A press that moves less than this is a tap, which plays or pauses. */
const TAP_SLOP_PX = 8;

interface SceneProps {
  profile: Profile;
  people: readonly Person[];
  moments: readonly Moment[];
  initialAge?: number;
  /** The night sky behind the scene, composed into exported images and videos. */
  skyRef: RefObject<HTMLCanvasElement | null>;
  onEditPeople: () => void;
  onEditMoments: () => void;
  /** Saves one person's memory; an empty string removes it. */
  onRemember: (personId: string, memory: string) => void;
  /** Saves a moment's note; an empty string removes it. */
  onNote: (momentId: string, note: string) => void;
  /**
   * Set while watching a sky that isn't yours, the example or one shared with you: the way to
   * make it your own.
   */
  ownAction?: { label: string; onConfirm: () => void };
  /** Set when making it your own would replace a saved sky, so it asks first. */
  replacesSaved?: boolean;
  /** Set for a sky from a link or file, so its words are never taken for the app's own. */
  shared?: boolean;
}

/** The star whose card is open: a person, or a moment in the constellation. */
interface Remembering {
  id: string;
  kind: 'person' | 'moment';
  x: number;
  y: number;
}

/** Held longer than this, a skip button sweeps through the years instead of jumping. */
const HOLD_MS = 260;

/**
 * Either side of play: a click goes to the previous or next moment, and pressing and holding
 * sweeps back or forward through the years at double speed until let go.
 */
function SkipButton({ direction, rendererRef }: { direction: -1 | 1; rendererRef: RefObject<SceneRenderer | null> }) {
  const press = useRef<{ timer: number; holding: boolean } | null>(null);

  const release = (jump: boolean) => {
    const current = press.current;
    if (!current) return;
    press.current = null;
    clearTimeout(current.timer);
    if (current.holding) rendererRef.current?.scan(0);
    else if (jump) rendererRef.current?.skip(direction);
  };
  useEffect(() => () => release(false), []);

  const label = direction < 0 ? t.skipBack : t.skipForward;
  return (
    <button
      type="button"
      className="hud-skip"
      aria-label={label}
      title={label}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const timer = window.setTimeout(() => {
          if (!press.current) return;
          press.current.holding = true;
          rendererRef.current?.scan(direction);
        }, HOLD_MS);
        press.current = { timer, holding: false };
      }}
      onPointerUp={() => release(true)}
      onPointerCancel={() => release(false)}
      onLostPointerCapture={() => release(false)}
      // The pointer is handled above; a keyboard presses with a click alone, which jumps.
      onClick={(event) => {
        if (event.detail === 0) rendererRef.current?.skip(direction);
      }}
      // A long press on a phone must not open a menu.
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {direction < 0 ? <path d="M13.5 3.6v8.8L8.2 8zM7.6 3.6v8.8L2.3 8z" /> : <path d="M2.5 3.6v8.8L7.8 8zM8.4 3.6v8.8L13.7 8z" />}
      </svg>
    </button>
  );
}

/** How long "Make it yours" waits for its confirming second click. */
const CONFIRM_MS = 4000;

/** Makes the sky being watched your own; asks once more when that would replace a saved one. */
function OwnAction({ label, confirmFirst, onConfirm }: { label: string; confirmFirst: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      className={confirming ? 'scene-action is-own is-confirming' : 'scene-action is-own'}
      onClick={() => (confirmFirst && !confirming ? setConfirming(true) : onConfirm())}
    >
      {confirming ? t.makeItYoursConfirm : label}
    </button>
  );
}

/** Typing in a field must not also play, pause or step through the years. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function Scene({
  profile,
  people,
  moments,
  initialAge,
  skyRef,
  onEditPeople,
  onEditMoments,
  onRemember,
  onNote,
  ownAction,
  replacesSaved = false,
  shared = false,
}: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ageRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [playing, setPlaying] = useState(initialAge === undefined);
  const [remembering, setRemembering] = useState<Remembering | null>(null);
  // The last moment captioned, kept while its caption fades out.
  const [caption, setCaption] = useState<{ moment: Moment; leaving: boolean } | null>(null);
  const rememberingRef = useRef(remembering);
  rememberingRef.current = remembering;

  // Memories don't change the sky, so writing one must not restart the journey: the renderer
  // only sees a new list when someone's place in the sky changes.
  const shape = people.map((p) => [p.id, p.name, p.bond, p.joinAge, p.departAge, p.color].join('|')).join('\n');
  const skyPeople = useMemo(() => people, [shape]);
  // The same for moments: a note never restarts the journey.
  const momentShape = moments.map((m) => [m.id, m.title, m.age, m.kind].join('|')).join('\n');
  const skyMoments = useMemo(() => moments, [momentShape]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new SceneRenderer(canvas, profile, skyPeople, skyMoments, {
      initialAge,
      onAge: (age) => {
        if (ageRef.current) ageRef.current.textContent = t.num(age);
      },
      onPlayingChange: setPlaying,
      onMoment: (moment) => setCaption((shown) => (moment ? { moment, leaving: false } : shown && { ...shown, leaving: true })),
    });
    rendererRef.current = renderer;
    renderer.start();

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.code === 'Space') renderer.togglePlay();
      else if (event.code === 'ArrowLeft') renderer.step(-1);
      else if (event.code === 'ArrowRight') renderer.step(1);
      else return;
      event.preventDefault();
    };

    // Tap a person or a moment to remember it, or the empty sky to play or pause. Only the
    // timeline travels through the years: touch it to go to a year, or drag along it. A stray
    // swipe across the sky does nothing, so an unsteady hand never sends the years spinning.
    let gesture: { id: number; x: number; y: number; onTimeline: boolean; moved: boolean; scrubbing: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || gesture) return;
      const onTimeline = renderer.timelineAgeAt(event.clientX, event.clientY) !== null;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, onTimeline, moved: false, scrubbing: false };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!gesture) {
        const over = renderer.personAt(event.clientX, event.clientY) ?? renderer.momentAt(event.clientX, event.clientY);
        canvas.classList.toggle('is-over-person', over !== null);
        canvas.classList.toggle('is-over-timeline', over === null && renderer.timelineAgeAt(event.clientX, event.clientY) !== null);
        return;
      }
      if (event.pointerId !== gesture.id) return;
      if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < TAP_SLOP_PX) return;
      gesture.moved = true;
      if (!gesture.onTimeline) return;
      gesture.scrubbing = true;
      canvas.classList.add('is-scrubbing');
      renderer.seek(renderer.timelineAge(event.clientX));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const { moved, onTimeline } = gesture;
      gesture = null;
      canvas.classList.remove('is-scrubbing');
      if (moved) return;
      const person = renderer.personAt(event.clientX, event.clientY);
      const moment = person ? null : renderer.momentAt(event.clientX, event.clientY);
      if (person || moment) {
        // Hold the moment so nothing drifts away while it is being remembered.
        renderer.pause();
        setRemembering(
          person
            ? { id: person.person.id, kind: 'person', x: person.x, y: person.y }
            : { id: moment!.moment.id, kind: 'moment', x: moment!.x, y: moment!.y },
        );
      } else if (rememberingRef.current) {
        setRemembering(null);
      } else if (onTimeline) {
        renderer.seek(renderer.timelineAge(event.clientX));
      } else {
        renderer.togglePlay();
      }
    };
    const onPointerCancel = () => {
      gesture = null;
      canvas.classList.remove('is-scrubbing');
    };

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [profile, skyPeople, skyMoments, initialAge]);

  useEffect(() => {
    rendererRef.current?.setFocus(remembering?.id ?? null);
  }, [remembering]);

  const rememberedPerson = remembering?.kind === 'person' ? people.find((p) => p.id === remembering.id) : undefined;
  const rememberedMoment = remembering?.kind === 'moment' ? moments.find((m) => m.id === remembering.id) : undefined;

  return (
    <>
      <canvas ref={canvasRef} className="scene" aria-hidden="true" />
      <div className="hud" aria-live="off">
        {/* Keyed so each new moment's caption rises in afresh. */}
        <span className={caption?.leaving ? 'hud-moment is-leaving' : 'hud-moment'} key={caption?.moment.id ?? 'none'}>
          {caption?.moment.title}
        </span>
        <span className="hud-caption">{t.ageCaption(profile.name)}</span>
        <span className="hud-age" ref={ageRef}>
          {t.num(0)}
        </span>
        <div className="hud-controls">
          <SkipButton direction={-1} rendererRef={rendererRef} />
          <button
            type="button"
            className="hud-play"
            onClick={() => rendererRef.current?.togglePlay()}
            aria-label={playing ? t.pause : t.play}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {playing ? <path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" /> : <path d="M5.5 3.2v9.6L12.5 8z" />}
            </svg>
          </button>
          <SkipButton direction={1} rendererRef={rendererRef} />
        </div>
      </div>
      {/* While the journey plays the buttons step aside; pausing brings them back. */}
      <div className={playing ? 'scene-actions is-quiet' : 'scene-actions'}>
        <Keep
          profile={profile}
          skyRef={skyRef}
          sceneRef={canvasRef}
          rendererRef={rendererRef}
          own={ownAction ? undefined : { people, moments }}
        />
        <EditMenu onEditPeople={onEditPeople} onEditMoments={onEditMoments} />
        {ownAction && <OwnAction label={ownAction.label} confirmFirst={replacesSaved} onConfirm={ownAction.onConfirm} />}
      </div>
      {shared && (
        <p className="shared-note">
          <span className="shared-note-title">{t.sharedWithYou}</span>
          <span>{t.sharedWords}</span>
        </p>
      )}
      {rememberedPerson && remembering && (
        <MemoryCard
          // A fresh card for each star, so a half-written memory never carries over.
          key={rememberedPerson.id}
          title={rememberedPerson.name}
          line={t.journeyLine(rememberedPerson)}
          color={rememberedPerson.color}
          note={rememberedPerson.memory}
          words={{
            dialog: t.remembering(rememberedPerson.name),
            placeholder: t.memoryPlaceholder(rememberedPerson.name),
            edit: t.editMemory(rememberedPerson.name),
            add: t.addMemory,
          }}
          anchor={remembering}
          onSave={(memory) => onRemember(rememberedPerson.id, memory)}
          onClose={() => setRemembering(null)}
        />
      )}
      {rememberedMoment && remembering && (
        <MemoryCard
          key={rememberedMoment.id}
          title={rememberedMoment.title}
          line={t.momentLine(rememberedMoment)}
          color={MOMENT_COLOR}
          note={rememberedMoment.note}
          words={{
            dialog: t.aboutMoment(rememberedMoment.title),
            placeholder: t.momentNotePlaceholder,
            edit: t.editMomentNote(rememberedMoment.title),
            add: t.addMomentNote,
          }}
          anchor={remembering}
          onSave={(note) => onNote(rememberedMoment.id, note)}
          onClose={() => setRemembering(null)}
        />
      )}
      <p className="controls-hint">
        <kbd>{t.keys.space}</kbd> {t.hint.pause} · <kbd>←</kbd> <kbd>→</kbd> {t.hint.step} · {t.hint.drag} · {t.hint.remember}
      </p>
      <p className="touch-hint">{t.touchHint}</p>
    </>
  );
}
