# Royal Flux

A poker roguelike deckbuilder. Play poker hands to score **chips × mult** and beat escalating blinds. Build your engine with Charms, Omens, Stars, Hexes, enhancements, editions and seals. Everything runs in the browser, with no backend.

## Run it

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm test             # 361 engine tests (Vitest)
npm run typecheck
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/
npm run preview      # serve the production build
```

## Play it

**Live at [royalflux.alexanderk.dev](https://royalflux.alexanderk.dev)**, and in the Lab on [alexanderk.dev](https://alexanderk.dev/lab/royal-flux).

Royal Flux is an installable web app (PWA):

- **iPhone / iPad (Safari):** open the site, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the site, then tap **Install app** (or menu ⋮ → **Add to Home screen**).

The installed app opens full screen, works offline after the first visit, and keeps its own save. On iPhone, the home-screen app has separate storage from Safari, so a run started in the browser doesn't carry over.

Icons are rendered from `public/icons/icon.svg` with `node scripts/make-icons.cjs`. The service worker is generated at build time in `vite.config.ts`, so every build precaches exactly the files it emits.

## Deploying

The game runs as a Cloudflare Worker named `royal-flux` with no script of its own: Cloudflare serves the built files in `dist/` (see `wrangler.jsonc`).

**Every push to the production branch deploys the site.** Cloudflare's [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) watches this repository, runs the tests, builds the game and deploys it. If a test fails, nothing is deployed. Pushes to other branches build a preview version.

### Setting it up from scratch

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick this repository. Set the production branch to this repo's default branch, leave the build command empty (`wrangler.jsonc` already runs the tests and the build), keep `npx wrangler deploy` as the deploy command, and add the build variable `NODE_VERSION` = `22`.
2. Open the `royal-flux` Worker, then **Settings → Domains & Routes → Add → Custom domain**, and enter `royalflux.alexanderk.dev`.

Or from a terminal: `npx wrangler login`, then `npm run deploy`.

## Controls

- **Click** cards to select them, and **drag** to reorder.
- **P**: play the hand. **D**: discard. **R** / **S**: sort by rank or suit.
- **1–9**: toggle cards. **Esc**: options.
- Hover anything to see its tooltip.
- On touch screens: **tap** to select, **long-press** anything to see its tooltip.

## Layout

- `src/engine/`: a pure, deterministic game engine using seeded RNG. It includes hands, scoring, run flow, shop, packs, consumables, progression and saves.
- `src/engine/content/`: data-driven content: charms, consumables, bosses, decks, challenges, boons, tokens, packs and heat levels.
- `src/ui/`: the React UI, made of screens, the game table, a scoring animation, and tooltips.
- `src/audio/`: synthesized SFX and generative music (Web Audio).
- `tests/`: unit, per-charm lifecycle, fuzz/bot and save/progression tests.

Add `?debug` to the URL to expose `window.__rf` for state inspection.
