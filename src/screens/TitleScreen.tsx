import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '../i18n';

const TITLE = 'Family Space';
/** Each letter's place in the title, so letters emerge one after another across both words. */
const WORDS = TITLE.split(' ').map((word, w, words) => {
  const offset = words.slice(0, w).join('').length;
  return [...word].map((letter, i) => ({ letter, index: offset + i }));
});
/** Long enough for the last letter's dissolve in styles.css to finish. */
const EXIT_MS = 1100;
const REDUCED_EXIT_MS = 250;
/** How long "Start a new sky" waits for its confirming second click. */
const CONFIRM_MS = 4000;

interface TitleScreenProps {
  /** Set when a saved sky exists, so the title offers a return to it. */
  returning: boolean;
  onStart: () => void;
  /** Erases the saved sky and starts again from the first question. */
  onStartOver: () => void;
  /** Plays the example life, leaving any saved sky as it is. */
  onExample: () => void;
}

export function TitleScreen({ returning, onStart, onStartOver, onExample }: TitleScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);

  const leave = useCallback((then: () => void) => {
    if (started.current) return;
    started.current = true;
    setLeaving(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(then, reduced ? REDUCED_EXIT_MS : EXIT_MS);
  }, []);

  const start = useCallback(() => leave(onStart), [leave, onStart]);

  // Erasing can't be undone, so it takes a second click while the button asks for it.
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const startOver = () => {
    if (confirming) leave(onStartOver);
    else setConfirming(true);
  };

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
      {/* The brand stays in English in every language. */}
      <h1 className="title" aria-label={TITLE} lang="en">
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
      <p className="tagline">{t.tagline}</p>
      <button type="button" className="begin" onClick={start}>
        <span className="begin-keys">
          {(returning ? t.returnKeys : t.beginKeys)[0]} <kbd>{t.keys.space}</kbd>{' '}
          {(returning ? t.returnKeys : t.beginKeys)[1]}
        </span>
        <span className="begin-touch">{returning ? t.returnTouch : t.beginTouch}</span>
      </button>
      <button type="button" className="see-example" onClick={() => leave(onExample)}>
        {t.seeExample} <span aria-hidden="true">→</span>
      </button>
      {returning && (
        <button type="button" className={confirming ? 'start-over is-confirming' : 'start-over'} onClick={startOver}>
          {confirming ? t.startOverConfirm : t.startOver}
        </button>
      )}
    </section>
  );
}
