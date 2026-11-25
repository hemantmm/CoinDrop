import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group, MeshStandardMaterial, PointLight } from "three";
import * as THREE from "three";
import { RARITY_COLOR, type Product, type Rarity } from "../generate";
import { Creature } from "./Creature";
import { COIL_CODES, type CoinPlayer, type GiftTopic, type PlayStep } from "../stock";
import { playBinThud, playCoilWhir, playCoinPickup, playKeypadBeep, playTeeterCreak } from "../audio";

export type Phase = "idle" | "vending" | "revealed" | "reality";

export const THEME_CONFIG: Record<GiftTopic, {
  bg: string;
  wall: string;
  sideWall: string;
  floor: string;
  spotA: string;
  spotB: string;
  hemiSky: string;
  hemiGround: string;
  lamp: string;
  bulb: string;
  coinGlow: string;
  lfA: string;
  lfB: string;
  lfC: string;
}> = {
  technology: {
    bg: "#030712",
    wall: "#040814",
    sideWall: "#050b18",
    floor: "#060d1a",
    spotA: "#c0d8ff",
    spotB: "#00f5ff",
    hemiSky: "#00a8ff",
    hemiGround: "#0a0510",
    lamp: "#00f5ff",
    bulb: "#00aaff",
    coinGlow: "#00f5ff",
    lfA: "#8ab8ff",
    lfB: "#00f5ff",
    lfC: "#bf5af2",
  },
  audio: {
    bg: "#090314",
    wall: "#0d041c",
    sideWall: "#120626",
    floor: "#160830",
    spotA: "#e9d5ff",
    spotB: "#ff2d78",
    hemiSky: "#bf5af2",
    hemiGround: "#180424",
    lamp: "#ff2d78",
    bulb: "#bf5af2",
    coinGlow: "#bf5af2",
    lfA: "#d8b4fe",
    lfB: "#ff2d78",
    lfC: "#38bdf8",
  },
  snacks: {
    bg: "#120603",
    wall: "#1c0a04",
    sideWall: "#240d05",
    floor: "#2a1007",
    spotA: "#ffedd5",
    spotB: "#ff9e3b",
    hemiSky: "#f59e0b",
    hemiGround: "#290c04",
    lamp: "#ff9e3b",
    bulb: "#ffaa00",
    coinGlow: "#ffb703",
    lfA: "#fde68a",
    lfB: "#fb923c",
    lfC: "#f43f5e",
  },
  style: {
    bg: "#02120a",
    wall: "#03170d",
    sideWall: "#042012",
    floor: "#062b18",
    spotA: "#d1fae5",
    spotB: "#00ff88",
    hemiSky: "#10b981",
    hemiGround: "#022c16",
    lamp: "#00ff88",
    bulb: "#10b981",
    coinGlow: "#00ff88",
    lfA: "#a7f3d0",
    lfB: "#34d399",
    lfC: "#facc15",
  },
};

const VEND_EASE = (t: number) => 1 - (1 - t) ** 3;

function idleTwitch(t: number): { active: boolean; x: number; z: number; flap: number } {
  const local = t % 9;
  if (local > 0.42) return { active: false, x: 0, z: 0, flap: 0 };
  const fade = 1 - local / 0.42;
  const swing = Math.sin(local * 42) * fade;
  const dir = Math.floor(t / 9) % 2 === 0 ? 1 : -1;
  return {
    active: true,
    x: swing * 0.01 * dir,
    z: swing * 0.012 * dir,
    flap: swing * 0.35,
  };
}

function progressOf(phase: Phase, vendStarted: number, vendMs: number): number {
  if (phase === "idle") return 0;
  if (phase !== "vending") return 1;
  if (vendStarted <= 0) return 0;
  return Math.min(1, Math.max(0, (performance.now() - vendStarted) / vendMs));
}

export function Gallery({
  phase,
  sky,
  topic = "technology",
  rarity = null,
  fullScreen = false,
  children,
}: {
  phase: Phase;
  sky: string;
  topic?: GiftTopic;
  rarity?: Rarity | null;
  fullScreen?: boolean;
  children: ReactNode;
}) {
  const { scene, camera, controls } = useThree();
  const realityPose = useRef(new THREE.Vector3(0, 1.25, 5.2));
  const theme = THEME_CONFIG[topic] ?? THEME_CONFIG.technology;
  const currentBg = useRef(new THREE.Color(theme.bg));
  const targetBg = useRef(new THREE.Color(theme.bg));

  const cosmicStars = useMemo(() => {
    const arr = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 8 - 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    let dest = phase === "reality" ? sky : theme.bg;
    if (phase === "revealed" && rarity === "impossible") {
      dest = "#03000a"; // Background changes to deep cosmic void!
    }
    targetBg.current.set(dest);
    currentBg.current.lerp(targetBg.current, 1 - Math.exp(-delta * 3.5));
    scene.background = currentBg.current;
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(currentBg.current);
    }

    if (fullScreen) {
      // Cinematic screenshot framing: glide camera close to centered prize
      camera.position.lerp(new THREE.Vector3(0, 0.72, 2.15), 0.06);
      if (controls && "target" in controls) {
        (controls.target as THREE.Vector3).lerp(new THREE.Vector3(0, 0.54, 0.95), 0.06);
      }
      return;
    }

    if (phase !== "reality") return;
    camera.position.lerp(realityPose.current, 0.06);
    camera.lookAt(0, 1.05, 0);
  });

  return (
    <>
      {phase !== "reality" ? (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          target={[0, 1.08, 0.25]}
          minDistance={1.65}
          maxDistance={6.5}
          minPolarAngle={0.85}
          maxPolarAngle={1.28}
          minAzimuthAngle={-0.95}
          maxAzimuthAngle={0.95}
        />
      ) : null}
      {phase !== "reality" ? (
        <fog
          attach="fog"
          args={[
            phase === "revealed" && rarity === "impossible" ? "#03000a" : theme.bg,
            phase === "revealed" && rarity === "impossible" ? 6 : 9,
            16,
          ]}
        />
      ) : null}
      {phase === "revealed" && rarity === "impossible" ? (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[cosmicStars, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.035} color="#d946ef" transparent opacity={0.85} blending={THREE.AdditiveBlending} />
        </points>
      ) : null}
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.42]} />
      <spotLight
        position={[2.6, 5.2, 3.4]}
        angle={0.42}
        penumbra={0.75}
        intensity={52}
        color={theme.spotA}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0002}
      />
      <spotLight position={[-3.2, 2.4, 2.2]} angle={0.6} penumbra={1} intensity={24} color={theme.spotB} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} position={[0, 3.4, 2]} scale={[7, 3, 1]} color={theme.lfA} />
        <Lightformer form="rect" intensity={1.6} position={[-3.5, 1.5, 1]} scale={[2, 3, 1]} color={theme.lfB} />
        <Lightformer form="rect" intensity={1.2} position={[3.2, 1.2, -1]} scale={[2.4, 1.6, 1]} color={theme.lfC} />
      </Environment>
      {children}
      {phase !== "reality" ? (
        <>
          <RoundedBox args={[10.4, 0.22, 7.2]} position={[0.2, -0.11, 0.55]} radius={0.04} smoothness={2} receiveShadow>
            <meshStandardMaterial color={theme.floor} metalness={0.6} roughness={0.4} />
          </RoundedBox>
          <mesh position={[0, 1.7, -1.7]} receiveShadow>
            <planeGeometry args={[12, 5.5]} />
            <meshStandardMaterial color={theme.wall} roughness={0.9} />
          </mesh>
          <mesh position={[-3.6, 1.4, -0.2]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[4, 4.5]} />
            <meshStandardMaterial color={theme.sideWall} roughness={0.95} />
          </mesh>
          <ContactShadows position={[0, 0.01, 0.4]} opacity={0.55} scale={8} blur={2.2} far={2.6} />
        </>
      ) : null}
    </>
  );
}

