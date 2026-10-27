import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Person, Profile } from '../model';
import { t } from '../i18n';
import { asciiDigits, EMPTY_DRAFT, isProblem, nextColor, toDraft, toPerson, type Draft, type Ending } from '../people';

const ENDINGS: { id: Ending; label: string; withAge: boolean }[] = [
  { id: 'here', label: t.stillHere, withAge: false },
  { id: 'passing', label: t.passingThrough, withAge: false },
  { id: 'drifted', label: t.driftedAt, withAge: true },
  { id: 'star', label: t.starAt, withAge: true },
];

interface PeopleProps {
  profile: Profile;
  /** People already in the sky, when coming back to edit them. */
  initialPeople?: Person[];
  /** Shown as "step / total" during onboarding; omitted when editing later. */
  step?: number;
  totalSteps?: number;
  onComplete: (people: Person[]) => void;
}

export function People({ profile, initialPeople = [], step, totalSteps, onComplete }: PeopleProps) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const joinRef = useRef<HTMLInputElement>(null);
  const departRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setError('');
  };

  /** Folds the draft into the list; returns the new list, or null if the draft needs fixing. */
  const commitDraft = (): Person[] | null => {
    const editing = people.find((p) => p.id === editingId);
    const identity = editing ?? { id: crypto.randomUUID(), color: nextColor(people) };
    const result = toPerson(draft, profile.age, identity);
    if (isProblem(result)) {
      setError(t.problem(result));
      return null;
    }
    const next = editing ? people.map((p) => (p.id === editing.id ? result : p)) : [...people, result];
    setPeople(next);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setError('');
    return next;
  };

  const begin = () => {
    if (!draft.name.trim()) {
      onComplete(people);
      return;
    }
    const next = commitDraft();
    if (next) onComplete(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Enter on an empty line means "that's everyone".
    if (!draft.name.trim() && !editingId && people.length > 0) {
      onComplete(people);
      return;
    }
    if (commitDraft()) nameRef.current?.focus();
  };

  const edit = (person: Person) => {
    setEditingId(person.id);
    setDraft(toDraft(person));
    setError('');
    nameRef.current?.focus();
  };

  const remove = (person: Person) => {
    setPeople(people.filter((p) => p.id !== person.id));
    if (editingId === person.id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
    nameRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !editingId) return;
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError('');
  };

  /** Moves focus to an age field once it has appeared. */
  const focusSoon = (ref: RefObject<HTMLInputElement | null>) => requestAnimationFrame(() => ref.current?.focus());

  const name = draft.name.trim();
  const hint = error || (name ? (editingId ? t.enterToSave : t.enterToAdd)(name) : people.length ? t.enterToBegin : '');

  return (
    <section className="onboarding people-screen">
      <form className="question people" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        {step !== undefined && (
          <p className="question-count">
            {step} / {totalSteps}
          </p>
        )}
        <label className="question-text" htmlFor="person-name">
          {t.askPeople}
        </label>
        <p className="people-lede">{t.peopleLede}</p>

        <input
          id="person-name"
          ref={nameRef}
          className="answer"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder={people.length ? t.someoneElse : t.theirName}
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby="people-hint"
        />

        <div className="facts">
          <div className="fact" role="radiogroup" aria-labelledby="fact-since">
            <span className="fact-label" id="fact-since">
              {t.since}
            </span>
            <Choice group="arrival" checked={draft.arrival === 'birth'} onSelect={() => update({ arrival: 'birth' })}>
              {t.birth}
            </Choice>
            <Choice
              group="arrival"
              checked={draft.arrival === 'later'}
              onSelect={() => {
                update({ arrival: 'later' });
                focusSoon(joinRef);
              }}
            >
              {t.age}
            </Choice>
            {draft.arrival === 'later' && (
              <AgeInput
                inputRef={joinRef}
                value={draft.joinAge}
                onChange={(joinAge) => update({ joinAge })}
                label={t.arrivedAgeLabel}
              />
            )}
          </div>

          <div className="fact" role="radiogroup" aria-labelledby="fact-now">
            <span className="fact-label" id="fact-now">
              {t.now}
            </span>
            {ENDINGS.map((ending) => (
              <span className="fact-option" key={ending.id}>
                <Choice
                  group="ending"
                  checked={draft.ending === ending.id}
                  onSelect={() => {
                    update({ ending: ending.id });
                    if (ending.withAge) focusSoon(departRef);
                  }}
                >
                  {ending.label}
                </Choice>
                {ending.withAge && draft.ending === ending.id && (
                  <AgeInput
                    inputRef={departRef}
                    value={draft.departAge}
                    onChange={(departAge) => update({ departAge })}
                    label={t.leftAgeLabel(ending.id === 'star' ? 'star' : 'drifted')}
                  />
                )}
              </span>
            ))}
          </div>
        </div>

        <p id="people-hint" className={error ? 'people-hint is-error' : 'people-hint'} role={error ? 'alert' : undefined}>
          {hint}
        </p>

        <div className="people-actions">
          <button type="submit" className="continue">
            {editingId ? t.save : t.add} <span aria-hidden="true">↵</span>
          </button>
          <button type="button" className="continue is-primary" onClick={begin}>
            {people.length || name ? t.beginJourney : t.beginAlone}
          </button>
        </div>

        {people.length > 0 && (
          <ul className="people-list" aria-label={t.peopleInSky}>
            {people.map((person) => (
              <li
                key={person.id}
                className={person.id === editingId ? 'person-chip is-editing' : 'person-chip'}
                style={{ '--person-color': person.color } as CSSProperties}
              >
                <button type="button" className="person-edit" onClick={() => edit(person)} aria-label={t.editPerson(t.describe(person))}>
                  <span className="person-dot" aria-hidden="true" />
                  {person.name}
                  <span className="person-span" aria-hidden="true">
                    {t.lifeSpan(person)}
                  </span>
                </button>
                <button type="button" className="person-remove" onClick={() => remove(person)} aria-label={t.removePerson(person.name)}>
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

function Choice({
  group,
  checked,
  onSelect,
  children,
}: {
  group: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label className={checked ? 'choice is-checked' : 'choice'}>
      <input type="radio" name={group} checked={checked} onChange={onSelect} />
      {children}
    </label>
  );
}

function AgeInput({
  inputRef,
  value,
  onChange,
  label,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <input
      ref={inputRef}
      className="age-input"
      // Kept as ASCII digits, shown in the language's own; either can be typed.
      value={t.num(value)}
      onChange={(event) => onChange(asciiDigits(event.target.value).replace(/\D/g, ''))}
      inputMode="numeric"
      maxLength={3}
      placeholder={t.num('00')}
      aria-label={label}
    />
  );
}
