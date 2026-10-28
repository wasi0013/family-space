import { KIND_GLYPH } from './glyphs';
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
  makeYourOwnSky: 'নিজের আকাশ তৈরি করুন',
  creditLabel: 'Raising the Gifted Mind, Family Space-এর পেছনের বই (নতুন ট্যাবে খুলবে)',

  tagline: 'আপনার জীবন, তারার আলোয় লেখা।',
  beginKeys: ['শুরু করতে', 'চাপুন'],
  returnKeys: ['আপনার আকাশে ফিরতে', 'চাপুন'],
  beginTouch: 'শুরু করতে ট্যাপ করুন',
  returnTouch: 'আপনার আকাশে ফিরতে ট্যাপ করুন',
  startOver: 'নতুন আকাশ শুরু করুন',
  startOverConfirm: 'আকাশটি মুছে ফেলবেন? নিশ্চিত করতে আবার চাপুন',
  seeExample: 'অথবা একটি উদাহরণ জীবন দেখুন',
  privacy: 'আপনার আকাশ এই ব্রাউজারেই থাকে। আপনি যা লেখেন, তা কোথাও পাঠানো হয় না।',
  makeItYours: 'নিজের মতো সাজান',
  makeItYoursConfirm: 'আগের আকাশ বদলাবেন?',
  backToStart: 'Family Space: শুরুতে ফিরে যান',
  openSkyFile: 'আকাশের ফাইল খুলুন',
  openProblem: (problem) => {
    switch (problem) {
      case 'tooLarge':
        return 'আকাশটি যেকোনো Family Space আকাশের চেয়ে অনেক বড়, তাই খোলা হয়নি।';
      case 'notSky':
        return 'এটি Family Space-এর কোনো আকাশ নয়।';
      case 'newer':
        return 'আকাশটি Family Space-এর নতুন সংস্করণ থেকে এসেছে। পেজটি রিলোড করে আবার চেষ্টা করুন।';
      case 'damaged':
        return 'আসার পথে আকাশটি নষ্ট হয়ে গেছে বলে মনে হচ্ছে, তাই খোলা হয়নি।';
      case 'oldBrowser':
        return 'এই ব্রাউজারটি পুরোনো, তাই শেয়ার করা আকাশ খুলতে পারে না। হালনাগাদ কোনো ব্রাউজারে খুলুন।';
    }
  },
  keepCopy: 'একটি কপি রাখুন',
  sharedWithYou: 'আপনার সাথে শেয়ার করা একটি আকাশ',
  sharedWords: 'এর লেখাগুলো যিনি পাঠিয়েছেন তাঁর, Family Space-এর নয়।',

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
  passingThrough: 'কিছুদিনের সঙ্গী',
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
  peopleFull: (max) => `একটি আকাশে সর্বোচ্চ ${num(max)} জন মানুষ রাখা যায়।`,
  lifeSpan: (p) => {
    const from = p.joinAge === 0 ? 'জন্ম' : num(p.joinAge);
    if (p.departAge === null) return `${from}–এখন${p.bond === 'temporary' ? ' ☄' : ''}`;
    return `${from}–${num(p.departAge)} ${p.bond === 'temporary' ? '↗' : '✦'}`;
  },
  describe: (p) => {
    const since = p.joinAge === 0 ? 'জন্ম থেকে সাথে' : `${num(p.joinAge)} বছর বয়স থেকে সাথে`;
    if (p.departAge === null) return `${p.name}, ${since}, ${p.bond === 'temporary' ? 'কিছুদিনের সঙ্গী' : 'এখনও আছেন'}`;
    return `${p.name}, ${since}, ${num(p.departAge)} বছর বয়সে ${p.bond === 'temporary' ? 'দূরে সরে গেছেন' : 'তারা হয়ে গেছেন'}`;
  },
  journeyLine: (p) => {
    if (p.departAge === null) {
      const since = p.joinAge === 0 ? 'জন্ম থেকে আপনার সাথে' : `${num(p.joinAge)} বছর বয়স থেকে আপনার সাথে`;
      return p.bond === 'temporary' ? `${since} · কিছুদিনের সঙ্গী` : since;
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
  skipBack: 'আগের মুহূর্ত, বা চেপে ধরে পেছনে যান',
  skipForward: 'পরের মুহূর্ত, বা চেপে ধরে দ্রুত সামনে যান',
  editPeople: 'মানুষেরা',
  hint: { pause: 'থামান', step: 'এক বছর করে', drag: 'সময়রেখা টেনে সময়ে ঘুরুন', remember: 'মনে করতে তারায় ক্লিক করুন' },
  touchHint: 'মনে করতে তারায় ট্যাপ করুন · সময়রেখা টেনে বছরগুলোতে যান',

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
  shareLink: 'লিংক শেয়ার করুন',
  shareLinkNote: 'লিংকটি যাঁর কাছে থাকবে, তিনিই আকাশটি দেখতে পারবেন',
  saveSkyFile: 'আকাশের ফাইল রাখুন',
  saveSkyFileNote: 'নিজের কাছে রাখার, বা অন্য কোথাও খোলার জন্য একটি কপি',
  skyFileSaved: 'আকাশের ফাইল সংরক্ষিত হয়েছে',
  shareWarning:
    'এই লিংক যাঁর কাছে থাকবে, তিনি আপনার আকাশের সব নাম ও বয়স দেখতে পারবেন। এটি এখনকার আকাশের একটি কপি: পরে কিছু বদলালে তা এতে পৌঁছাবে না, আর একবার পাঠালে ফিরিয়ে নেওয়া যায় না।',
  includeWords: 'স্মৃতি ও নোটগুলোও দিন',
  copyLink: 'লিংক কপি করুন',
  sendLink: 'লিংক শেয়ার করুন',
  linkCopied: 'লিংক কপি হয়েছে',
  linkSent: 'লিংক শেয়ার হয়েছে',
  copyThisLink: 'এই লিংকটি কপি করুন',
  cannotShare: 'এই আকাশের কিছু অংশ শেয়ার করা যাচ্ছে না',

  askMoments: 'কোন মুহূর্তগুলো আপনার আকাশ বদলে দিয়েছিল?',
  momentsLede: 'নতুন ঠিকানা, কোনো অর্জন, ভালোবাসা, কিংবা কঠিন একটি বছর।',
  optional: 'ঐচ্ছিক',
  momentTitlePlaceholder: 'ঢাকায় চলে এলাম',
  anotherMoment: 'আরও একটি মুহূর্ত',
  atAge: 'বয়স তখন',
  momentAgeLabel: 'তখন আপনার বয়স',
  momentKindLabel: 'কেমন মুহূর্ত',
  guessed: (kind) => `মনে হচ্ছে: ${bn.kind[kind]}`,
  enterToAddMoment: 'যোগ করতে এন্টার চাপুন',
  enterToSaveMoment: 'পরিবর্তন রাখতে এন্টার চাপুন',
  enterToFinish: 'শুরু করতে লাইন খালি রেখে এন্টার চাপুন',
  skipMoments: 'এখন থাক',
  momentsInSky: 'আপনার আকাশের মুহূর্তগুলো',
  editMoment: (title) => `সম্পাদনা করুন: ${title}`,
  removeMoment: (title) => `সরান: ${title}`,
  momentProblem: (problem) =>
    problem.kind === 'title'
      ? 'কী ঘটেছিল, কয়েকটি শব্দে লিখুন।'
      : `তখন আপনার বয়স কত ছিল, তা ${num(0)} থেকে ${num(problem.max)}-এর মধ্যে লিখুন।`,
  momentsFull: (max) => `একটি আকাশে সর্বোচ্চ ${num(max)}টি মুহূর্ত রাখা যায়।`,
  edit: 'সম্পাদনা',
  editMoments: 'মুহূর্তগুলো',
  done: 'শেষ',
  kind: { milestone: 'অর্জন', home: 'নতুন ঠিকানা', love: 'ভালোবাসা', hardship: 'কঠিন সময়' },
  momentLine: (m) => `${KIND_GLYPH[m.kind]} ${bn.kind[m.kind]} · ${num(m.age)} বছর বয়সে`,
  aboutMoment: (title) => `${title} — স্মৃতি`,
  momentNotePlaceholder: 'এই মুহূর্তটি নিয়ে এক লাইন…',
  editMomentNote: (title) => `${title} নিয়ে লেখা সম্পাদনা করুন`,
  addMomentNote: 'এক লাইন লিখুন…',

  remembering: (name) => `${objective(name)} স্মরণ`,
  close: 'বন্ধ করুন',
  memoryPlaceholder: (name) => `${possessive(name)} একটি স্মৃতি…`,
  keepMemory: 'রেখে দিন',
  removeMemory: 'মুছে দিন',
  addMemory: 'একটি স্মৃতি যোগ করুন…',
  editMemory: (name) => `${possessive(name)} স্মৃতি সম্পাদনা করুন`,
};
