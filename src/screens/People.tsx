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

/** Each person's light, handed out in order; distinct hues that glow well on the night sky. */
const PERSON_COLORS = [
  '#ff8a7a',
  '#7ea6ff',
  '#b7a6ff',
  '#8ff0d2',
  '#ff9fd0',
  '#ffd27a',
  '#9fe7ff',
  '#ffb48a',
  '#c8f08f',
  '#cfe9ff',
];

type Arrival = 'birth' | 'later';
/** How someone's part in the story ends, which also decides how they leave the sky. */
type Ending = 'here' | 'drifted' | 'star';

interface Draft {
  name: string;
  arrival: Arrival;
  joinAge: string;
  ending: Ending;
  departAge: string;
}

const EMPTY_DRAFT: Draft = { name: '', arrival: 'birth', joinAge: '', ending: 'here', departAge: '' };

const ENDINGS: { id: Ending; label: string; withAge: boolean }[] = [
  { id: 'here', label: 'still here', withAge: false },
  { id: 'drifted', label: 'drifted away at', withAge: true },
  { id: 'star', label: 'became a star at', withAge: true },
];

function parseAge(text: string): number | null {
  return /^\d{1,3}$/.test(text.trim()) ? Number(text) : null;
}

/** Turns a draft into a person, or returns what still needs fixing. */
function toPerson(draft: Draft, maxAge: number, identity: { id: string; color: string }): Person | string {
  const name = draft.name.trim();
  if (!name) return 'Give them a name.';

  let joinAge = 0;
  if (draft.arrival === 'later') {
    const age = parseAge(draft.joinAge);
    if (age === null || age > maxAge) return `Enter the age they arrived, from 0 to ${maxAge}.`;
    joinAge = age;
  }

  let departAge: number | null = null;
  if (draft.ending !== 'here') {
    const age = parseAge(draft.departAge);
    const what = draft.ending === 'star' ? 'became a star' : 'drifted away';
    if (joinAge >= maxAge) return `They arrived at ${joinAge}, so they can only still be here.`;
    if (age === null || age <= joinAge || age > maxAge) {
      return `Enter the age they ${what}, from ${joinAge + 1} to ${maxAge}.`;
    }
    departAge = age;
  }

  // Whether someone passes through only shows once they have left; until then they stay.
  return { ...identity, name, bond: draft.ending === 'drifted' ? 'temporary' : 'permanent', joinAge, departAge };
}

function toDraft(person: Person): Draft {
  return {
    name: person.name,
    arrival: person.joinAge > 0 ? 'later' : 'birth',
    joinAge: person.joinAge > 0 ? String(person.joinAge) : '',
    ending: person.departAge === null ? 'here' : person.bond === 'temporary' ? 'drifted' : 'star',
    departAge: person.departAge === null ? '' : String(person.departAge),
  };
}

function nextColor(people: readonly Person[]): string {
  return PERSON_COLORS.find((c) => !people.some((p) => p.color === c)) ?? PERSON_COLORS[people.length % PERSON_COLORS.length];
}

function lifeSpan(person: Person): string {
  const from = person.joinAge === 0 ? 'birth' : person.joinAge;
  if (person.departAge === null) return `${from}–now`;
  return `${from}–${person.departAge} ${person.bond === 'temporary' ? '↗' : '✦'}`;
}

function describe(person: Person): string {
  const since = person.joinAge === 0 ? 'since birth' : `since you were ${person.joinAge}`;
  if (person.departAge === null) return `${person.name}, with you ${since}, still here`;
  const end = person.bond === 'temporary' ? 'drifted away' : 'became a star';
  return `${person.name}, with you ${since}, ${end} at ${person.departAge}`;
}

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
    if (typeof result === 'string') {
      setError(result);
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
  const hint = error || (name ? `Press Enter to ${editingId ? 'save' : 'add'} ${name}` : people.length ? 'Press Enter on an empty name to begin' : '');

  return (
    <section className="onboarding people-screen">
      <form className="question people" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        {step !== undefined && (
          <p className="question-count">
            {step} / {totalSteps}
          </p>
        )}
        <label className="question-text" htmlFor="person-name">
          Who has shared your journey?
        </label>
        <p className="people-lede">Some stay. Some drift away. Some become stars.</p>

        <input
          id="person-name"
          ref={nameRef}
          className="answer"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder={people.length ? 'Someone else' : 'Their name'}
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
              With you since
            </span>
            <Choice group="arrival" checked={draft.arrival === 'birth'} onSelect={() => update({ arrival: 'birth' })}>
              birth
            </Choice>
            <Choice
              group="arrival"
              checked={draft.arrival === 'later'}
              onSelect={() => {
                update({ arrival: 'later' });
                focusSoon(joinRef);
              }}
            >
              age
            </Choice>
            {draft.arrival === 'later' && (
              <AgeInput
                inputRef={joinRef}
                value={draft.joinAge}
                onChange={(joinAge) => update({ joinAge })}
                label="Age they arrived"
              />
            )}
          </div>

          <div className="fact" role="radiogroup" aria-labelledby="fact-now">
            <span className="fact-label" id="fact-now">
              Now
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
                    label={`Age they ${ending.id === 'star' ? 'became a star' : 'drifted away'}`}
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
            {editingId ? 'Save' : 'Add'} <span aria-hidden="true">↵</span>
          </button>
          <button type="button" className="continue is-primary" onClick={begin}>
            {people.length || name ? 'Begin the journey' : 'Begin with just me'}
          </button>
        </div>

        {people.length > 0 && (
          <ul className="people-list" aria-label="People in your sky">
            {people.map((person) => (
              <li
                key={person.id}
                className={person.id === editingId ? 'person-chip is-editing' : 'person-chip'}
                style={{ '--person-color': person.color } as CSSProperties}
              >
                <button type="button" className="person-edit" onClick={() => edit(person)} aria-label={`Edit ${describe(person)}`}>
                  <span className="person-dot" aria-hidden="true" />
                  {person.name}
                  <span className="person-span" aria-hidden="true">
                    {lifeSpan(person)}
                  </span>
                </button>
                <button type="button" className="person-remove" onClick={() => remove(person)} aria-label={`Remove ${person.name}`}>
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
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      inputMode="numeric"
      maxLength={3}
      placeholder="00"
      aria-label={label}
    />
  );
}
