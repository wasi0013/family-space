import { useRef, useState } from 'react';
import { exampleSky, fitToAge } from './example';
import type { Moment, Person, Profile } from './model';
import { LANG, t } from './i18n';
import { Scene } from './scene/Scene';
import { sampleMoments, samplePeople } from './scene/samplePeople';
import { Moments } from './screens/Moments';
import { Onboarding } from './screens/Onboarding';
import { People } from './screens/People';
import { TitleScreen } from './screens/TitleScreen';
import { NightSky } from './sky/NightSky';
import { clearSky, loadSky, saveSky } from './storage';

/** The author's home, linked quietly from the footer of every screen. */
const HOME_URL = 'https://raisingthegiftedmind.com';

type Phase = 'title' | 'onboarding' | 'people' | 'moments' | 'journey';

/** Name and age questions, the people step, then the optional moments step. */
const ONBOARDING_STEPS = 4;

// Development shortcuts: `?demo` (or `?demo=45`) skips onboarding with a sample profile and
// people, `?age=14.5` opens the scene paused at that age, `?cast=crowd` swaps in a crowded
// sample life, and `?people` or `?moments` opens that step.
// They never read or overwrite the saved sky.
const params = new URLSearchParams(window.location.search);
/** `?example` opens the example life, as the title screen's link does, so it can be shared. */
const EXAMPLE_PARAM = 'example';
const DEMO_PROFILE: Profile | null =
  params.has('demo') || params.has('people') || params.has('moments')
    ? { name: LANG === 'bn' ? 'আলিফ' : 'Alex', age: Number(params.get('demo') || params.get('people') || params.get('moments')) || 32 }
    : null;
const SEEK_AGE = params.has('age') ? Number(params.get('age')) : undefined;
const SAVED = DEMO_PROFILE ? null : loadSky();
const EXAMPLE = !DEMO_PROFILE && params.has(EXAMPLE_PARAM) ? exampleSky(LANG) : null;

function initialPhase(): Phase {
  if (params.has('people')) return 'people';
  if (params.has('moments')) return 'moments';
  return params.has('demo') || EXAMPLE ? 'journey' : 'title';
}

/** Keeps `?example` in the address while the example plays, so a reload or a shared link shows it. */
function markExample(on: boolean) {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set(EXAMPLE_PARAM, '');
  else url.searchParams.delete(EXAMPLE_PARAM);
  // An empty value reads better as a bare `?example`.
  window.history.replaceState(null, '', url.href.replace(`${EXAMPLE_PARAM}=`, EXAMPLE_PARAM).replace(/[?&]$/, ''));
}

