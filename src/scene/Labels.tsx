import { useEffect, useState } from "react";
import * as THREE from "three";
import type { Product } from "../generate";
import type { Readout } from "../machine/personality";

function wrap(pen: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (pen.measureText(trial).width > maxWidth && line) {
      pen.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) pen.fillText(line, x, cursor);
  return cursor + lineHeight;
}

function cardTexture(product: Product) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  const payload = product.payload;
  const paper = payload.kind === "letter";
  pen.fillStyle = paper ? "#f4efe4" : "rgba(14, 15, 22, 0.96)";
  pen.fillRect(0, 0, canvas.width, canvas.height);
  pen.strokeStyle = paper ? "#c4b49a" : "rgba(224, 177, 90, 0.78)";
  pen.lineWidth = 10;
  pen.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  const ink = paper ? "#241c16" : "#f3ecdf";
  const muted = paper ? "#4a4036" : "#e0b15a";
  pen.textAlign = "left";
  pen.textBaseline = "top";
  pen.fillStyle = muted;
  pen.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";

  if (payload.kind === "memory") {
    pen.fillText(payload.date.toUpperCase(), 64, 56);
    pen.fillStyle = ink;
    pen.font = "600 64px Fraunces, Palatino, serif";
    const next = wrap(pen, payload.place, 64, 112, 880, 72);
    pen.font = "400 32px Fraunces, Palatino, serif";
    const body = wrap(pen, payload.sensory, 64, next + 12, 880, 42);
    pen.fillStyle = "#8a5a22";
    wrap(pen, payload.detail, 64, body + 8, 880, 40);
  } else if (payload.kind === "letter") {
    pen.fillText(`UNSENT · ${payload.year}`, 64, 52);
    pen.fillStyle = ink;
    pen.font = "500 30px 'IBM Plex Mono', ui-monospace, monospace";
    pen.fillText(payload.salutation, 64, 112);
    pen.font = "400 34px Fraunces, Palatino, serif";
    const next = wrap(pen, payload.body, 64, 168, 880, 46);
    pen.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
    pen.fillText(payload.signoff, 64, next + 8);
    pen.font = "600 52px Fraunces, Palatino, serif";
    pen.fillText(payload.signature, 64, next + 52);
  } else if (payload.kind === "sound") {
    pen.fillText("NOW PLAYING", 64, 70);
    pen.fillStyle = ink;
    pen.font = "600 64px Fraunces, Palatino, serif";
    const next = wrap(pen, payload.planet, 64, 140, 880, 72);
    pen.fillStyle = muted;
    pen.font = "400 32px Fraunces, Palatino, serif";
    wrap(pen, payload.notes.join("  ·  "), 64, next + 20, 880, 44);
  } else if (payload.kind === "creature") {
    pen.textAlign = "center";
    pen.fillText(product.serial, 512, 180);
    pen.fillStyle = ink;
    pen.font = "600 84px Fraunces, Palatino, serif";
    pen.fillText(product.title, 512, 250);
  } else if (payload.kind === "prize") {
    pen.fillText(`${product.rarity.toUpperCase()} · ${product.traits[0]?.toUpperCase() ?? "PRIZE"}`, 64, 68);
    pen.fillStyle = ink;
    pen.font = "600 74px Fraunces, Palatino, serif";
    const next = wrap(pen, payload.name, 64, 138, 880, 84);
    pen.fillStyle = muted;
    pen.font = "400 34px Fraunces, Palatino, serif";
    wrap(pen, payload.detail, 64, next + 16, 880, 44);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function rounded(pen: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  pen.beginPath();
  pen.moveTo(x + radius, y);
  pen.arcTo(x + width, y, x + width, y + height, radius);
  pen.arcTo(x + width, y + height, x, y + height, radius);
  pen.arcTo(x, y + height, x, y, radius);
  pen.arcTo(x, y, x + width, y, radius);
  pen.closePath();
}

function plateTexture(readout: Readout) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 340;
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  const accent = readout.tone === "fault" ? "#e7b4ff" : readout.tone === "warn" ? "#fde68a" : "#7dd3fc";
  pen.clearRect(0, 0, canvas.width, canvas.height);

  const bezel = pen.createLinearGradient(0, 0, 0, canvas.height);
  bezel.addColorStop(0, "#334155");
  bezel.addColorStop(0.5, "#1e293b");
  bezel.addColorStop(1, "#0f172a");
  rounded(pen, 12, 16, 1256, 308, 32);
  pen.fillStyle = bezel;
  pen.fill();
  pen.strokeStyle = accent;
  pen.lineWidth = 5;
  pen.stroke();

  rounded(pen, 32, 34, 1216, 272, 22);
  pen.fillStyle = "rgba(4, 7, 15, 0.96)";
  pen.fill();

  pen.beginPath();
  pen.arc(82, 92, 13, 0, Math.PI * 2);
  pen.fillStyle = accent;
  pen.fill();
  pen.font = "600 27px 'IBM Plex Mono', ui-monospace, monospace";
  pen.fillStyle = accent;
  pen.textAlign = "left";
  pen.textBaseline = "middle";
  pen.fillText(readout.label.toUpperCase(), 112, 92);

  pen.textAlign = "left";
  pen.textBaseline = "top";
  pen.fillStyle = "#f8fafc";
  pen.font = "700 48px Inter, system-ui, sans-serif";
  const afterTitle = wrap(pen, readout.text, 66, 138, 1140, 56);
  pen.fillStyle = "#cbd5e1";
  pen.font = "400 28px Inter, system-ui, sans-serif";
  wrap(pen, readout.detail, 66, Math.min(afterTitle + 6, 240), 1140, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function usePainted(paint: () => THREE.CanvasTexture | null, key: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let gone = false;
    let current: THREE.CanvasTexture | null = null;
    const run = () => {
      if (gone) return;
      current?.dispose();
      current = paint();
      setTexture(current);
    };
    void document.fonts.ready.then(run);
    return () => {
      gone = true;
      current?.dispose();
    };
    // `key` changes exactly when the painted content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return texture;
}

function DisplayPlate({ readout }: { readout: Readout }) {
  const texture = usePainted(
    () => plateTexture(readout),
    `${readout.tone}:${readout.label}:${readout.text}:${readout.detail}`,
  );
  if (!texture) return null;
  // Mounted cleanly on the top crown marquee so none of shelves A-D are blocked
  return (
    <group position={[0, 2.13, 0.34]} rotation={[0.08, 0, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[1.18, 0.31]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function ProductCard({ product }: { product: Product }) {
  const texture = usePainted(() => cardTexture(product), product.seed);
  if (!texture) return null;
  const creature = product.type === "creature";
  // Positioned cleanly on a display easel to the front-right of the plinth without clipping or blocking the prize
  return (
    <group position={[0.58, 0.24, 1.15]} rotation={[-0.42, -0.34, 0]}>
      {/* Brass easel leg */}
      <mesh position={[0, -0.14, -0.05]} rotation={[0.35, 0, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.008, 0.008, 0.28, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh castShadow raycast={() => null}>
        <boxGeometry args={creature ? [0.46, 0.22, 0.014] : [0.54, 0.34, 0.014]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.009]} raycast={() => null}>
        <planeGeometry args={creature ? [0.44, 0.2] : [0.52, 0.32]} />
        <meshStandardMaterial map={texture} roughness={0.5} metalness={0.05} />
      </mesh>
    </group>
  );
}

export function WorldCopy({
  phase,
  product,
  showPlinth,
  readout,
}: {
  phase: "idle" | "vending" | "revealed" | "reality";
  product: Product | null;
  showPlinth: boolean;
  listening: boolean;
  readout: Readout;
}) {
  return (
    <group>
      {phase !== "reality" ? <DisplayPlate readout={readout} /> : null}
      {showPlinth && product && product.type !== "reality" ? <ProductCard product={product} /> : null}
    </group>
  );
}
