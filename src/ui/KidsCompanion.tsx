import { useEffect, useState } from "react";
import type { CoinPlayer, GiftTopic, PlayStep } from "../stock";
import type { Phase } from "../scene/Machine";
import type { Product } from "../generate";

type Props = {
  topic: GiftTopic;
  phase: Phase;
  playStep?: PlayStep;
  coinPlayer?: CoinPlayer;
  isSuspenseHanging?: boolean;
  nudgeWarn?: boolean;
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

export function KidsCompanion({
  topic,
  phase,
  playStep = "need_coin",
  coinPlayer = "Dad",
  isSuspenseHanging = false,
  nudgeWarn = false,
  product,
  onNudge,
}: Props) {
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

  useEffect(() => {
    setWhisper(null);
  }, [playStep, isSuspenseHanging]);

  let activeSpeech = KID_LINES[topic][index % KID_LINES[topic].length];
  if (whisper) {
    activeSpeech = whisper as typeof activeSpeech;
  } else if (playStep === "coin_entering") {
    if (coinPlayer === "Leo") {
      activeSpeech = {
        speaker: "Leo",
        text: "I'm tall enough! Watch me reach up on my tiptoes and push the coin in!",
        sub: "Stretching both hands way up toward the shiny coin slot",
      };
    } else if (coinPlayer === "Maya") {
      activeSpeech = {
        speaker: "Maya",
        text: "1, 2, 3... JUMP! Dropping our lucky coin right into the slot!",
        sub: "Hopping enthusiastically with a big cheer",
      };
    } else {
      activeSpeech = {
        speaker: "Both",
        text: "Clink!! Here goes the coin, Dad! Almost in!",
        sub: "Watching Dad slide the coin cleanly into the acceptor",
      };
    }
  } else if (playStep === "select_item") {
    activeSpeech = {
      speaker: "Both",
      text: "The coin went in!! Now press the buttons on the machine or tap our toy through the glass!",
      sub: "Maya points at the shelf codes · Leo leans close to the display glass",
    };
  } else if (nudgeWarn) {
    activeSpeech = {
      speaker: "Both",
      text: "HAHAHA!! Dad nudged the glass and knocked it clean off the lip!!",
      sub: "Alarm chirps 'DO NOT SHAKE' while Maya & Leo cheer as it tumbles down!",
    };
  } else if (playStep === "vending" && isSuspenseHanging) {
    activeSpeech = {
      speaker: "Both",
      text: "GASP!! IT'S BALANCED RIGHT ON THE EDGE LIP!! Tap the glass to nudge it, Dad!!",
      sub: "Maya clasps her hands · Leo stares wide-eyed at the teetering capsule",
    };
  } else if (phase === "vending" || playStep === "vending") {
    activeSpeech = {
      speaker: "Both",
      text: "IT'S TURNING!! Watch the horizontal spiral coil push it forward step by step!!",
      sub: "Bouncing up and down watching the selected coil spin 360°",
    };
  } else if (playStep === "in_tray") {
    activeSpeech = {
      speaker: "Both",
      text: "THUD!! Look inside the bottom pocket — push the green door flap to grab & open it!",
      sub: "Both crouch and point right at the illuminated pickup tray",
    };
  } else if (playStep === "collecting") {
    activeSpeech = {
      speaker: "Both",
      text: "Lifting it onto the spotlight stand... OOH OPEN IT!!",
      sub: "Pressing close around the showcase plinth as the capsule hinges open",
    };
  } else if (phase === "revealed" && product) {
    if (product.rarity === "impossible") {
      activeSpeech = {
        speaker: "Both",
        text: "DAD WHAT'S HAPPENING TO THE MACHINE?! THE WHOLE ROOM IS FLOATING INTO SPACE!! LOOK AT THE SCREEN!!",
        sub: "Jumping in utter astonishment as reality glitches around the glowing cosmic anomaly",
      };
    } else if (product.rarity === "legendary") {
      activeSpeech = {
        speaker: "Both",
        text: `NO WAY!! DAD LOOK AT THE GOLDEN LIGHT BEAMS!! IT'S A 1-OF-1 LEGENDARY!! WE ACTUALLY GOT THE ${product.title.toUpperCase()}!!`,
        sub: "Hugging each other and pointing at the glorious golden rays radiating across the case",
      };
    } else if (product.rarity === "rare") {
      activeSpeech = {
        speaker: "Leo",
        text: `WHOA! Look at the electric blue sparkles glowing around it!! Dad, it's hovering in the air! That's a RARE one!!`,
        sub: "Maya: 'The aura is so pretty!!' · Eyes wide watching the swirling cyber particles",
      };
    } else {
      activeSpeech = {
        speaker: "Maya",
        text: `Yay, the capsule popped open! Dad, look at our ${product.title}! Can I hold it in the car?!`,
        sub: "Smiling happily as the clean capsule lid rests neatly on the tray",
      };
    }
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
