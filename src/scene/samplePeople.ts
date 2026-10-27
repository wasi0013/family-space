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

/** A crowded early life: many elders become stars before a few late arrivals settle in. */
const CROWD: Sample[] = [
  ['Great-grandma', 'permanent', 0, 0.06, '#b7a6ff'],
  ['Great-grandpa', 'permanent', 0, 0.1, '#cfe9ff'],
  ['Nana', 'permanent', 0, 0.16, '#ff9fd0'],
  ['Pop', 'permanent', 0, 0.22, '#9fe7ff'],
  ['Uncle Ray', 'permanent', 0, 0.28, '#c8f08f'],
  ['Aunt June', 'permanent', 0, 0.34, '#ffb48a'],
  ['Grandma', 'permanent', 0, 0.4, '#e3c6ff'],
  ['Grandpa', 'permanent', 0, 0.46, '#a6c8ff'],
  ['Uncle Tom', 'permanent', 0, 0.52, '#8ff0d2'],
  ['Aunt May', 'permanent', 0, 0.58, '#ffd27a'],
  ['Mom', 'permanent', 0, null, '#ff8a7a'],
  ['Leo', 'permanent', 0.7, null, '#ffc38a'],
  ['Nora', 'permanent', 0.85, null, '#ff9fb4'],
  ['Theo', 'permanent', 0.92, null, '#7ea6ff'],
];

export type Cast = 'family' | 'crowd';

export function samplePeople(age: number, cast: Cast = 'family'): Person[] {
  return (cast === 'crowd' ? CROWD : SAMPLES).map(([name, bond, join, depart, color]) => {
    const joinAge = Math.round(join * age);
    return {
      id: name.toLowerCase().replace(/\W+/g, '-'),
      name,
      bond,
      joinAge,
      departAge: depart === null ? null : Math.max(joinAge + 1, Math.round(depart * age)),
      color,
    };
  });
}
