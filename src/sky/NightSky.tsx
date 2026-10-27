import { useEffect, useRef } from 'react';
import { SkyRenderer } from './SkyRenderer';

export function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const renderer = new SkyRenderer(canvasRef.current!);
    renderer.start();
    return () => renderer.dispose();
  }, []);

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />;
}