const COIN_REST = new THREE.Vector3(0.92, 0.5, 1.55);
const COIN_SLOT = new THREE.Vector3(0.62, 1.38, 0.36);
const coinPointer = new THREE.Vector2();
const coinRay = new THREE.Raycaster();
const coinHit = new THREE.Vector3();
const coinPlane = new THREE.Plane();
const coinNormal = new THREE.Vector3();
const coinMid = new THREE.Vector3();
const coinLaunch = new THREE.Vector3();
const coinBob = new THREE.Vector3();

function pointOnCoinPlane(clientX: number, clientY: number, camera: THREE.Camera, element: HTMLCanvasElement) {
  const rect = element.getBoundingClientRect();
  coinPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  coinPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  coinRay.setFromCamera(coinPointer, camera);
  coinNormal.copy(camera.position).sub(COIN_SLOT).normalize();
  coinPlane.setFromNormalAndCoplanarPoint(coinNormal, COIN_SLOT);
  return coinRay.ray.intersectPlane(coinPlane, coinHit);
}

function curveCoin(
  from: THREE.Vector3,
  amount: number,
  target: THREE.Vector3,
  player: CoinPlayer = "Dad",
) {
  coinMid.copy(from).lerp(COIN_SLOT, 0.5);
  coinMid.y += player === "Maya" ? 0.58 : player === "Leo" ? 0.5 : 0.38;
  const remain = 1 - amount;
  target
    .copy(from)
    .multiplyScalar(remain * remain)
    .addScaledVector(coinMid, 2 * remain * amount)
    .addScaledVector(COIN_SLOT, amount * amount);
  if (player === "Leo") target.y += Math.sin(amount * Math.PI) * 0.05;
  if (player === "Maya") target.y += Math.sin(amount * Math.PI) * 0.09;
}

function Brass({ color = "#1a2535" }: { color?: string }) {
  return <meshPhysicalMaterial color={color} metalness={0.85} roughness={0.2} clearcoat={0.45} clearcoatRoughness={0.28} />;
}

function CabinetShell() {
  return (
    <group>
      <RoundedBox args={[1.28, 1.96, 0.08]} radius={0.02} smoothness={2} position={[0, 0, -0.28]} castShadow>
        <Brass />
      </RoundedBox>
      <RoundedBox args={[0.09, 1.96, 0.64]} radius={0.02} smoothness={2} position={[-0.62, 0, 0.02]} castShadow>
        <Brass color="#0d1420" />
      </RoundedBox>
      <RoundedBox args={[0.09, 1.96, 0.64]} radius={0.02} smoothness={2} position={[0.62, 0, 0.02]} castShadow>
        <Brass color="#0d1420" />
      </RoundedBox>
      <RoundedBox args={[1.36, 0.12, 0.7]} radius={0.02} smoothness={2} position={[0, 1.0, 0.02]} castShadow>
        <Brass color="#1a2a3a" />
      </RoundedBox>
      <RoundedBox args={[1.36, 0.14, 0.7]} radius={0.02} smoothness={2} position={[0, -0.96, 0.02]} castShadow>
        <Brass color="#0a1018" />
      </RoundedBox>
      <mesh position={[0, 0.12, -0.22]}>
        <planeGeometry args={[1.16, 1.7]} />
        <meshStandardMaterial color="#0d1118" roughness={0.9} />
      </mesh>
    </group>
  );
}

const staticTextureCache = new Map<string, THREE.CanvasTexture>();

function getBadgeTexture(label: string, accent: string, highlighted: boolean): THREE.CanvasTexture {
  const key = `badge:${label}:${highlighted ? accent : "dim"}`;
  const existing = staticTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = highlighted ? accent : "#0b1322";
    ctx.fillRect(0, 0, 128, 48);
    ctx.strokeStyle = highlighted ? "#ffffff" : "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 44);
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = highlighted ? "#030712" : "#e2e8f0";
    ctx.fillText(label, 64, 25);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  staticTextureCache.set(key, tex);
  return tex;
}

function getKeycapTexture(label: string, variant: "letter" | "number" | "clr" | "ok"): THREE.CanvasTexture {
  const key = `key:${label}:${variant}`;
  const existing = staticTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle =
      variant === "clr" ? "#450a0a" : variant === "ok" ? "#064e3b" : variant === "letter" ? "#0f172a" : "#162235";
    ctx.fillRect(0, 0, 96, 72);
    ctx.strokeStyle =
      variant === "clr" ? "#f87171" : variant === "ok" ? "#34d399" : variant === "letter" ? "#38bdf8" : "#94a3b8";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 92, 68);
    ctx.font = variant === "clr" || variant === "ok" ? "bold 26px monospace" : "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle =
      variant === "clr" ? "#fecaca" : variant === "ok" ? "#6ee7b7" : variant === "letter" ? "#7dd3fc" : "#f8fafc";
    ctx.fillText(label, 48, 38);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  staticTextureCache.set(key, tex);
  return tex;
}

function getTrayTagTexture(text: string): THREE.CanvasTexture {
  const key = `tray:${text}`;
  const existing = staticTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#042f2e";
    ctx.fillRect(0, 0, 320, 64);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 316, 60);
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#6ee7b7";
    ctx.fillText(text, 160, 33);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  staticTextureCache.set(key, tex);
  return tex;
}

function HorizontalCoil() {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 6;
    const steps = 84;
    const radius = 0.048;
    for (let i = 0; i <= steps; i += 1) {
      const frac = i / steps;
      const angle = frac * Math.PI * 2 * turns;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          -0.115 + frac * 0.22,
        ),
      );
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.0046, 8, false);
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#e4e4e7" metalness={0.92} roughness={0.16} />
    </mesh>
  );
}

