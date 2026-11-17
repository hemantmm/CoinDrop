import type { Rng } from "./rng";

const ONSETS = ["br", "v", "l", "m", "s", "n", "th", "k", "r", "sh", "y", "qu", "z", "f"];
const NUCLEI = ["a", "e", "i", "o", "ae", "io", "ou", "ei"];
const CODAS = ["n", "l", "th", "r", "s", "", "m", "x"];

const DATES = [
  "On the 31st of February, 1974",
  "Three minutes before you were born, again",
  "The Thursday that lasted nine hours",
  "A Tuesday filed under never",
  "In the year the clocks refused",
  "During the eclipse that happened indoors",
  "On a birthday that belonged to someone else",
  "The night the harbor forgot its name",
  "At 4:07, which did not occur",
  "In the week between Sunday and Monday",
  "On the last day of a month that was withdrawn",
  "The morning you woke in a house you have not rented yet",
];

const PLACES = [
  "a station with no tracks",
  "the kitchen of a ship",
  "a library where the books face the wall",
  "an elevator stopped between floors that do not exist",
  "a classroom after the subject left",
  "the back row of a cinema playing a room",
  "a bridge that ends in weather",
  "your childhood hallway, made longer",
  "a waiting room for departures that already happened",
  "a roof in a city that uses different stars",
  "the aisle of a night market",
  "a phone booth at the bottom of a pool",
];

const SENSES = [
  "The air tasted of coins and orange peel.",
  "Someone was humming a song you will write later.",
  "The light arrived before the lamp was switched on.",
  "It smelled like rain on a hot engine.",
  "Your hands were warm from holding a name.",
  "A radio under the floor played only the quiet between stations.",
  "The color of the room was a sound.",
  "Cold metal, then the memory of cold metal.",
  "You could hear a clock unwinding.",
  "Dust hung in the shape of a sentence.",
  "The floor was soft, like a held breath.",
  "A window showed the weather from next year.",
];

const DETAILS = [
  "You remembered a person you have not met, and they remembered you back.",
  "When you blinked, the room stayed.",
  "A ticket in your pocket named a seat that was never installed.",
  "You knew the ending and still sat down.",
  "The door locked from the side you were already on.",
  "Your reflection waved on the second try.",
  "A child asked if you were the one who keeps the extra hour.",
  "You left your keys on a table that has not been built.",
  "The conversation finished in a language you only speak asleep.",
  "You were certain this had happened to the version of you that stayed.",
  "An usher tore the ticket and handed you the smaller half of the day.",
  "You promised to return, and the promise is still walking here.",
];

const SALUTATIONS = [
  "Dear earlier me,",
  "To the one who still has Tuesdays,",
  "Hello from the side of the door you have not opened,",
  "Dear you, who is still in the kitchen,",
  "To the person holding the coin,",
];

const LETTER_OPEN = [
  "I am writing from a year in which your name fits better.",
  "The coin you are holding has already been spent here.",
  "We kept the plant. It learned a new silence.",
  "Do not apologize to the version of this day that turned left.",
  "Your keys are in the bowl, and the bowl is in a different house.",
  "I went back for the sentence you swallowed at dinner.",
  "The city added a street with your handwriting.",
  "Nothing terrible happens. Something exact does.",
  "The machine was right to hesitate before this one.",
  "I still have the ticket stub from a film that premieres next spring.",
];

const LETTER_CLOSE = [
  "When the machine offers you a memory, take the smaller one.",
  "Bring the blue coat. The weather here remembers it.",
  "You can stop rehearsing the call. It ends kindly.",
  "Leave the light on. I am still walking up.",
  "If a creature says your old number, it is not a trick.",
  "Count to five and let the other sky finish.",
  "I am proud of the ordinary Tuesday you are about to keep.",
  "Do not look for me in the mirror that blinks.",
  "Spend the rare one. It gets heavier if you wait.",
  "Tell them you received this. They will know which they.",
];

const SIGNOFFS = [
  "Yours, from a kitchen that faces the wrong ocean,",
  "With the hour I saved for you,",
  "Still yours, slightly later,",
  "From the platform after the last listed train,",
  "Affectionately, and with better shoes,",
];

const RULES = [
  "Rain falls upward and keeps your name.",
  "Doors open toward the person you meant to call.",
  "Shadows arrive a few seconds before their owners.",
  "Every mirror owes you a different year.",
  "Gravity is polite and waits to be asked.",
  "The moon is closer, and slightly embarrassed.",
  "Streets rearrange to avoid an apology.",
  "Clocks run toward the last honest thing you said.",
  "Animals can see the minute you are avoiding.",
  "Light refuses to leave a room where someone is telling the truth.",
  "Your footsteps belong to tomorrow.",
  "The ocean is standing up, very quietly.",
];

const OBJECTS = [
  "a staircase that ends in a held breath",
  "a coin still warm from a hand you do not have yet",
  "a chair facing the wrong century",
  "a small animal made of receipt paper",
  "a window propped open with a forgotten word",
  "a planet the size of a marble, humming",
  "an unsent letter folding itself into a bird",
  "a traffic light showing a color this world retired",
  "your old keys, glowing from the inside",
  "a second moon, shy, behind the first",
];

const SKIES = [
  { name: "A violet dusk with no source", color: "#241c3e" },
  { name: "Copper night, close enough to touch", color: "#3a2418" },
  { name: "A green storm standing still", color: "#102e28" },
  { name: "Noon, the wrong temperature", color: "#8a7048" },
  { name: "Blue-black, like a harbor under ice", color: "#0e1c33" },
  { name: "The eclipse that learned your name", color: "#3d1630" },
];

