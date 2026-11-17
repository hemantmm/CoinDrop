# The Impossible Vending Machine

A virtual vending machine that dispenses things that should not exist. Insert a coin and receive one of five objects: a memory you have not lived, a sound from an imaginary planet, a tiny animated creature, a letter from your future self, or five seconds of an alternate reality.

Every object is generated from a seed. The same seed always produces the same object, so a link can be shared and opened on another machine.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173/.

```bash
npm run build
npm run preview
```

`build` typechecks, then writes a static site to `dist/`. There is no server and no API key. Audio, prose, creatures, and the five-second realities all run in the browser.

## How a pull works

1. **Insert coin.** The click unlocks audio and creates a seed.
2. The coil turns and a capsule drops onto the plinth.
3. The seed rolls rarity, then product type, then traits, then the object itself. That order is fixed, so the seed stays stable.
4. The receipt shows the title, rarity, traits, and a serial such as `#665771`.
5. **Copy link** writes `/?seed=<seed>`. Opening that URL rebuilds the same object.

The cabinet in this browser remembers pulls in `localStorage`. Choosing a kept item loads its seed again instead of rolling a new one.

## What it dispenses

| Type | What you get |
| --- | --- |
| Memory | A date that never happened, a place, one sensory fact, and one impossible detail. |
| Planetary sound | A named planet and a loop built in the Web Audio API: drone, filtered noise, and a seeded rhythm. Press **Play sound** if the browser has not heard a click yet. |
| Creature | A small rig in the same Three.js scene: body, limbs, eyes, horns, a tail, and an idle bob. |
| Letter | A note from a future year, signed with a generated name. |
| Alternate reality | A five-second scene. A countdown, a changed sky, one object that should not be there, and one rule of that world. **Replay five seconds** runs it again. |

Prose comes from seeded grammars, not a language model. The same seed always prints the same sentence.

## Rarity

| Rarity | Chance |
| --- | --- |
| Common | 40% |
| Uncommon | 30% |
| Rare | 18% |
| Legendary | 9% |
| Impossible | 3% |

Each object gets two to four traits. An impossible pull also receives one trait that only that tier can roll, such as `never dispensed before` or `signed in a year that has no calendar`. Legendary and impossible pulls get a harder reveal and a brighter stinger.


The machine, the creature, and the reality are built from Three.js primitives. No models or textures are loaded.