function QuantumAnomaly({ color = "#e7b4ff" }: { color?: string }) {
  const coreRef = useRef<Group>(null);
  const ringARef = useRef<Group>(null);
  const ringBRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 1.4;
      coreRef.current.rotation.x = t * 0.9;
      const pulse = 1 + Math.sin(t * 8) * 0.14;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ringARef.current) {
      ringARef.current.rotation.x = t * 2.2;
      ringARef.current.rotation.y = t * 1.1;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.y = -t * 1.8;
      ringBRef.current.rotation.z = t * 1.5;
    }
  });

  return (
    <group>
      <group ref={coreRef}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.045, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.5}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.052, 1]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.5} />
        </mesh>
      </group>
      <group ref={ringARef}>
        <mesh>
          <torusGeometry args={[0.08, 0.005, 12, 36]} />
          <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={2.0} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
      <group ref={ringBRef}>
        <mesh>
          <torusGeometry args={[0.105, 0.004, 12, 36]} />
          <meshStandardMaterial color="#bf5af2" emissive="#bf5af2" emissiveIntensity={2.2} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function PrizeShape({
  shape,
  color,
  rarity = "common",
}: {
  shape: string;
  color: string;
  rarity?: Rarity | string;
}) {
  const isLegendary = rarity === "legendary";
  const isRare = rarity === "rare";
  const accentColor = isLegendary ? "#ffd700" : isRare ? "#00f5ff" : color;
  const metalness = isLegendary ? 0.95 : isRare ? 0.7 : 0.45;
  const roughness = isLegendary ? 0.15 : isRare ? 0.25 : 0.35;

  if (shape === "anomaly") {
    return <QuantumAnomaly color={accentColor} />;
  }

  if (shape === "phone") {
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[0.072, 0.144, 0.01]} />
          <meshStandardMaterial
            color={accentColor}
            metalness={metalness}
            roughness={roughness}
            emissive={isLegendary ? "#ffd700" : isRare ? "#00f5ff" : "#000000"}
            emissiveIntensity={isLegendary ? 0.25 : isRare ? 0.2 : 0}
          />
        </mesh>
        <mesh position={[0, 0.005, 0.006]}>
          <boxGeometry args={[0.058, 0.105, 0.002]} />
          <meshStandardMaterial color="#101014" roughness={0.15} metalness={0.6} />
        </mesh>
        {isLegendary ? (
          <mesh position={[0, -0.045, 0.006]}>
            <circleGeometry args={[0.008, 16]} />
            <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.1} />
          </mesh>
        ) : null}
      </group>
    );
  }
  if (shape === "laptop") {
    return (
      <group position={[0, -0.02, 0]}>
        <mesh position={[0, 0.012, 0]} castShadow>
          <boxGeometry args={[0.18, 0.012, 0.12]} />
          <meshStandardMaterial color={accentColor} metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh position={[0, 0.07, -0.05]} rotation={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.008]} />
          <meshStandardMaterial color="#1c1c1e" metalness={0.5} roughness={0.25} />
        </mesh>
      </group>
    );
  }
  if (shape === "watch") {
    return (
      <group rotation={[0.4, 0, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.045, 0.012, 12, 24]} />
          <meshStandardMaterial
            color={isLegendary ? "#ffd700" : "#b9c0c8"}
            metalness={isLegendary ? 1 : 0.8}
            roughness={0.2}
          />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.028, 0.028, 0.012, 20]} />
          <meshStandardMaterial color={accentColor} metalness={metalness} roughness={roughness} />
        </mesh>
      </group>
    );
  }
  if (shape === "chocolate") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.12, 0.028, 0.07]} />
        <meshStandardMaterial
          color={isLegendary ? "#ffd700" : isRare ? "#f472b6" : "#6b3e22"}
          metalness={isLegendary ? 0.95 : 0.1}
          roughness={isLegendary ? 0.2 : 0.55}
          emissive={isLegendary ? "#ffae00" : "#000000"}
          emissiveIntensity={isLegendary ? 0.35 : 0}
        />
      </mesh>
    );
  }
  if (shape === "buds") {
    return (
      <group>
        <mesh position={[-0.03, 0, 0]} castShadow>
          <sphereGeometry args={[0.022, 14, 12]} />
          <meshStandardMaterial color={accentColor} metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh position={[0.03, 0, 0]} castShadow>
          <sphereGeometry args={[0.022, 14, 12]} />
          <meshStandardMaterial color={accentColor} metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.07, 0.012, 0.03]} />
          <meshStandardMaterial color={isRare ? "#1e1b4b" : "#eceae4"} roughness={0.45} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[-0.03, 0, 0]} rotation={[0, 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.12]} />
        <meshStandardMaterial color={accentColor} roughness={roughness} metalness={metalness} />
      </mesh>
      <mesh position={[0.03, 0, 0]} rotation={[0, -0.2, -0.1]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.12]} />
        <meshStandardMaterial color={accentColor} roughness={roughness} metalness={metalness} />
      </mesh>
    </group>
  );
}

function CapsulePod({
  phase,
  rarity,
  color,
}: {
  phase: Phase;
  rarity: Rarity | null;
  color: string;
}) {
  const topDomeRef = useRef<Group>(null);
  const bottomDomeRef = useRef<Group>(null);

  useFrame(() => {
    if (!topDomeRef.current || !bottomDomeRef.current) return;
    if (phase === "revealed") {
      if (rarity === "common" || rarity === "uncommon") {
        // Classic capsule opening: top dome hinges back cleanly on rear pivot
        topDomeRef.current.position.set(0, -0.01, -0.11);
        topDomeRef.current.rotation.x = -1.45;
        topDomeRef.current.visible = true;
        bottomDomeRef.current.position.set(0, 0, 0);
        bottomDomeRef.current.visible = true;
      } else if (rarity === "rare") {
        topDomeRef.current.position.set(0, 0.08, -0.12);
        topDomeRef.current.rotation.x = -1.6;
        topDomeRef.current.visible = true;
        bottomDomeRef.current.position.set(0, -0.02, 0);
        bottomDomeRef.current.visible = true;
      } else if (rarity === "legendary") {
        topDomeRef.current.position.set(0, 0.12, -0.16);
        topDomeRef.current.rotation.x = -2.0;
        topDomeRef.current.visible = true;
        bottomDomeRef.current.position.set(0, -0.03, 0);
        bottomDomeRef.current.visible = true;
      } else if (rarity === "impossible") {
        // Defies normal capsule rules: fractures & disintegrates into void
        topDomeRef.current.visible = false;
        bottomDomeRef.current.visible = false;
      }
    } else {
      topDomeRef.current.position.set(0, 0, 0);
      topDomeRef.current.rotation.x = 0;
      topDomeRef.current.visible = true;
      bottomDomeRef.current.position.set(0, 0, 0);
      bottomDomeRef.current.visible = true;
    }
  });

  const isLegendary = rarity === "legendary";
  const isRare = rarity === "rare";
  const domeColor = isLegendary ? "#ffd700" : isRare ? "#00f5ff" : color;
  const metalness = isLegendary ? 0.95 : isRare ? 0.6 : 0.4;
  const roughness = isLegendary ? 0.15 : isRare ? 0.25 : 0.35;

  return (
    <group>
      <group ref={topDomeRef}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.108, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={domeColor}
            emissive={domeColor}
            emissiveIntensity={isLegendary ? 0.6 : isRare ? 0.4 : 0.15}
            metalness={metalness}
            roughness={roughness}
            transparent
            opacity={0.92}
            clearcoat={0.6}
          />
        </mesh>
      </group>
      <group ref={bottomDomeRef}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.108, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={domeColor}
            emissive={domeColor}
            emissiveIntensity={isLegendary ? 0.6 : isRare ? 0.4 : 0.15}
            metalness={metalness}
            roughness={roughness}
            transparent
            opacity={0.92}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.109, 0.007, 12, 36]} />
          <meshStandardMaterial
            color={isLegendary ? "#ffe066" : isRare ? "#ffffff" : "#4a5568"}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