const SHAPES = ["torus", "octa", "icosa", "knot"] as const;

const MODES = [
  [0, 2, 5, 7, 10],
  [0, 3, 5, 7, 11],
  [0, 1, 5, 8, 10],
  [0, 3, 6, 7, 10],
  [0, 2, 3, 7, 8],
];

const PALETTES = [
  ["#d7efe8", "#1f6f6a"],
  ["#f3d2b5", "#8c3d2a"],
  ["#e7e2ff", "#3d3a86"],
  ["#f6f1d8", "#8a7a32"],
  ["#f7c6d0", "#7a2344"],
  ["#c9e4ff", "#1d4e89"],
  ["#efe6d4", "#5c4632"],
  ["#d9f5c8", "#2f6b32"],
];

export const TRAIT_POOL = {
  memory: [
    "secondhand",
    "warm to the touch",
    "smells like rain on coins",
    "unreliable narrator",
    "filed under never",
    "still developing",
    "borrowed from a stranger",
    "repeats if you blink",
  ],
  sound: [
    "thin atmosphere",
    "no birds",
    "subsonic tide",
    "radio quiet",
    "metal wind",
    "a buried bell",
    "night side only",
    "echoes in reverse",
  ],
  creature: [
    "nocturnal",
    "collects echoes",
    "one heart too many",
    "translucent",
    "knows your old number",
    "pocket-sized",
    "fond of receipts",
    "blinks out of order",
  ],
  letter: [
    "unposted",
    "ink still wet",
    "written twice",
    "margin full of weather",
    "addressed to a nickname",
    "sealed with a coin",
    "read once already",
    "paper from a tree that is not here",
  ],
  reality: [
    "unstable",
    "locally true",
    "expires",
    "contagious calm",
    "non-transferable",
    "heavier at the edges",
    "visible to cameras",
    "ends mid-sentence",
  ],
} as const;

export const IMPOSSIBLE_TRAITS = [
  "never dispensed before",
  "listens back",
  "signed in a year that has no calendar",
  "heavier than its shadow",
  "remembers the next owner",
  "cannot be photographed twice",
];

export function makeName(rng: Rng): string {
  const parts = 2 + rng.int(2);
  let name = "";
  for (let i = 0; i < parts; i += 1) {
    name += rng.pick(ONSETS) + rng.pick(NUCLEI) + rng.pick(CODAS);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function makePlanet(rng: Rng): string {
  const suffix = rng.pick(["", " Prime", " IX", "-b", " Minor"]);
  return `${makeName(rng)}${suffix}`;
}

export function writeMemory(rng: Rng) {
  const date = rng.pick(DATES);
  const place = rng.pick(PLACES);
  const sensory = rng.pick(SENSES);
  const detail = rng.pick(DETAILS);
  return {
    kind: "memory" as const,
    date,
    place,
    sensory,
    detail,
    body: `${date}, ${place}. ${sensory} ${detail}`,
  };
}

export function writeLetter(rng: Rng) {
  const year = 2071 + rng.int(340);
  const salutation = rng.pick(SALUTATIONS);
  const opening = rng.pick(LETTER_OPEN);
  const closing = rng.pick(LETTER_CLOSE);
  const signoff = rng.pick(SIGNOFFS);
  const signature = makeName(rng);
  return {
    kind: "letter" as const,
    year,
    salutation,
    body: `${opening} ${closing}`,
    signoff,
    signature,
  };
}

export function writeReality(rng: Rng) {
  const sky = rng.pick(SKIES);
  const rule = rng.pick(RULES);
  const object = rng.pick(OBJECTS);
  const shape = rng.pick(SHAPES);
  return {
    kind: "reality" as const,
    skyName: sky.name,
    sky: sky.color,
    rule,
    object,
    shape,
    beats: [
      { at: 0, line: sky.name },
      { at: 1.7, line: object },
      { at: 3.3, line: "This lasts five seconds." },
    ],
  };
}

export function writeCreature(rng: Rng) {
  const palette = rng.pick(PALETTES);
  return {
    kind: "creature" as const,
    name: makeName(rng),
    body: [rng.range(0.16, 0.34), rng.range(0.16, 0.46), rng.range(0.15, 0.32)] as [
      number,
      number,
      number,
    ],
    limbCount: rng.pick([3, 4, 5, 6, 8]),
    palette: [palette[0], palette[1]] as [string, string],
    bobSpeed: rng.range(1.1, 3.2),
    blinkEvery: rng.range(2.1, 5.4),
    eyeCount: rng.pick([1, 2, 3, 4]),
    horns: rng.int(4),
    tail: rng.chance(0.62),
  };
}

export function writeSound(rng: Rng) {
  const fundamental = rng.range(46, 210);
  const scale = rng.pick(MODES);
  const rhythm = Array.from({ length: 8 }, (_, index) => (index === 0 ? 1 : rng.chance(0.45) ? 1 : 0));
  const noiseAmount = rng.range(0.03, 0.38);
  const density = rhythm.reduce<number>((sum, step) => sum + step, 0) / rhythm.length;
  const notes = [
    fundamental < 80 ? "low orbit" : fundamental > 160 ? "thin upper air" : "a close sky",
    noiseAmount > 0.2 ? "glass rain" : "dry wind",
    density > 0.55 ? "two moons" : "a slow tide",
  ];
  return {
    kind: "sound" as const,
    planet: makePlanet(rng),
    fundamental,
    scale,
    rhythm,
    filterCutoff: rng.range(180, 2600),
    noiseAmount,
    lfoRate: rng.range(0.04, 0.4),
    stepMs: Math.round(rng.range(180, 340)),
    notes,
  };
}
