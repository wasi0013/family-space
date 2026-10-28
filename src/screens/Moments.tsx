import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { KIND_GLYPH } from '../i18n/glyphs';
import type { Moment, MomentKind, Profile } from '../model';
import {
  byAge,
  EMPTY_MOMENT,
  guessKind,
  isMomentProblem,
  MOMENT_KINDS,
  MOMENT_TITLE_MAX_LENGTH,
  toMoment,
  toMomentDraft,
  type MomentDraft,
} from '../moments';
import { asciiDigits } from '../people';
import { MAX_MOMENTS } from '../skyFile';

interface MomentsProps {
  profile: Profile;
  initialMoments?: Moment[];
  /** Shown as "step / total" during onboarding; omitted when editing later. */
  step?: number;
  totalSteps?: number;
  onComplete: (moments: Moment[]) => void;
}

/** Add the moments that changed your sky: a few words, an age, and a kind usually picked for you. */
export function Moments({ profile, initialMoments = [], step, totalSteps, onComplete }: MomentsProps) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [draft, setDraft] = useState<MomentDraft>(EMPTY_MOMENT);
  // Once someone picks a kind themselves, the title stops changing it.
  const [kindChosen, setKindChosen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  const guessed = kindChosen ? null : guessKind(draft.title);

  const reset = () => {
    setDraft(EMPTY_MOMENT);
    setKindChosen(false);
    setEditingId(null);
    setError('');
  };

  const setTitle = (title: string) => {
    const guess = kindChosen ? null : guessKind(title);
    setDraft({ ...draft, title, kind: guess ?? draft.kind });
    setError('');
  };

  /** Folds the draft into the list; returns the new list, or null if the draft needs fixing. */
  const commitDraft = (): Moment[] | null => {
    const editing = moments.find((m) => m.id === editingId);
    if (!editing && moments.length >= MAX_MOMENTS) {
      setError(t.momentsFull(MAX_MOMENTS));
      return null;
    }
    const result = toMoment(draft, profile.age, editing ?? { id: crypto.randomUUID() });
    if (isMomentProblem(result)) {
      setError(t.momentProblem(result));
      (result.kind === 'title' ? titleRef : ageRef).current?.focus();
      return null;
    }
    const next = byAge(editing ? moments.map((m) => (m.id === editing.id ? result : m)) : [...moments, result]);
    setMoments(next);
    reset();
    return next;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Enter on an empty line means "that's all"; an age with no title asks for the title instead.
    if (!draft.title.trim() && !draft.age && !editingId) {
      onComplete(moments);
      return;
    }
    if (commitDraft()) titleRef.current?.focus();
  };

  const finish = () => {
    if (!draft.title.trim()) {
      onComplete(moments);
      return;
    }
    const next = commitDraft();
    if (next) onComplete(next);
  };

  const edit = (moment: Moment) => {
    setEditingId(moment.id);
    setDraft(toMomentDraft(moment));
    setKindChosen(true);
    setError('');
    titleRef.current?.focus();
  };

  const remove = (moment: Moment) => {
    setMoments(moments.filter((m) => m.id !== moment.id));
    if (editingId === moment.id) reset();
    titleRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && editingId) reset();
  };

  const chooseKind = (kind: MomentKind) => {
    setDraft({ ...draft, kind });
    setKindChosen(true);
    setError('');
  };

  const title = draft.title.trim();
  const hint =
    error ||
    (title ? [guessed && t.guessed(guessed), editingId ? t.enterToSaveMoment : t.enterToAddMoment].filter(Boolean).join(' · ') : t.enterToFinish);

  return (
    <section className="onboarding people-screen">
      <form className="question people" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        <p className="question-count">
          {step !== undefined && totalSteps !== undefined ? `${t.optional} · ${t.step(step, totalSteps)}` : t.optional}
        </p>
        <label className="question-text" htmlFor="moment-title">
          {t.askMoments}
        </label>
        <p className="people-lede">{t.momentsLede}</p>

        <input
          id="moment-title"
          ref={titleRef}
          className="answer"
          value={draft.title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={moments.length ? t.anotherMoment : t.momentTitlePlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={MOMENT_TITLE_MAX_LENGTH}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby="moments-hint"
        />

        <div className="facts">
          <div className="fact">
            <label className="fact-label" htmlFor="moment-age">
              {t.atAge}
            </label>
            <input
              id="moment-age"
              ref={ageRef}
              className="age-input"
              value={t.num(draft.age)}
              onChange={(event) => {
                setDraft({ ...draft, age: asciiDigits(event.target.value).replace(/\D/g, '') });
                setError('');
              }}
              inputMode="numeric"
              maxLength={3}
              placeholder={t.num('00')}
              aria-label={t.momentAgeLabel}
            />
          </div>
          <div className="fact" role="radiogroup" aria-label={t.momentKindLabel}>
            {MOMENT_KINDS.map((kind) => (
              <label key={kind} className={draft.kind === kind ? 'choice is-checked' : 'choice'}>
                <input type="radio" name="moment-kind" checked={draft.kind === kind} onChange={() => chooseKind(kind)} />
                <span className="choice-glyph" aria-hidden="true">
                  {KIND_GLYPH[kind]}
                </span>
                {t.kind[kind]}
              </label>
            ))}
          </div>
        </div>

        <p id="moments-hint" className={error ? 'people-hint is-error' : 'people-hint'} role={error ? 'alert' : undefined}>
          {hint}
        </p>

        <div className="people-actions">
          <button type="submit" className="continue">
            {editingId ? t.save : t.add} <span aria-hidden="true">↵</span>
          </button>
          <button type="button" className="continue is-primary" onClick={finish}>
            {step === undefined ? t.done : moments.length || title ? t.beginJourney : t.skipMoments}
          </button>
        </div>

        {moments.length > 0 && (
          <ul className="people-list" aria-label={t.momentsInSky}>
            {moments.map((moment) => (
              <li key={moment.id} className={moment.id === editingId ? 'person-chip is-editing' : 'person-chip'}>
                <button type="button" className="person-edit" onClick={() => edit(moment)} aria-label={t.editMoment(moment.title)}>
                  <span className="moment-glyph" aria-hidden="true">
                    {KIND_GLYPH[moment.kind]}
                  </span>
                  {moment.title}
                  <span className="person-span" aria-hidden="true">
                    {t.num(moment.age)}
                  </span>
                </button>
                <button type="button" className="person-remove" onClick={() => remove(moment)} aria-label={t.removeMoment(moment.title)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </section>
  );
}
