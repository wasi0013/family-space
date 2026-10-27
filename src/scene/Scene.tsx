import { useEffect, useRef, useState } from 'react';
import type { Person, Profile } from '../model';
import { SceneRenderer } from './SceneRenderer';

/** A press that moves less than this is a tap, which plays or pauses. */
const TAP_SLOP_PX = 8;

interface SceneProps {
  profile: Profile;
  people: readonly Person[];
  initialAge?: number;
  onEditPeople: () => void;
}

export function Scene({ profile, people, initialAge, onEditPeople }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ageRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [playing, setPlaying] = useState(initialAge === undefined);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new SceneRenderer(canvas, profile, people, {
      initialAge,
      onAge: (age) => {
        if (ageRef.current) ageRef.current.textContent = String(age);
      },
      onPlayingChange: setPlaying,
    });
    rendererRef.current = renderer;
    renderer.start();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') renderer.togglePlay();
      else if (event.code === 'ArrowLeft') renderer.step(-1);
      else if (event.code === 'ArrowRight') renderer.step(1);
      else return;
      event.preventDefault();
    };

    // Tap the sky to play or pause; drag sideways to travel through the years. One drag across
    // the whole screen spans the whole life.
    let gesture: { id: number; x: number; y: number; age: number; scrubbing: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || gesture) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, age: renderer.currentAge, scrubbing: false };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      if (!gesture.scrubbing && Math.hypot(dx, event.clientY - gesture.y) < TAP_SLOP_PX) return;
      gesture.scrubbing = true;
      canvas.classList.add('is-scrubbing');
      renderer.seek(gesture.age + (dx / canvas.clientWidth) * renderer.lifespan);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (!gesture.scrubbing) renderer.togglePlay();
      gesture = null;
      canvas.classList.remove('is-scrubbing');
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
  }, [profile, people, initialAge]);

  return (
    <>
      <canvas ref={canvasRef} className="scene" aria-hidden="true" />
      <div className="hud" aria-live="off">
        <span className="hud-caption">{profile.name} · age</span>
        <span className="hud-age" ref={ageRef}>
          0
        </span>
        <button
          type="button"
          className="hud-play"
          onClick={() => rendererRef.current?.togglePlay()}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {playing ? <path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" /> : <path d="M5.5 3.2v9.6L12.5 8z" />}
          </svg>
        </button>
      </div>
      <button type="button" className="scene-action" onClick={onEditPeople}>
        Edit people
      </button>
      <p className="controls-hint">
        <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> step a year · drag to travel
      </p>
      <p className="touch-hint">Tap to pause · Drag through the years</p>
    </>
  );
}
