import type { Moment, MomentKind, Person } from '../model';
import type { MomentProblem } from '../moments';
import type { DraftProblem } from '../people';

export type Lang = 'en' | 'bn';

/**
 * Every word the app shows, in one language. Phrases that wrap a key cap are split around it:
 * `[before, after]` renders as "before <kbd>key</kbd> after".
 */
export interface Strings {
  lang: Lang;
  /** Writes a number, or a string of digits, with this language's digits. */
  num: (n: number | string) => string;
  keys: { space: string; enter: string };

  tagline: string;
  beginKeys: [string, string];
  returnKeys: [string, string];
  beginTouch: string;
  returnTouch: string;
  startOver: string;
  startOverConfirm: string;

  step: (n: number, total: number) => string;
  askName: string;
  namePlaceholder: string;
  nameMissing: string;
  askAge: string;
  agePlaceholder: string;
  ageInvalid: string;
  continue: string;

  askPeople: string;
  peopleLede: string;
  theirName: string;
  someoneElse: string;
  since: string;
  birth: string;
  age: string;
  arrivedAgeLabel: string;
  now: string;
  stillHere: string;
  driftedAt: string;
  starAt: string;
  leftAgeLabel: (ending: 'drifted' | 'star') => string;
  enterToAdd: (name: string) => string;
  enterToSave: (name: string) => string;
  enterToBegin: string;
  add: string;
  save: string;
  beginJourney: string;
  beginAlone: string;
  peopleInSky: string;
  editPerson: (sentence: string) => string;
  removePerson: (name: string) => string;
  problem: (problem: DraftProblem) => string;
  /** Short span for the chips, such as "birth–8 ✦". */
  lifeSpan: (person: Person) => string;
  /** A full sentence about someone, for screen readers. */
  describe: (person: Person) => string;
  /** Someone's place in your life, as the memory card says it. */
  journeyLine: (person: Person) => string;

  ageCaption: (name: string) => string;
  play: string;
  pause: string;
  editPeople: string;
  hint: { pause: string; step: string; drag: string; remember: string };
  touchHint: string;

  keep: string;
  recordJourney: string;
  recordJourneyNote: string;
  saveMoment: string;
  saveMomentNote: string;
  recording: string;
  stop: string;
  journeySaved: string;
  journeyReady: string;
  imageSaved: string;
  imageReady: string;
  savingImage: string;
  imageFailed: string;
  cannotRecord: string;

  askMoments: string;
  momentsLede: string;
  optional: string;
  momentTitlePlaceholder: string;
  anotherMoment: string;
  atAge: string;
  momentAgeLabel: string;
  momentKindLabel: string;
  /** "“moved” suggested New home", shown when a word in the title picked the kind. */
  guessed: (kind: MomentKind) => string;
  enterToAddMoment: string;
  enterToSaveMoment: string;
  enterToFinish: string;
  skipMoments: string;
  momentsInSky: string;
  editMoment: (title: string) => string;
  removeMoment: (title: string) => string;
  momentProblem: (problem: MomentProblem) => string;
  edit: string;
  editMoments: string;
  done: string;
  kind: Record<MomentKind, string>;
  /** A moment's kind and age, as its card says it: "✦ Milestone · age 22". */
  momentLine: (moment: Moment) => string;
  aboutMoment: (title: string) => string;
  momentNotePlaceholder: string;
  editMomentNote: (title: string) => string;
  addMomentNote: string;

  remembering: (name: string) => string;
  close: string;
  memoryPlaceholder: (name: string) => string;
  keepMemory: string;
  removeMemory: string;
  addMemory: string;
  editMemory: (name: string) => string;
}
