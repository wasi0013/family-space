import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/**
 * Writes `dist/bn/index.html`: the same app, with a Bengali page head. Link previews are read
 * from the page without running the app, so `/bn/` is what makes Bengali links preview in Bengali.
 */
function bengaliPage(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bengali-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      let html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      for (const [english, bengali] of BENGALI_HEAD) {
        if (!html.includes(english)) throw new Error(`bengali-page: missing "${english}" in index.html`);
        html = html.split(english).join(bengali);
      }
      mkdirSync(resolve(outDir, 'bn'), { recursive: true });
      writeFileSync(resolve(outDir, 'bn', 'index.html'), html);
    },
  };
}

export default defineConfig({
  plugins: [react(), bengaliPage()],
});
