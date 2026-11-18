import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playClunk, playStinger, startPlanet, stopPlanet, unlockAudio } from "./audio";
import { loadCabinet, remember, shareUrl, type CabinetItem } from "./cabinet";
import { generate, isHighRarity, type Product } from "./generate";
import { displayLine, noteVisit, type Readout } from "./machine/personality";
import { isSeed } from "./rng";
import { Crowd } from "./scene/Crowd";
import { Gallery, Machine, type Phase } from "./scene/Machine";
import { WorldCopy } from "./scene/Labels";
import { Reality } from "./scene/Reality";
import { claimSlot, todayStock, type DayStock } from "./stock";
import { Cabinet } from "./ui/Cabinet";
import { Moment, RealityOverlay, Receipt } from "./ui/Receipt";
import { StockBoard } from "./ui/StockBoard";

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
  const [askNext, setAskNext] = useState(false);
  const [advance, setAdvance] = useState(0);
  const [stock, setStock] = useState<DayStock>(() => todayStock());
  const [canShare, setCanShare] = useState(false);
  const timers = useRef<number[]>([]);
  const copyTimer = useRef<number | null>(null);

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

  const show = (next: Product, mode: "vend" | "instant") => {
    clearTimers();
    stopPlanet();
    setListening(false);
    setCopied(false);
    setMoment(false);
    setAskNext(false);
    setProduct(next);
    const url = new URL(window.location.href);
    url.searchParams.set("seed", next.seed);
    window.history.replaceState({}, "", url);

    const finishReveal = () => {
      setPhase("revealed");
      setMark(performance.now());
      if (next.type === "sound" && next.payload.kind === "sound" && mode === "vend") {
        startPlanet(next.payload);
        setListening(true);
      }
      if (mode !== "vend") return;
      if (isHighRarity(next.rarity) && next.type !== "reality" && next.type !== "creature") {
        setMoment(true);
        later(MOMENT_MS, () => {
          setMoment(false);
          setAskNext(true);
        });
        return;
      }
      setAskNext(true);
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
            setAskNext(true);
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
    if (busy || stock.soldOut || !stock.next) return;
    const slot = stock.next;
    claimSlot(slot.index);
    setStock(todayStock());
    setCabinet(remember(slot.product));
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
  const showPlinth = phase === "revealed" && !moment;
  const impossibleKept = cabinet.some((item) => item.rarity === "impossible");
  const closed = stock.soldOut && phase !== "vending" && phase !== "reality";
  const readout: Readout = closed
    ? {
        label: "Closed",
        text: "Come back tomorrow.",
        detail: "Today's prizes are gone. Tomorrow holds more exciting ones.",
        tone: "warn",
      }
    : phase === "idle" && stock.next
      ? {
          label: "For you",
          text: stock.next.product.title,
          detail: "Only the person at the front is offered this one.",
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
    <div className="shell" data-rarity={product?.rarity ?? "none"} data-phase={phase}>
      <main className="main">
        <header className="top">
          <div>
            <p className="kicker">Gallery machine</p>
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
            camera={{ position: [2.55, 1.72, 4.35], fov: 42 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
            }}
            onCreated={({ camera, gl }) => {
              camera.lookAt(0, 0.95, 0);
              gl.domElement.style.touchAction = "none";
            }}
          >
            <Gallery phase={phase} sky={sky}>
              <Machine
                phase={phase}
                vendStarted={mark}
                vendMs={VEND_MS}
                product={product}
                canInsert={!busy && !stock.soldOut}
                onInsert={takeNext}
                stock={stock.slots.map((slot) => ({
                  shape: slot.shape,
                  color: slot.color,
                  claimed: slot.claimed,
                }))}
              />
              <Crowd phase={phase} advance={advance} />
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
          {phase === "reality" && product?.payload.kind === "reality" ? (
            <RealityOverlay spec={product.payload} startedAt={mark} copied={copied} onCopy={() => void copyLink()} />
          ) : null}
          {moment && product ? (
            <Moment product={product} copied={copied} onCopy={() => void copyLink()} onDismiss={() => setMoment(false)} />
          ) : null}
        </div>
        <div className="controls">
          {askNext ? (
            <div className="next-ask" role="dialog" aria-labelledby="next-ask-title">
              <p className="kicker">Turn over</p>
              <h2 id="next-ask-title">Call the next person?</h2>
              <p>The one at the rope has a coin ready.</p>
              <div className="next-actions">
                <button type="button" onClick={() => { setAskNext(false); setAdvance((count) => count + 1); }}>
                  Yes, next
                </button>
                <button type="button" className="quiet" onClick={() => setAskNext(false)}>
                  Not yet
                </button>
              </div>
            </div>
          ) : null}
          {closed ? (
            <div className="next-ask closed-note" role="status">
              <p className="kicker">Sold out</p>
              <h2>Come back tomorrow</h2>
              <p>Today's prizes are finished. Return tomorrow to continue, and for more exciting prizes.</p>
            </div>
          ) : null}
          <button type="button" className="coin" disabled={busy || stock.soldOut} onClick={takeNext}>
            {stock.soldOut
              ? "Come back tomorrow"
              : phase === "vending"
                ? "Dispensing"
                : phase === "reality"
                  ? "Five seconds"
                  : product
                    ? "Insert another coin"
                    : "Insert coin"}
          </button>
          <p>
            {stock.soldOut
              ? "The case is empty until tomorrow."
              : `${stock.remaining} prizes are still inside. Insert a coin to take the next one.`}
          </p>
        </div>
      </main>
      <aside className="side">
        <StockBoard slots={stock.slots} />
        <Receipt
          product={phase === "idle" || phase === "vending" ? null : product}
          copied={copied}
          listening={listening}
          onCopy={() => void copyLink()}
          onShare={() => void share()}
          onToggleSound={toggleSound}
          onReplay={replay}
        />
        <Cabinet
          items={cabinet}
          activeSeed={product?.seed ?? null}
          onOpen={(seed) => show(generate(seed), "instant")}
        />
      </aside>
    </div>
  );
}
