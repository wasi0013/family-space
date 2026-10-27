import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SITE = 'https://familyspace.raisingthegiftedmind.com';

/** What changes in the page head for Bengali visitors; the app itself reads the language from the path. */
const BENGALI_HEAD: [string, string][] = [
  ['<html lang="en">', '<html lang="bn">'],
  ['Family Space · Your life, written in starlight', 'Family Space · আপনার জীবন, তারার আলোয় লেখা'],
  [
    'See your life as a solar system: the people who stayed, the ones who passed through like comets, and the ones who became stars.',
    'আপনার জীবনকে দেখুন একটি সৌরজগৎ হিসেবে: যাঁরা থেকে গেছেন, যাঁরা ধূমকেতুর মতো পাশ দিয়ে চলে গেছেন, আর যাঁরা তারা হয়ে গেছেন।',
  ],
  [`<link rel="canonical" href="${SITE}/" />`, `<link rel="canonical" href="${SITE}/bn/" />`],
  [`<meta property="og:url" content="${SITE}/" />`, `<meta property="og:url" content="${SITE}/bn/" />`],
  ['content="en_US"', 'content="bn_BD"'],
  ['/og-en.jpg', '/og-bn.jpg'],
  [
    "A glowing star at the centre of its family's orbits, beneath a night sky of memorial stars.",
    'পরিবারের কক্ষপথের মাঝে একটি উজ্জ্বল তারা, ওপরে স্মৃতির তারায় ভরা রাতের আকাশ।',
  ],
];

/** The example life's own page in a language: the same head, pointing at its own address. */
function exampleHead(home: string): [string, string][] {
  return [
    [`<link rel="canonical" href="${SITE}${home}" />`, `<link rel="canonical" href="${SITE}${home}example" />`],
    [`<meta property="og:url" content="${SITE}${home}" />`, `<meta property="og:url" content="${SITE}${home}example" />`],
  ];
}

/** Every page beyond the home page, with what changes in its head. */
const PAGES: { file: string; head: [string, string][] }[] = [
  { file: 'bn/index.html', head: BENGALI_HEAD },
  // Cloudflare Pages serves `example.html` at `/example`, so the example has a plain address.
  { file: 'example.html', head: exampleHead('/') },
  { file: 'bn/example.html', head: [...BENGALI_HEAD, ...exampleHead('/bn/')] },
];

/**
 * Writes the other pages next to `dist/index.html`: the same app, each with its own page head.
 * Link previews are read from the page without running the app, so `/bn/` is what makes Bengali
 * links preview in Bengali, and `/example` what gives the example its own address.
 */
function pages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const home = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      for (const { file, head } of PAGES) {
        let html = home;
        for (const [from, to] of head) {
          if (!html.includes(from)) throw new Error(`pages: missing "${from}" for ${file}`);
          html = html.split(from).join(to);
        }
        mkdirSync(dirname(resolve(outDir, file)), { recursive: true });
        writeFileSync(resolve(outDir, file), html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), pages()],
});