function RarityVFX({
  rarity,
  active,
}: {
  rarity: Rarity | null;
  active: boolean;
}) {
  const godraysRef = useRef<Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const lightRef = useRef<PointLight>(null);

  const particleCount = rarity === "legendary" ? 60 : rarity === "rare" ? 40 : rarity === "impossible" ? 75 : 0;
  const [positions, colors] = useMemo(() => {
    if (!particleCount) return [new Float32Array(0), new Float32Array(0)];
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const c1 = new THREE.Color(
      rarity === "legendary" ? "#ffd700" : rarity === "rare" ? "#00f5ff" : "#e7b4ff",
    );
    const c2 = new THREE.Color(
      rarity === "legendary" ? "#fff2a8" : rarity === "rare" ? "#bf5af2" : "#ff2d78",
    );

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.08 + Math.random() * (rarity === "impossible" ? 0.35 : 0.22);
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.2) * (rarity === "impossible" ? 0.45 : 0.3);

      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const mixed = c1.clone().lerp(c2, Math.random());
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }
    return [pos, col];
  }, [particleCount, rarity]);

  useFrame(({ clock }) => {
    if (!active) return;
    const t = clock.elapsedTime;

    if (godraysRef.current) {
      godraysRef.current.rotation.y = t * 0.35;
      const pulse = 0.85 + Math.sin(t * 3) * 0.15;
      godraysRef.current.scale.set(pulse, 1, pulse);
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * (rarity === "impossible" ? 0.8 : 0.45);
      particlesRef.current.position.y = Math.sin(t * 2) * 0.02;
    }

    if (lightRef.current) {
      if (rarity === "rare") {
        lightRef.current.intensity = 3.5 + Math.sin(t * 6) * 1.5;
      } else if (rarity === "legendary") {
        lightRef.current.intensity = 6.0 + Math.sin(t * 4) * 2.5;
      } else if (rarity === "impossible") {
        lightRef.current.intensity = Math.sin(t * 40) > 0.1 ? 7.5 : 0.2;
      }
    }
  });

  if (!active || !rarity || rarity === "common" || rarity === "uncommon") {
    return active ? (
      <pointLight position={[0, 0.2, 0.1]} intensity={1.8} distance={1.2} color="#fff6e8" />
    ) : null;
  }

  return (
    <group position={[0, 0.08, 0]}>
      <pointLight
        ref={lightRef}
        position={[0, 0.18, 0.12]}
        distance={2.4}
        color={rarity === "legendary" ? "#ffd700" : rarity === "rare" ? "#00f5ff" : "#e7b4ff"}
        intensity={3}
      />

      {rarity === "rare" && (
        <>
          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.016} vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} />
          </points>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <ringGeometry args={[0.07, 0.12, 32]} />
            <meshBasicMaterial color="#00f5ff" transparent opacity={0.25} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        </>
      )}

      {rarity === "legendary" && (
        <>
          <group ref={godraysRef} position={[0, 0.05, 0]}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i / 6) * Math.PI * 2;
              const tilt = 0.22;
              return (
                <group key={i} rotation={[0, angle, 0]}>
                  <mesh position={[Math.sin(tilt) * 0.14, 0.22, 0]} rotation={[0, 0, -tilt]}>
                    <cylinderGeometry args={[0.012, 0.05, 0.44, 16, 1, true]} />
                    <meshBasicMaterial
                      color="#ffd700"
                      transparent
                      opacity={0.32}
                      side={THREE.DoubleSide}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>

          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.02} vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} />
          </points>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
            <circleGeometry args={[0.18, 32]} />
            <meshBasicMaterial color="#ffd700" transparent opacity={0.35} blending={THREE.AdditiveBlending} />
          </mesh>
        </>
      )}

      {rarity === "impossible" && (
        <>
          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.022} vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} />
          </points>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
            <ringGeometry args={[0.04, 0.28, 48]} />
            <meshBasicMaterial color="#7928ca" transparent opacity={0.4} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

function RevealedItem({
  product,
  rarity,
  stock,
}: {
  product: Product | null;
  rarity: Rarity | null;
  stock: { shape: string; color: string; claimed: boolean }[];
}) {
  const itemGroup = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!itemGroup.current) return;
    const t = clock.elapsedTime;

    if (rarity === "common" || rarity === "uncommon") {
      // Ordinary subtle breathing resting in the capsule cup
      itemGroup.current.position.set(0, 0.04 + Math.sin(t * 1.8) * 0.003, 0);
      itemGroup.current.rotation.set(0, 0, 0);
    } else if (rarity === "rare") {
      // Gentle levitation & bobbing
      itemGroup.current.position.set(0, 0.075 + Math.sin(t * 2.5) * 0.012, 0);
      itemGroup.current.rotation.set(0, t * 0.7, 0);
    } else if (rarity === "legendary") {
      // Majestic golden float & gyroscopic tilt
      itemGroup.current.position.set(0, 0.14 + Math.sin(t * 2.0) * 0.02, 0);
      itemGroup.current.rotation.set(
        Math.sin(t * 1.5) * 0.12,
        t * 0.5,
        Math.cos(t * 1.2) * 0.08,
      );
    } else if (rarity === "impossible") {
      // Defies normal physical rules: erratic levitation & spin
      itemGroup.current.position.set(
        Math.sin(t * 15) > 0.85 ? (Math.random() - 0.5) * 0.015 : 0,
        0.20 + Math.sin(t * 2.8) * 0.025,
        0,
      );
      itemGroup.current.rotation.set(
        Math.sin(t * 2.2) * 0.25,
        t * 1.4,
        Math.cos(t * 1.8) * 0.25,
      );
    }
  });

  if (!product) return null;

  if (product.type === "creature" && product.payload.kind === "creature") {
    return (
      <group ref={itemGroup}>
        <Creature spec={product.payload} />
      </group>
    );
  }

  let shape = "phone";
  let color = "#f5f5f7";
  if (product.type === "prize" && product.payload.kind === "prize") {
    if (product.payload.shape && product.payload.color) {
      shape = product.payload.shape;
      color = product.payload.color;
    } else {
      const titleLower = product.title.toLowerCase();
      const match = stock.find((s) => s.shape && titleLower.includes(s.shape));
      if (match) {
        shape = match.shape;
        color = match.color;
      }
      if (
        titleLower.includes("anomaly") ||
        titleLower.includes("singularity") ||
        titleLower.includes("resonator") ||
        titleLower.includes("starlight") ||
        titleLower.includes("chrono") ||
        product.rarity === "impossible"
      ) {
        shape = "anomaly";
        color = "#e7b4ff";
      } else if (titleLower.includes("phone") || titleLower.includes("camera") || titleLower.includes("player")) {
        shape = "phone";
        color = product.rarity === "legendary" ? "#ffd700" : "#d7d7dc";
      } else if (titleLower.includes("laptop")) {
        shape = "laptop";
        color = "#d7d7dc";
      } else if (titleLower.includes("watch") || titleLower.includes("sunglasses")) {
        shape = "watch";
        color = product.rarity === "legendary" ? "#ffd700" : "#00f5ff";
      } else if (
        titleLower.includes("chocolate") ||
        titleLower.includes("truffle") ||
        titleLower.includes("candy") ||
        titleLower.includes("snack") ||
        titleLower.includes("macaron")
      ) {
        shape = "chocolate";
        color = product.rarity === "legendary" ? "#ffd700" : "#6b3e22";
      } else if (
        titleLower.includes("speaker") ||
        titleLower.includes("headphones") ||
        titleLower.includes("earbuds") ||
        titleLower.includes("buds")
      ) {
        shape = "buds";
        color = product.rarity === "rare" ? "#bf5af2" : "#6a8c83";
      } else if (titleLower.includes("shoes") || titleLower.includes("sneakers") || titleLower.includes("cap") || titleLower.includes("bag")) {
        shape = "shoes";
        color = "#f4f1ea";
      }
    }
  } else if (product.rarity === "impossible") {
    shape = "anomaly";
    color = "#e7b4ff";
  }

  return (
    <group ref={itemGroup}>
      {shape === "anomaly" ? (
        <QuantumAnomaly color={color} />
      ) : (
        <PrizeShape shape={shape} color={color} rarity={product.rarity} />
      )}
    </group>
  );
}

