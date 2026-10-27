import { useState } from 'react';
import type { Person, Profile } from './model';
import { Scene } from './scene/Scene';
import { samplePeople } from './scene/samplePeople';
import { Onboarding } from './screens/Onboarding';
import { People } from './screens/People';
import { TitleScreen } from './screens/TitleScreen';
import { NightSky } from './sky/NightSky';

type Phase = 'title' | 'onboarding' | 'people' | 'journey';

/** Name and age questions, then the people step. */
const ONBOARDING_STEPS = 3;

// Development shortcuts: `?demo` (or `?demo=45`) skips onboarding with a sample profile and
// people, `?age=14.5` opens the scene paused at that age, and `?people` opens the people step.
const params = new URLSearchParams(window.location.search);
const DEMO_PROFILE: Profile | null =
  params.has('demo') || params.has('people')
    ? { name: 'Alex', age: Number(params.get('demo') || params.get('people')) || 32 }
    : null;
const SEEK_AGE = params.has('age') ? Number(params.get('age')) : undefined;

function initialPhase(): Phase {
  if (params.has('people')) return 'people';
  return DEMO_PROFILE ? 'journey' : 'title';
}

export function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [profile, setProfile] = useState<Profile | null>(DEMO_PROFILE);
  const [people, setPeople] = useState<Person[]>(() =>
    DEMO_PROFILE && params.has('demo') ? samplePeople(DEMO_PROFILE.age) : [],
  );

  return (
    <main className="app">
      <NightSky />
      {phase === 'title' && <TitleScreen onStart={() => setPhase('onboarding')} />}
      {phase === 'onboarding' && (
        <Onboarding
          totalSteps={ONBOARDING_STEPS}
          onComplete={(answers) => {
            setProfile(answers);
            setPhase('people');
          }}
        />
      )}
      {phase === 'people' && profile && (
        <People
          profile={profile}
          step={ONBOARDING_STEPS}
          totalSteps={ONBOARDING_STEPS}
          onComplete={(added) => {
            setPeople(added);
            setPhase('journey');
          }}
        />
      )}
      {phase === 'journey' && profile && <Scene profile={profile} people={people} initialAge={SEEK_AGE} />}
      {phase !== 'title' && <header className="brand">Family Space</header>}
    </main>
  );
}
