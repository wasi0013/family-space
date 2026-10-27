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
  /** Set while watching the example life: starts a sky of your own from it. */
  onMakeItYours?: () => void;
  /** Set when starting from the example would replace a saved sky, so it asks first. */
  replacesSaved?: boolean;
}

/** The star whose card is open: a person, or a moment in the constellation. */
interface Remembering {
  id: string;
  kind: 'person' | 'moment';
  x: number;
  y: number;
}

/** How long "Make it yours" waits for its confirming second click. */
const CONFIRM_MS = 4000;

/** Starts your own sky from the example; asks once more when that would replace a saved one. */
function MakeItYours({ confirmFirst, onConfirm }: { confirmFirst: boolean; onConfirm: () => void }) {
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
      {confirming ? t.makeItYoursConfirm : t.makeItYours}
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
  onMakeItYours,
  replacesSaved = false,
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

    // Tap a person to remember them, or the empty sky to play or pause; drag sideways to travel
    // through the years. One drag across the whole screen spans the whole life.
    let gesture: { id: number; x: number; y: number; age: number; scrubbing: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || gesture) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, age: renderer.currentAge, scrubbing: false };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!gesture) {
        const over = renderer.personAt(event.clientX, event.clientY) ?? renderer.momentAt(event.clientX, event.clientY);
        canvas.classList.toggle('is-over-person', over !== null);
        return;
      }
      if (event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      if (!gesture.scrubbing && Math.hypot(dx, event.clientY - gesture.y) < TAP_SLOP_PX) return;
      gesture.scrubbing = true;
      canvas.classList.add('is-scrubbing');
      renderer.seek(gesture.age + (dx / canvas.clientWidth) * renderer.lifespan);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const tapped = !gesture.scrubbing;
      gesture = null;
      canvas.classList.remove('is-scrubbing');
      if (!tapped) return;
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
      </div>
      <div className="scene-actions">
        <Keep profile={profile} skyRef={skyRef} sceneRef={canvasRef} rendererRef={rendererRef} />
        <EditMenu onEditPeople={onEditPeople} onEditMoments={onEditMoments} />
        {onMakeItYours && <MakeItYours confirmFirst={replacesSaved} onConfirm={onMakeItYours} />}
      </div>
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
