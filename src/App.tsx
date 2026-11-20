import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playClunk, playKidsCheer, playStinger, playTopicSelect, startPlanet, stopPlanet, unlockAudio } from "./audio";
import { loadCabinet, remember, shareUrl, type CabinetItem } from "./cabinet";
import { generate, isHighRarity, type Product } from "./generate";
import { displayLine, noteVisit, type Readout } from "./machine/personality";
import { isSeed } from "./rng";
import { Crowd } from "./scene/Crowd";
import { Gallery, Machine, type Phase } from "./scene/Machine";
import { WorldCopy } from "./scene/Labels";
import { Reality } from "./scene/Reality";
import { claimSlot, GIFT_TOPICS, todayStock, type DayStock, type GiftTopic, type StockSlot } from "./stock";
import { Cabinet } from "./ui/Cabinet";
import { FullScreenScreenshotOverlay, Moment, RealityOverlay, Receipt } from "./ui/Receipt";
import { StockBoard } from "./ui/StockBoard";
import { KidsCompanion } from "./ui/KidsCompanion";
import { FamilyJourney } from "./ui/FamilyJourney";

const VEND_MS = 2200;
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

  const handleCompleteJourney = () => {
    try {
      sessionStorage.setItem("vm-journey-seen-v3", "1");
    } catch {
      /* ignore */
    }
    setShowJourney(false);
    setTopicBounce((c) => c + 1);
  };

  const chooseTopic = (next: GiftTopic) => {
    if (selectedTopic === next) return;
    setSelectedTopic(next);
    setTopicBounce((c) => c + 1);
    unlockAudio();
    playTopicSelect(next);
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

  const show = (next: Product, mode: "vend" | "instant") => {
    clearTimers();
    stopPlanet();
    setListening(false);
    setCopied(false);
    setMoment(false);
    setProduct(next);
    const url = new URL(window.location.href);
    url.searchParams.set("seed", next.seed);
    window.history.replaceState({}, "", url);

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
      unlockAudio();
      playClunk();
      setPhase("vending");
      setMark(performance.now());
      later(VEND_MS, () => {
        setCabinet(remember(next));
        playStinger(next.rarity);
        if (next.type === "reality") {
          setPhase("reality");
          setMark(performance.now());
          later(REALITY_MS, () => {
            setPhase("revealed");
            handOff(next.seed);
          });
          return;
        }
        finishReveal();
      });
      return;
    }

    setCabinet(remember(next));
    if (next.type === "reality") {
      setPhase("reality");
      setMark(performance.now());
      later(REALITY_MS, () => setPhase("revealed"));
      return;
    }
    finishReveal();
  };

  const takeNext = () => {
    let slot: StockSlot | undefined;
    if (targetedSlotIndex !== null) {
      slot = stock.slots.find((item) => item.index === targetedSlotIndex && !item.claimed);
    }
    if (!slot) {
      const available = stock.slots.filter((item) => !item.claimed && item.topic === selectedTopic);
      if (busy || available.length === 0) return;
      slot = available[Math.floor(Math.random() * available.length)];
    }
    if (!slot) return;
    claimSlot(slot.index);
    setStock(todayStock());
    setCabinet(remember(slot.product));
    setTargetedSlotIndex(null);
    show(slot.product, "vend");
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
  const busy = phase === "vending" || phase === "reality" || moment;
  const topicStock = stock.slots.filter((item) => item.topic === selectedTopic);
  const availableGifts = topicStock.filter((item) => !item.claimed);
  const selectedGift = availableGifts[0] ?? null;
  const showPlinth = phase === "revealed" && !moment;
  const impossibleKept = cabinet.some((item) => item.rarity === "impossible");
  const closed = !selectedGift && phase !== "vending" && phase !== "reality";
  const readout: Readout = closed
    ? {
        label: "Closed",
        text: stock.soldOut ? "Come back tomorrow." : "Choose another topic.",
        detail: stock.soldOut ? "Today's gifts are gone. Tomorrow the case will be full again." : `There are no ${GIFT_TOPICS.find((topic) => topic.id === selectedTopic)?.label.toLowerCase()} gifts left today.`,
        tone: "warn",
      }
    : phase === "idle" && selectedGift
      ? {
          label: "Your pick",
          text: "A surprise is waiting",
          detail: `You chose ${GIFT_TOPICS.find((topic) => topic.id === selectedTopic)?.label}. Insert a coin and the machine will pick one of the ${availableGifts.length} gifts in this topic at random.`,
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
                vendStarted={mark}
                vendMs={VEND_MS}
                product={product}
                canInsert={!busy && Boolean(selectedGift)}
                onInsert={takeNext}
                topic={selectedTopic}
                stock={topicStock.map((slot) => ({
                  shape: slot.shape,
                  color: slot.color,
                  claimed: slot.claimed,
                }))}
              />
              <Crowd phase={phase} advance={advance} topicBounce={topicBounce} />
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
          <button type="button" className="coin" disabled={busy || !selectedGift} onClick={takeNext}>
            {stock.soldOut
              ? "Come back tomorrow"
              : !selectedGift
                ? "Choose another topic"
                : phase === "vending"
                  ? "Dispensing"
                  : phase === "reality"
                    ? "Five seconds"
                    : product
                      ? "Insert another coin"
                      : "Insert a coin"}
          </button>
          <p>
            {stock.soldOut
              ? "The case is empty until tomorrow."
              : `${stock.remaining} gifts remain. Drag the coin to the slot, or use this button to play.`}
          </p>
        </div>
      </main>
      <aside className="side">
        <StockBoard
          slots={topicStock}
          selectedSlotIndex={targetedSlotIndex}
          onSelectSlot={(idx) => setTargetedSlotIndex(idx)}
        />
        <Receipt
          product={phase === "idle" || phase === "vending" ? null : product}
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
