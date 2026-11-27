import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  isAudioMuted,
  playCapsulePop,
  playClunk,
  playCoinInsertDrop,
  playCoinReturn,
  playErrorBuzz,
  playFlapOpen,
  playKeypadBeep,
  playKidCoinCheer,
  playKidsCheer,
  playNudgeThump,
  playRouletteTick,
  playStinger,
  playTopicSelect,
  startPlanet,
  stopPlanet,
  toggleAudioMuted,
  unlockAudio,
} from "./audio";
import { loadCabinet, remember, shareUrl, type CabinetItem } from "./cabinet";
import { isHighRarity, type Product } from "./generate";
import { displayLine, noteVisit, type Readout } from "./machine/personality";
import { isSeed } from "./rng";
import { Crowd, type WalkKeys } from "./scene/Crowd";
import { Gallery, Machine, type CameraView, type Phase } from "./scene/Machine";
import { WorldCopy } from "./scene/Labels";
import { Reality } from "./scene/Reality";
import {
  claimSlot,
  COIL_CODES,
  familyForTurn,
  GIFT_TOPICS,
  prizeForSeed,
  resolveProduct,
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

const DAD_COIN_MS = 1150;
const KID_COIN_MS = 1550;
const VEND_MS = 3500;
const COLLECT_MS = 480;
const REALITY_MS = 5000;
const MOMENT_MS = 5000;

function initialProduct(): Product | null {
  const seed = new URLSearchParams(window.location.search).get("seed");
  if (!seed || !isSeed(seed)) return null;
  return resolveProduct(seed);
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
  const [collectMark, setCollectMark] = useState(0);
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
  const [selectedTopic, setSelectedTopic] = useState<GiftTopic>(() => {
    const initial = starting.current ? prizeForSeed(starting.current.seed) : null;
    return initial?.topic ?? "technology";
  });
  const [targetedSlotIndex, setTargetedSlotIndex] = useState<number | null>(null);
  const [rouletteSlotIndex, setRouletteSlotIndex] = useState<number | null>(null);
  const [vendingSlotIndex, setVendingSlotIndex] = useState<number | null>(null);
  const [coinPlayer, setCoinPlayer] = useState<CoinPlayer>("Dad");
  const [coinDurationMs, setCoinDurationMs] = useState(DAD_COIN_MS);
  const [playStep, setPlayStep] = useState<PlayStep>(() => (starting.current ? "revealed" : "need_coin"));
  const [coinMark, setCoinMark] = useState(0);
  const [typedCode, setTypedCode] = useState("");
  const [isSuspenseHanging, setIsSuspenseHanging] = useState(false);
  const [nudgeWarn, setNudgeWarn] = useState(false);
  const [keyTapAt, setKeyTapAt] = useState(0);
  const [coinsInserted, setCoinsInserted] = useState(0);
  const [shockAt, setShockAt] = useState(0);
  const [cameraView, setCameraView] = useState<CameraView>("default");
  const [cameraViewSeq, setCameraViewSeq] = useState(0);
  const [autoCam, setAutoCam] = useState(true);
  const [muted, setMuted] = useState(() => isAudioMuted());
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
  const rouletteActive = useRef(false);
  const walkKeysRef = useRef<WalkKeys>({ up: false, down: false, left: false, right: false });
  const setWalkDirection = (dir: keyof WalkKeys, pressed: boolean) => {
    walkKeysRef.current[dir] = pressed;
  };
  const targetedSlotRef = useRef<number | null>(null);
  targetedSlotRef.current = targetedSlotIndex;
  const typedCodeRef = useRef("");
  typedCodeRef.current = typedCode;
  const selectedTopicRef = useRef<GiftTopic>(selectedTopic);
  selectedTopicRef.current = selectedTopic;

  const focusCamera = (next: CameraView) => {
    setCameraView(next);
    setCameraViewSeq((s) => s + 1);
  };

  const handleToggleMute = () => {
    const nextMuted = toggleAudioMuted();
    setMuted(nextMuted);
    if (!nextMuted) unlockAudio();
  };

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
    if (playStep === "select_item") {
      setTypedCode("");
    } else if (playStep === "revealed" && !busy) {
      if (product) handOff(product.seed);
      setPhase("idle");
      setPlayStep("need_coin");
    }
    setTopicBounce((c) => c + 1);
    unlockAudio();
    playTopicSelect(next);
  };

  const chooseCoinPlayer = (next: CoinPlayer) => {
    setCoinPlayer(next);
    unlockAudio();
    if (next === "Dad") playKeypadBeep("A");
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
    rouletteActive.current = false;
    setRouletteSlotIndex(null);
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
    if (!todayStock().soldOut) {
      setAdvance((count) => count + 1);
    }
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
      } else if (mode === "vend" && next.rarity === "legendary" && !autoCam) {
        focusCamera("plinth");
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
      later(1900, () => handOff(next.seed));
    };

    if (mode === "vend") {
      playStinger(next.rarity);
    }
    if (next.type === "reality") {
      setPhase("reality");
      setMark(performance.now());
      later(REALITY_MS, () => {
        setPhase("revealed");
        if (mode === "vend") {
          later(1900, () => handOff(next.seed));
        }
      });
      return;
    }
    finishReveal();
  };

  const scheduleDropCompletion = (remainingMs: number) => {
    later(remainingMs, () => {
      setIsSuspenseHanging(false);
      setPhase("idle");
      setPlayStep("in_tray");
      setShockAt(performance.now());
    });
  };

  const show = (next: Product, mode: "vend" | "instant") => {
    clearTimers();
    stopPlanet();
    setListening(false);
    setCopied(false);
    setMoment(false);
    setNudgeWarn(false);
    setIsFullScreenTakeover(false);
    setProduct(next);

    if (mode === "vend") {
      unlockAudio();
      playClunk();
      setPhase("vending");
      setPlayStep("vending");
      setMark(performance.now());
      later(Math.round(VEND_MS * 0.48), () => setIsSuspenseHanging(true));
      later(Math.round(VEND_MS * 0.69), () => setIsSuspenseHanging(false));
      scheduleDropCompletion(VEND_MS);
      return;
    }

    completeRevealFor(next, "instant");
  };

  const startVendSlot = (slot: StockSlot) => {
    claimSlot(slot.index);
    setStock(todayStock());
    setVendingSlotIndex(slot.index);
    setTargetedSlotIndex(null);
    setRouletteSlotIndex(null);
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
    return undefined;
  };

  const runSurpriseRoulette = () => {
    if (rouletteActive.current) return;
    const freshStock = todayStock();
    const pool = freshStock.slots.filter((item) => !item.claimed && item.topic === selectedTopicRef.current);
    if (pool.length === 0) return;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) return;
    if (pool.length === 1) {
      startVendSlot(chosen);
      return;
    }

    rouletteActive.current = true;
    unlockAudio();
    const totalSteps = 6;
    for (let step = 0; step < totalSteps; step += 1) {
      const pick = step === totalSteps - 1 ? chosen : pool[(step * 7 + Math.floor(Math.random() * pool.length)) % pool.length];
      later(step * 75, () => {
        if (!pick) return;
        setRouletteSlotIndex(pick.index);
        setTargetedSlotIndex(pick.index);
        setTypedCode(pick.code);
        playRouletteTick(step);
        if (step === totalSteps - 1) {
          rouletteActive.current = false;
          later(90, () => startVendSlot(pick));
        }
      });
    }
  };

  const handleNudgeMachine = () => {
    if (playStep !== "vending") return;
    unlockAudio();
    playNudgeThump();
    setNudgeWarn(true);
    setShockAt(performance.now());
    later(950, () => setNudgeWarn(false));

    // If precariously balanced on the shelf lip, the nudge knocks it straight into the gravity chute!
    if (isSuspenseHanging) {
      clearTimers();
      setIsSuspenseHanging(false);
      const jumpProgress = 0.695;
      setMark(performance.now() - Math.round(VEND_MS * jumpProgress));
      scheduleDropCompletion(Math.round(VEND_MS * (1 - jumpProgress)));
    }
  };

  const handleInsertCoin = () => {
    if (
      playStep === "coin_entering" ||
      playStep === "vending" ||
      playStep === "in_tray" ||
      playStep === "collecting" ||
      phase === "reality" ||
      moment
    ) {
      return;
    }
    const fresh = todayStock();
    const hasInTopic = fresh.slots.some((item) => !item.claimed && item.topic === selectedTopicRef.current);
    if (fresh.soldOut || !hasInTopic) return;
    if (phase === "revealed" && product) {
      handOff(product.seed);
    }

    const ms = coinPlayer === "Dad" ? DAD_COIN_MS : KID_COIN_MS;
    setCoinDurationMs(ms);
    clearTimers();
    stopPlanet();
    setListening(false);
    setMoment(false);
    setNudgeWarn(false);
    setIsFullScreenTakeover(false);
    setVendingSlotIndex(null);
    setPhase("idle");
    setPlayStep("coin_entering");
    setCoinMark(performance.now());
    setCoinsInserted((c) => c + 1);
    unlockAudio();
    playCoinInsertDrop();
    if (coinPlayer !== "Dad") playKidCoinCheer();

    later(ms, () => {
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

  const handleCoinReturn = () => {
    if (playStep !== "select_item" || rouletteActive.current) return;
    unlockAudio();
    playCoinReturn();
    setTypedCode("");
    setTargetedSlotIndex(null);
    setCoinsInserted((c) => Math.max(0, c - 1));
    setPlayStep("need_coin");
  };

  const handleSelectSlot = (slotIndex: number) => {
    if (playStep === "coin_entering" || playStep === "vending" || playStep === "collecting" || rouletteActive.current) return;
    const fresh = todayStock();
    const slot = fresh.slots.find((item) => item.index === slotIndex);
    if (!slot || slot.claimed) {
      unlockAudio();
      playErrorBuzz();
      return;
    }
    unlockAudio();
    playKeypadBeep(slot.code[0] ?? "A");
    setKeyTapAt(Date.now());
    setSelectedTopic(slot.topic);
    setTypedCode(slot.code);
    setTargetedSlotIndex(slot.index);
    if (playStep === "select_item") {
      startVendSlot(slot);
    }
  };

  const handleKeyPress = (key: string) => {
    unlockAudio();
    if (rouletteActive.current) return;
    setKeyTapAt(Date.now());
    if (key === "CLR") {
      setTypedCode("");
      setTargetedSlotIndex(null);
      return;
    }
    if (key === "VEND") {
      if (playStep === "select_item") {
        if (targetedSlotRef.current !== null || typedCodeRef.current.length === 2) {
          const slot = resolveSlotToVend();
          if (slot) startVendSlot(slot);
          else playErrorBuzz();
        } else {
          runSurpriseRoulette();
        }
      } else if (playStep === "need_coin" || playStep === "revealed") {
        playErrorBuzz();
      }
      return;
    }
    if (["A", "B", "C", "D"].includes(key)) {
      setTypedCode(key);
      const topicMap: Record<string, GiftTopic> = { A: "technology", B: "audio", C: "snacks", D: "style" };
      if (topicMap[key]) chooseTopic(topicMap[key]);
      return;
    }
    if (["1", "2", "3", "4"].includes(key)) {
      const row =
        ["A", "B", "C", "D"].includes(typedCode)
          ? typedCode
          : COIL_CODES.find((_, idx) => stock.slots[idx]?.topic === selectedTopic)?.[0] ?? "A";
      const code = `${row}${key}`;
      setTypedCode(code);
      const match = todayStock().slots.find((item) => item.code === code && !item.claimed);
      if (match) {
        setSelectedTopic(match.topic);
        setTargetedSlotIndex(match.index);
        if (playStep === "select_item") {
          startVendSlot(match);
        }
      } else {
        playErrorBuzz();
      }
    }
  };

  const handleCollect = () => {
    if (playStep !== "in_tray" || !product) return;
    unlockAudio();
    playFlapOpen();
    setPlayStep("collecting");
    setCollectMark(performance.now());
    later(COLLECT_MS, () => {
      playCapsulePop();
      completeRevealFor(product, "vend");
    });
  };

  const handlePrimaryAction = () => {
    if (playStep === "in_tray") {
      handleCollect();
      return;
    }
    if (playStep === "vending" && isSuspenseHanging) {
      handleNudgeMachine();
      return;
    }
    if (playStep === "select_item") {
      if (targetedSlotRef.current !== null || typedCodeRef.current.length === 2) {
        const slot = resolveSlotToVend();
        if (slot) {
          startVendSlot(slot);
          return;
        }
      }
      const freshStock = todayStock();
      const hasCurrentTopic = freshStock.slots.some((item) => !item.claimed && item.topic === selectedTopicRef.current);
      if (!hasCurrentTopic) {
        const nextTopic = GIFT_TOPICS.find(
          (t) => t.id !== selectedTopicRef.current && freshStock.slots.some((item) => !item.claimed && item.topic === t.id),
        );
        if (nextTopic) chooseTopic(nextTopic.id);
        return;
      }
      runSurpriseRoulette();
      return;
    }
    const freshStock = todayStock();
    const hasCurrentTopic = freshStock.slots.some((item) => !item.claimed && item.topic === selectedTopicRef.current);
    if (!hasCurrentTopic) {
      const nextTopic = GIFT_TOPICS.find(
        (t) => t.id !== selectedTopicRef.current && freshStock.slots.some((item) => !item.claimed && item.topic === t.id),
      );
      if (nextTopic) chooseTopic(nextTopic.id);
      return;
    }
    handleInsertCoin();
  };

  // Keyboard shortcuts for snappy tactile keypad & action feel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (showJourney) return;

      const k = e.key.toUpperCase();
      if (k === "ESCAPE") {
        if (isFullScreenTakeover) {
          setIsFullScreenTakeover(false);
        } else if (playStep === "select_item") {
          handleCoinReturn();
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        handlePrimaryAction();
        return;
      }
      if (k === "ENTER") {
        e.preventDefault();
        handlePrimaryAction();
        return;
      }
      if (k === "BACKSPACE") {
        if (playStep === "select_item" && !typedCode) {
          handleCoinReturn();
        } else {
          playKeypadBeep("CLR");
          handleKeyPress("CLR");
        }
        return;
      }
      if (["A", "B", "C", "D", "1", "2", "3", "4"].includes(k)) {
        unlockAudio();
        playKeypadBeep(k);
        handleKeyPress(k);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Directional arrow keys walk the 3D family on the arcade floor (leaving A-D/1-4 for keypad!)
  useEffect(() => {
    const clearWalk = () => {
      walkKeysRef.current.up = false;
      walkKeysRef.current.down = false;
      walkKeysRef.current.left = false;
      walkKeysRef.current.right = false;
    };
    const keyToDir = (key: string): keyof WalkKeys | null => {
      if (key === "ArrowUp") return "up";
      if (key === "ArrowDown") return "down";
      if (key === "ArrowLeft") return "left";
      if (key === "ArrowRight") return "right";
      return null;
    };
    const onArrowDown = (e: KeyboardEvent) => {
      if (showJourney) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      walkKeysRef.current[dir] = true;
    };
    const onArrowUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key);
      if (dir) walkKeysRef.current[dir] = false;
    };
    window.addEventListener("keydown", onArrowDown);
    window.addEventListener("keyup", onArrowUp);
    window.addEventListener("blur", clearWalk);
    return () => {
      clearWalk();
      window.removeEventListener("keydown", onArrowDown);
      window.removeEventListener("keyup", onArrowUp);
      window.removeEventListener("blur", clearWalk);
    };
  }, [showJourney]);

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
  const activeFamily = familyForTurn(advance);
  const coinPlayerLabel =
    coinPlayer === "Dad"
      ? activeFamily.parentName
      : coinPlayer === "Leo"
        ? activeFamily.youngerKid.name
        : activeFamily.olderKid.name;
  const isNewFamilyGreeting =
    advance > 0 && playStep === "revealed" && Boolean(product && handed.current === product.seed);
  const busy =
    playStep === "coin_entering" ||
    playStep === "collecting" ||
    (phase === "vending" && !isSuspenseHanging) ||
    phase === "reality" ||
    moment;
  const topicStock = stock.slots.filter((item) => item.topic === selectedTopic);
  const availableGifts = topicStock.filter((item) => !item.claimed);
  const selectedGift = availableGifts[0] ?? null;
  const remainingTopics = GIFT_TOPICS.map((topic) => ({
    id: topic.id,
    label: topic.label,
    icon: topic.icon,
    remaining: stock.slots.filter((slot) => !slot.claimed && slot.topic === topic.id).length,
  })).filter((topic) => topic.remaining > 0);
  const currentTopicInfo = GIFT_TOPICS.find((topic) => topic.id === selectedTopic) ?? GIFT_TOPICS[0];
  const nextAvailableTopic = remainingTopics.find((topic) => topic.id !== selectedTopic) ?? remainingTopics[0] ?? null;
  const targetedSlot = targetedSlotIndex !== null ? stock.slots.find((item) => item.index === targetedSlotIndex && !item.claimed) ?? null : null;
  const showPlinth = (phase === "revealed" && playStep === "revealed") && !moment;
  const impossibleKept = cabinet.some((item) => item.rarity === "impossible");
  const closed =
    !selectedGift &&
    playStep !== "coin_entering" &&
    playStep !== "select_item" &&
    playStep !== "vending" &&
    playStep !== "in_tray" &&
    playStep !== "collecting" &&
    phase !== "vending" &&
    phase !== "reality";

  const readout: Readout = closed
    ? {
        label: stock.soldOut ? "Sold out" : "Category empty",
        text: stock.soldOut
          ? "Come back tomorrow again."
          : nextAvailableTopic
            ? `Move to ${nextAvailableTopic.label}`
            : "Try another gift shelf.",
        detail: stock.soldOut
          ? "Every category has been claimed for today. Tomorrow brings fresh prizes."
          : `All ${currentTopicInfo?.label ?? selectedTopic} items claimed! Ask the family to move to ${remainingTopics.map((r) => `${r.label} (${r.remaining})`).join(", ")}.`,
        tone: "warn",
      }
    : nudgeWarn
      ? {
          label: "Tilt sensor",
          text: "Do not shake the case!",
          detail: "Good thing it cleared the shelf lip just as the frame shook!",
          tone: "fault",
        }
      : playStep === "coin_entering"
        ? {
            label: coinPlayerLabel,
            text: `${coinPlayerLabel} is inserting the coin`,
            detail: "Dropping a shiny $1 coin down the validator slot.",
            tone: "warn",
          }
        : playStep === "select_item"
          ? {
              label: "Credit $1",
              text: typedCode
                ? stock.slots.some((s) => s.code === typedCode && s.claimed)
                  ? `Coil ${typedCode} empty`
                  : `Code ${typedCode} locked`
                : "Press A1–D4 or Kids' Pick",
              detail: "Click any prize behind the glass, press keypad buttons (or keyboard A–D / 1–4), or spin Kids' Pick.",
              tone: "warn",
            }
          : playStep === "vending" && isSuspenseHanging
            ? {
                label: "Edge hang!",
                text: "Teetering on the lip...",
                detail: "Holding breath! Tap the glass (or Space) to nudge it loose!",
                tone: "warn",
              }
            : playStep === "in_tray"
              ? {
                  label: "Delivered",
                  text: "Push the bottom flap",
                  detail: "Your prize landed in the pickup bin! Push the green door below to grab & open it.",
                  tone: "warn",
                }
              : playStep === "collecting"
                ? {
                    label: "Opening",
                    text: "Unboxing prize...",
                    detail: "Lifting capsule onto the velvet display pedestal.",
                    tone: "warn",
                  }
                : phase === "idle" && targetedSlot
                  ? {
                      label: `Slot ${targetedSlot.code}`,
                      text: targetedSlot.product.title,
                      detail: `${targetedSlot.code} selected ($1). Drag or insert coin with ${coinPlayerLabel} to vend.`,
                      tone: "warn",
                    }
                  : phase === "idle" && selectedGift
                    ? {
                        label: "Ready $1",
                        text: "Pick a coil & insert coin",
                        detail: `Choose ${coinPlayerLabel} to drop the coin, or drag the gold $1 coin from the side tray into the slot.`,
                        tone: "calm",
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
    (playStep !== "in_tray" && playStep !== "select_item" && playStep !== "vending" && stock.soldOut);

  const actionLabel = () => {
    if (playStep === "coin_entering") return `${coinPlayerLabel} inserting coin...`;
    if (playStep === "vending" && isSuspenseHanging) return "Nudge Glass Loose!";
    if (playStep === "vending" || phase === "vending") return "Spiral Coil Turning...";
    if (playStep === "collecting") return "Opening Capsule...";
    if (phase === "reality") return "Five Seconds";
    if (playStep === "in_tray") return "Push Flap & Grab Prize!";
    if (playStep === "select_item") {
      if (!selectedGift && nextAvailableTopic) return `Move to ${nextAvailableTopic.icon} ${nextAvailableTopic.label}`;
      return typedCode ? `Dispense ${typedCode}` : "Kids' Pick Surprise!";
    }
    if (stock.soldOut) return "Come Back Tomorrow";
    if (!selectedGift && nextAvailableTopic) return `Move to ${nextAvailableTopic.icon} ${nextAvailableTopic.label}`;
    if (targetedSlot) return `${coinPlayerLabel}: Insert Coin for ${targetedSlot.code}`;
    return isNewFamilyGreeting
      ? `${coinPlayerLabel}: Next Family Insert $1`
      : product
        ? `${coinPlayerLabel}: Insert Another $1 Coin`
        : `${coinPlayerLabel}: Insert $1 Coin`;
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
              <p className="kicker">Starlight Mall · Level 2 Arcade</p>
              <span className="kids-status-pill">
                👧 {activeFamily.olderKid.name} &amp; 👦 {activeFamily.youngerKid.name} at the glass
              </span>
              <button
                type="button"
                className="journey-trigger-btn"
                onClick={() => setShowJourney(true)}
                title="Replay the family drive & mall elevator trip!"
              >
                🚗 <span>Mall Trip</span>
              </button>
              <button
                type="button"
                className="hud-chip-btn"
                onClick={handleToggleMute}
                title={muted ? "Unmute vending sounds" : "Mute vending sounds"}
              >
                {muted ? "🔇 Muted" : "🔊 Sound"}
              </button>
              <div className="camera-pills" role="group" aria-label="Camera angle">
                <button
                  type="button"
                  className={`hud-chip-btn ${autoCam ? "active" : ""}`}
                  onClick={() => {
                    setAutoCam((v) => !v);
                    if (!autoCam) focusCamera("default");
                  }}
                  title="Automatically follow the coin, spinning coil, chute & prize in 3D"
                >
                  {autoCam ? "🎯 Auto-Cam" : "Auto-Cam Off"}
                </button>
                {(
                  [
                    { id: "default", label: "Front" },
                    { id: "controls", label: "Keypad" },
                    { id: "plinth", label: "Plinth" },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`hud-chip-btn ${cameraView === v.id ? "active" : ""}`}
                    onClick={() => focusCamera(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <h1>The Impossible Vending Machine</h1>
          </div>
          <div className="header-stats">
            <p className="kept" title="Coins used this session">
              Spent <span>${coinsInserted}</span>
            </p>
            <p className="kept">
              Kept <span>{cabinet.length}</span>
            </p>
          </div>
        </header>

        <div className="stage">
          <Canvas
            frameloop={showJourney ? "never" : "always"}
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [0.06, 1.46, 2.82], fov: 50 }}
            gl={{
              antialias: true,
              preserveDrawingBuffer: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.08,
            }}
            onCreated={({ gl }) => {
              gl.domElement.style.touchAction = "none";
            }}
          >
            <Gallery
              phase={phase}
              playStep={playStep}
              sky={sky}
              topic={selectedTopic}
              rarity={product?.rarity ?? null}
              fullScreen={isFullScreenTakeover}
              autoCam={autoCam}
              cameraView={cameraView}
              cameraViewSeq={cameraViewSeq}
              vendingSlotIndex={vendingSlotIndex}
              vendStarted={mark}
              vendMs={VEND_MS}
              shockAt={shockAt}
            >
              <Machine
                phase={phase}
                playStep={playStep}
                coinStarted={coinMark}
                coinMs={coinDurationMs}
                vendStarted={mark}
                vendMs={VEND_MS}
                collectStarted={collectMark}
                product={product}
                canInsert={!busy && !stock.soldOut && Boolean(selectedGift)}
                onInsert={handleInsertCoin}
                onCoinReturn={handleCoinReturn}
                onNudgeMachine={handleNudgeMachine}
                topic={selectedTopic}
                targetedSlotIndex={targetedSlotIndex}
                rouletteSlotIndex={rouletteSlotIndex}
                vendingSlotIndex={vendingSlotIndex}
                typedCode={typedCode}
                coinPlayer={coinPlayer}
                nudgeWarn={nudgeWarn}
                onSelectSlotIndex={handleSelectSlot}
                onKeyPress={handleKeyPress}
                onCollect={handleCollect}
                stock={stock.slots.map((slot) => ({
                  shape: slot.shape,
                  name: slot.product.title,
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
                coinStarted={coinMark}
                coinMs={coinDurationMs}
                vendStarted={mark}
                vendMs={VEND_MS}
                isSuspenseHanging={isSuspenseHanging}
                arrivalSeq={arrivalSeq}
                focusSlotIndex={vendingSlotIndex ?? targetedSlotIndex}
                topic={selectedTopic}
                keyTapAt={keyTapAt}
                nudgeWarn={nudgeWarn}
                rarity={product?.rarity ?? null}
                manualInputRef={walkKeysRef}
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
            family={activeFamily}
            isNewFamilyGreeting={isNewFamilyGreeting}
            topic={selectedTopic}
            topicRemaining={availableGifts.length}
            remainingTopics={remainingTopics}
            soldOut={stock.soldOut}
            onMoveToTopic={chooseTopic}
            phase={phase}
            playStep={playStep}
            coinPlayer={coinPlayer}
            isSuspenseHanging={isSuspenseHanging}
            nudgeWarn={nudgeWarn}
            product={product}
            onNudge={handleNudgeKids}
          />
          {phase !== "reality" && !isFullScreenTakeover ? (
            <>
              <div className="stage-cam-hint">
                🖱 Drag: Orbit · Right-Drag: Pan · Scroll: Zoom · ↑↓←→ Walk Family
              </div>
              <div className="dpad-overlay stage-walk-pad" aria-label="Walk family around floor">
                <button
                  type="button"
                  className="dpad-btn up"
                  onPointerDown={() => setWalkDirection("up", true)}
                  onPointerUp={() => setWalkDirection("up", false)}
                  onPointerLeave={() => setWalkDirection("up", false)}
                  onPointerCancel={() => setWalkDirection("up", false)}
                  title="Walk Closer (↑)"
                >
                  ▲
                </button>
                <div className="dpad-mid">
                  <button
                    type="button"
                    className="dpad-btn"
                    onPointerDown={() => setWalkDirection("left", true)}
                    onPointerUp={() => setWalkDirection("left", false)}
                    onPointerLeave={() => setWalkDirection("left", false)}
                    onPointerCancel={() => setWalkDirection("left", false)}
                    title="Walk Left (←)"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="dpad-btn"
                    onPointerDown={() => setWalkDirection("down", true)}
                    onPointerUp={() => setWalkDirection("down", false)}
                    onPointerLeave={() => setWalkDirection("down", false)}
                    onPointerCancel={() => setWalkDirection("down", false)}
                    title="Walk Back (↓)"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="dpad-btn"
                    onPointerDown={() => setWalkDirection("right", true)}
                    onPointerUp={() => setWalkDirection("right", false)}
                    onPointerLeave={() => setWalkDirection("right", false)}
                    onPointerCancel={() => setWalkDirection("right", false)}
                    title="Walk Right (→)"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </>
          ) : null}
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
            <FullScreenScreenshotOverlay product={product} onExit={() => setIsFullScreenTakeover(false)} />
          ) : null}
        </div>

        <div className="controls">
          {!stock.soldOut ? (
            <div className="topic-picker" aria-label="Choose a gift topic">
              <p className="kicker">Choose a category · Only selected category items are shown</p>
              <div className="topic-options" role="group" aria-label="Gift topics">
                {GIFT_TOPICS.map((topic) => {
                  const available = stock.slots.filter((slot) => !slot.claimed && slot.topic === topic.id);
                  const classes = [
                    "topic-option",
                    selectedTopic === topic.id ? "selected" : "",
                    available.length === 0 ? "sold-out" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={classes}
                      aria-pressed={selectedTopic === topic.id}
                      onClick={() => chooseTopic(topic.id)}
                    >
                      <div className="topic-header-line">
                        <span className="topic-icon">{topic.icon}</span>
                        <strong>{topic.label}</strong>
                      </div>
                      <span className="topic-vote">{topic.kidsVote}</span>
                      <small>
                        {available.length ? `${available.length} gift${available.length === 1 ? "" : "s"} left` : "All claimed"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {closed ? (
            <div className="next-ask closed-note" role="status">
              <p className="kicker">{stock.soldOut ? "All categories empty" : `${currentTopicInfo?.label ?? selectedTopic} finished`}</p>
              <h2>{stock.soldOut ? "Come back tomorrow again" : "Move family to another category"}</h2>
              <p>
                {stock.soldOut
                  ? "Every category and prize for today has been claimed. Come back tomorrow again for a restocked machine."
                  : `All ${currentTopicInfo?.label ?? selectedTopic} items are claimed! Ask the family to move to a remaining category:`}
              </p>
              {!stock.soldOut && remainingTopics.length > 0 ? (
                <div className="closed-move-links">
                  {remainingTopics.map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      className="move-topic-chip"
                      onClick={() => chooseTopic(rt.id)}
                    >
                      {rt.icon} Move to {rt.label} ({rt.remaining} left) →
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="coin-action-row">
            <div className="coin-player-toggle" role="group" aria-label="Who inserts the coin">
              {(["Dad", "Leo", "Maya"] as const).map((member) => {
                const label =
                  member === "Dad"
                    ? `${activeFamily.parentIcon} ${activeFamily.parentName}`
                    : member === "Leo"
                      ? `👦 ${activeFamily.youngerKid.name}`
                      : `👧 ${activeFamily.olderKid.name}`;
                const cleanName =
                  member === "Dad"
                    ? activeFamily.parentName
                    : member === "Leo"
                      ? activeFamily.youngerKid.name
                      : activeFamily.olderKid.name;
                return (
                  <button
                    key={member}
                    type="button"
                    className={coinPlayer === member ? "coin-player-pill active" : "coin-player-pill"}
                    aria-pressed={coinPlayer === member}
                    disabled={busy}
                    onClick={() => chooseCoinPlayer(member)}
                    title={`Let ${cleanName} insert the coin`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button type="button" className="coin" disabled={actionDisabled} onClick={handlePrimaryAction}>
              {actionLabel()}
            </button>
            {playStep === "select_item" ? (
              <button
                type="button"
                className="coin-return-pill"
                onClick={handleCoinReturn}
                title="Cancel and press coin return lever (Esc)"
              >
                ↩ Return Coin
              </button>
            ) : null}
          </div>
          <p>
            {stock.soldOut && playStep !== "in_tray" && playStep !== "collecting"
              ? "All categories are empty today — come back tomorrow again!"
              : !selectedGift && nextAvailableTopic && playStep !== "in_tray" && playStep !== "collecting"
                ? `All ${currentTopicInfo?.label ?? selectedTopic} items claimed — move to ${nextAvailableTopic.label} (${remainingTopics.length} categor${remainingTopics.length === 1 ? "y" : "ies"} left).`
                : playStep === "select_item"
                  ? "Credit $1 in! Click a shelf capsule, use the 3D keypad (keys A–D, 1–4), or hit Kids' Pick."
                  : playStep === "vending" && isSuspenseHanging
                    ? "Balanced on the shelf edge! Click the glass, press Space, or hit Nudge to drop it!"
                    : playStep === "in_tray"
                      ? "Thud! Look inside the bottom pickup pocket — push the green flap to grab & open your prize!"
                      : `${availableGifts.length} ${currentTopicInfo?.label.toLowerCase()} gift${availableGifts.length === 1 ? "" : "s"} left (${stock.remaining} total) · Drag the gold $1 coin or press Enter.`}
          </p>
        </div>
      </main>
      <aside className="side">
        <StockBoard
          slots={topicStock}
          selectedSlotIndex={targetedSlotIndex}
          onSelectSlot={handleSelectSlot}
          topicLabel={currentTopicInfo?.label ?? selectedTopic}
          remainingTopics={remainingTopics}
          soldOut={stock.soldOut}
          onMoveToTopic={chooseTopic}
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
          onOpen={(seed) => {
            const meta = prizeForSeed(seed);
            if (meta) setSelectedTopic(meta.topic);
            setIsSuspenseHanging(false);
            setNudgeWarn(false);
            setVendingSlotIndex(null);
            setTargetedSlotIndex(null);
            setTypedCode("");
            show(resolveProduct(seed), "instant");
          }}
        />
      </aside>
      {showJourney ? <FamilyJourney onComplete={handleCompleteJourney} /> : null}
    </div>
  );
}
