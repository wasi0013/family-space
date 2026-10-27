import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { MEMORY_MAX_LENGTH } from '../people';

const CARD_WIDTH = 300;
/** Below this width the card becomes a sheet along the bottom of the screen. */
const SHEET_BELOW = 560;
const GAP = 22;

/** The words a card needs, which differ between a person and a moment. */
export interface CardWords {
  dialog: string;
  placeholder: string;
  edit: string;
  add: string;
}

interface MemoryCardProps {
  title: string;
  /** Their place in your life, or a moment's kind and age. */
  line: string;
  color: string;
  note: string | undefined;
  words: CardWords;
  /** Where the star was when tapped; the card opens beside it. */
  anchor: { x: number; y: number };
  onSave: (note: string) => void;
  onClose: () => void;
}

/** A card for one star in the sky, with a line of memory that can be written and edited. */
export function MemoryCard({ title, line, color, note, words, anchor, onSave, onClose }: MemoryCardProps) {
  const [editing, setEditing] = useState(!note);
  const [text, setText] = useState(note ?? '');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const memory = note?.trim() ?? '';

  // Focus lands in the card: in the field while writing, otherwise on the card itself.
  useEffect(() => {
    if (editing) fieldRef.current?.focus();
    else cardRef.current?.focus();
  }, [editing]);

  // Escape works wherever focus is, even after a click back on the sky.
  const escapeRef = useRef(() => {});
  escapeRef.current = () => {
    // It backs out of editing a written memory first, then closes the card.
    if (editing && memory) {
      setText(memory);
      setEditing(false);
    } else {
      onClose();
    }
  };
  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      escapeRef.current();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  const save = (event?: FormEvent) => {
    event?.preventDefault();
    onSave(text.trim());
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && editing) {
      // A memory is one line, so Enter keeps it rather than starting a new line.
      event.preventDefault();
      save();
    }
  };

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      className="memory-card"
      style={{ ...place(anchor), '--person-color': color } as CSSProperties}
      role="dialog"
      aria-label={words.dialog}
      onKeyDown={onKeyDown}
    >
      <header className="memory-header">
        <span className="person-dot" aria-hidden="true" />
        <h2 className="memory-name">{title}</h2>
        <button type="button" className="memory-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </header>
      <p className="memory-journey">{line}</p>

      {editing ? (
        <form className="memory-form" onSubmit={save}>
          <textarea
            ref={fieldRef}
            className="memory-field"
            value={text}
            onChange={(event) => setText(event.target.value.replace(/\n/g, ' '))}
            placeholder={words.placeholder}
            maxLength={MEMORY_MAX_LENGTH}
            rows={2}
            aria-label={words.placeholder}
          />
          <div className="memory-actions">
            <span className="memory-count" aria-hidden="true">
              {t.num(MEMORY_MAX_LENGTH - text.length)}
            </span>
            <button type="submit" className="memory-save">
              {text.trim() || !memory ? t.keepMemory : t.removeMemory} <span aria-hidden="true">↵</span>
            </button>
          </div>
        </form>
      ) : memory ? (
        <button type="button" className="memory-text" onClick={() => setEditing(true)} aria-label={words.edit}>
          “{memory}”
        </button>
      ) : (
        <button type="button" className="memory-add" onClick={() => setEditing(true)}>
          {words.add}
        </button>
      )}
    </section>
  );
}

/** Opens beside the star, kept on screen; a bottom sheet on narrow screens. */
function place(anchor: { x: number; y: number }): CSSProperties {
  const { innerWidth: width, innerHeight: height } = window;
  if (width < SHEET_BELOW) return { left: 16, right: 16, bottom: 'max(132px, calc(env(safe-area-inset-bottom) + 120px))' };
  const left = Math.min(width - CARD_WIDTH - 16, Math.max(16, anchor.x - CARD_WIDTH / 2));
  // Above the star when there is room, otherwise below it.
  return anchor.y > height * 0.45
    ? { left, width: CARD_WIDTH, bottom: height - anchor.y + GAP }
    : { left, width: CARD_WIDTH, top: anchor.y + GAP };
}
