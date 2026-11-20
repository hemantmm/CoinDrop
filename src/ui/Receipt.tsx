import { useEffect, useState } from "react";
import { getPlanetLevel } from "../audio";
import {
  RARITY_COLOR,
  TYPE_LABEL,
  type Product,
  type RealityPayload,
} from "../generate";

export function LevelBars({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const loop = () => {
      setLevel(getPlanetLevel());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div className="bars" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => {
        const wave = 0.18 + ((index * 17) % 10) / 14;
        const height = active ? 0.15 + level * (0.45 + wave) : 0.16;
        return <span key={index} style={{ transform: `scaleY(${height})` }} />;
      })}
    </div>
  );
}

function PlinthBody({ product, listening }: { product: Product; listening: boolean }) {
  const payload = product.payload;
  if (payload.kind === "memory") {
    return (
      <article className="object memory">
        <p className="kicker">{payload.date}</p>
        <h3>{payload.place}</h3>
        <p>{payload.sensory}</p>
        <p className="detail">{payload.detail}</p>
      </article>
    );
  }
  if (payload.kind === "letter") {
    return (
      <article className="object letter">
        <p className="kicker">Unsent · {payload.year}</p>
        <p className="salute">{payload.salutation}</p>
        <p>{payload.body}</p>
        <p className="signoff">{payload.signoff}</p>
        <p className="signature">{payload.signature}</p>
      </article>
    );
  }
  if (payload.kind === "sound") {
    return (
      <article className="object sound">
        <p className="kicker">Now playing</p>
        <h3>{payload.planet}</h3>
        <LevelBars active={listening} />
        <p>{payload.notes.join(" · ")}</p>
      </article>
    );
  }
  return null;
}

export function PlinthCard({
  product,
  hidden,
  listening,
  placed = false,
}: {
  product: Product | null;
  hidden: boolean;
  listening: boolean;
  placed?: boolean;
}) {
  if (!product || hidden) return null;
  if (product.type === "creature" || product.type === "reality") return null;
  return (
    <div className={placed ? "plinth-card in-world" : "plinth-card"}>
      <PlinthBody product={product} listening={listening} />
    </div>
  );
}

export function CreatureLabel({
  product,
  hidden,
  placed = false,
}: {
  product: Product | null;
  hidden: boolean;
  placed?: boolean;
}) {
  if (!product || hidden || product.type !== "creature") return null;
  return (
    <div className={placed ? "creature-label in-world" : "creature-label"}>
      <span>{product.serial}</span>
      <strong>{product.title}</strong>
    </div>
  );
}

