export interface Profile {
  name: string;
  /** Current age in years; the journey runs from 0 to here. */
  age: number;
}

/** What kind of moment it was, which decides how the sky shows it. */
export type MomentKind = 'milestone' | 'home' | 'love' | 'hardship';

/** Something that changed the person's sky at one age, such as a move or a graduation. */
export interface Moment {
  id: string;
  title: string;
  age: number;
  kind: MomentKind;
  /** One line about it, written by the profile owner. */
  note?: string;
}

/** Temporary people pass through a life; permanent ones stay in memory as stars when they go. */
export type Bond = 'temporary' | 'permanent';

export interface Person {
  id: string;
  name: string;
  bond: Bond;
  /** The profile owner's age when this person arrived. */
  joinAge: number;
  /** The profile owner's age when this person left, or null while they are still here. */
  departAge: number | null;
  /** Hex color for their light and label. */
  color: string;
  /** One line remembering them, written by the profile owner. */
  memory?: string;
}
