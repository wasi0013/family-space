import { useState, type FormEvent } from 'react';
import { t } from '../i18n';
import type { Profile } from '../model';
import { asciiDigits } from '../people';
import { PROFILE_NAME_MAX_LENGTH } from '../skyFile';

const STEPS = [
  {
    id: 'name',
    question: t.askName,
    placeholder: t.namePlaceholder,
    inputMode: 'text',
    autoComplete: 'given-name',
    maxLength: PROFILE_NAME_MAX_LENGTH,
  },
  {
    id: 'age',
    question: t.askAge,
    placeholder: t.agePlaceholder,
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 3,
  },
] as const;

type Answers = Record<(typeof STEPS)[number]['id'], string>;

function validate(id: keyof Answers, value: string): string {
  if (id === 'name') return value.trim() ? '' : t.nameMissing;
  const age = value === '' ? NaN : Number(value);
  return Number.isInteger(age) && age >= 1 && age <= 120 ? '' : t.ageInvalid;
}

interface OnboardingProps {
  /** Steps in the whole flow, when more follow these questions. */
  totalSteps?: number;
  onComplete: (profile: Profile) => void;
}

export function Onboarding({ totalSteps = STEPS.length, onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ name: '', age: '' });
  const [error, setError] = useState('');
  const step = STEPS[stepIndex];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validate(step.id, answers[step.id]);
    if (problem) {
      setError(problem);
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    onComplete({ name: answers.name.trim(), age: Number(answers.age) });
  };

  return (
    <section className="onboarding">
      <form key={step.id} className="question" onSubmit={submit} noValidate>
        <p className="question-count">
          {t.step(stepIndex + 1, totalSteps)}
        </p>
        <label className="question-text" htmlFor={`answer-${step.id}`}>
          {step.question}
        </label>
        <input
          id={`answer-${step.id}`}
          className="answer"
          // Ages are kept as ASCII digits but shown in the language's own, and either can be typed.
          value={step.id === 'age' ? t.num(answers.age) : answers.name}
          onChange={(event) => {
            const value = step.id === 'age' ? asciiDigits(event.target.value).replace(/\D/g, '') : event.target.value;
            setAnswers({ ...answers, [step.id]: value });
            setError('');
          }}
          placeholder={step.placeholder}
          inputMode={step.inputMode}
          autoComplete={step.autoComplete}
          maxLength={step.maxLength}
          spellCheck={false}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby="answer-error"
        />
        <p id="answer-error" className="answer-error" role="alert">
          {error}
        </p>
        <button type="submit" className="continue">
          {t.continue} <span aria-hidden="true">↵</span>
        </button>
        <p className="privacy-note is-inline">{t.privacy}</p>
      </form>
    </section>
  );
}