const SHELF_FLOORS = [0.36, -0.04, -0.44, -0.84];
const SHELF_COLS = [-0.39, -0.13, 0.13, 0.39];

const SHELF_SPOTS: [number, number, number][] = SHELF_FLOORS.flatMap((floorY, rowIdx) =>
  SHELF_COLS.map((x): [number, number, number] => [x, floorY + 0.078, rowIdx]),
);

function CoilSlot({
  x,
  y,
  floorY,
  index,
  code,
  mark,
  rarity,
  accent,
  highlighted,
  isTargeted,
  isThisVending,
  vendStarted,
  vendMs,
  onSelectSlot,
}: {
  x: number;
  y: number;
  floorY: number;
  index: number;
  code: string;
  mark: { shape: string; color: string; claimed: boolean } | undefined;
  rarity?: Rarity;
  accent: string;
  highlighted: boolean;
  isTargeted: boolean;
  isThisVending: boolean;
  vendStarted: number;
  vendMs: number;
  onSelectSlot?: (index: number) => void;
}) {
  const { gl } = useThree();
  const coilRef = useRef<Group>(null);
  const prizeRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  const hasItem = Boolean(mark && (!mark.claimed || isThisVending));
  const badgeTex = useMemo(
    () => getBadgeTexture(code, accent, isTargeted || isThisVending || hovered),
    [code, accent, isTargeted, isThisVending, hovered],
  );

  useFrame(() => {
    if (!coilRef.current || !prizeRef.current) return;
    if (!isThisVending) {
      coilRef.current.rotation.z = 0;
      prizeRef.current.position.set(0, 0, 0);
      prizeRef.current.rotation.set(0, 0, 0);
      prizeRef.current.visible = hasItem;
      return;
    }
    const progress = Math.min(1, Math.max(0, (performance.now() - vendStarted) / vendMs));
    if (progress < 0.5) {
      const coilT = progress / 0.5;
      coilRef.current.rotation.z = coilT * Math.PI * 2;
      prizeRef.current.position.set(0, 0, coilT * 0.135);
      prizeRef.current.rotation.set(0, 0, 0);
      prizeRef.current.visible = true;
    } else if (progress < 0.68) {
      coilRef.current.rotation.z = Math.PI * 2;
      const hangT = (progress - 0.5) / 0.18;
      const wobble = Math.sin(hangT * Math.PI * 5) * 0.09;
      prizeRef.current.position.set(0, -0.015, 0.15);
      prizeRef.current.rotation.set(0.62 + wobble, 0, 0);
      prizeRef.current.visible = true;
    } else if (progress < 0.9) {
      coilRef.current.rotation.z = Math.PI * 2;
      const dropT = (progress - 0.68) / 0.22;
      const dropDist = (y - -0.94) * (dropT * dropT);
      prizeRef.current.position.set(0, -0.015 - dropDist, 0.15 + dropT * 0.08);
      prizeRef.current.rotation.set(0.62 + dropT * 3.8, dropT * 0.8, 0);
      prizeRef.current.visible = true;
    } else {
      coilRef.current.rotation.z = Math.PI * 2;
      prizeRef.current.visible = false;
    }
  });

  return (
    <group
      position={[x, y, 0]}
      onClick={(e) => {
        if (!hasItem || isThisVending) return;
        e.stopPropagation();
        onSelectSlot?.(index);
      }}
      onPointerOver={(e) => {
        if (!hasItem) return;
        e.stopPropagation();
        setHovered(true);
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        gl.domElement.style.cursor = "";
      }}
    >
      {/* Horizontal 3D helical steel coil resting on shelf */}
      <group ref={coilRef}>
        <HorizontalCoil />
      </group>

      {/* Prize resting inside coil */}
      <group ref={prizeRef} visible={hasItem}>
        {mark ? <PrizeShape shape={mark.shape} color={mark.color} rarity={rarity} /> : null}
      </group>

      {/* Subtle shelf lip slot tag badge (A1 - D4) */}
      <mesh position={[0, floorY - y + 0.01, 0.132]}>
        <planeGeometry args={[0.072, 0.024]} />
        <meshBasicMaterial
          map={badgeTex}
          transparent
          opacity={highlighted || isTargeted || hovered || isThisVending ? 1 : 0.72}
        />
      </mesh>
    </group>
  );
}

function Shelves({
  marks,
  activeTopicIndex = 0,
  targetedSlotIndex = null,
  vendingSlotIndex = null,
  isVending = false,
  vendStarted = 0,
  vendMs = 3200,
  accent = "#00f5ff",
  onSelectSlot,
}: {
  marks: { shape: string; color: string; claimed: boolean; rarity?: Rarity }[];
  activeTopicIndex?: number;
  targetedSlotIndex?: number | null;
  vendingSlotIndex?: number | null;
  isVending?: boolean;
  vendStarted?: number;
  vendMs?: number;
  accent?: string;
  onSelectSlot?: (index: number) => void;
}) {
  return (
    <group>
      {[0.76, 0.36, -0.04, -0.44, -0.84].map((floorY, shelfIdx) => (
        <group key={floorY} position={[0, floorY, -0.02]}>
          <mesh receiveShadow>
            <boxGeometry args={[1.05, 0.02, 0.28]} />
            <meshStandardMaterial color="#0d1a2a" roughness={0.7} metalness={0.35} />
          </mesh>
          {shelfIdx > 0 ? (
            <mesh position={[0, 0.01, 0.14]}>
              <boxGeometry args={[1.05, 0.024, 0.01]} />
              <meshStandardMaterial
                color={shelfIdx - 1 === activeTopicIndex ? "#1e3a5f" : "#152033"}
                emissive={shelfIdx - 1 === activeTopicIndex ? accent : "#000000"}
                emissiveIntensity={shelfIdx - 1 === activeTopicIndex ? 0.15 : 0}
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
          ) : null}
        </group>
      ))}
      {SHELF_SPOTS.map(([x, y, rowIdx], index) => {
        const mark = marks[index];
        const code = COIL_CODES[index] ?? `A${index + 1}`;
        const floorY = SHELF_FLOORS[rowIdx] ?? 0.36;
        return (
          <CoilSlot
            key={`${code}-${index}`}
            x={x}
            y={y}
            floorY={floorY}
            index={index}
            code={code}
            mark={mark}
            rarity={mark?.rarity}
            accent={accent}
            highlighted={rowIdx === activeTopicIndex}
            isTargeted={targetedSlotIndex === index}
            isThisVending={isVending && vendingSlotIndex === index}
            vendStarted={vendStarted}
            vendMs={vendMs}
            onSelectSlot={onSelectSlot}
          />
        );
      })}
    </group>
  );
}

