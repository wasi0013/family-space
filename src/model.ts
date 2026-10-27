export interface Profile {
  name: string;
  /** Current age in years; the journey runs from 0 to here. */
  age: number;
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
}
