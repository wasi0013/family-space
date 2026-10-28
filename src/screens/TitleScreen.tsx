import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '../i18n';
import { openSkyFile, type SkyFileProblem, type SkyFileResult } from '../skyFile';

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
  /** Plays a sky from a file someone passed on, leaving any saved sky as it is. */
  onOpenSky: (result: SkyFileResult) => void;
  /** Why the last shared link didn't open, if it didn't. */
  problem: SkyFileProblem | null;
}

export function TitleScreen({ returning, onStart, onStartOver, onExample, onOpenSky, problem: linkProblem }: TitleScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState(linkProblem);
  const started = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // A file is read and checked here, so a damaged one is explained without leaving the title.
  const openFile = async (file: File | undefined) => {
    if (!file || started.current) return;
    const result = await openSkyFile(file);
    if ('problem' in result) setProblem(result.problem);
    else leave(() => onOpenSky(result));
  };

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
    <section
      className={leaving ? 'title-screen is-leaving' : 'title-screen'}
      // A sky file dropped anywhere on the title opens like one chosen with the button.
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void openFile(event.dataTransfer.files[0]);
      }}
    >
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
      <div className="title-more">
        <button type="button" className="start-over" onClick={() => fileRef.current?.click()}>
          {t.openSkyFile}
        </button>
        {returning && (
          <button type="button" className={confirming ? 'start-over is-confirming' : 'start-over'} onClick={startOver}>
            {confirming ? t.startOverConfirm : t.startOver}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          void openFile(event.target.files?.[0]);
          // The same file can be chosen again after a problem is fixed.
          event.target.value = '';
        }}
      />
      {problem && (
        <p className="open-problem" role="alert">
          {t.openProblem(problem)}
        </p>
      )}
      <p className="privacy-note">{t.privacy}</p>
    </section>
  );
}