function KeypadButton({
  label,
  variant,
  position,
  disabled,
  onPress,
}: {
  label: string;
  variant: "letter" | "number" | "clr" | "ok";
  position: [number, number, number];
  disabled: boolean;
  onPress: (key: string) => void;
}) {
  const { gl } = useThree();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tex = useMemo(() => getKeycapTexture(label, variant), [label, variant]);

  return (
    <mesh
      position={[position[0], position[1], position[2] + (pressed ? -0.0025 : 0)]}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        setPressed(true);
        playKeypadBeep(label === "OK" ? "VEND" : label);
        onPress(label === "OK" ? "VEND" : label);
        window.setTimeout(() => setPressed(false), 120);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!disabled) {
          setHovered(true);
          gl.domElement.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        gl.domElement.style.cursor = "";
      }}
    >
      <boxGeometry args={[0.032, 0.022, 0.01]} />
      <meshStandardMaterial
        map={tex}
        metalness={0.55}
        roughness={0.3}
        emissive={hovered ? (variant === "ok" ? "#10b981" : variant === "clr" ? "#ef4444" : "#38bdf8") : "#000000"}
        emissiveIntensity={hovered ? 0.35 : 0}
      />
    </mesh>
  );
}

function RightBezelControls({
  playStep,
  typedCode,
  activeCode,
  coinGlow,
  onCoinClick,
  onKeyPress,
}: {
  playStep: PlayStep;
  typedCode: string;
  activeCode: string | null;
  coinGlow: string;
  onCoinClick: () => void;
  onKeyPress: (key: string) => void;
}) {
  const { gl } = useThree();
  const [ledTex, setLedTex] = useState<THREE.CanvasTexture | null>(null);

  const ledState = useMemo(() => {
    if (playStep === "need_coin") {
      return activeCode
        ? { line1: `PICK ${activeCode}`, line2: "INSERT COIN", color: "#fbbf24" }
        : { line1: "READY $1.00", line2: "INSERT COIN", color: "#fbbf24" };
    }
    if (playStep === "coin_entering") {
      return { line1: "COIN...", line2: "CHECKING", color: "#38bdf8" };
    }
    if (playStep === "select_item") {
      return {
        line1: "CREDIT $1",
        line2: typedCode ? `CODE: ${typedCode}` : "PICK A1-D4",
        color: "#34d399",
      };
    }
    if (playStep === "vending") {
      return { line1: "MOTOR ON", line2: `VEND ${activeCode ?? ""}`, color: "#38bdf8" };
    }
    if (playStep === "in_tray") {
      return { line1: "DISPENSED", line2: "OPEN TRAY", color: "#34d399" };
    }
    return { line1: "ENJOY!", line2: "PLAY AGAIN", color: "#e2e8f0" };
  }, [playStep, typedCode, activeCode]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#020610";
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = ledState.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, 250, 122);
      ctx.font = "bold 28px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(ledState.line1, 128, 46);
      ctx.font = "bold 36px monospace";
      ctx.fillStyle = ledState.color;
      ctx.fillText(ledState.line2, 128, 98);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    setLedTex(tex);
    return () => {
      tex.dispose();
    };
  }, [ledState]);

  const keys: { label: string; variant: "letter" | "number" | "clr" | "ok"; pos: [number, number, number] }[] = [
    { label: "A", variant: "letter", pos: [-0.019, 0.02, 0.008] },
    { label: "B", variant: "letter", pos: [0.019, 0.02, 0.008] },
    { label: "C", variant: "letter", pos: [-0.019, -0.008, 0.008] },
    { label: "D", variant: "letter", pos: [0.019, -0.008, 0.008] },
    { label: "1", variant: "number", pos: [-0.019, -0.036, 0.008] },
    { label: "2", variant: "number", pos: [0.019, -0.036, 0.008] },
    { label: "3", variant: "number", pos: [-0.019, -0.064, 0.008] },
    { label: "4", variant: "number", pos: [0.019, -0.064, 0.008] },
    { label: "CLR", variant: "clr", pos: [-0.019, -0.092, 0.008] },
    { label: "OK", variant: "ok", pos: [0.019, -0.092, 0.008] },
  ];

  const keypadDisabled = playStep === "coin_entering" || playStep === "vending" || playStep === "in_tray";

  return (
    <group position={[0.62, 0.14, 0.344]}>
      {/* Integrated flush backing plate on right pillar */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.082, 0.34, 0.008]} />
        <meshStandardMaterial color="#050a14" roughness={0.45} metalness={0.4} />
      </mesh>

      {/* Coin acceptor bezel at top (local y = 0.16 => world y = 1.38) */}
      <group
        position={[0, 0.16, 0.006]}
        onClick={(e) => {
          e.stopPropagation();
          if (playStep === "need_coin") onCoinClick();
        }}
        onPointerOver={() => {
          if (playStep === "need_coin") gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "";
        }}
      >
        <mesh>
          <boxGeometry args={[0.058, 0.068, 0.014]} />
          <meshStandardMaterial
            color="#111a2b"
            metalness={0.85}
            roughness={0.22}
            emissive={playStep === "need_coin" ? coinGlow : "#000000"}
            emissiveIntensity={playStep === "need_coin" ? 0.25 : 0}
          />
        </mesh>
        {/* Vertical Coin Slot */}
        <mesh position={[0, 0.005, 0.008]}>
          <boxGeometry args={[0.008, 0.042, 0.006]} />
          <meshStandardMaterial color="#020408" roughness={0.2} metalness={0.9} />
        </mesh>
      </group>

      {/* Crisp Mini Digital LED Screen */}
      {ledTex ? (
        <mesh position={[0, 0.08, 0.006]}>
          <planeGeometry args={[0.076, 0.038]} />
          <meshBasicMaterial map={ledTex} />
        </mesh>
      ) : null}

      {/* Compact 3D Push Keypad */}
      <group position={[0, 0.012, 0]}>
        {keys.map((k) => (
          <KeypadButton
            key={k.label}
            label={k.label}
            variant={k.variant}
            position={k.pos}
            disabled={keypadDisabled}
            onPress={onKeyPress}
          />
        ))}
      </group>
    </group>
  );
}

