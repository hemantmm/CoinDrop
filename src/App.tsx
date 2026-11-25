import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  playCapsulePop,
  playClunk,
  playCoinInsertDrop,
  playFlapOpen,
  playKeypadBeep,
  playKidCoinCheer,
  playKidsCheer,
  playStinger,
  playTopicSelect,
  startPlanet,
  stopPlanet,
  unlockAudio,
} from "./audio";
import { loadCabinet, remember, shareUrl, type CabinetItem } from "./cabinet";
import { generate, isHighRarity, type Product } from "./generate";
import { displayLine, noteVisit, type Readout } from "./machine/personality";
import { isSeed } from "./rng";
import { Crowd } from "./scene/Crowd";
import { Gallery, Machine, type Phase } from "./scene/Machine";
import { WorldCopy } from "./scene/Labels";
import { Reality } from "./scene/Reality";
import {
  claimSlot,
  COIL_CODES,
  GIFT_TOPICS,
  todayStock,
  type CoinPlayer,
  type DayStock,
  type GiftTopic,
  type PlayStep,
  type StockSlot,
} from "./stock";
import { Cabinet } from "./ui/Cabinet";
import { FullScreenScreenshotOverlay, Moment, RealityOverlay, Receipt } from "./ui/Receipt";
import { StockBoard } from "./ui/StockBoard";
import { KidsCompanion } from "./ui/KidsCompanion";
import { FamilyJourney } from "./ui/FamilyJourney";

const COIN_MS = 850;
const VEND_MS = 3200;
const REALITY_MS = 5000;
const MOMENT_MS = 5000;

function initialProduct(): Product | null {
  const seed = new URLSearchParams(window.location.search).get("seed");
  if (!seed || !isSeed(seed)) return null;
  return generate(seed);
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
}

