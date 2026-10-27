import { useMemo, useState } from 'react';
import type { Profile } from './model';
import { Scene } from './scene/Scene';
import { samplePeople } from './scene/samplePeople';
import { Onboarding } from './screens/Onboarding';
import { TitleScreen } from './screens/TitleScreen';
import { NightSky } from './sky/NightSky';

type Phase = 'title' | 'onboarding' | 'journey';

// Development shortcuts: `?demo` (or `?demo=45`) skips onboarding with a sample profile, and
// `?age=14.5` opens the scene paused at that age.
const params = new URLSearchParams(window.location.search);
const DEMO_PROFILE: Profile | null = params.has('demo')
  ? { name: 'Alex', age: Number(params.get('demo')) || 32 }
  : null;
const SEEK_AGE = params.has('age') ? Number(params.get('age')) : undefined;

export function App() {
  const [phase, setPhase] = useState<Phase>(DEMO_PROFILE ? 'journey' : 'title');
  const [profile, setProfile] = useState<Profile | null>(DEMO_PROFILE);
  // Sample people stand in until onboarding collects real ones.
  const people = useMemo(() => (profile ? samplePeople(profile.age) : []), [profile]);

  return (
    <main className="app">
      <NightSky />
      {phase === 'title' && <TitleScreen onStart={() => setPhase('onboarding')} />}
      {phase === 'onboarding' && (
        <Onboarding
          onComplete={(answers) => {
            setProfile(answers);
            setPhase('journey');
          }}
        />
      )}
      {phase === 'journey' && profile && <Scene profile={profile} people={people} initialAge={SEEK_AGE} />}
      {phase !== 'title' && <header className="brand">Family Space</header>}
    </main>
  );
}
