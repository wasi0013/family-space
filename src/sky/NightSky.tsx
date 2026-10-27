import { useEffect, type RefObject } from 'react';
import { SkyRenderer } from './SkyRenderer';

/** `canvasRef` lets the journey recorder read the sky it composes into each video frame. */
export function NightSky({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const renderer = new SkyRenderer(canvasRef.current!);
    renderer.start();
    return () => renderer.dispose();
  }, [canvasRef]);

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />;
}
