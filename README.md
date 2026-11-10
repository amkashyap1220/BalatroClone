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

## Controls

- **Click** cards to select them, and **drag** to reorder.
- **P**: play the hand. **D**: discard. **R** / **S**: sort by rank or suit.
- **1–9**: toggle cards. **Esc**: options.
- Hover anything to see its tooltip.

## Layout

- `src/engine/`: a pure, deterministic game engine using seeded RNG. It includes hands, scoring, run flow, shop, packs, consumables, progression and saves.
- `src/engine/content/`: data-driven content: charms, consumables, bosses, decks, challenges, boons, tokens, packs and heat levels.
- `src/ui/`: the React UI, made of screens, the game table, a scoring animation, and tooltips.
- `src/audio/`: synthesized SFX and generative music (Web Audio).
- `tests/`: unit, per-charm lifecycle, fuzz/bot and save/progression tests.

Add `?debug` to the URL to expose `window.__rf` for state inspection.
