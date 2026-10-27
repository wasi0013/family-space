import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { t } from '../i18n';
import { Keep } from '../keep/Keep';
import type { Person, Profile } from '../model';
import { MemoryCard } from './MemoryCard';
import { SceneRenderer } from './SceneRenderer';

/** A press that moves less than this is a tap, which plays or pauses. */
const TAP_SLOP_PX = 8;

interface SceneProps {
  profile: Profile;
  people: readonly Person[];
  initialAge?: number;
  /** The night sky behind the scene, composed into exported images and videos. */
  skyRef: RefObject<HTMLCanvasElement | null>;
  onEditPeople: () => void;
  /** Saves one person's memory; an empty string removes it. */
  onRemember: (personId: string, memory: string) => void;
}

interface Remembering {
  id: string;
  x: number;
  y: number;
}

/** Typing in a field must not also play, pause or step through the years. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function Scene({ profile, people, initialAge, skyRef, onEditPeople, onRemember }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ageRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [playing, setPlaying] = useState(initialAge === undefined);
  const [remembering, setRemembering] = useState<Remembering | null>(null);
  const rememberingRef = useRef(remembering);
  rememberingRef.current = remembering;

  // Memories don't change the sky, so writing one must not restart the journey: the renderer
  // only sees a new list when someone's place in the sky changes.
  const shape = people.map((p) => [p.id, p.name, p.bond, p.joinAge, p.departAge, p.color].join('|')).join('\n');
  const skyPeople = useMemo(() => people, [shape]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new SceneRenderer(canvas, profile, skyPeople, {
      initialAge,
      onAge: (age) => {
        if (ageRef.current) ageRef.current.textContent = t.num(age);
      },
      onPlayingChange: setPlaying,
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
        canvas.classList.toggle('is-over-person', renderer.personAt(event.clientX, event.clientY) !== null);
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
      const hit = renderer.personAt(event.clientX, event.clientY);
      if (hit) {
        // Hold the moment so they don't drift away while being remembered.
        renderer.pause();
        setRemembering({ id: hit.person.id, x: hit.x, y: hit.y });
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
  }, [profile, skyPeople, initialAge]);

  useEffect(() => {
    rendererRef.current?.setFocus(remembering?.id ?? null);
  }, [remembering]);

  const rememberedPerson = remembering && people.find((p) => p.id === remembering.id);

  return (
    <>
      <canvas ref={canvasRef} className="scene" aria-hidden="true" />
      <div className="hud" aria-live="off">
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
        <button type="button" className="scene-action" onClick={onEditPeople}>
          {t.editPeople}
        </button>
      </div>
      {rememberedPerson && remembering && (
        <MemoryCard
          // A fresh card for each person, so a half-written memory never carries over.
          key={rememberedPerson.id}
          person={rememberedPerson}
          anchor={remembering}
          onSave={(memory) => onRemember(rememberedPerson.id, memory)}
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