export function Machine({
  phase,
  playStep = "need_coin",
  coinStarted = 0,
  coinMs = 850,
  vendStarted,
  vendMs,
  product,
  canInsert,
  onInsert,
  stock = [],
  topic = "technology",
  targetedSlotIndex = null,
  vendingSlotIndex = null,
  typedCode = "",
  coinPlayer = "Dad",
  onSelectSlotIndex,
  onKeyPress,
  onCollect,
}: {
  phase: Phase;
  playStep?: PlayStep;
  coinStarted?: number;
  coinMs?: number;
  vendStarted: number;
  vendMs: number;
  product: Product | null;
  canInsert: boolean;
  onInsert: () => void;
  stock?: { shape: string; color: string; claimed: boolean; rarity?: Rarity }[];
  topic?: GiftTopic;
  targetedSlotIndex?: number | null;
  vendingSlotIndex?: number | null;
  typedCode?: string;
  coinPlayer?: CoinPlayer;
  onSelectSlotIndex?: (index: number) => void;
  onKeyPress?: (key: string) => void;
  onCollect?: () => void;
}) {
  const theme = THEME_CONFIG[topic] ?? THEME_CONFIG.technology;
  const activeTopicIndex = topic === "technology" ? 0 : topic === "audio" ? 1 : topic === "snacks" ? 2 : 3;
  const flap = useRef<Group>(null);
  const coin = useRef<Group>(null);
  const drop = useRef<Group>(null);
  const bulb = useRef<PointLight>(null);
  const rig = useRef<Group>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const held = useRef(false);
  const wasCoinEntering = useRef(false);
  const playedWhir = useRef(false);
  const playedTeeter = useRef(false);
  const playedThud = useRef(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const insertRef = useRef(onInsert);
  const allowRef = useRef(canInsert);
  insertRef.current = onInsert;
  allowRef.current = canInsert;
  const { camera, gl, controls } = useThree();
  const rarity: Rarity | null = product?.rarity ?? null;
  const trayTagTex = useMemo(() => getTrayTagTexture("TAP FLAP TO OPEN"), []);

  const activeSlotCode =
    vendingSlotIndex !== null
      ? (COIL_CODES[vendingSlotIndex] ?? null)
      : targetedSlotIndex !== null
        ? (COIL_CODES[targetedSlotIndex] ?? null)
        : null;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const progress = progressOf(phase, vendStarted, vendMs);
    const vending = phase === "vending";
    const twitch = idleTwitch(t);
    const acknowledging = playStep === "select_item" || (vending && progress < 0.25);

    if (phase !== "vending") {
      playedWhir.current = false;
      playedTeeter.current = false;
      playedThud.current = false;
    } else {
      if (!playedWhir.current && progress >= 0.05) {
        playedWhir.current = true;
        playCoilWhir();
      }
      if (!playedTeeter.current && progress >= 0.5) {
        playedTeeter.current = true;
        playTeeterCreak();
      }
      if (!playedThud.current && progress >= 0.86) {
        playedThud.current = true;
        playBinThud();
      }
    }

    if (bulb.current) {
      const dip = Math.sin(t * 13.7) * Math.sin(t * 2.3);
      let intensity = dip > 0.82 ? 0.45 : 1.55 + dip * 0.12;
      if (acknowledging) intensity = 3.2;
      if (vending && rarity === "rare") intensity = Math.sin(t * 48) > 0 ? 5.5 : 0.25;
      if (vending && rarity === "legendary") intensity = 2.4 + Math.abs(Math.sin(t * 22)) * 4;
      if (vending && rarity === "impossible") intensity = Math.sin(t * 60) > 0.15 ? 7 : 0.04;
      if (phase === "revealed" && rarity === "impossible") intensity = Math.sin(t * 70) > 0.15 ? 7.5 : 0.08;
      bulb.current.intensity = intensity;
    }

    if (lamp.current) {
      lamp.current.emissiveIntensity = acknowledging ? 5 : playStep === "in_tray" ? 4 + Math.sin(t * 8) * 2 : 1.2;
    }

    if (rig.current) {
      let x = 0;
      let z = 0;
      let pitch = 0;
      if (phase === "idle" && twitch.active) {
        x = twitch.x;
        z = twitch.z;
      }
      if (vending && progress >= 0.84 && progress < 0.94) {
        // Subtle thud shudder when prize hits bottom chute
        const hit = 1 - (progress - 0.84) / 0.1;
        pitch = Math.sin(hit * Math.PI) * 0.025;
      }
      if (vending && rarity === "rare") {
        x = Math.sin(t * 46) * 0.014;
        z = Math.sin(t * 37) * 0.01;
      }
      if (vending && rarity === "legendary") {
        x = Math.sin(t * 34) * 0.03;
        z = Math.sin(t * 28) * 0.028;
        pitch = Math.sin(t * 22) * 0.045;
      }
      if (vending && rarity === "impossible") {
        const jam = Math.sin(t * 9) > 0.4;
        x = jam ? 0.04 : -0.015;
        z = jam ? -0.03 : 0.02;
        pitch = jam ? 0.05 : -0.02;
      }
      if (phase === "revealed" && rarity === "impossible") {
        const shudder = Math.sin(t * 28) > 0.35;
        x = shudder ? (Math.random() - 0.5) * 0.025 : 0;
        z = shudder ? (Math.random() - 0.5) * 0.02 : 0;
        pitch = shudder ? (Math.random() - 0.5) * 0.03 : 0;
      }
      rig.current.position.x = x;
      rig.current.rotation.z = z;
      rig.current.rotation.x = pitch;
    }

    if (flap.current) {
      let angle = 0;
      if (vending && progress >= 0.82) {
        angle = -1.05 * VEND_EASE((progress - 0.82) / 0.18);
      } else if (playStep === "in_tray") {
        angle = -0.35 + Math.sin(t * 5) * 0.08;
      } else if (phase === "revealed") {
        angle = -0.22;
      } else if (phase === "idle") {
        angle = twitch.flap;
      }
      if (vending && rarity === "legendary") angle += Math.sin(t * 30) * 0.14;
      if (vending && rarity === "impossible") angle += Math.sin(t * 9) > 0.4 ? -0.6 : 0.05;
      flap.current.rotation.x = angle;
    }

    if (coin.current) {
      const mesh = coin.current;
      const enteringNow = playStep === "coin_entering";
      if (enteringNow && !wasCoinEntering.current) {
        coinLaunch.copy(mesh.position);
      }
      wasCoinEntering.current = enteringNow;

      if (held.current) {
        mesh.visible = true;
      } else if (enteringNow && coinStarted > 0) {
        const coinT = Math.min(1, Math.max(0, (performance.now() - coinStarted) / coinMs));
        const amount = VEND_EASE(coinT);
        curveCoin(coinLaunch, amount, mesh.position, coinPlayer);
        mesh.visible = coinT < 0.96;
      } else if (playStep === "need_coin" || playStep === "revealed") {
        mesh.visible = true;
        coinBob.copy(COIN_REST);
        coinBob.y += Math.sin(t * 2) * 0.03;
        mesh.position.lerp(coinBob, 0.18);
      } else {
        mesh.visible = false;
      }
      const closeness = THREE.MathUtils.clamp(1 - mesh.position.distanceTo(COIN_SLOT) / 1.5, 0, 1);
      mesh.scale.setScalar(THREE.MathUtils.lerp(1.35, 0.62, closeness));
    }

    if (drop.current) {
      if (playStep === "in_tray") {
        // Capsule sitting visibly inside/under the chute opening ready to be grabbed!
        drop.current.visible = true;
        drop.current.position.set(0, 0.24, 0.46);
        drop.current.rotation.y = Math.sin(t * 2.5) * 0.35;
      } else if (vending && progress > 0.84) {
        const emergeT = (progress - 0.84) / 0.16;
        drop.current.visible = true;
        drop.current.position.set(0, 0.34 - emergeT * 0.1, 0.24 + emergeT * 0.22);
        drop.current.rotation.y = progress * 5;
      } else if (phase === "revealed" || playStep === "revealed") {
        drop.current.visible = true;
        drop.current.position.set(0, 0.42, 0.95);
        drop.current.rotation.y = 0;
      } else {
        drop.current.visible = false;
      }
    }
  });

  const podColor = rarity ? RARITY_COLOR[rarity] : "#e0b15a";
  const coinInteractive = allowRef.current && (playStep === "need_coin" || playStep === "revealed");

  return (
    <group ref={rig} visible={phase !== "reality"}>
      <group position={[0, 1.08, 0]}>
        <CabinetShell />
        {/* Front glass pane — raycast disabled so clicks reach shelves and coils inside */}
        <mesh position={[0, 0.12, 0.38]} castShadow raycast={() => null}>
          <boxGeometry args={[1.05, 1.48, 0.008]} />
          <meshPhysicalMaterial
            color="#a0e8ff"
            transmission={0.92}
            thickness={0.04}
            roughness={0.04}
            metalness={0}
            ior={1.45}
            transparent
          />
        </mesh>

        <Shelves
          marks={stock}
          activeTopicIndex={activeTopicIndex}
          targetedSlotIndex={targetedSlotIndex}
          vendingSlotIndex={vendingSlotIndex}
          isVending={phase === "vending"}
          vendStarted={vendStarted}
          vendMs={vendMs}
          accent={theme.lamp}
          onSelectSlot={onSelectSlotIndex}
        />

        <pointLight ref={bulb} position={[0, 0.35, 0.28]} intensity={2} distance={2.4} color={theme.bulb} />

        {/* Right bezel indicator lamp (preserved from original machine) */}
        <mesh position={[0.62, 0.4, 0.35]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial ref={lamp} color={theme.lamp} emissive={theme.lamp} emissiveIntensity={2.5} />
        </mesh>

        {/* Compact Coin Slot, Digital LED & Tactile Keypad integrated on right bezel */}
        <RightBezelControls
          playStep={playStep}
          typedCode={typedCode}
          activeCode={activeSlotCode}
          coinGlow={theme.coinGlow}
          onCoinClick={() => {
            if (coinInteractive) insertRef.current();
          }}
          onKeyPress={(k) => onKeyPress?.(k)}
        />

        {/* Lower Chute Delivery Flap — clickable to grab & open capsule when dispensed */}
        <group
          ref={flap}
          position={[0, -0.92, 0.28]}
          onClick={(e) => {
            if (playStep === "in_tray") {
              e.stopPropagation();
              onCollect?.();
            }
          }}
          onPointerOver={() => {
            if (playStep === "in_tray") gl.domElement.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            gl.domElement.style.cursor = "";
          }}
        >
          <mesh position={[0, -0.07, 0.08]}>
            <boxGeometry args={[0.72, 0.12, 0.08]} />
            <meshPhysicalMaterial
              color={playStep === "in_tray" ? "#164e3f" : "#1a2a3a"}
              emissive={playStep === "in_tray" ? "#10b981" : "#000000"}
              emissiveIntensity={playStep === "in_tray" ? 0.35 : 0}
              metalness={1}
              roughness={0.15}
              clearcoat={0.35}
            />
          </mesh>
          {playStep === "in_tray" ? (
            <mesh position={[0, -0.02, 0.13]}>
              <planeGeometry args={[0.42, 0.085]} />
              <meshBasicMaterial map={trayTagTex} />
            </mesh>
          ) : null}
        </group>

        <mesh position={[0, -1.02, 0.02]}>
          <boxGeometry args={[1.2, 0.08, 0.5]} />
          <meshPhysicalMaterial color="#0d1a2a" metalness={0.9} roughness={0.2} clearcoat={0.3} />
        </mesh>
      </group>

      {/* Existing front display plinth */}
      <mesh position={[0, 0.12, 0.95]} castShadow receiveShadow>
        <boxGeometry args={[0.86, 0.28, 0.56]} />
        <meshPhysicalMaterial color="#0d1118" metalness={0.55} roughness={0.38} clearcoat={0.2} />
      </mesh>
      <mesh position={[0, 0.28, 0.95]} receiveShadow>
        <boxGeometry args={[0.7, 0.03, 0.4]} />
        <meshPhysicalMaterial color="#c8e0f0" metalness={0.85} roughness={0.22} />
      </mesh>

      {/* Draggable / Clickable 3D Coin */}
      <group
        ref={coin}
        position={[COIN_REST.x, COIN_REST.y, COIN_REST.z]}
        onPointerOver={() => {
          if (coinInteractive) gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!held.current) gl.domElement.style.cursor = "";
        }}
        onPointerDown={(event) => {
          if (!coinInteractive || phase === "vending" || phase === "reality") return;
          event.stopPropagation();
          dragStart.current = { x: event.clientX, y: event.clientY };
          held.current = true;
          playCoinPickup();
          gl.domElement.style.cursor = "grabbing";
          const orbit = controls as { enabled?: boolean } | null;
          if (orbit) orbit.enabled = false;
          const place = (native: PointerEvent) => {
            const hit = pointOnCoinPlane(native.clientX, native.clientY, camera, gl.domElement);
            if (hit && coin.current) coin.current.position.copy(hit);
          };
          const release = (native: PointerEvent) => {
            gl.domElement.removeEventListener("pointermove", place);
            gl.domElement.removeEventListener("pointerup", release);
            gl.domElement.style.cursor = "";
            if (orbit) orbit.enabled = true;
            const movedPx = Math.hypot(native.clientX - dragStart.current.x, native.clientY - dragStart.current.y);
            const nearSlot = coin.current ? coin.current.position.distanceTo(COIN_SLOT) < 0.42 : false;
            held.current = false;
            if ((nearSlot || movedPx < 8) && coinInteractive) {
              insertRef.current();
            }
          };
          gl.domElement.addEventListener("pointermove", place);
          gl.domElement.addEventListener("pointerup", release);
        }}
      >
        <group rotation={[0.15, -0.7, 0.08]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.03, 48]} />
            <meshPhysicalMaterial color="#c8e8ff" emissive={theme.coinGlow} emissiveIntensity={0.45} metalness={1} roughness={0.18} clearcoat={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.1, 0.011, 12, 40]} />
            <meshPhysicalMaterial color="#e8f4ff" metalness={1} roughness={0.15} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.034, 0.034, 0.034, 24]} />
            <meshPhysicalMaterial color="#2a3a4a" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Dispensed Capsule & Revealed Item */}
      <group
        ref={drop}
        position={[0, 0.42, 0.95]}
        onClick={(e) => {
          if (playStep === "in_tray") {
            e.stopPropagation();
            onCollect?.();
          }
        }}
        onPointerOver={() => {
          if (playStep === "in_tray") gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "";
        }}
      >
        <CapsulePod
          phase={phase}
          rarity={rarity}
          color={podColor}
        />
        {phase === "revealed" ? (
          <>
            <RevealedItem product={product} rarity={rarity} stock={stock} />
            <RarityVFX rarity={rarity} active={phase === "revealed"} />
          </>
        ) : null}
      </group>
    </group>
  );
}
