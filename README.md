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

## Play on your phone

Royal Flux is an installable web app (PWA). Pushes to the default branch build and deploy to GitHub Pages through `.github/workflows/pages.yml`, which needs **Settings → Pages → Source: GitHub Actions** turned on once.

- **iPhone / iPad (Safari):** open the site, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the site, then tap **Install app** (or menu ⋮ → **Add to Home screen**).

The installed app opens full screen, works offline after the first visit, and keeps its own save. On iPhone, the home-screen app has separate storage from Safari, so a run started in the browser doesn't carry over.

Icons are rendered from `public/icons/icon.svg` with `node scripts/make-icons.cjs`. The service worker is generated at build time in `vite.config.ts`, so every build precaches exactly the files it emits.

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
