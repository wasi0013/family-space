import type { Bond, Person } from '../model';

type Sample = [name: string, bond: Bond, join: number, depart: number | null, color: string];

/** Ages are fractions of the profile's age, so every kind of departure shows up at any age. */
const SAMPLES: Sample[] = [
  ['Grandma', 'permanent', 0, 0.25, '#b7a6ff'],
  ['Grandpa', 'permanent', 0, 0.45, '#cfe9ff'],
  ['Mom', 'permanent', 0, null, '#ff8a7a'],
  ['Dad', 'permanent', 0, 0.8, '#7ea6ff'],
  ['Sam', 'temporary', 0.15, 0.5, '#8ff0d2'],
  ['Biscuit', 'permanent', 0.6, 0.9, '#ffd27a'],
  ['Maya', 'temporary', 0.55, 0.75, '#ff9fd0'],
  ['Leo', 'permanent', 0.7, null, '#ffb48a'],
];

export function samplePeople(age: number): Person[] {
  return SAMPLES.map(([name, bond, join, depart, color]) => {
    const joinAge = Math.round(join * age);
    return {
      id: name.toLowerCase(),
      name,
      bond,
      joinAge,
      departAge: depart === null ? null : Math.max(joinAge + 1, Math.round(depart * age)),
      color,
    };
  });
}
