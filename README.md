# Family Space

Your life, written in starlight.

Family Space draws a life as a solar system. Your star sits at the centre and ages with you. The people who stay orbit it, the ones who pass through cross it as comets, and the ones who die rise into the sky and become stars. The moments that changed your life gather above as a constellation of their own, and a lifeline along the bottom carries you back and forth through the years.

**Try it:** [familyspace.raisingthegiftedmind.com](https://familyspace.raisingthegiftedmind.com), or watch [an example life](https://familyspace.raisingthegiftedmind.com/example) first. It also speaks Bengali at [/bn](https://familyspace.raisingthegiftedmind.com/bn/).

## Your data stays with you

There are no accounts and no backend. Everything you enter is saved in your browser's local storage and never sent anywhere. Recordings and images you export are made on your device too.

## What happens in the sky

- **Your star** follows a stellar life: blue-white in childhood, gold in its prime, then cooling and swelling into a red giant after 40 and toward a red supergiant like Betelgeuse by 100. Its colour comes from a blackbody temperature curve.
- **People who stay** settle into orbits that close ranks when someone leaves.
- **People who pass through** arrive as comets: a straight run in, a swing around your star, and a straight run out.
- **People who die** rise into the upper sky, burst as a nova and become a star there. Your own star dims and wavers for a while in grief.
- **Moments** change the sky as they play: a milestone flares your star, a new home turns the sky, love fills it with an aurora, and a hard time darkens it and draws everyone closer. Each moment's light rises from the lifeline to its own star in the sky.

Tap any star to read about it or to write a line of memory. The **Keep** menu records the journey as a video or saves a still image.

## Running it

You need Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm test
pnpm build    # static site in dist/
```

A few URL shortcuts help while developing. None of them read or overwrite a saved sky.

| URL | Opens |
| --- | --- |
| `/example` | The example life, as visitors see it |
| `/bn/`, `?lang=bn` | The app in Bengali |
| `?demo`, `?demo=45` | A sample life at age 32, or the age given |
| `?cast=crowd` | With `?demo`, a crowded early life |
| `?age=14.5` | The journey paused at that age |
| `?people`, `?moments` | That step of the questions |

## How it's built

React and TypeScript with Vite, drawing on two Canvas 2D layers: the night sky behind and the life scene in front, blended together. The scene is a pure function of age, so playing, scrubbing and recording all draw the same frame for the same year.

- `src/scene`: the solar system, its people and moments, the star's life (`stellar.ts`) and the lifeline
- `src/sky`: the night sky, painted once into layers; while it holds still, only the twinkling stars are redrawn
- `src/keep`: video recording and image export
- `src/screens`: the title and the questions
- `src/i18n`: every word the app shows, in English and Bengali

The site is static. `vite.config.ts` writes the extra pages (`/bn/`, `/example`) with their own link previews, and Cloudflare Pages serves the result.

## Languages

All text lives in `src/i18n`. To add a language, copy `en.ts` and translate it, add the language to `Lang` in `strings.ts` and to `STRINGS` in `index.ts`, and teach `pickLang` which link opens it.

## License

[MIT](LICENSE)