export function App() {
  const starting = useRef(initialProduct());
  const [product, setProduct] = useState<Product | null>(starting.current);
  const [phase, setPhase] = useState<Phase>(() => {
    if (!starting.current) return "idle";
    return starting.current.type === "reality" ? "reality" : "revealed";
  });
  const [cabinet, setCabinet] = useState<CabinetItem[]>(() => loadCabinet());
  const [visits] = useState(() => noteVisit());
  const [now, setNow] = useState(() => Date.now());
  const [mark, setMark] = useState(() => (starting.current ? performance.now() : 0));
  const [moment, setMoment] = useState(
    () =>
      Boolean(
        starting.current &&
          isHighRarity(starting.current.rarity) &&
          starting.current.type !== "reality" &&
          starting.current.type !== "creature",
      ),
  );
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const [advance, setAdvance] = useState(0);
  const handed = useRef<string | null>(null);
  const [stock, setStock] = useState<DayStock>(() => todayStock());
  const [selectedTopic, setSelectedTopic] = useState<GiftTopic>("technology");
  const [targetedSlotIndex, setTargetedSlotIndex] = useState<number | null>(null);
  const [vendingSlotIndex, setVendingSlotIndex] = useState<number | null>(null);
  const [coinPlayer, setCoinPlayer] = useState<CoinPlayer>("Dad");
  const [playStep, setPlayStep] = useState<PlayStep>(() => (starting.current ? "revealed" : "need_coin"));
  const [coinMark, setCoinMark] = useState(0);
  const [typedCode, setTypedCode] = useState("");
  const [isSuspenseHanging, setIsSuspenseHanging] = useState(false);
  const [arrivalSeq, setArrivalSeq] = useState(1);
  const [isFullScreenTakeover, setIsFullScreenTakeover] = useState(false);
  const [topicBounce, setTopicBounce] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const [showJourney, setShowJourney] = useState(() => {
    if (starting.current) return false;
    try {
      return sessionStorage.getItem("vm-journey-seen-v3") !== "1";
    } catch {
      return true;
    }
  });
  const timers = useRef<number[]>([]);
  const copyTimer = useRef<number | null>(null);
  const targetedSlotRef = useRef<number | null>(null);
  targetedSlotRef.current = targetedSlotIndex;
  const typedCodeRef = useRef("");
  typedCodeRef.current = typedCode;
  const selectedTopicRef = useRef<GiftTopic>(selectedTopic);
  selectedTopicRef.current = selectedTopic;

  const handleCompleteJourney = () => {
    try {
      sessionStorage.setItem("vm-journey-seen-v3", "1");
    } catch {
      /* ignore */
    }
    setShowJourney(false);
    setArrivalSeq((s) => s + 1);
    setTopicBounce((c) => c + 1);
  };

  const chooseTopic = (next: GiftTopic) => {
    if (selectedTopic === next) return;
    setSelectedTopic(next);
    setTargetedSlotIndex((cur) => {
      if (cur === null) return null;
      const slot = stock.slots.find((item) => item.index === cur);
      return slot?.topic === next ? cur : null;
    });
    setTopicBounce((c) => c + 1);
    unlockAudio();
    playTopicSelect(next);
  };

  const chooseCoinPlayer = (next: CoinPlayer) => {
    setCoinPlayer(next);
    unlockAudio();
    if (next === "Dad") playCoinInsertDrop();
    else playKidCoinCheer();
  };

  const handleNudgeKids = () => {
    setTopicBounce((c) => c + 1);
    unlockAudio();
    playKidsCheer();
  };

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((item) => item !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };

  const noteCopied = () => {
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const handOff = (seed: string) => {
    if (handed.current === seed) return;
    handed.current = seed;
    setAdvance((count) => count + 1);
  };

  const completeRevealFor = (next: Product, mode: "vend" | "instant") => {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", next.seed);
    window.history.replaceState({}, "", url);
    setCabinet(remember(next));
    setPlayStep("revealed");

    const finishReveal = () => {
      setPhase("revealed");
      setMark(performance.now());
      if (next.rarity === "impossible") {
        setIsFullScreenTakeover(true);
      }
      if (next.type === "sound" && next.payload.kind === "sound" && mode === "vend") {
        startPlanet(next.payload);
        setListening(true);
      }
      if (mode !== "vend") return;
      if (isHighRarity(next.rarity) && next.type !== "reality" && next.type !== "creature") {
        setMoment(true);
        later(MOMENT_MS, () => {
          setMoment(false);
          handOff(next.seed);
        });
        return;
      }
      handOff(next.seed);
    };

    if (mode === "vend") {
      playStinger(next.rarity);
    }
    if (next.type === "reality") {
      setPhase("reality");
      setMark(performance.now());
      later(REALITY_MS, () => {
        setPhase("revealed");
        if (mode === "vend") handOff(next.seed);
      });
      return;
    }
    finishReveal();
  };

  const show = (next: Product, mode: "vend" | "instant") => {
    clearTimers();
    stopPlanet();
    setListening(false);
    setCopied(false);
    setMoment(false);
    setIsFullScreenTakeover(false);
    setProduct(next);

    if (mode === "vend") {
      unlockAudio();
      playClunk();
      setPhase("vending");
      setPlayStep("vending");
      setMark(performance.now());
      later(Math.round(VEND_MS * 0.5), () => setIsSuspenseHanging(true));
      later(Math.round(VEND_MS * 0.68), () => setIsSuspenseHanging(false));
      later(VEND_MS, () => {
        setIsSuspenseHanging(false);
        setPhase("idle");
        setPlayStep("in_tray");
      });
      return;
    }

    completeRevealFor(next, "instant");
  };

  const startVendSlot = (slot: StockSlot) => {
    claimSlot(slot.index);
    setStock(todayStock());
    setVendingSlotIndex(slot.index);
    setTargetedSlotIndex(null);
    setTypedCode("");
    setSelectedTopic(slot.topic);
    show(slot.product, "vend");
  };

  const resolveSlotToVend = (): StockSlot | undefined => {
    const freshStock = todayStock();
    const tIdx = targetedSlotRef.current;
    if (tIdx !== null) {
      const hit = freshStock.slots.find((item) => item.index === tIdx && !item.claimed);
      if (hit) return hit;
    }
    if (typedCodeRef.current.length === 2) {
      const hit = freshStock.slots.find((item) => item.code === typedCodeRef.current && !item.claimed);
      if (hit) return hit;
    }
    const available = freshStock.slots.filter((item) => !item.claimed && item.topic === selectedTopicRef.current);
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    const anyAvailable = freshStock.slots.filter((item) => !item.claimed);
    return anyAvailable[0];
  };

  const handleInsertCoin = () => {
    if (playStep === "coin_entering" || playStep === "vending" || playStep === "in_tray" || phase === "reality" || moment) {
      return;
    }
    const fresh = todayStock();
    if (fresh.soldOut) return;

    clearTimers();
    stopPlanet();
    setListening(false);
    setMoment(false);
    setIsFullScreenTakeover(false);
    setVendingSlotIndex(null);
    setPhase("idle");
    setPlayStep("coin_entering");
    setCoinMark(performance.now());
    unlockAudio();
    playCoinInsertDrop();
    if (coinPlayer !== "Dad") playKidCoinCheer();

    later(COIN_MS, () => {
      // If user pre-selected a specific item (via shelf, StockBoard, or keypad), dispense it right away;
      // otherwise let them pick a button/shelf item like a real vending machine!
      const preIdx = targetedSlotRef.current;
      const preCode = typedCodeRef.current;
      const currentStock = todayStock();
      const preSlot =
        preIdx !== null
          ? currentStock.slots.find((item) => item.index === preIdx && !item.claimed)
          : preCode.length === 2
            ? currentStock.slots.find((item) => item.code === preCode && !item.claimed)
            : undefined;
      if (preSlot) {
        startVendSlot(preSlot);
      } else {
        setPlayStep("select_item");
      }
    });
  };

  const handleSelectSlot = (slotIndex: number) => {
    const fresh = todayStock();
    const slot = fresh.slots.find((item) => item.index === slotIndex);
    if (!slot || slot.claimed) return;
    unlockAudio();
    playKeypadBeep(slot.code[0] ?? "A");
    setSelectedTopic(slot.topic);
    setTypedCode(slot.code);
    setTargetedSlotIndex(slot.index);
    if (playStep === "select_item") {
      startVendSlot(slot);
    }
  };

  const handleKeyPress = (key: string) => {
    unlockAudio();
    if (key === "CLR") {
      setTypedCode("");
      setTargetedSlotIndex(null);
      return;
    }
    if (key === "VEND") {
      if (playStep === "select_item") {
        const slot = resolveSlotToVend();
        if (slot) startVendSlot(slot);
      } else if (playStep === "need_coin" || playStep === "revealed") {
        handleInsertCoin();
      }
      return;
    }
    if (["A", "B", "C", "D"].includes(key)) {
      setTypedCode(key);
      const topicMap: Record<string, GiftTopic> = { A: "technology", B: "audio", C: "snacks", D: "style" };
      if (topicMap[key]) setSelectedTopic(topicMap[key]);
      return;
    }
    if (["1", "2", "3", "4"].includes(key)) {
      const row = ["A", "B", "C", "D"].includes(typedCode) ? typedCode : COIL_CODES.find((_, idx) => stock.slots[idx]?.topic === selectedTopic)?.[0] ?? "A";
      const code = `${row}${key}`;
      setTypedCode(code);
      const match = todayStock().slots.find((item) => item.code === code && !item.claimed);
      if (match) {
        setSelectedTopic(match.topic);
        setTargetedSlotIndex(match.index);
        if (playStep === "select_item") {
          startVendSlot(match);
        }
      }
    }
  };

  const handleCollect = () => {
    if (playStep !== "in_tray" || !product) return;
    unlockAudio();
    playFlapOpen();
    playCapsulePop();
    completeRevealFor(product, "vend");
  };

  const handlePrimaryAction = () => {
    if (playStep === "in_tray") {
      handleCollect();
      return;
    }
    if (playStep === "select_item") {
      const slot = resolveSlotToVend();
      if (slot) startVendSlot(slot);
      return;
    }
    handleInsertCoin();
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    const owned = loadCabinet();
    const shared = starting.current;
    if (shared) {
      setCabinet(remember(shared));
      if (shared.type === "reality") later(REALITY_MS, () => setPhase("revealed"));
      else if (isHighRarity(shared.rarity) && shared.type !== "creature") later(MOMENT_MS, () => setMoment(false));
    } else {
      setCabinet(owned);
    }
    return () => {
      clearTimers();
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      stopPlanet();
    };
    // The shared object is fixed for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = () => {
    if (!product) return;
    void copyText(shareUrl(product.seed));
    noteCopied();
  };

  const share = async () => {
    if (!product) return;
    const url = shareUrl(product.seed);
    if (canShare && navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `${product.title}. ${product.line}`,
          url,
        });
      } catch {
        /* The share sheet was dismissed. */
      }
      return;
    }
    await copyLink();
  };

  const toggleSound = () => {
    if (!product || product.payload.kind !== "sound") return;
    unlockAudio();
    if (listening) {
      stopPlanet();
      setListening(false);
      return;
    }
    startPlanet(product.payload);
    setListening(true);
  };

  const replay = () => {
    if (!product || product.type !== "reality") return;
    clearTimers();
    stopPlanet();
    setListening(false);
    setMoment(false);
    setPhase("reality");
    setMark(performance.now());
    later(REALITY_MS, () => setPhase("revealed"));
  };

  const sky = product?.payload.kind === "reality" ? product.payload.sky : "#14110e";
  const busy = playStep === "coin_entering" || phase === "vending" || phase === "reality" || moment;
  const topicStock = stock.slots.filter((item) => item.topic === selectedTopic);
  const availableGifts = topicStock.filter((item) => !item.claimed);
  const selectedGift = availableGifts[0] ?? null;
  const targetedSlot = targetedSlotIndex !== null ? stock.slots.find((item) => item.index === targetedSlotIndex && !item.claimed) ?? null : null;
  const showPlinth = (phase === "revealed" || playStep === "revealed") && !moment;
  const impossibleKept = cabinet.some((item) => item.rarity === "impossible");
  const closed =
    !selectedGift &&
    playStep !== "coin_entering" &&
    playStep !== "select_item" &&
    playStep !== "vending" &&
    playStep !== "in_tray" &&
    phase !== "vending" &&
    phase !== "reality";
  const readout: Readout = closed
    ? {
        label: "Closed",
        text: stock.soldOut ? "Come back tomorrow." : "Choose another topic.",
        detail: stock.soldOut ? "Today's gifts are gone. Tomorrow the case will be full again." : `There are no ${GIFT_TOPICS.find((topic) => topic.id === selectedTopic)?.label.toLowerCase()} gifts left today.`,
        tone: "warn",
      }
    : playStep === "coin_entering"
      ? {
          label: coinPlayer,
          text: `${coinPlayer} is inserting the coin`,
          detail: "Sliding the shiny coin into the slot on the right.",
          tone: "warn",
        }
      : playStep === "select_item"
        ? {
            label: "Credit $1",
            text: typedCode
              ? stock.slots.some((s) => s.code === typedCode && s.claimed)
                ? `Coil ${typedCode} empty`
                : `Code ${typedCode} entered`
              : "Press a coil button (A1–D4)",
            detail: "Tap any glowing prize inside the glass, or press the keypad on the right.",
            tone: "warn",
          }
        : playStep === "vending" && isSuspenseHanging
          ? {
              label: "Edge hang",
              text: "Balanced on the lip...",
              detail: "Holding breath! The prize is teetering right over the shelf edge.",
              tone: "warn",
            }
          : playStep === "in_tray"
            ? {
                label: "In tray",
                text: "Push the bottom flap",
                detail: "Your capsule hit the bottom chute! Tap the flap or capsule to open it.",
                tone: "warn",
              }
            : phase === "idle" && targetedSlot
              ? {
                  label: `Coil ${targetedSlot.code}`,
                  text: targetedSlot.product.title,
                  detail: `Coil ${targetedSlot.code} selected. Let ${coinPlayer} insert a coin to dispense it.`,
                  tone: "warn",
                }
              : phase === "idle" && selectedGift
                ? {
                    label: "Your pick",
                    text: "A surprise is waiting",
                    detail: `Drop the coin in the slot with ${coinPlayer}, then pick any coil A1–D4 inside the glass.`,
                    tone: "warn",
                  }
                : displayLine({
                    phase,
                    rarity: product?.rarity ?? null,
                    type: product?.type ?? null,
                    title: product?.title ?? null,
                    seed: product?.seed ?? null,
                    visits,
                    discoveries: cabinet.length,
                    impossibleKept,
                    vendStarted: mark,
                    now,
                  });

  const actionDisabled =
    busy ||
    (playStep !== "in_tray" && playStep !== "select_item" && stock.soldOut) ||
    (playStep === "need_coin" && !selectedGift && stock.soldOut);

  const actionLabel = () => {
    if (playStep === "coin_entering") return `${coinPlayer} inserting coin...`;
    if (playStep === "vending" || phase === "vending") {
      return isSuspenseHanging ? "Teetering on edge..." : "Coil turning...";
    }
    if (phase === "reality") return "Five seconds";
    if (playStep === "in_tray") return "Grab & open prize!";
    if (playStep === "select_item") return typedCode ? `Dispense ${typedCode}` : "Tap glass item or Kids' Pick";
    if (stock.soldOut) return "Come back tomorrow";
    if (!selectedGift && playStep === "need_coin") return "Choose another topic";
    if (targetedSlot) return `${coinPlayer}: Coin for ${targetedSlot.code}`;
    return product ? `${coinPlayer}: Insert another coin` : `${coinPlayer}: Insert a coin`;
  };

  return (
    <div
      className={`shell ${isFullScreenTakeover ? "fullscreen-active" : ""}`}
      data-rarity={product?.rarity ?? "none"}
      data-phase={phase}
      data-topic={selectedTopic}
    >
      <main className="main">
        <header className="top">
          <div>
            <div className="kicker-row">
              <p className="kicker">Standing with the kids</p>
              <span className="kids-status-pill">👧 Maya & 👦 Leo at the glass</span>
              <button
                type="button"
                className="journey-trigger-btn"
                onClick={() => setShowJourney(true)}
                title="Experience the family car trip from home to the mall!"
              >
                🚗 <span>Family Mall Trip</span>
              </button>
            </div>
            <h1>The Impossible Vending Machine</h1>
          </div>
          <p className="kept">
            Kept <span>{cabinet.length}</span>
          </p>
        </header>
        <div className="stage">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [0.1, 1.58, 2.42], fov: 48 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
            }}
            onCreated={({ camera, gl }) => {
              camera.lookAt(0, 1.08, 0.25);
              gl.domElement.style.touchAction = "none";
            }}
          >
            <Gallery
              phase={phase}
              sky={sky}
              topic={selectedTopic}
              rarity={product?.rarity ?? null}
              fullScreen={isFullScreenTakeover}
            >
              <Machine
                phase={phase}
                playStep={playStep}
                coinStarted={coinMark}
                coinMs={COIN_MS}
                vendStarted={mark}
                vendMs={VEND_MS}
                product={product}
                canInsert={!busy && !stock.soldOut}
                onInsert={handleInsertCoin}
                topic={selectedTopic}
                targetedSlotIndex={targetedSlotIndex}
                vendingSlotIndex={vendingSlotIndex}
                typedCode={typedCode}
                coinPlayer={coinPlayer}
                onSelectSlotIndex={handleSelectSlot}
                onKeyPress={handleKeyPress}
                onCollect={handleCollect}
                stock={stock.slots.map((slot) => ({
                  shape: slot.shape,
                  color: slot.color,
                  claimed: slot.claimed,
                  rarity: slot.product.rarity,
                }))}
              />
              <Crowd
                phase={phase}
                advance={advance}
                topicBounce={topicBounce}
                playStep={playStep}
                coinPlayer={coinPlayer}
                isSuspenseHanging={isSuspenseHanging}
                arrivalSeq={arrivalSeq}
              />
              <WorldCopy
                phase={phase}
                product={product}
                showPlinth={showPlinth}
                listening={listening}
                readout={readout}
              />
              {phase === "reality" && product?.payload.kind === "reality" ? (
                <Reality spec={product.payload} startedAt={mark} />
              ) : null}
            </Gallery>
          </Canvas>
          <KidsCompanion
            topic={selectedTopic}
            phase={phase}
            playStep={playStep}
            coinPlayer={coinPlayer}
            isSuspenseHanging={isSuspenseHanging}
            product={product}
            onNudge={handleNudgeKids}
          />
          {phase === "reality" && product?.payload.kind === "reality" ? (
            <RealityOverlay spec={product.payload} startedAt={mark} copied={copied} onCopy={() => void copyLink()} />
          ) : null}
          {moment && product ? (
            <Moment
              product={product}
              copied={copied}
              onCopy={() => void copyLink()}
              onDismiss={() => {
                setMoment(false);
                handOff(product.seed);
              }}
            />
          ) : null}
          {isFullScreenTakeover && product ? (
            <FullScreenScreenshotOverlay
              product={product}
              onExit={() => setIsFullScreenTakeover(false)}
            />
          ) : null}
        </div>
        <div className="controls">
          {!stock.soldOut ? (
            <div className="topic-picker" aria-label="Choose a gift topic">
              <p className="kicker">Choose what you’re into · The kids are watching</p>
              <div className="topic-options" role="group" aria-label="Gift topics">
                {GIFT_TOPICS.map((topic) => {
                  const available = stock.slots.filter((slot) => !slot.claimed && slot.topic === topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={selectedTopic === topic.id ? "topic-option selected" : "topic-option"}
                      aria-pressed={selectedTopic === topic.id}
                      onClick={() => chooseTopic(topic.id)}
                    >
                      <div className="topic-header-line">
                        <span className="topic-icon">{topic.icon}</span>
                        <strong>{topic.label}</strong>
                      </div>
                      <span className="topic-vote">{topic.kidsVote}</span>
                      <small>{available.length ? `${available.length} gift${available.length === 1 ? "" : "s"} left` : "Sold out today"}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {closed ? (
            <div className="next-ask closed-note" role="status">
              <p className="kicker">Topic empty</p>
              <h2>{stock.soldOut ? "Come back tomorrow" : "Choose another topic"}</h2>
              <p>{stock.soldOut ? "Today's gifts are finished. Come back tomorrow for a new case." : `There are no ${GIFT_TOPICS.find((topic) => topic.id === selectedTopic)?.label.toLowerCase()} gifts left today. Pick another topic to keep playing.`}</p>
            </div>
          ) : null}
          <div className="coin-action-row">
            <div className="coin-player-toggle" role="group" aria-label="Who inserts the coin">
              {(["Dad", "Leo", "Maya"] as const).map((member) => (
                <button
                  key={member}
                  type="button"
                  className={coinPlayer === member ? "coin-player-pill active" : "coin-player-pill"}
                  aria-pressed={coinPlayer === member}
                  disabled={busy}
                  onClick={() => chooseCoinPlayer(member)}
                  title={`Let ${member} insert the coin`}
                >
                  {member === "Dad" ? "🧔 Dad" : member === "Leo" ? "👦 Leo" : "👧 Maya"}
                </button>
              ))}
            </div>
            <button type="button" className="coin" disabled={actionDisabled} onClick={handlePrimaryAction}>
              {actionLabel()}
            </button>
          </div>
          <p>
            {stock.soldOut && playStep !== "in_tray"
              ? "The case is empty until tomorrow."
              : playStep === "select_item"
                ? "Coin is in! Click any coil item behind the glass, use the 3D keypad, or tap the button."
                : playStep === "in_tray"
                  ? "Your prize dropped into the bottom tray! Click the delivery flap to grab & open it."
                  : `${stock.remaining} gifts remain. Drag or click the 3D coin, or press to insert it with ${coinPlayer}.`}
          </p>
        </div>
      </main>
      <aside className="side">
        <StockBoard
          slots={topicStock}
          selectedSlotIndex={targetedSlotIndex}
          onSelectSlot={handleSelectSlot}
        />
        <Receipt
          product={playStep === "revealed" ? product : null}
          copied={copied}
          listening={listening}
          onCopy={() => void copyLink()}
          onShare={() => void share()}
          onToggleSound={toggleSound}
          onReplay={replay}
          onOpenScreenshot={() => setIsFullScreenTakeover(true)}
        />
        <Cabinet
          items={cabinet}
          activeSeed={product?.seed ?? null}
          onOpen={(seed) => show(generate(seed), "instant")}
        />
      </aside>
      {showJourney ? <FamilyJourney onComplete={handleCompleteJourney} /> : null}
    </div>
  );
}
