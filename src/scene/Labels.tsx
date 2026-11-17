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
  pen.fillStyle = paper ? "#f4efe4" : "rgba(16, 14, 12, 0.94)";
  pen.fillRect(0, 0, canvas.width, canvas.height);
  pen.strokeStyle = paper ? "#c4b49a" : "rgba(224, 177, 90, 0.7)";
  pen.lineWidth = 8;
  pen.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
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
  canvas.height = 420;
  const pen = canvas.getContext("2d");
  if (!pen) return null;
  const accent = readout.tone === "fault" ? "#e7b4ff" : readout.tone === "warn" ? "#f0d7a2" : "#e0b15a";
  pen.clearRect(0, 0, canvas.width, canvas.height);

  const bezel = pen.createLinearGradient(0, 0, 0, canvas.height);
  bezel.addColorStop(0, "#c9a36a");
  bezel.addColorStop(0.45, "#6d522f");
  bezel.addColorStop(1, "#3a2a16");
  rounded(pen, 16, 24, 1248, 372, 36);
  pen.fillStyle = bezel;
  pen.fill();

  rounded(pen, 40, 48, 1200, 324, 24);
  pen.fillStyle = "rgba(10, 8, 6, 0.94)";
  pen.fill();

  pen.beginPath();
  pen.arc(92, 118, 14, 0, Math.PI * 2);
  pen.fillStyle = accent;
  pen.fill();
  pen.font = "500 28px 'IBM Plex Mono', ui-monospace, monospace";
  pen.fillStyle = accent;
  pen.textAlign = "left";
  pen.textBaseline = "middle";
  pen.fillText(readout.label.toUpperCase(), 124, 118);

  pen.textAlign = "left";
  pen.textBaseline = "top";
  pen.fillStyle = "#f6efe2";
  pen.font = "600 52px Fraunces, Palatino, serif";
  const afterTitle = wrap(pen, readout.text, 72, 168, 1120, 60);
  pen.fillStyle = "#cbb892";
  pen.font = "400 28px Fraunces, Palatino, serif";
  wrap(pen, readout.detail, 72, Math.min(afterTitle + 8, 292), 1120, 36);

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
  return (
    <mesh position={[0, 1.66, 0.44]}>
      <planeGeometry args={[1.02, 0.33]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function ProductCard({ product }: { product: Product }) {
  const texture = usePainted(() => cardTexture(product), product.seed);
  if (!texture) return null;
  const creature = product.type === "creature";
  return (
    <mesh
      position={creature ? [0, 0.95, 1.18] : [0, 0.58, 1.16]}
      rotation={[creature ? -0.15 : -0.4, 0.38, 0]}
      castShadow
    >
      <planeGeometry args={creature ? [0.62, 0.28] : [0.78, 0.48]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0.05} />
    </mesh>
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
