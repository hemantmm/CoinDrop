import { useEffect, useState } from "react";
import type { GiftTopic } from "../stock";
import type { Phase } from "../scene/Machine";
import type { Product } from "../generate";

type Props = {
  topic: GiftTopic;
  phase: Phase;
  product: Product | null;
  onNudge: () => void;
};

const KID_LINES: Record<GiftTopic, { speaker: "Maya" | "Leo" | "Both"; text: string; sub: string }[]> = {
  technology: [
    { speaker: "Leo", text: "Look at the phone, Dad! Can we please get it?!", sub: "Pressing his face against the glass" },
    { speaker: "Maya", text: "Check out the tiny camera! It still has one picture inside!", sub: "Pointing to the top shelf" },
    { speaker: "Leo", text: "The smartwatch looks like a secret agent gadget! So cool!", sub: "Jumping on his toes" },
    { speaker: "Both", text: "Put the coin in! Let's see if the gadget drops!", sub: "Eyes locked on the spiral coil" },
  ],
  audio: [
    { speaker: "Maya", text: "Ooh the purple headphones! Can I wear them on the road?!", sub: "Bobbing her head to an imaginary beat" },
    { speaker: "Leo", text: "We need that little speaker so we can have a room dance party!", sub: "Air-guitaring next to you" },
    { speaker: "Maya", text: "Listen to the lights hum! It sounds like music already!", sub: "Tugging your sleeve excitedly" },
    { speaker: "Both", text: "Music for the road! Let's get the playlist player!", sub: "Dancing together in line" },
  ],
  snacks: [
    { speaker: "Maya", text: "CHOCOLATE! Dad, the shiny gold bar, please please please!!", sub: "Her eyes wide as saucers" },
    { speaker: "Leo", text: "Look at the gummy bears! They look so squishy and juicy!", sub: "Licking his lips" },
    { speaker: "Maya", text: "I promise I'll share half with Leo if we get the cookies!", sub: "Making puppy dog eyes" },
    { speaker: "Both", text: "Popcorn or chocolate! We're starving, Dad!", sub: "Giggling and pulling your coat" },
  ],
  style: [
    { speaker: "Leo", text: "Those sneakers are so fire! I bet I can run 100 mph in them!", sub: "Testing out a running stance" },
    { speaker: "Maya", text: "Look at the sunglasses! I'd look just like a movie star!", sub: "Striking a funny cool pose" },
    { speaker: "Leo", text: "The cap with the embroidered star! Put it on me first!", sub: "Pointing with both hands" },
    { speaker: "Both", text: "Street style! Let's see what the machine gives us!", sub: "Cheering at the glass" },
  ],
};

const NUDGE_WHISPERS = [
  { speaker: "Maya", text: "Giggles: 'Don’t tell Mom we're trying for the candy before dinner!' 🤫", sub: "Sharing a secret smile with you" },
  { speaker: "Leo", text: "Whispers: 'I think this machine likes you, Dad! You have magic coins!' ✨", sub: "Gazing up in awe" },
  { speaker: "Maya", text: "Whispers: 'If we get the music, can we listen on the way home?' 🚗🎶", sub: "Holding your hand tightly" },
  { speaker: "Leo", text: "Whispers: 'You're the best Dad in the whole galaxy!' 🚀", sub: "Giving you a big high-five" },
  { speaker: "Maya", text: "Giggles: 'Look at the people behind us watching! They want your turn!' 👀", sub: "Glancing back at the queue" },
];

export function KidsCompanion({ topic, phase, product, onNudge }: Props) {
  const [index, setIndex] = useState(0);
  const [whisper, setWhisper] = useState<{ speaker: string; text: string; sub: string } | null>(null);
  const [isWiggle, setIsWiggle] = useState(false);

  useEffect(() => {
    setIndex(0);
    setWhisper(null);
    setIsWiggle(true);
    const id = window.setTimeout(() => setIsWiggle(false), 800);
    return () => window.clearTimeout(id);
  }, [topic]);

  let activeSpeech = KID_LINES[topic][index % KID_LINES[topic].length];
  if (whisper) {
    activeSpeech = whisper as typeof activeSpeech;
  } else if (phase === "vending") {
    activeSpeech = {
      speaker: "Both",
      text: "IT'S TURNING!! Look, look, look! Which one is falling?!",
      sub: "Bouncing up and down with both hands on the glass",
    };
  } else if (phase === "revealed" && product) {
    activeSpeech = {
      speaker: "Both",
      text: `WE GOT IT!! Dad, look, it's the ${product.title}! Can I open the flap?!`,
      sub: "Reaching down towards the dispensing flap with huge smiles",
    };
  }

  const handleNudge = () => {
    onNudge();
    setIsWiggle(true);
    const nextWhisper = NUDGE_WHISPERS[Math.floor(Math.random() * NUDGE_WHISPERS.length)];
    setWhisper(nextWhisper);
    const id = window.setTimeout(() => setIsWiggle(false), 600);
    return () => window.clearTimeout(id);
  };

  return (
    <div className={`kids-companion ${isWiggle ? "wiggle" : ""}`}>
      <div className="kids-bubble">
        <div className="kids-header">
          <div className="kids-avatars">
            <span className="kid-badge girl" title="Maya (7)">
              👧 <strong>Maya</strong> <small>7</small>
            </span>
            <span className="kid-badge boy" title="Leo (5)">
              👦 <strong>Leo</strong> <small>5</small>
            </span>
          </div>
          <button
            type="button"
            className="kids-nudge-btn"
            onClick={handleNudge}
            title="Nudge Maya & Leo to hear what they say!"
          >
            <span>Ask kids</span> ✨
          </button>
        </div>
        <div className="kids-body" onClick={handleNudge} role="button" tabIndex={0}>
          <p className="kids-speaker">
            <span className="dot-pulse" /> {activeSpeech.speaker}:
          </p>
          <p className="kids-quote">“{activeSpeech.text}”</p>
          <p className="kids-sub">{activeSpeech.sub}</p>
        </div>
      </div>
    </div>
  );
}
