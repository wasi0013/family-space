import { useState } from 'react';
import type { Person, Profile } from './model';
import { Scene } from './scene/Scene';
import { samplePeople } from './scene/samplePeople';
import { Onboarding } from './screens/Onboarding';
import { People } from './screens/People';
import { TitleScreen } from './screens/TitleScreen';
import { NightSky } from './sky/NightSky';
import { clearSky, loadSky, saveSky } from './storage';

type Phase = 'title' | 'onboarding' | 'people' | 'journey';

/** Name and age questions, then the people step. */
const ONBOARDING_STEPS = 3;

// Development shortcuts: `?demo` (or `?demo=45`) skips onboarding with a sample profile and
// people, `?age=14.5` opens the scene paused at that age, `?cast=crowd` swaps in a crowded
// sample life, and `?people` opens the people step.
// They never read or overwrite the saved sky.
const params = new URLSearchParams(window.location.search);
const DEMO_PROFILE: Profile | null =
  params.has('demo') || params.has('people')
    ? { name: 'Alex', age: Number(params.get('demo') || params.get('people')) || 32 }
    : null;
const SEEK_AGE = params.has('age') ? Number(params.get('age')) : undefined;
const SAVED = DEMO_PROFILE ? null : loadSky();

function initialPhase(): Phase {
  if (params.has('people')) return 'people';
  return params.has('demo') ? 'journey' : 'title';
}

export function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [profile, setProfile] = useState<Profile | null>(DEMO_PROFILE ?? SAVED?.profile ?? null);
  const [people, setPeople] = useState<Person[] | null>(() =>
    params.has('demo')
      ? samplePeople(DEMO_PROFILE!.age, params.get('cast') === 'crowd' ? 'crowd' : 'family')
      : (SAVED?.people ?? null),
  );
  const persist = (next: Profile, nextPeople: Person[] | null) => {
    if (!DEMO_PROFILE) saveSky({ profile: next, people: nextPeople });
  };

  return (
    <main className="app">
      <NightSky />
      {phase === 'title' && (
        <TitleScreen
          returning={profile !== null}
          // Resume wherever the saved sky left off.
          onStart={() => setPhase(!profile ? 'onboarding' : people ? 'journey' : 'people')}
          onStartOver={() => {
            clearSky();
            setProfile(null);
            setPeople(null);
            setPhase('onboarding');
          }}
        />
      )}
      {phase === 'onboarding' && (
        <Onboarding
          totalSteps={ONBOARDING_STEPS}
          onComplete={(answers) => {
            setProfile(answers);
            persist(answers, null);
            setPhase('people');
          }}
        />
      )}
      {phase === 'people' && profile && (
        <People
          profile={profile}
          initialPeople={people ?? []}
          // The step counter only belongs to first-time onboarding, not later edits.
          step={people ? undefined : ONBOARDING_STEPS}
          totalSteps={ONBOARDING_STEPS}
          onComplete={(added) => {
            setPeople(added);
            persist(profile, added);
            setPhase('journey');
          }}
        />
      )}
      {phase === 'journey' && profile && (
        <Scene
          profile={profile}
          people={people ?? []}
          initialAge={SEEK_AGE}
          onEditPeople={() => setPhase('people')}
        />
      )}
      {phase !== 'title' && <header className="brand">Family Space</header>}
    </main>
  );
}
