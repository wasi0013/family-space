/**
 * An example life, shown from the title screen so anyone can see what a sky becomes before
 * writing their own: sixty-five years of family, from grandparents to grandchildren. "Make it
 * yours" starts a new sky from it, fitted to the visitor's age.
 */
import type { Lang } from './i18n';
import type { Bond, Moment, MomentKind, Person, Profile } from './model';

export const EXAMPLE_AGE = 65;

type Words = { en: string; bn: string };

interface ExamplePerson {
  id: string;
  name: Words;
  bond: Bond;
  joinAge: number;
  departAge: number | null;
  color: string;
  memory: Words;
}

interface ExampleMoment {
  id: string;
  title: Words;
  age: number;
  kind: MomentKind;
  note: Words;
}

const NAME: Words = { en: 'Alex', bn: 'রফিক' };

/**
 * The family, the friends who passed through, and the grandchildren still arriving, by role rather
 * than by name, so anyone can see themselves in it, and keep most of it when they make it theirs.
 */
const PEOPLE: ExamplePerson[] = [
  {
    id: 'grandma',
    name: { en: 'Grandma', bn: 'দাদি' },
    bond: 'permanent',
    joinAge: 0,
    departAge: 9,
    color: '#b7a6ff',
    memory: { en: 'Stories on the front porch every evening.', bn: 'প্রতি সন্ধ্যায় বারান্দায় বসে গল্প।' },
  },
  {
    id: 'grandpa',
    name: { en: 'Grandpa', bn: 'দাদা' },
    bond: 'permanent',
    joinAge: 0,
    departAge: 15,
    color: '#cfe9ff',
    memory: { en: 'Taught me to fish, and to wait.', bn: 'মাছ ধরতে শিখিয়েছিলেন, আর ধৈর্য ধরতে।' },
  },
  {
    id: 'dad',
    name: { en: 'Dad', bn: 'বাবা' },
    bond: 'permanent',
    joinAge: 0,
    departAge: 47,
    color: '#7ea6ff',
    memory: { en: 'Walked me to school every morning.', bn: 'প্রতিদিন সকালে হাত ধরে স্কুলে দিয়ে আসতেন।' },
  },
  {
    id: 'mom',
    name: { en: 'Mom', bn: 'মা' },
    bond: 'permanent',
    joinAge: 0,
    departAge: 58,
    color: '#ff8a7a',
    memory: { en: 'Her kitchen smelled of apple pie and Sundays.', bn: 'মায়ের রান্নাঘরে এলাচ আর শুক্রবারের গন্ধ।' },
  },
  {
    id: 'elder-brother',
    name: { en: 'Elder brother', bn: 'বড় ভাই' },
    bond: 'permanent',
    joinAge: 0,
    departAge: null,
    color: '#f0c8a0',
    memory: { en: 'Took the blame for my broken window.', bn: 'আমার ভাঙা জানালার দোষটা নিজের ঘাড়ে নিয়েছিল।' },
  },
  {
    id: 'younger-brother',
    name: { en: 'Younger brother', bn: 'ছোট ভাই' },
    bond: 'permanent',
    joinAge: 4,
    departAge: null,
    color: '#c8f08f',
    memory: { en: 'Followed me everywhere, and still my best friend.', bn: 'সবখানে আমার পিছু পিছু ঘুরত, এখনো সবচেয়ে কাছের বন্ধু।' },
  },
  {
    id: 'friend',
    name: { en: 'Best friend', bn: 'প্রাণের বন্ধু' },
    bond: 'temporary',
    joinAge: 7,
    departAge: 19,
    color: '#8ff0d2',
    memory: { en: 'Bikes, the river, summers without end.', bn: 'সাইকেল, নদী, আর শেষ না হওয়া ছুটির দুপুর।' },
  },
  {
    id: 'spouse',
    name: { en: 'Wife', bn: 'স্ত্রী' },
    bond: 'permanent',
    joinAge: 24,
    departAge: null,
    color: '#ff9fd0',
    memory: { en: 'Forty years on, and she still makes me laugh.', bn: 'চল্লিশ বছর পরেও সে আমাকে হাসায়।' },
  },
  {
    id: 'mentor',
    name: { en: 'Mentor', bn: 'কাজের গুরু' },
    bond: 'temporary',
    joinAge: 25,
    departAge: 40,
    color: '#9fe7ff',
    memory: { en: 'Gave me my first real chance.', bn: 'জীবনের প্রথম সত্যিকারের সুযোগটা তিনিই দিয়েছিলেন।' },
  },
  {
    id: 'daughter',
    name: { en: 'Daughter', bn: 'মেয়ে' },
    bond: 'permanent',
    joinAge: 30,
    departAge: null,
    color: '#ffd27a',
    memory: { en: 'A bedtime story every night until she was twelve.', bn: 'বারো বছর বয়স পর্যন্ত প্রতি রাতে ঘুমের আগে গল্প।' },
  },
  {
    id: 'son',
    name: { en: 'Son', bn: 'ছেলে' },
    bond: 'permanent',
    joinAge: 33,
    departAge: null,
    color: '#ffb48a',
    memory: { en: 'Saturday mornings at the lake, just the two of us.', bn: 'শুক্রবার সকালে পুকুরপাড়ে, শুধু আমরা দুজন।' },
  },
  {
    id: 'pet',
    name: { en: 'Our dog', bn: 'পোষা বিড়াল' },
    bond: 'permanent',
    joinAge: 36,
    departAge: 49,
    color: '#e3c6ff',
    memory: { en: 'Waited at the gate every evening.', bn: 'প্রতি সন্ধ্যায় দরজায় বসে অপেক্ষা করত।' },
  },
  {
    id: 'granddaughter',
    name: { en: 'Granddaughter', bn: 'নাতনি' },
    bond: 'permanent',
    joinAge: 57,
    departAge: null,
    color: '#ff9fb4',
    memory: { en: 'She thinks I hung the moon.', bn: 'ও ভাবে, চাঁদটা আমিই আকাশে টাঙিয়েছি।' },
  },
  {
    id: 'neighbor',
    name: { en: 'Neighbor', bn: 'প্রতিবেশী' },
    bond: 'temporary',
    joinAge: 60,
    departAge: null,
    color: '#a6c8ff',
    memory: { en: 'Morning walks, and all the news of the world.', bn: 'সকালের হাঁটা, আর দুনিয়ার সব খবর।' },
  },
  {
    id: 'grandson',
    name: { en: 'Grandson', bn: 'নাতি' },
    bond: 'permanent',
    joinAge: 61,
    departAge: null,
    color: '#9ff0a8',
    memory: { en: 'Learning to fly kites together.', bn: 'একসঙ্গে ঘুড়ি ওড়াতে শিখছি।' },
  },
];

