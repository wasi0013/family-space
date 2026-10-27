import { useEffect, useRef } from 'react';
import type { Person, Profile } from '../model';
import { SceneRenderer } from './SceneRenderer';

interface SceneProps {
  profile: Profile;
  people: readonly Person[];
  initialAge?: number;
}

export function Scene({ profile, people, initialAge }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ageRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderer = new SceneRenderer(canvasRef.current!, profile, people, {
      initialAge,
      onAge: (age) => {
        if (ageRef.current) ageRef.current.textContent = String(age);
      },
    });
    renderer.start();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') renderer.togglePlay();
      else if (event.code === 'ArrowLeft') renderer.step(-1);
      else if (event.code === 'ArrowRight') renderer.step(1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
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
      </div>
      <p className="controls-hint">
        <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> step a year
      </p>
    </>
  );
}