export function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const [profile, setProfile] = useState<Profile | null>(DEMO_PROFILE ?? EXAMPLE?.profile ?? SAVED?.profile ?? null);
  const [people, setPeople] = useState<Person[] | null>(() =>
    params.has('demo')
      ? samplePeople(DEMO_PROFILE!.age, params.get('cast') === 'crowd' ? 'crowd' : 'family', LANG)
      : (EXAMPLE?.people ?? SAVED?.people ?? null),
  );
  const [moments, setMoments] = useState<Moment[]>(() =>
    params.has('demo') ? sampleMoments(DEMO_PROFILE!.age, LANG) : (EXAMPLE?.moments ?? SAVED?.moments ?? []),
  );
  // While the example plays nothing is saved; edits to it last only until "Make it yours".
  const [example, setExample] = useState(EXAMPLE !== null);
  // The example's people and moments, offered as the start of a new sky once its age is known.
  const [template, setTemplate] = useState<{ people: Person[]; moments: Moment[] } | null>(null);
  // Where the moments step goes when it finishes: on into the journey for first-time onboarding.
  const [firstVisit, setFirstVisit] = useState(false);
  const persist = (next: Profile, nextPeople: Person[] | null, nextMoments: Moment[] = moments) => {
    if (!DEMO_PROFILE && !example) saveSky({ profile: next, people: nextPeople, moments: nextMoments });
  };

  const watchExample = () => {
    const sky = exampleSky(LANG);
    setProfile(sky.profile);
    setPeople(sky.people);
    setMoments(sky.moments);
    setExample(true);
    markExample(true);
    setPhase('journey');
  };

  const leaveExample = () => {
    const saved = loadSky();
    setProfile(saved?.profile ?? null);
    setPeople(saved?.people ?? null);
    setMoments(saved?.moments ?? []);
    setExample(false);
    markExample(false);
    setPhase('title');
  };

  // Their own sky begins with their name and age; the example's people and moments follow.
  const makeItYours = () => {
    setTemplate({ people: people ?? [], moments });
    setExample(false);
    markExample(false);
    setProfile(null);
    setPeople(null);
    setMoments([]);
    setPhase('onboarding');
  };

  return (
    <main className="app">
      <NightSky canvasRef={skyRef} />
      {phase === 'title' && (
        <TitleScreen
          returning={profile !== null}
          // Resume wherever the saved sky left off.
          onStart={() => setPhase(!profile ? 'onboarding' : people ? 'journey' : 'people')}
          onStartOver={() => {
            clearSky();
            setProfile(null);
            setPeople(null);
            setMoments([]);
            setPhase('onboarding');
          }}
          onExample={watchExample}
        />
      )}
      {phase === 'onboarding' && (
        <Onboarding
          totalSteps={ONBOARDING_STEPS}
          onComplete={(answers) => {
            const start = template && fitToAge(template.people, template.moments, answers.age);
            setTemplate(start);
            setProfile(answers);
            if (start) setMoments(start.moments);
            persist(answers, null, start?.moments);
            setFirstVisit(true);
            setPhase('people');
          }}
        />
      )}
      {phase === 'people' && profile && (
        <People
          profile={profile}
          initialPeople={people ?? template?.people ?? []}
          // The step counter only belongs to first-time onboarding, not later edits.
          step={people ? undefined : 3}
          totalSteps={ONBOARDING_STEPS}
          onComplete={(added) => {
            const first = people === null;
            setTemplate(null);
            setPeople(added);
            persist(profile, added);
            setFirstVisit(first);
            setPhase(first ? 'moments' : 'journey');
          }}
        />
      )}
      {phase === 'moments' && profile && (
        <Moments
          profile={profile}
          initialMoments={moments}
          step={firstVisit ? ONBOARDING_STEPS : undefined}
          totalSteps={ONBOARDING_STEPS}
          onComplete={(added) => {
            setMoments(added);
            persist(profile, people, added);
            setFirstVisit(false);
            setPhase('journey');
          }}
        />
      )}
      {phase === 'journey' && profile && (
        <Scene
          profile={profile}
          people={people ?? []}
          moments={moments}
          initialAge={SEEK_AGE}
          skyRef={skyRef}
          onEditPeople={() => setPhase('people')}
          onEditMoments={() => setPhase('moments')}
          onRemember={(id, memory) => {
            const next = (people ?? []).map((p) => (p.id === id ? { ...p, memory: memory || undefined } : p));
            setPeople(next);
            persist(profile, next);
          }}
          onNote={(id, note) => {
            const next = moments.map((m) => (m.id === id ? { ...m, note: note || undefined } : m));
            setMoments(next);
            persist(profile, people, next);
          }}
          onMakeItYours={example ? makeItYours : undefined}
          replacesSaved={SAVED !== null}
        />
      )}
      <footer className="footer">
        {phase !== 'title' &&
          (example ? (
            // From the example, the brand leads back to the title and any sky of your own.
            <button type="button" className="brand is-link" lang="en" onClick={leaveExample} aria-label={t.backToStart}>
              Family Space
            </button>
          ) : (
            <span className="brand" lang="en">
              Family Space
            </span>
          ))}
        <a className="credit" href={HOME_URL} target="_blank" rel="noopener" aria-label={t.creditLabel}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {/* An open book. */}
            <path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.8v12.6c3.6-.2 6.2.4 8 1.7 1.8-1.3 4.4-1.9 8-1.7V4.8c-3.6-.2-6.2.4-8 1.7Zm0 0v12.6" />
          </svg>
          <span className="credit-name" lang="en">
            Raising the Gifted Mind
          </span>
        </a>
      </footer>
    </main>
  );
}