export function FullScreenScreenshotOverlay({
  product,
  onExit,
}: {
  product: Product;
  onExit: () => void;
}) {
  const [cleanView, setCleanView] = useState(false);
  const [captured, setCaptured] = useState(false);

  const takeScreenshot = () => {
    try {
      const canvas = document.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        link.download = `impossible-vm-${product.rarity}-${product.serial}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setCaptured(true);
        setTimeout(() => setCaptured(false), 2000);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`fullscreen-hud ${cleanView ? "clean-mode" : ""}`}
      onClick={(e) => {
        // Toggle clean view on clicking empty canvas space
        if (e.target === e.currentTarget) {
          setCleanView((v) => !v);
        }
      }}
    >
      <header className="fs-header">
        <div className="fs-badge-group">
          <span className={`fs-rarity-pill pill-${product.rarity}`}>
            {product.rarity === "impossible"
              ? "🌌 REALITY BREACH // IMPOSSIBLE"
              : product.rarity === "legendary"
                ? "✦ LEGENDARY 1 OF 1 COLLECTIBLE ✦"
                : `✧ ${product.rarity.toUpperCase()} FIND ✧`}
          </span>
          <span className="fs-serial">{product.serial}</span>
        </div>
        <h1 className="fs-title">{product.title}</h1>
        <p className="fs-desc">{product.line}</p>
      </header>

      <footer className="fs-footer">
        <div className="fs-actions">
          <button type="button" className="fs-btn primary" onClick={takeScreenshot}>
            {captured ? "✓ Saved to Photos" : "📸 Capture Screenshot"}
          </button>
          <button
            type="button"
            className="fs-btn secondary"
            onClick={() => setCleanView((v) => !v)}
            title="Hide all UI for a pristine screenshot"
          >
            {cleanView ? "Show Details" : "👁 Clean View"}
          </button>
          <button type="button" className="fs-btn ghost" onClick={onExit}>
            ✕ Return to Mall
          </button>
        </div>
        <p className="fs-hint">Tip: Click anywhere or use Clean View to hide all buttons for wallpaper photos.</p>
      </footer>
    </div>
  );
}

export function Receipt({
  product,
  copied,
  listening,
  onCopy,
  onShare,
  onToggleSound,
  onReplay,
  onOpenScreenshot,
}: {
  product: Product | null;
  copied: boolean;
  listening: boolean;
  onCopy: () => void;
  onShare: () => void;
  onToggleSound: () => void;
  onReplay: () => void;
  onOpenScreenshot?: () => void;
}) {
  if (!product) {
    return (
      <section className="receipt empty">
        <p className="kicker">The machine</p>
        <h2>Nothing has been dispensed.</h2>
        <p className="lede">
          You are standing at the case with the kids. They can see the iPhone, the MacBook, the watch, the chocolate, and the rest. Your coin takes the next one.
        </p>
        <ul className="odds">
          {(["common", "uncommon", "rare", "legendary", "impossible"] as const).map((rarity) => (
            <li key={rarity} style={{ color: RARITY_COLOR[rarity] }}>
              {rarity}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const isLegendary = product.rarity === "legendary";
  const isImpossible = product.rarity === "impossible";
  const isRare = product.rarity === "rare";

  const cardContent = (
    <>
      <div className="receipt-top">
        <div className="receipt-tag-group">
          <p className="kicker" style={{ color: RARITY_COLOR[product.rarity] }}>
            {product.rarity}
          </p>
          {isLegendary && <span className="legendary-crest">★ 1 OF 1 MINT</span>}
          {isImpossible && <span className="impossible-anomaly-tag">⚠ ANOMALY DETECTED</span>}
        </div>
        <p className="serial">{product.serial}</p>
      </div>

      {isImpossible && (
        <div className="malfunction-notice">
          <strong>MACHINE MALFUNCTION DETECTED</strong>
          <small>Reality parameters corrupted. Item defies local space-time.</small>
        </div>
      )}

      <h2>{product.title}</h2>
      <p className="type">{TYPE_LABEL[product.type]}</p>
      <p className="line">{product.line}</p>
      <ul className="traits">
        {product.traits.map((trait) => (
          <li key={trait}>{trait}</li>
        ))}
      </ul>

      <div className="actions">
        {onOpenScreenshot && (
          <button type="button" className="screenshot-trigger-btn" onClick={onOpenScreenshot}>
            📸 3D Screenshot View
          </button>
        )}
        <button type="button" onClick={onCopy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" className="ghost" onClick={onShare}>
          Share
        </button>
        {product.type === "sound" ? (
          <button type="button" className="ghost" onClick={onToggleSound}>
            {listening ? "Stop sound" : "Play sound"}
          </button>
        ) : null}
        {product.type === "reality" ? (
          <button type="button" className="ghost" onClick={onReplay}>
            Replay five seconds
          </button>
        ) : null}
      </div>
    </>
  );

  if (isLegendary) {
    return (
      <div className="legendary-collectible-wrapper">
        <div className="legendary-gold-corners top-left">✦</div>
        <div className="legendary-gold-corners top-right">✦</div>
        <div className="legendary-gold-corners bottom-left">✦</div>
        <div className="legendary-gold-corners bottom-right">✦</div>
        <section className="receipt legendary-collectible-frame" data-rarity="legendary">
          <div className="legendary-holo-sheen" aria-hidden="true" />
          {cardContent}
        </section>
      </div>
    );
  }

  if (isRare) {
    return (
      <section className="receipt rare-glow-frame" data-rarity="rare">
        {cardContent}
      </section>
    );
  }

  return (
    <section className="receipt common-frame" data-rarity={product.rarity}>
      {cardContent}
    </section>
  );
}

export function RealityOverlay({
  spec,
  startedAt,
  copied,
  onCopy,
}: {
  spec: RealityPayload;
  startedAt: number;
  copied: boolean;
  onCopy: () => void;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [startedAt]);

  const elapsed = (now - startedAt) / 1000;
  const left = Math.max(0, Math.ceil(5 - elapsed));
  const beat = [...spec.beats].reverse().find((item) => elapsed >= item.at) ?? spec.beats[0];

  return (
    <div className="reality-overlay">
      <p className="reality-count">{left}</p>
      <p key={beat?.line} className="reality-kicker">
        {beat?.line}
      </p>
      <h2>{spec.rule}</h2>
      <button type="button" onClick={onCopy}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function Moment({
  product,
  copied,
  onCopy,
  onDismiss,
}: {
  product: Product;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={`moment moment-${product.rarity}`} onClick={onDismiss} role="presentation">
      <p className="kicker">{product.rarity}</p>
      <h2>{product.title}</h2>
      <p className="moment-line">{product.line}</p>
      <p className="serial">{product.serial}</p>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCopy();
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
