import { KIND_GLYPH } from './glyphs';
import type { Strings } from './strings';

export const en: Strings = {
  lang: 'en',
  num: (n) => String(n),
  keys: { space: 'Space', enter: 'Enter' },
  makeYourOwnSky: 'Make your own sky',
  creditLabel: 'Raising the Gifted Mind, the book behind Family Space (opens in a new tab)',

  tagline: 'Your life, written in starlight.',
  beginKeys: ['Press', 'to begin'],
  returnKeys: ['Press', 'to return to your sky'],
  beginTouch: 'Tap to begin',
  returnTouch: 'Tap to return to your sky',
  startOver: 'Start a new sky',
  startOverConfirm: 'Erase your sky? Once more to confirm',
  seeExample: 'Or watch an example life',
  privacy: 'Your sky stays in this browser. Nothing you enter is sent anywhere.',
  makeItYours: 'Make it yours',
  makeItYoursConfirm: 'Replace your sky?',
  backToStart: 'Family Space: back to the start',
  openSkyFile: 'Open a sky file',
  openProblem: (problem) => {
    switch (problem) {
      case 'tooLarge':
        return 'That sky is far larger than any Family Space sky, so it wasn’t opened.';
      case 'notSky':
        return 'That isn’t a Family Space sky.';
      case 'newer':
        return 'That sky comes from a newer Family Space. Reload the page and try again.';
      case 'damaged':
        return 'That sky seems to have been damaged on its way here, so it wasn’t opened.';
      case 'oldBrowser':
        return 'This browser is too old to open a shared sky. An up-to-date browser can.';
    }
  },
  keepCopy: 'Keep a copy',
  sharedWithYou: 'A sky shared with you',
  sharedWords: 'Its words are the sender’s, not Family Space’s.',

  step: (n, total) => `${n} / ${total}`,
  askName: 'What should we call you?',
  namePlaceholder: 'Your name',
  nameMissing: 'Tell us a name to write in the stars.',
  askAge: 'How many years have you lived?',
  agePlaceholder: 'Your age',
  ageInvalid: 'Enter an age between 1 and 120.',
  continue: 'Continue',

  askPeople: 'Who has shared your journey?',
  peopleLede: 'Some stay. Some drift away. Some become stars.',
  theirName: 'Their name',
  someoneElse: 'Someone else',
  since: 'With you since',
  birth: 'birth',
  age: 'age',
  arrivedAgeLabel: 'Age they arrived',
  now: 'Now',
  stillHere: 'still here',
  passingThrough: 'passing through',
  driftedAt: 'drifted away at',
  starAt: 'became a star at',
  leftAgeLabel: (ending) => `Age they ${ending === 'star' ? 'became a star' : 'drifted away'}`,
  enterToAdd: (name) => `Press Enter to add ${name}`,
  enterToSave: (name) => `Press Enter to save ${name}`,
  enterToBegin: 'Press Enter on an empty name to begin',
  add: 'Add',
  save: 'Save',
  beginJourney: 'Begin the journey',
  beginAlone: 'Begin with just me',
  peopleInSky: 'People in your sky',
  editPerson: (sentence) => `Edit ${sentence}`,
  removePerson: (name) => `Remove ${name}`,
  problem: (problem) => {
    switch (problem.kind) {
      case 'name':
        return 'Give them a name.';
      case 'arrival':
        return `Enter the age they arrived, from 0 to ${problem.max}.`;
      case 'tooRecent':
        return `They arrived at ${problem.joinAge}, so they can only still be here.`;
      case 'departure':
        return `Enter the age they ${problem.ending === 'star' ? 'became a star' : 'drifted away'}, from ${problem.from} to ${problem.max}.`;
    }
  },
  peopleFull: (max) => `A sky holds up to ${max} people.`,
  lifeSpan: (p) => {
    const from = p.joinAge === 0 ? 'birth' : p.joinAge;
    if (p.departAge === null) return `${from}–now${p.bond === 'temporary' ? ' ☄' : ''}`;
    return `${from}–${p.departAge} ${p.bond === 'temporary' ? '↗' : '✦'}`;
  },
  describe: (p) => {
    const since = p.joinAge === 0 ? 'since birth' : `since you were ${p.joinAge}`;
    if (p.departAge === null) return `${p.name}, with you ${since}, ${p.bond === 'temporary' ? 'passing through' : 'still here'}`;
    return `${p.name}, with you ${since}, ${p.bond === 'temporary' ? 'drifted away' : 'became a star'} at ${p.departAge}`;
  },
  journeyLine: (p) => {
    if (p.departAge === null) {
      if (p.bond === 'temporary') return p.joinAge === 0 ? 'Passing through, since birth' : `Passing through, since you were ${p.joinAge}`;
      return p.joinAge === 0 ? 'With you since birth' : `With you since you were ${p.joinAge}`;
    }
    const span = p.joinAge === 0 ? `From birth until ${p.departAge}` : `From ${p.joinAge} until ${p.departAge}`;
    return `${span} · ${p.bond === 'temporary' ? 'drifted away' : 'now a star'}`;
  },

  ageCaption: (name) => `${name} · age`,
  play: 'Play',
  pause: 'Pause',
  skipBack: 'Previous moment, or hold to rewind',
  skipForward: 'Next moment, or hold to fast-forward',
  editPeople: 'People',
  hint: { pause: 'pause', step: 'step a year', drag: 'drag the timeline to travel', remember: 'click a star to remember' },
  touchHint: 'Tap a star to remember · Drag the timeline through the years',

  keep: 'Keep',
  recordJourney: 'Record your journey',
  recordJourneyNote: 'A video from your first light to today',
  saveMoment: 'Save this moment',
  saveMomentNote: 'An image of your sky as it is now',
  recording: 'Recording your journey',
  stop: 'Stop',
  journeySaved: 'Your journey was saved',
  journeyReady: 'Your journey is ready to share',
  imageSaved: 'Image saved',
  imageReady: 'Ready to share',
  savingImage: 'Saving this moment…',
  imageFailed: 'Couldn’t save the image',
  cannotRecord: 'This browser can’t record video',
  shareLink: 'Share a link',
  shareLinkNote: 'Anyone with it can watch this sky',
  saveSkyFile: 'Save the sky file',
  saveSkyFileNote: 'A copy to keep, or to open elsewhere',
  skyFileSaved: 'Sky file saved',
  shareWarning:
    'Anyone with this link can see every name and age in your sky. It’s a copy of the sky as it is now: later changes won’t reach it, and once sent it can’t be taken back.',
  includeWords: 'Include memories and notes',
  copyLink: 'Copy link',
  sendLink: 'Share link',
  linkCopied: 'Link copied',
  linkSent: 'Link shared',
  copyThisLink: 'Copy this link',
  cannotShare: 'Something in this sky can’t be shared',

  askMoments: 'Which moments changed your sky?',
  momentsLede: 'A move, a milestone, a love, a hard year.',
  optional: 'Optional',
  momentTitlePlaceholder: 'Moved to Chicago',
  anotherMoment: 'Another moment',
  atAge: 'At age',
  momentAgeLabel: 'Your age then',
  momentKindLabel: 'What kind of moment',
  guessed: (kind) => `Looks like ${en.kind[kind].toLowerCase()}`,
  enterToAddMoment: 'Press Enter to add it',
  enterToSaveMoment: 'Press Enter to save it',
  enterToFinish: 'Press Enter on an empty line to begin',
  skipMoments: 'Skip for now',
  momentsInSky: 'Moments in your sky',
  editMoment: (title) => `Edit ${title}`,
  removeMoment: (title) => `Remove ${title}`,
  momentProblem: (problem) =>
    problem.kind === 'title' ? 'Say what happened in a few words.' : `Enter your age then, from 0 to ${problem.max}.`,
  momentsFull: (max) => `A sky holds up to ${max} moments.`,
  edit: 'Edit',
  editMoments: 'Moments',
  done: 'Done',
  kind: { milestone: 'Milestone', home: 'New home', love: 'Love', hardship: 'Hard time' },
  momentLine: (m) => `${KIND_GLYPH[m.kind]} ${en.kind[m.kind]} · age ${m.age}`,
  aboutMoment: (title) => `About ${title}`,
  momentNotePlaceholder: 'A line about this moment…',
  editMomentNote: (title) => `Edit the note about ${title}`,
  addMomentNote: 'Add a note…',

  remembering: (name) => `Remembering ${name}`,
  close: 'Close',
  memoryPlaceholder: (name) => `A memory of ${name}…`,
  keepMemory: 'Keep it',
  removeMemory: 'Remove',
  addMemory: 'Add a memory…',
  editMemory: (name) => `Edit the memory of ${name}`,
};