/**
 * The moments, a few years apart so each can be read. Titles name roles, not people, so they
 * still read true once someone renames the people in their own sky.
 */
const MOMENTS: ExampleMoment[] = [
  {
    id: 'school',
    title: { en: 'Started school', bn: 'স্কুলে প্রথম দিন' },
    age: 6,
    kind: 'milestone',
    note: { en: 'A new bag, and Dad’s hand.', bn: 'নতুন ব্যাগ, আর বাবার হাত।' },
  },
  {
    id: 'city',
    title: { en: 'Moved to Chicago', bn: 'ঢাকায় চলে এলাম' },
    age: 18,
    kind: 'home',
    note: { en: 'For college; the first time away from home.', bn: 'বিশ্ববিদ্যালয়ের জন্য, প্রথমবার বাড়ি ছেড়ে।' },
  },
  {
    id: 'graduated',
    title: { en: 'Graduated', bn: 'স্নাতক পাস' },
    age: 22,
    kind: 'milestone',
    note: { en: 'Mom cried. Dad pretended not to.', bn: 'মা কেঁদেছিলেন। বাবা লুকিয়ে।' },
  },
  {
    id: 'married',
    title: { en: 'Got married', bn: 'বিয়ে' },
    age: 27,
    kind: 'love',
    note: { en: 'It rained all day. Nobody minded.', bn: 'সারাদিন বৃষ্টি। কারও মন খারাপ হয়নি।' },
  },
  {
    id: 'first-child',
    title: { en: 'Our first child', bn: 'প্রথম সন্তান' },
    age: 30,
    kind: 'love',
    note: { en: 'I didn’t sleep that night, and didn’t mind.', bn: 'সেই রাতে ঘুমাইনি, একটুও আফসোস নেই।' },
  },
  {
    id: 'house',
    title: { en: 'Our own home', bn: 'নিজেদের বাসা' },
    age: 34,
    kind: 'home',
    note: { en: 'A small garden, and room to grow.', bn: 'ছোট্ট একটা বাগান, আর বড় হওয়ার জায়গা।' },
  },
  {
    id: 'fishing',
    title: { en: 'Fishing with my son', bn: 'ছেলের সঙ্গে মাছ ধরা' },
    age: 39,
    kind: 'love',
    note: { en: 'We never caught much. We talked about everything.', bn: 'মাছ তেমন পাইনি। কথা হয়েছে সব কিছু নিয়ে।' },
  },
  {
    id: 'laid-off',
    title: { en: 'Lost my job', bn: 'চাকরি হারালাম' },
    age: 42,
    kind: 'hardship',
    note: { en: 'A hard year. The family kept us steady.', bn: 'কঠিন একটা বছর। পরিবারই সামলে রেখেছিল।' },
  },
  {
    id: 'workshop',
    title: { en: 'Opened my workshop', bn: 'নিজের দোকান খুললাম' },
    age: 45,
    kind: 'milestone',
    note: { en: 'My own name above the door.', bn: 'দরজার ওপরে নিজের নাম।' },
  },
  {
    id: 'daughter-wedding',
    title: { en: 'Our daughter’s wedding', bn: 'মেয়ের বিয়ে' },
    age: 52,
    kind: 'love',
    note: { en: 'I held it together until the last dance.', bn: 'বিদায়ের সময় চোখের পানি আটকাতে পারিনি।' },
  },
  {
    id: 'surgery',
    title: { en: 'Heart surgery', bn: 'হার্টের অপারেশন' },
    age: 55,
    kind: 'hardship',
    note: { en: 'A scare. Everyone came home.', bn: 'ভয়ের সময়। সবাই বাড়ি ফিরে এসেছিল।' },
  },
  {
    id: 'grandparent',
    title: { en: 'Became a grandparent', bn: 'প্রথম নাতনি' },
    age: 57,
    kind: 'love',
    note: { en: 'A tiny hand around my finger, and everything began again.', bn: 'আমার আঙুল ধরা ছোট্ট একটা হাত, সব যেন নতুন করে শুরু।' },
  },
  {
    id: 'retired',
    title: { en: 'Retired', bn: 'অবসর' },
    age: 60,
    kind: 'milestone',
    note: { en: 'Time, at last, for the people who matter.', bn: 'অবশেষে প্রিয় মানুষদের জন্য সময়।' },
  },
  {
    id: 'grandkids',
    title: { en: 'Summers with the grandkids', bn: 'নাতি-নাতনিদের সঙ্গে ছুটি' },
    age: 64,
    kind: 'love',
    note: { en: 'Fireflies, lemonade, and long afternoons.', bn: 'ঘুড়ি, আম, আর লম্বা দুপুর।' },
  },
];

export interface ExampleSky {
  profile: Profile;
  people: Person[];
  moments: Moment[];
}

/** The example life in one language, with its memories and notes for tapping on. */
export function exampleSky(lang: Lang): ExampleSky {
  return {
    profile: { name: NAME[lang], age: EXAMPLE_AGE },
    people: PEOPLE.map(({ name, memory, ...person }) => ({ ...person, name: name[lang], memory: memory[lang] })),
    moments: MOMENTS.map(({ title, note, ...moment }) => ({ ...moment, title: title[lang], note: note[lang] })),
  };
}

/**
 * A start for someone's own sky, taken from the example: only what fits within their years, with
 * anyone who left later than that still here, and without the example's own memories and notes.
 */
export function fitToAge(people: readonly Person[], moments: readonly Moment[], age: number): { people: Person[]; moments: Moment[] } {
  return {
    people: people
      .filter((p) => p.joinAge <= age)
      .map(({ memory: _, ...p }) => ({ ...p, departAge: p.departAge !== null && p.departAge > age ? null : p.departAge })),
    moments: moments.filter((m) => m.age <= age).map(({ note: _, ...m }) => m),
  };
}
