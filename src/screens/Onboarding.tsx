import { useState, type FormEvent } from 'react';
import type { Profile } from '../model';

const STEPS = [
  {
    id: 'name',
    question: 'What should we call you?',
    placeholder: 'Your name',
    inputMode: 'text',
    autoComplete: 'given-name',
    maxLength: 40,
  },
  {
    id: 'age',
    question: 'How many years have you lived?',
    placeholder: 'Your age',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 3,
  },
] as const;

type Answers = Record<(typeof STEPS)[number]['id'], string>;

function validate(id: keyof Answers, value: string): string {
  if (id === 'name') return value.trim() ? '' : 'Tell us a name to write in the stars.';
  const age = Number(value);
  return Number.isInteger(age) && age >= 1 && age <= 120 ? '' : 'Enter an age between 1 and 120.';
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
          {stepIndex + 1} / {totalSteps}
        </p>
        <label className="question-text" htmlFor={`answer-${step.id}`}>
          {step.question}
        </label>
        <input
          id={`answer-${step.id}`}
          className="answer"
          value={answers[step.id]}
          onChange={(event) => {
            setAnswers({ ...answers, [step.id]: event.target.value });
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
          Continue <span aria-hidden="true">↵</span>
        </button>
      </form>
    </section>
  );
}
