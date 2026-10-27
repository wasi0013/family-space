import type { Strings } from './strings';

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';
const num = (n: number | string) => String(n).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);

const ENDS_IN_BENGALI = /[ঀ-৿]$/;
/** Independent vowels and vowel signs: names ending in one take "-র" rather than "-ের". */
const ENDS_IN_VOWEL = /[অ-ঔা-ৌৗ]$/;

/** "মা" → "মাকে", "রহিম" → "রহিমকে"; names in other scripts take a hyphen: "Alex-কে". */
export function objective(name: string): string {
  return ENDS_IN_BENGALI.test(name) ? `${name}কে` : `${name}-কে`;
}

/** "মা" → "মার", "রহিম" → "রহিমের"; names in other scripts take a hyphen: "Alex-এর". */
export function possessive(name: string): string {
  if (!ENDS_IN_BENGALI.test(name)) return `${name}-এর`;
  return ENDS_IN_VOWEL.test(name) ? `${name}র` : `${name}ের`;
}

const left = (ending: 'drifted' | 'star') => (ending === 'star' ? 'তারা হয়ে গেছেন' : 'দূরে সরে গেছেন');

export const bn: Strings = {
  lang: 'bn',
  num,
  keys: { space: 'স্পেস', enter: 'এন্টার' },

  tagline: 'আপনার জীবন, তারার আলোয় লেখা।',
  beginKeys: ['শুরু করতে', 'চাপুন'],
  returnKeys: ['আপনার আকাশে ফিরতে', 'চাপুন'],
  beginTouch: 'শুরু করতে ট্যাপ করুন',
  returnTouch: 'আপনার আকাশে ফিরতে ট্যাপ করুন',
  startOver: 'নতুন আকাশ শুরু করুন',
  startOverConfirm: 'আকাশটি মুছে ফেলবেন? নিশ্চিত করতে আবার চাপুন',

  step: (n, total) => `${num(n)} / ${num(total)}`,
  askName: 'আপনাকে কী নামে ডাকব?',
  namePlaceholder: 'আপনার নাম',
  nameMissing: 'তারায় লেখার জন্য একটি নাম দিন।',
  askAge: 'কত বছরের পথ পেরিয়ে এলেন?',
  agePlaceholder: 'আপনার বয়স',
  ageInvalid: `${num(1)} থেকে ${num(120)}-এর মধ্যে বয়স লিখুন।`,
  continue: 'এগিয়ে যান',

  askPeople: 'আপনার যাত্রায় কারা সঙ্গী ছিলেন?',
  peopleLede: 'কেউ থেকে যান। কেউ দূরে সরে যান। কেউ তারা হয়ে যান।',
  theirName: 'তাঁর নাম',
  someoneElse: 'আরও একজন',
  since: 'কবে থেকে',
  birth: 'জন্ম থেকে',
  age: 'বয়স',
  arrivedAgeLabel: 'কত বছর বয়স থেকে সাথে আছেন',
  now: 'এখন',
  stillHere: 'এখনও আছেন',
  driftedAt: 'দূরে সরে গেছেন, বয়স',
  starAt: 'তারা হয়ে গেছেন, বয়স',
  leftAgeLabel: (ending) => `কত বছর বয়সে ${left(ending)}`,
  enterToAdd: (name) => `${objective(name)} যোগ করতে এন্টার চাপুন`,
  enterToSave: (name) => `${possessive(name)} পরিবর্তন রাখতে এন্টার চাপুন`,
  enterToBegin: 'যাত্রা শুরু করতে নাম খালি রেখে এন্টার চাপুন',
  add: 'যোগ করুন',
  save: 'রাখুন',
  beginJourney: 'যাত্রা শুরু করুন',
  beginAlone: 'শুধু আমাকে নিয়ে শুরু করুন',
  peopleInSky: 'আপনার আকাশের মানুষেরা',
  editPerson: (sentence) => `সম্পাদনা করুন: ${sentence}`,
  removePerson: (name) => `${objective(name)} সরান`,
  problem: (problem) => {
    switch (problem.kind) {
      case 'name':
        return 'একটি নাম দিন।';
      case 'arrival':
        return `কত বছর বয়স থেকে সাথে আছেন, তা ${num(0)} থেকে ${num(problem.max)}-এর মধ্যে লিখুন।`;
      case 'tooRecent':
        return `${num(problem.joinAge)} বছর বয়সে এসেছেন, তাই তিনি এখনও সাথেই আছেন।`;
      case 'departure':
        return `কত বছর বয়সে ${left(problem.ending)}, তা ${num(problem.from)} থেকে ${num(problem.max)}-এর মধ্যে লিখুন।`;
    }
  },
  lifeSpan: (p) => {
    const from = p.joinAge === 0 ? 'জন্ম' : num(p.joinAge);
    if (p.departAge === null) return `${from}–এখন`;
    return `${from}–${num(p.departAge)} ${p.bond === 'temporary' ? '↗' : '✦'}`;
  },
  describe: (p) => {
    const since = p.joinAge === 0 ? 'জন্ম থেকে সাথে' : `${num(p.joinAge)} বছর বয়স থেকে সাথে`;
    if (p.departAge === null) return `${p.name}, ${since}, এখনও আছেন`;
    return `${p.name}, ${since}, ${num(p.departAge)} বছর বয়সে ${p.bond === 'temporary' ? 'দূরে সরে গেছেন' : 'তারা হয়ে গেছেন'}`;
  },
  journeyLine: (p) => {
    if (p.departAge === null) {
      return p.joinAge === 0 ? 'জন্ম থেকে আপনার সাথে' : `${num(p.joinAge)} বছর বয়স থেকে আপনার সাথে`;
    }
    const span =
      p.joinAge === 0
        ? `জন্ম থেকে ${num(p.departAge)} বছর বয়স পর্যন্ত`
        : `${num(p.joinAge)} থেকে ${num(p.departAge)} বছর বয়স পর্যন্ত`;
    return `${span} · ${p.bond === 'temporary' ? 'দূরে সরে গেছেন' : 'এখন একটি তারা'}`;
  },

  ageCaption: (name) => `${name} · বয়স`,
  play: 'চালান',
  pause: 'থামান',
  editPeople: 'মানুষদের সম্পাদনা',
  hint: { pause: 'থামান', step: 'এক বছর করে', drag: 'টেনে সময়ে ঘুরুন', remember: 'মনে করতে তারায় ক্লিক করুন' },
  touchHint: 'মনে করতে তারায় ট্যাপ করুন · বছরগুলোর মধ্যে টেনে যান',

  keep: 'রেখে দিন',
  recordJourney: 'আপনার যাত্রা রেকর্ড করুন',
  recordJourneyNote: 'প্রথম আলো থেকে আজ পর্যন্ত একটি ভিডিও',
  saveMoment: 'এই মুহূর্তটি রাখুন',
  saveMomentNote: 'এখনকার আকাশের একটি ছবি',
  recording: 'আপনার যাত্রা রেকর্ড হচ্ছে',
  stop: 'থামান',
  journeySaved: 'আপনার যাত্রা সংরক্ষিত হয়েছে',
  journeyReady: 'আপনার যাত্রা শেয়ার করার জন্য প্রস্তুত',
  imageSaved: 'ছবিটি সংরক্ষিত হয়েছে',
  imageReady: 'শেয়ার করার জন্য প্রস্তুত',
  savingImage: 'মুহূর্তটি সংরক্ষণ হচ্ছে…',
  imageFailed: 'ছবিটি সংরক্ষণ করা যায়নি',
  cannotRecord: 'এই ব্রাউজারে ভিডিও রেকর্ড করা যায় না',

  remembering: (name) => `${objective(name)} স্মরণ`,
  close: 'বন্ধ করুন',
  memoryPlaceholder: (name) => `${possessive(name)} একটি স্মৃতি…`,
  keepMemory: 'রেখে দিন',
  removeMemory: 'মুছে দিন',
  addMemory: 'একটি স্মৃতি যোগ করুন…',
  editMemory: (name) => `${possessive(name)} স্মৃতি সম্পাদনা করুন`,
};
