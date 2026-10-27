import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const TITLE = 'Family Space';
/** Each letter's place in the title, so letters emerge one after another across both words. */
const WORDS = TITLE.split(' ').map((word, w, words) => {
  const offset = words.slice(0, w).join('').length;
  return [...word].map((letter, i) => ({ letter, index: offset + i }));
});
/** Long enough for the last letter's dissolve in styles.css to finish. */
const EXIT_MS = 1100;
const REDUCED_EXIT_MS = 250;

export function TitleScreen({ onStart }: { onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setLeaving(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(onStart, reduced ? REDUCED_EXIT_MS : EXIT_MS);
  }, [onStart]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      start();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [start]);

  return (
    <section className={leaving ? 'title-screen is-leaving' : 'title-screen'}>
      <h1 className="title" aria-label={TITLE}>
        {WORDS.map((letters, w) => (
          <span className="title-word" key={w} aria-hidden="true">
            {letters.map(({ letter, index }) => (
              <span className="title-letter" key={index} style={{ '--i': index } as CSSProperties}>
                {letter}
              </span>
            ))}
          </span>
        ))}
      </h1>
      <p className="tagline">Your life, written in starlight.</p>
      <button type="button" className="begin" onClick={start}>
        <span className="begin-keys">
          Press <kbd>Space</kbd> to begin
        </span>
        <span className="begin-touch">Tap to begin</span>
      </button>
    </section>
  );
}
