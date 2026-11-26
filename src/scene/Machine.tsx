import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group, MeshStandardMaterial, PointLight } from "three";
import * as THREE from "three";
import { RARITY_COLOR, type Product, type Rarity } from "../generate";
import { Creature } from "./Creature";
import { COIL_CODES, type CoinPlayer, type GiftTopic, type PlayStep } from "../stock";
import {
  playBinThud,
  playCoilWhir,
  playCoinPickup,
  playKeypadBeep,
  playTeeterCreak,
} from "../audio";

export type Phase = "idle" | "vending" | "revealed" | "reality";
export type CameraView = "default" | "controls" | "plinth";

export const THEME_CONFIG: Record<
  GiftTopic,
  {
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
  }
> = {
  technology: {
    bg: "#040916",
    wall: "#060c1d",
    sideWall: "#071024",
    floor: "#081224",
    spotA: "#d8e6ff",
    spotB: "#00f5ff",
    hemiSky: "#38bdf8",
    hemiGround: "#0a0818",
    lamp: "#00f5ff",
    bulb: "#38bdf8",
    coinGlow: "#fbbf24",
    lfA: "#bae6fd",
    lfB: "#00f5ff",
    lfC: "#818cf8",
  },
  audio: {
    bg: "#0b0418",
    wall: "#110622",
    sideWall: "#16082d",
    floor: "#170b2e",
    spotA: "#f3e8ff",
    spotB: "#ff2d78",
    hemiSky: "#bf5af2",
    hemiGround: "#180524",
    lamp: "#ff2d78",
    bulb: "#c084fc",
    coinGlow: "#fbbf24",
    lfA: "#e9d5ff",
    lfB: "#ff2d78",
    lfC: "#38bdf8",
  },
  snacks: {
    bg: "#140804",
    wall: "#1e0c05",
    sideWall: "#271006",
    floor: "#241008",
    spotA: "#ffedd5",
    spotB: "#ff9e3b",
    hemiSky: "#f59e0b",
    hemiGround: "#290c04",
    lamp: "#ff9e3b",
    bulb: "#fbbf24",
    coinGlow: "#fbbf24",
    lfA: "#fde68a",
    lfB: "#fb923c",
    lfC: "#f43f5e",
  },
  style: {
    bg: "#03140b",
    wall: "#051b10",
    sideWall: "#062415",
    floor: "#072617",
    spotA: "#d1fae5",
    spotB: "#00ff88",
    hemiSky: "#10b981",
    hemiGround: "#032615",
    lamp: "#00ff88",
    bulb: "#34d399",
    coinGlow: "#fbbf24",
    lfA: "#a7f3d0",
    lfB: "#34d399",
    lfC: "#facc15",
  },
};

const VEND_EASE = (t: number) => 1 - (1 - t) ** 3;
const COLLECT_MS = 480;

const CAMERA_PRESETS: Record<CameraView, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  default: {
    pos: new THREE.Vector3(0.06, 1.48, 2.86),
    target: new THREE.Vector3(0.0, 1.06, 0.25),
  },
  controls: {
    pos: new THREE.Vector3(0.76, 1.38, 1.62),
    target: new THREE.Vector3(0.54, 1.24, 0.36),
  },
  plinth: {
    pos: new THREE.Vector3(0.04, 0.78, 1.98),
    target: new THREE.Vector3(-0.02, 0.44, 0.92),
  },
};

function idleTwitch(t: number): { active: boolean; x: number; z: number; flap: number } {
  const local = t % 9;
  if (local > 0.42) return { active: false, x: 0, z: 0, flap: 0 };
  const fade = 1 - local / 0.42;
  const swing = Math.sin(local * 42) * fade;
  const dir = Math.floor(t / 9) % 2 === 0 ? 1 : -1;
  return {
    active: true,
    x: swing * 0.008 * dir,
    z: swing * 0.01 * dir,
    flap: swing * 0.2,
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
  cameraView = "default",
  cameraViewSeq = 0,
  shockAt = 0,
  children,
}: {
  phase: Phase;
  sky: string;
  topic?: GiftTopic;
  rarity?: Rarity | null;
  fullScreen?: boolean;
  cameraView?: CameraView;
  cameraViewSeq?: number;
  shockAt?: number;
  children: ReactNode;
}) {
  const { scene, camera, controls } = useThree();
  const realityPose = useRef(new THREE.Vector3(0, 1.25, 5.2));
  const theme = THEME_CONFIG[topic] ?? THEME_CONFIG.technology;
  const currentBg = useRef(new THREE.Color(theme.bg));
  const targetBg = useRef(new THREE.Color(theme.bg));
  const gliding = useRef(false);
  const lastViewSeq = useRef(cameraViewSeq);
  const lastShock = useRef(shockAt);
  const shockEnergy = useRef(0);

  useEffect(() => {
    if (cameraViewSeq !== lastViewSeq.current) {
      lastViewSeq.current = cameraViewSeq;
      gliding.current = true;
    }
  }, [cameraViewSeq]);

  useEffect(() => {
    if (shockAt > 0 && shockAt !== lastShock.current) {
      lastShock.current = shockAt;
      shockEnergy.current = 1;
    }
  }, [shockAt]);

  const cosmicStars = useMemo(() => {
    const arr = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 8 - 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    return arr;
  }, []);

  const tileGridTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0e172a";
      ctx.fillRect(0, 0, 512, 512);
      // Terrazzo tile seams & faint speckles
      ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
      ctx.lineWidth = 4;
      for (let i = 0; i <= 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 3 === 0 ? "rgba(255,255,255,0.05)" : "rgba(56,189,248,0.04)";
        ctx.fillRect((i * 73) % 508, (i * 139) % 508, 3, 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 6);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => tileGridTex.dispose(), [tileGridTex]);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    let dest = phase === "reality" ? sky : theme.bg;
    if (phase === "revealed" && rarity === "impossible") {
      dest = "#03000a";
    }
    targetBg.current.set(dest);
    currentBg.current.lerp(targetBg.current, 1 - Math.exp(-dt * 3.5));
    scene.background = currentBg.current;
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(currentBg.current);
    }

    if (fullScreen) {
      camera.position.lerp(new THREE.Vector3(0, 0.74, 2.08), 0.07);
      if (controls && "target" in controls) {
        (controls.target as THREE.Vector3).lerp(new THREE.Vector3(0, 0.54, 0.96), 0.07);
      }
      return;
    }

    if (phase === "reality") {
      camera.position.lerp(realityPose.current, 0.06);
      camera.lookAt(0, 1.05, 0);
      return;
    }

    if (gliding.current) {
      const preset = CAMERA_PRESETS[cameraView];
      camera.position.lerp(preset.pos, 1 - Math.exp(-dt * 6.5));
      if (controls && "target" in controls) {
        (controls.target as THREE.Vector3).lerp(preset.target, 1 - Math.exp(-dt * 6.5));
      }
      if (camera.position.distanceTo(preset.pos) < 0.015) {
        gliding.current = false;
      }
    }

    if (shockEnergy.current > 0.005) {
      const s = shockEnergy.current;
      camera.position.x += Math.sin(performance.now() * 0.09) * 0.012 * s;
      camera.position.y += Math.cos(performance.now() * 0.11) * 0.01 * s;
      shockEnergy.current *= Math.exp(-dt * 12);
    }
  });

  return (
    <>
      {phase !== "reality" ? (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          target={[0.0, 1.06, 0.25]}
          minDistance={1.35}
          maxDistance={6.2}
          minPolarAngle={0.78}
          maxPolarAngle={1.32}
          minAzimuthAngle={-1.0}
          maxAzimuthAngle={1.0}
          onStart={() => {
            gliding.current = false;
          }}
        />
      ) : null}
      {phase !== "reality" ? (
        <fog
          attach="fog"
          args={[
            phase === "revealed" && rarity === "impossible" ? "#03000a" : theme.bg,
            phase === "revealed" && rarity === "impossible" ? 5.5 : 8.5,
            16,
          ]}
        />
      ) : null}
      {phase === "revealed" && rarity === "impossible" ? (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[cosmicStars, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.036} color="#d946ef" transparent opacity={0.88} blending={THREE.AdditiveBlending} />
        </points>
      ) : null}

      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.5]} />
      <spotLight
        position={[2.4, 5.1, 3.6]}
        angle={0.44}
        penumbra={0.75}
        intensity={58}
        color={theme.spotA}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0002}
      />
      <spotLight position={[-3.0, 2.5, 2.4]} angle={0.6} penumbra={1} intensity={26} color={theme.spotB} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.4} position={[0, 3.4, 2]} scale={[7, 3, 1]} color={theme.lfA} />
        <Lightformer form="rect" intensity={1.7} position={[-3.5, 1.5, 1]} scale={[2, 3, 1]} color={theme.lfB} />
        <Lightformer form="rect" intensity={1.3} position={[3.2, 1.2, -1]} scale={[2.4, 1.6, 1]} color={theme.lfC} />
      </Environment>

      {children}

      {phase !== "reality" ? (
        <>
          {/* Polished mall terrazzo floor */}
          <RoundedBox args={[11.2, 0.22, 8.2]} position={[0.2, -0.11, 0.65]} radius={0.04} smoothness={2} receiveShadow>
            <meshStandardMaterial color={theme.floor} map={tileGridTex} metalness={0.42} roughness={0.34} />
          </RoundedBox>
          {/* Decorative circular arcade rubber mat under the machine */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.35]} receiveShadow>
            <circleGeometry args={[1.45, 48]} />
            <meshStandardMaterial color="#0b1120" roughness={0.85} metalness={0.1} />
          </mesh>
          {/* Mall rear architectural wall & glowing arcade pillars */}
          <mesh position={[0, 1.85, -2.0]} receiveShadow>
            <planeGeometry args={[13.5, 6.0]} />
            <meshStandardMaterial color={theme.wall} roughness={0.88} />
          </mesh>
          {[-2.4, -1.25, 1.25, 2.4].map((colX) => (
            <group key={colX} position={[colX, 1.45, -1.88]}>
              <mesh>
                <boxGeometry args={[0.14, 3.2, 0.14]} />
                <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.075]}>
                <planeGeometry args={[0.024, 2.7]} />
                <meshStandardMaterial color={theme.lamp} emissive={theme.lamp} emissiveIntensity={1.6} />
              </mesh>
            </group>
          ))}
          {/* Subtle distant arcade booths in the background for Starlight Mall depth */}
          <group position={[-2.5, 0.95, -1.35]} rotation={[0, 0.35, 0]}>
            <RoundedBox args={[0.72, 1.9, 0.56]} radius={0.03} smoothness={2}>
              <meshStandardMaterial color="#0d1326" metalness={0.4} roughness={0.5} />
            </RoundedBox>
            <mesh position={[0, 0.34, 0.285]}>
              <planeGeometry args={[0.52, 0.38]} />
              <meshStandardMaterial color="#1e1b4b" emissive="#818cf8" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, 0.78, 0.285]}>
              <planeGeometry args={[0.56, 0.14]} />
              <meshStandardMaterial color={theme.spotB} emissive={theme.spotB} emissiveIntensity={0.9} />
            </mesh>
          </group>
          <mesh position={[-3.8, 1.5, -0.2]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[4.5, 4.8]} />
            <meshStandardMaterial color={theme.sideWall} roughness={0.92} />
          </mesh>
          <ContactShadows position={[0, 0.01, 0.4]} opacity={0.55} scale={8} blur={2.2} far={2.6} />
        </>
      ) : null}
    </>
  );
}

const COIN_REST = new THREE.Vector3(0.84, 0.98, 0.49);
const COIN_SLOT = new THREE.Vector3(0.59, 1.32, 0.39);
const KID_HAND_POS = new THREE.Vector3(0.68, 1.15, 0.52);
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

function animateCoinArc(
  from: THREE.Vector3,
  coinT: number,
  target: THREE.Vector3,
  player: CoinPlayer,
): { rollZ: number; rotX: number; rotY: number; visible: boolean; scale: number } {
  if (player === "Dad") {
    const smooth = VEND_EASE(Math.min(1, coinT / 0.8));
    coinMid.copy(from).lerp(COIN_SLOT, 0.5);
    coinMid.y += 0.34;
    const rem = 1 - smooth;
    target
      .copy(from)
      .multiplyScalar(rem * rem)
      .addScaledVector(coinMid, 2 * rem * smooth)
      .addScaledVector(COIN_SLOT, smooth * smooth);
    // Final slide straight into the vertical coin slot aperture
    if (coinT >= 0.8) {
      const slide = Math.min(1, (coinT - 0.8) / 0.16);
      target.z -= slide * 0.045;
    }
    return {
      rotX: THREE.MathUtils.lerp(Math.PI / 2, 0, Math.min(1, smooth * 1.4)),
      rotY: THREE.MathUtils.lerp(0.1, Math.PI / 2, smooth),
      rollZ: THREE.MathUtils.lerp(0, Math.PI / 2, smooth),
      visible: coinT < 0.96,
      scale: THREE.MathUtils.lerp(0.65, 0.42, smooth),
    };
  }

  // Leo (tiptoes) or Maya (joyful jump): Stage 1 picks up/carries coin cleanly to hand-reach beside slot;
  // Stage 2 lifts/pushes edge-on directly into the vertical slot!
  if (coinT < 0.36) {
    const grabT = VEND_EASE(coinT / 0.36);
    target.copy(from).lerp(KID_HAND_POS, grabT);
    target.y += Math.sin(grabT * Math.PI) * 0.12;
    return {
      rotX: THREE.MathUtils.lerp(Math.PI / 2, 0.35, grabT),
      rotY: grabT * 0.8,
      rollZ: grabT * 0.6,
      visible: true,
      scale: THREE.MathUtils.lerp(0.62, 0.48, grabT),
    };
  }

  const pushT = Math.min(1, (coinT - 0.36) / 0.48);
  const easedPush = VEND_EASE(pushT);
  target.copy(KID_HAND_POS).lerp(COIN_SLOT, easedPush);
  if (player === "Maya") {
    target.y += Math.sin(pushT * Math.PI) * 0.11;
  } else {
    target.y += Math.sin(pushT * Math.PI * 2) * 0.025;
  }
  if (coinT >= 0.84) {
    const slide = Math.min(1, (coinT - 0.84) / 0.12);
    target.z -= slide * 0.045;
  }
  return {
    rotX: THREE.MathUtils.lerp(0.35, 0, easedPush),
    rotY: THREE.MathUtils.lerp(0.8, Math.PI / 2, easedPush),
    rollZ: THREE.MathUtils.lerp(0.6, Math.PI / 2, easedPush),
    visible: coinT < 0.96,
    scale: THREE.MathUtils.lerp(0.48, 0.42, easedPush),
  };
}

function Steel({ color = "#172030", roughness = 0.28 }: { color?: string; roughness?: number }) {
  return <meshPhysicalMaterial color={color} metalness={0.82} roughness={roughness} clearcoat={0.35} clearcoatRoughness={0.25} />;
}

function CabinetShell({ accent }: { accent: string }) {
  return (
    <group>
      {/* Back Cabinet Shell */}
      <RoundedBox args={[1.42, 2.02, 0.10]} radius={0.02} smoothness={2} position={[0.02, -0.02, -0.30]} castShadow>
        <Steel color="#111827" />
      </RoundedBox>
      {/* Left Structural Pillar */}
      <RoundedBox args={[0.10, 2.02, 0.72]} radius={0.02} smoothness={2} position={[-0.64, -0.02, 0.02]} castShadow>
        <Steel color="#0f172a" />
      </RoundedBox>
      {/* Interior Mullion between Glass & Right Console */}
      <RoundedBox args={[0.045, 1.98, 0.36]} radius={0.015} smoothness={2} position={[0.455, -0.02, 0.21]} castShadow>
        <Steel color="#1e293b" />
      </RoundedBox>
      {/* Wide Right Control Console Pillar */}
      <RoundedBox args={[0.24, 2.02, 0.72]} radius={0.02} smoothness={2} position={[0.59, -0.02, 0.02]} castShadow>
        <Steel color="#0c1422" />
      </RoundedBox>
      {/* Top Roof Cap */}
      <RoundedBox args={[1.48, 0.13, 0.78]} radius={0.02} smoothness={2} position={[0.02, 0.99, 0.04]} castShadow>
        <Steel color="#1b2838" />
      </RoundedBox>
      {/* Illuminated Top Marquee Frame Trim */}
      <RoundedBox args={[1.28, 0.34, 0.08]} radius={0.02} smoothness={2} position={[0, 1.06, 0.29]}>
        <Steel color="#0f172a" />
      </RoundedBox>
      <mesh position={[0, 0.90, 0.39]}>
        <boxGeometry args={[1.24, 0.018, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} />
      </mesh>
      {/* Bottom Chassis Skirt */}
      <RoundedBox args={[1.48, 0.12, 0.78]} radius={0.02} smoothness={2} position={[0.02, -1.01, 0.04]} castShadow>
        <Steel color="#090e17" />
      </RoundedBox>
      {/* Brushed Steel Sill dividing Glass Window (top) from Pickup Bin (bottom) */}
      <mesh position={[-0.07, -0.68, 0.24]} castShadow>
        <boxGeometry args={[1.04, 0.04, 0.28]} />
        <meshPhysicalMaterial color="#334155" metalness={0.85} roughness={0.22} />
      </mesh>
      {/* Dark interior rear liner behind shelves */}
      <mesh position={[-0.07, 0.12, -0.24]}>
        <planeGeometry args={[1.02, 1.62]} />
        <meshStandardMaterial color="#0b101b" roughness={0.85} />
      </mesh>
      {/* Subtle Neon Vertical Strip Lights inside left & right inner glass cheeks */}
      <mesh position={[-0.575, 0.14, 0.28]}>
        <boxGeometry args={[0.014, 1.46, 0.018]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={1.3} />
      </mesh>
      <mesh position={[0.425, 0.14, 0.28]}>
        <boxGeometry args={[0.014, 1.46, 0.018]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={1.3} />
      </mesh>
      {/* Rubber front glass frame gasket */}
      <mesh position={[-0.07, 0.87, 0.365]}>
        <boxGeometry args={[1.04, 0.028, 0.02]} />
        <meshStandardMaterial color="#06090f" roughness={0.85} />
      </mesh>
    </group>
  );
}

const staticTextureCache = new Map<string, THREE.CanvasTexture>();

function getBadgeTexture(label: string, accent: string, highlighted: boolean, claimed: boolean): THREE.CanvasTexture {
  const key = `badge:${label}:${claimed ? "out" : highlighted ? accent : "dim"}`;
  const existing = staticTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 56;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = claimed ? "#111827" : highlighted ? accent : "#091120";
    ctx.fillRect(0, 0, 160, 56);
    ctx.strokeStyle = claimed ? "rgba(148, 163, 184, 0.22)" : highlighted ? "#ffffff" : "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 156, 52);
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = claimed ? "#475569" : highlighted ? "#030712" : "#f1f5f9";
    ctx.fillText(label, 14, 29);
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = claimed ? "#64748b" : highlighted ? "#030712" : "#fbbf24";
    ctx.fillText(claimed ? "--" : "$1", 146, 29);
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
  canvas.width = 112;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle =
      variant === "clr" ? "#450a0a" : variant === "ok" ? "#064e3b" : variant === "letter" ? "#0f172a" : "#17253b";
    ctx.fillRect(0, 0, 112, 80);
    ctx.strokeStyle =
      variant === "clr" ? "#f87171" : variant === "ok" ? "#34d399" : variant === "letter" ? "#38bdf8" : "#cbd5e1";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 106, 74);
    ctx.font = variant === "clr" || variant === "ok" ? "bold 30px monospace" : "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle =
      variant === "clr" ? "#fecaca" : variant === "ok" ? "#6ee7b7" : variant === "letter" ? "#bae6fd" : "#ffffff";
    ctx.fillText(label, 56, 42);
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
  canvas.width = 360;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(4, 47, 46, 0.94)";
    ctx.fillRect(0, 0, 360, 72);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 356, 68);
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#6ee7b7";
    ctx.fillText(text, 180, 37);
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
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.118 + frac * 0.23));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.0048, 8, false);
  }, []);

  return (
    <group>
      {/* Back motor hub */}
      <mesh position={[0, 0, -0.125]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 12]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#e2e8f0" metalness={0.94} roughness={0.14} />
      </mesh>
    </group>
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
    <group scale={0.78}>
      <group ref={coreRef}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.044, 0]} />
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
          <torusGeometry args={[0.075, 0.005, 12, 36]} />
          <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={2.0} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
      <group ref={ringBRef}>
        <mesh>
          <torusGeometry args={[0.098, 0.004, 12, 36]} />
          <meshStandardMaterial color="#bf5af2" emissive="#bf5af2" emissiveIntensity={2.2} metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function PrizeShape({
  shape,
  name = "",
  color,
  rarity = "common",
}: {
  shape: string;
  name?: string;
  color: string;
  rarity?: Rarity | string;
}) {
  const isLegendary = rarity === "legendary";
  const isRare = rarity === "rare";
  const accentColor = isLegendary ? "#ffd700" : isRare && !color ? "#00f5ff" : color;
  const metalness = isLegendary ? 0.94 : isRare ? 0.65 : 0.4;
  const roughness = isLegendary ? 0.16 : isRare ? 0.25 : 0.36;
  const titleLower = name.toLowerCase();

  if (shape === "anomaly") {
    return <QuantumAnomaly color={accentColor} />;
  }

  if (titleLower.includes("camera")) {
    return (
      <group>
        {/* Brushed silver & leather body */}
        <RoundedBox args={[0.095, 0.062, 0.036]} radius={0.006} smoothness={2} castShadow>
          <meshStandardMaterial color="#27272a" roughness={0.65} metalness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.024, 0]}>
          <boxGeometry args={[0.096, 0.016, 0.037]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.85} roughness={0.22} />
        </mesh>
        {/* Lens barrel */}
        <mesh position={[0.006, -0.004, 0.025]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.024, 0.024, 20]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.006, -0.004, 0.038]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.005, 16]} />
          <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} emissive="#0ea5e9" emissiveIntensity={0.35} />
        </mesh>
        {/* Top shutter button */}
        <mesh position={[-0.028, 0.035, 0.004]}>
          <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  if (shape === "phone" || titleLower.includes("phone") || titleLower.includes("player")) {
    const isHifi = titleLower.includes("hi-fi") || titleLower.includes("player");
    return (
      <group>
        <RoundedBox args={[0.064, 0.118, 0.014]} radius={0.008} smoothness={2} castShadow>
          <meshStandardMaterial
            color={accentColor}
            metalness={metalness}
            roughness={roughness}
            emissive={isLegendary ? "#ffd700" : isRare ? "#00f5ff" : "#000000"}
            emissiveIntensity={isLegendary ? 0.22 : isRare ? 0.15 : 0}
          />
        </RoundedBox>
        {/* Glowing OLED Screen */}
        <mesh position={[0, isHifi ? 0.018 : 0.002, 0.008]}>
          <planeGeometry args={[0.052, isHifi ? 0.05 : 0.098]} />
          <meshStandardMaterial
            color="#0f172a"
            emissive={isHifi ? "#facc15" : isLegendary ? "#38bdf8" : "#1e293b"}
            emissiveIntensity={isHifi ? 0.75 : isLegendary ? 0.65 : 0.4}
            roughness={0.1}
          />
        </mesh>
        {/* Hi-fi DAC wheel or Gold Phone Ring */}
        {isHifi ? (
          <mesh position={[0, -0.028, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.004, 24]} />
            <meshStandardMaterial color="#facc15" metalness={1} roughness={0.15} />
          </mesh>
        ) : (
          <mesh position={[-0.016, 0.036, -0.008]}>
            <boxGeometry args={[0.022, 0.022, 0.004]} />
            <meshStandardMaterial color={isLegendary ? "#fde047" : "#334155"} metalness={0.9} roughness={0.2} />
          </mesh>
        )}
      </group>
    );
  }

  if (shape === "laptop") {
    return (
      <group position={[0, -0.015, 0]}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <boxGeometry args={[0.13, 0.01, 0.085]} />
          <meshStandardMaterial color={accentColor} metalness={metalness} roughness={roughness} />
        </mesh>
        <mesh position={[0, 0.052, -0.038]} rotation={[-0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.007]} />
          <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.052, -0.033]} rotation={[-0.35, 0, 0]}>
          <planeGeometry args={[0.115, 0.068]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={0.45} />
        </mesh>
      </group>
    );
  }

  if (titleLower.includes("sunglasses")) {
    return (
      <group rotation={[0.18, 0, 0]}>
        {/* Left & Right frames */}
        <mesh position={[-0.028, 0, 0.01]} castShadow>
          <torusGeometry args={[0.02, 0.0045, 10, 20]} />
          <meshStandardMaterial color="#18181b" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[-0.028, 0, 0.01]}>
          <circleGeometry args={[0.018, 16]} />
          <meshPhysicalMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} metalness={0.8} roughness={0.1} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0.028, 0, 0.01]} castShadow>
          <torusGeometry args={[0.02, 0.0045, 10, 20]} />
          <meshStandardMaterial color="#18181b" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0.028, 0, 0.01]}>
          <circleGeometry args={[0.018, 16]} />
          <meshPhysicalMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} metalness={0.8} roughness={0.1} transparent opacity={0.85} />
        </mesh>
        {/* Nose bridge */}
        <mesh position={[0, 0.004, 0.01]}>
          <boxGeometry args={[0.02, 0.005, 0.005]} />
          <meshStandardMaterial color={accentColor} metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Temple arms */}
        <mesh position={[-0.048, 0.004, -0.02]}>
          <boxGeometry args={[0.004, 0.005, 0.06]} />
          <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.048, 0.004, -0.02]}>
          <boxGeometry args={[0.004, 0.005, 0.06]} />
          <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    );
  }

  if (shape === "watch") {
    return (
      <group rotation={[0.35, 0, 0]}>
        {/* Wrist strap loop */}
        <mesh castShadow>
          <torusGeometry args={[0.04, 0.011, 10, 24]} />
          <meshStandardMaterial color={isLegendary ? "#eab308" : "#1e293b"} metalness={isLegendary ? 0.95 : 0.4} roughness={0.3} />
        </mesh>
        {/* Watch case */}
        <mesh position={[0, 0.032, 0.016]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.014, 24]} />
          <meshStandardMaterial color={isLegendary ? "#ffd700" : "#cbd5e1"} metalness={0.92} roughness={0.16} />
        </mesh>
        {/* Illuminated Watch Dial */}
        <mesh position={[0, 0.032, 0.024]}>
          <circleGeometry args={[0.021, 20]} />
          <meshStandardMaterial color="#020617" emissive={accentColor} emissiveIntensity={isLegendary ? 0.45 : 0.75} />
        </mesh>
      </group>
    );
  }

  if (titleLower.includes("macaron")) {
    const macaronColors = ["#c084fc", "#86efac", "#f472b6"];
    return (
      <group>
        {/* Clear ribbon gift box base */}
        <RoundedBox args={[0.105, 0.028, 0.056]} radius={0.005} smoothness={2} position={[0, -0.012, 0]} castShadow>
          <meshPhysicalMaterial color="#fdf2f8" roughness={0.25} clearcoat={0.5} />
        </RoundedBox>
        {macaronColors.map((mc, i) => (
          <group key={mc} position={[(i - 1) * 0.03, 0.01, 0]}>
            <mesh position={[0, 0.008, 0]} castShadow>
              <cylinderGeometry args={[0.013, 0.014, 0.008, 16]} />
              <meshStandardMaterial color={mc} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.005, 16]} />
              <meshStandardMaterial color="#fffbeb" roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.007, 0]}>
              <cylinderGeometry args={[0.014, 0.013, 0.008, 16]} />
              <meshStandardMaterial color={mc} roughness={0.45} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (titleLower.includes("truffle")) {
    return (
      <group>
        {/* Fluted foil wrapper cup */}
        <mesh position={[0, -0.014, 0]} castShadow>
          <cylinderGeometry args={[0.036, 0.026, 0.022, 16]} />
          <meshStandardMaterial color="#451a03" roughness={0.6} />
        </mesh>
        {/* Faceted 24K Gold Foil Truffle */}
        <mesh position={[0, 0.012, 0]} castShadow>
          <icosahedronGeometry args={[0.032, 1]} />
          <meshStandardMaterial color="#ffd700" metalness={0.96} roughness={0.14} emissive="#f59e0b" emissiveIntensity={0.35} />
        </mesh>
      </group>
    );
  }

  if (shape === "chocolate") {
    return (
      <group rotation={[0.18, 0.15, 0]}>
        {/* Bright outer foil wrapper */}
        <RoundedBox args={[0.095, 0.024, 0.056]} radius={0.004} smoothness={2} position={[-0.012, 0, 0]} castShadow>
          <meshStandardMaterial color="#b91c1c" metalness={0.6} roughness={0.3} />
        </RoundedBox>
        {/* Gold inner paper liner */}
        <mesh position={[0.016, 0.001, 0]}>
          <boxGeometry args={[0.055, 0.023, 0.053]} />
          <meshStandardMaterial color="#fde047" metalness={0.85} roughness={0.22} />
        </mesh>
        {/* Exposed rich chocolate bar squares */}
        <mesh position={[0.038, 0.001, 0]} castShadow>
          <boxGeometry args={[0.038, 0.021, 0.048]} />
          <meshStandardMaterial color="#582c16" roughness={0.45} metalness={0.08} />
        </mesh>
      </group>
    );
  }

  if (titleLower.includes("headphone")) {
    return (
      <group>
        {/* Curved Headband */}
        <mesh position={[0, 0.01, 0]} rotation={[0, 0, 0]} castShadow>
          <torusGeometry args={[0.044, 0.007, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Left & Right Earcups + Neon Ring */}
        {[-0.044, 0.044].map((ex, i) => (
          <group key={i} position={[ex, -0.005, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.018, 16]} />
              <meshStandardMaterial color="#27272a" roughness={0.35} metalness={0.6} />
            </mesh>
            <mesh position={[0, i === 0 ? 0.01 : -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.016, 0.003, 8, 20]} />
              <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1.6} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (shape === "buds" || titleLower.includes("speaker")) {
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.095, 20]} />
          <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.45} />
        </mesh>
        {/* Glowing end passive bass rings */}
        {[-0.048, 0.048].map((sx) => (
          <mesh key={sx} position={[sx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.022, 0.004, 8, 20]} />
            <meshStandardMaterial color="#00f5ff" emissive="#00f5ff" emissiveIntensity={1.3} />
          </mesh>
        ))}
      </group>
    );
  }

  if (titleLower.includes("cap")) {
    return (
      <group>
        {/* Rounded Crown */}
        <mesh position={[0, 0.005, -0.008]} castShadow>
          <sphereGeometry args={[0.042, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={accentColor} roughness={0.65} />
        </mesh>
        {/* Curved Front Visor/Bill */}
        <mesh position={[0, 0.005, 0.036]} rotation={[0.18, 0, 0]} castShadow>
          <cylinderGeometry args={[0.038, 0.044, 0.006, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        {/* Embroidered Gold Star Patch */}
        <mesh position={[0, 0.024, 0.032]} rotation={[-0.4, 0, 0]}>
          <octahedronGeometry args={[0.009, 0]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // Stylized Sneakers default
  return (
    <group>
      {[-0.026, 0.026].map((sx, idx) => (
        <group key={idx} position={[sx, -0.006, 0]} rotation={[0, idx === 0 ? 0.14 : -0.14, 0]}>
          <mesh position={[0, -0.01, 0]} castShadow>
            <boxGeometry args={[0.034, 0.01, 0.088]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.006, -0.004]} castShadow>
            <boxGeometry args={[0.03, 0.022, 0.072]} />
            <meshStandardMaterial color={accentColor} roughness={0.45} metalness={metalness} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CapsulePod({
  openAmountRef,
  openFixed = 0,
  rarity,
  color,
  shelfMode = false,
}: {
  openAmountRef?: MutableRefObject<number>;
  openFixed?: number;
  rarity: Rarity | null;
  color: string;
  shelfMode?: boolean;
}) {
  const topDomeRef = useRef<Group>(null);
  const bottomDomeRef = useRef<Group>(null);

  useFrame(() => {
    if (!topDomeRef.current || !bottomDomeRef.current) return;
    const openAmount = openAmountRef ? openAmountRef.current : openFixed;
    if (openAmount > 0.05) {
      if (rarity === "impossible") {
        topDomeRef.current.visible = false;
        bottomDomeRef.current.visible = false;
        return;
      }
      const hinge = openAmount;
      if (rarity === "legendary") {
        topDomeRef.current.position.set(0, 0.09 * hinge, -0.14 * hinge);
        topDomeRef.current.rotation.x = -1.9 * hinge;
        bottomDomeRef.current.position.set(0, -0.02 * hinge, 0);
      } else {
        topDomeRef.current.position.set(0, 0.04 * hinge, -0.11 * hinge);
        topDomeRef.current.rotation.x = -1.5 * hinge;
        bottomDomeRef.current.position.set(0, -0.01 * hinge, 0);
      }
      topDomeRef.current.visible = true;
      bottomDomeRef.current.visible = true;
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
  const cupColor = isLegendary ? "#ffd700" : isRare ? "#00f5ff" : color;
  const r = shelfMode ? 0.078 : 0.108;
  const centerY = shelfMode ? 0 : 0.05;

  return (
    <group>
      <group ref={topDomeRef}>
        {/* Crystal-clear upper dome so prize inside is ALWAYS clearly visible on shelf and in tray */}
        <mesh position={[0, centerY, 0]}>
          <sphereGeometry args={[r, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color="#e2f1ff"
            roughness={0.08}
            metalness={0.05}
            transparent
            opacity={shelfMode ? 0.24 : 0.32}
            clearcoat={0.9}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={bottomDomeRef}>
        <mesh position={[0, centerY, 0]}>
          <sphereGeometry args={[r, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={cupColor}
            emissive={cupColor}
            emissiveIntensity={isLegendary ? 0.45 : isRare ? 0.35 : 0.12}
            metalness={isLegendary ? 0.9 : 0.45}
            roughness={0.22}
            transparent
            opacity={0.92}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0, centerY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.002, shelfMode ? 0.004 : 0.007, 10, 32]} />
          <meshStandardMaterial
            color={isLegendary ? "#ffe066" : isRare ? "#bae6fd" : "#94a3b8"}
            metalness={0.85}
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
    return active ? <pointLight position={[0, 0.2, 0.1]} intensity={2.0} distance={1.3} color="#fff6e8" /> : null;
  }

  return (
    <group position={[0, 0.08, 0]}>
      <pointLight
        ref={lightRef}
        position={[0, 0.18, 0.12]}
        distance={2.6}
        color={rarity === "legendary" ? "#ffd700" : rarity === "rare" ? "#00f5ff" : "#e7b4ff"}
        intensity={3.5}
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

function resolveVisualSpec(
  product: Product | null,
  stock: { shape: string; name?: string; color: string; claimed: boolean }[],
): { shape: string; name: string; color: string } {
  if (!product) return { shape: "phone", name: "", color: "#f5f5f7" };
  let shape = "phone";
  let color = "#f5f5f7";
  const name = product.title;

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
      }
    }
  } else if (product.rarity === "impossible") {
    shape = "anomaly";
    color = "#e7b4ff";
  }

  return { shape, name, color };
}

function RevealedItem({
  product,
  rarity,
  stock,
  insidePod = false,
}: {
  product: Product | null;
  rarity: Rarity | null;
  stock: { shape: string; name?: string; color: string; claimed: boolean }[];
  insidePod?: boolean;
}) {
  const itemGroup = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!itemGroup.current) return;
    if (insidePod) {
      itemGroup.current.position.set(0, 0.045, 0);
      itemGroup.current.rotation.set(0.15, clock.elapsedTime * 0.6, 0);
      return;
    }
    const t = clock.elapsedTime;
    if (rarity === "common" || rarity === "uncommon") {
      itemGroup.current.position.set(0, 0.05 + Math.sin(t * 1.8) * 0.004, 0);
      itemGroup.current.rotation.set(0, Math.sin(t * 0.6) * 0.25, 0);
    } else if (rarity === "rare") {
      itemGroup.current.position.set(0, 0.09 + Math.sin(t * 2.5) * 0.012, 0);
      itemGroup.current.rotation.set(0, t * 0.75, 0);
    } else if (rarity === "legendary") {
      itemGroup.current.position.set(0, 0.15 + Math.sin(t * 2.0) * 0.02, 0);
      itemGroup.current.rotation.set(Math.sin(t * 1.5) * 0.12, t * 0.55, Math.cos(t * 1.2) * 0.08);
    } else if (rarity === "impossible") {
      itemGroup.current.position.set(
        Math.sin(t * 15) > 0.85 ? (Math.random() - 0.5) * 0.015 : 0,
        0.21 + Math.sin(t * 2.8) * 0.025,
        0,
      );
      itemGroup.current.rotation.set(Math.sin(t * 2.2) * 0.25, t * 1.4, Math.cos(t * 1.8) * 0.25);
    }
  });

  if (!product) return null;

  if (product.type === "creature" && product.payload.kind === "creature") {
    return (
      <group ref={itemGroup} scale={insidePod ? 0.55 : 1}>
        <Creature spec={product.payload} />
      </group>
    );
  }

  const { shape, name, color } = resolveVisualSpec(product, stock);

  return (
    <group ref={itemGroup} scale={insidePod ? 0.9 : 1.15}>
      {shape === "anomaly" ? (
        <QuantumAnomaly color={color} />
      ) : (
        <PrizeShape shape={shape} name={name} color={color} rarity={product.rarity} />
      )}
    </group>
  );
}

export const SHELF_FLOORS = [0.46, 0.09, -0.28, -0.65] as const;
const SHELF_COLS = [-0.43, -0.19, 0.05, 0.29] as const;

export const SHELF_SPOTS: [number, number, number][] = SHELF_FLOORS.flatMap((floorY, rowIdx) =>
  SHELF_COLS.map((x): [number, number, number] => [x, floorY + 0.084, rowIdx]),
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
  isRouletteLit,
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
  mark: { shape: string; name?: string; color: string; claimed: boolean } | undefined;
  rarity?: Rarity;
  accent: string;
  highlighted: boolean;
  isTargeted: boolean;
  isRouletteLit: boolean;
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
    () => getBadgeTexture(code, accent, isTargeted || isRouletteLit || isThisVending || hovered, !hasItem),
    [code, accent, isTargeted, isRouletteLit, isThisVending, hovered, hasItem],
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
    if (progress < 0.48) {
      // Coil rotates 360° inching the prize capsule forward against the front lip
      const coilT = progress / 0.48;
      coilRef.current.rotation.z = coilT * Math.PI * 2;
      const creep = coilT * 0.132 + Math.sin(coilT * Math.PI * 4) * 0.004;
      prizeRef.current.position.set(0, Math.abs(Math.sin(coilT * Math.PI * 2)) * 0.006, creep);
      prizeRef.current.rotation.set(coilT * 0.15, 0, 0);
      prizeRef.current.visible = true;
    } else if (progress < 0.69) {
      // Edge-Teeter Suspense: capsule precariously balanced on front retaining rail
      coilRef.current.rotation.z = Math.PI * 2;
      const hangT = (progress - 0.48) / 0.21;
      const teeter = Math.sin(hangT * Math.PI * 5.5) * 0.12 + hangT * 0.08;
      prizeRef.current.position.set(0, -0.016 - Math.max(0, teeter) * 0.03, 0.146);
      prizeRef.current.rotation.set(0.64 + teeter, 0, 0);
      prizeRef.current.visible = true;
    } else if (progress < 0.87) {
      // Breakaway gravity fall & deflector bounce inside front drop chute
      coilRef.current.rotation.z = Math.PI * 2;
      const dropT = (progress - 0.69) / 0.18;
      const floorDrop = -0.84 - y;
      const grav = dropT * dropT;
      // Subtle bounce forward off angled lower chute baffle at the bottom
      const baffleKick = dropT > 0.72 ? Math.sin(((dropT - 0.72) / 0.28) * Math.PI) * 0.035 : 0;
      prizeRef.current.position.set(
        -x * Math.max(0, (dropT - 0.6) * 0.8),
        -0.016 + floorDrop * grav + baffleKick,
        0.15 + dropT * 0.09,
      );
      prizeRef.current.rotation.set(0.64 + dropT * 5.2, dropT * 1.4, dropT * 0.9);
      prizeRef.current.visible = true;
    } else {
      coilRef.current.rotation.z = Math.PI * 2;
      prizeRef.current.visible = false;
    }
  });

  const podColor = rarity ? RARITY_COLOR[rarity] : mark?.color ?? "#94a3b8";

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
      {/* Horizontal 3D helical steel coil */}
      <group ref={coilRef}>
        <HorizontalCoil />
      </group>

      {/* Prize nestled inside its crystal collectible capsule right in the coil */}
      <group ref={prizeRef} visible={hasItem}>
        {mark ? (
          <>
            <CapsulePod openFixed={0} rarity={rarity ?? "common"} color={podColor} shelfMode />
            <group scale={0.78}>
              <PrizeShape shape={mark.shape} name={mark.name} color={mark.color} rarity={rarity} />
            </group>
          </>
        ) : null}
      </group>

      {/* Glowing slot tag & $1 badge on the front shelf lip */}
      <mesh position={[0, floorY - y + 0.01, 0.135]}>
        <planeGeometry args={[0.094, 0.032]} />
        <meshBasicMaterial
          map={badgeTex}
          transparent
          opacity={!hasItem ? 0.55 : highlighted || isTargeted || isRouletteLit || hovered || isThisVending ? 1 : 0.84}
        />
      </mesh>
    </group>
  );
}

function Shelves({
  marks,
  activeTopicIndex = 0,
  targetedSlotIndex = null,
  rouletteSlotIndex = null,
  vendingSlotIndex = null,
  isVending = false,
  vendStarted = 0,
  vendMs = 3400,
  accent = "#00f5ff",
  onSelectSlot,
}: {
  marks: { shape: string; name?: string; color: string; claimed: boolean; rarity?: Rarity }[];
  activeTopicIndex?: number;
  targetedSlotIndex?: number | null;
  rouletteSlotIndex?: number | null;
  vendingSlotIndex?: number | null;
  isVending?: boolean;
  vendStarted?: number;
  vendMs?: number;
  accent?: string;
  onSelectSlot?: (index: number) => void;
}) {
  return (
    <group>
      {[0.83, ...SHELF_FLOORS].map((floorY, shelfIdx) => (
        <group key={floorY} position={[-0.07, floorY, -0.02]}>
          {/* Matte steel shelf tray */}
          <mesh receiveShadow>
            <boxGeometry args={[1.01, 0.018, 0.28]} />
            <meshStandardMaterial color="#111d2e" roughness={0.62} metalness={0.45} />
          </mesh>
          {/* Under-shelf LED diffuser strip lighting up the shelf below */}
          {shelfIdx < 4 ? (
            <mesh position={[0, -0.011, 0.08]}>
              <boxGeometry args={[0.96, 0.005, 0.018]} />
              <meshStandardMaterial color="#ffffff" emissive={shelfIdx === activeTopicIndex ? accent : "#94a3b8"} emissiveIntensity={shelfIdx === activeTopicIndex ? 2.0 : 0.7} />
            </mesh>
          ) : null}
          {/* Front shelf price rail */}
          {shelfIdx > 0 ? (
            <mesh position={[0, 0.01, 0.14]}>
              <boxGeometry args={[1.01, 0.028, 0.012]} />
              <meshStandardMaterial
                color={shelfIdx - 1 === activeTopicIndex ? "#1e3a5f" : "#152033"}
                emissive={shelfIdx - 1 === activeTopicIndex ? accent : "#000000"}
                emissiveIntensity={shelfIdx - 1 === activeTopicIndex ? 0.25 : 0}
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
          ) : null}
        </group>
      ))}

      {/* Vertical clear acrylic column dividers between columns 1|2|3|4 */}
      {[-0.31, -0.07, 0.17].map((divX) => (
        <mesh key={divX} position={[divX, 0.09, -0.02]} raycast={() => null}>
          <boxGeometry args={[0.005, 1.46, 0.25]} />
          <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.14} roughness={0.1} metalness={0.1} depthWrite={false} />
        </mesh>
      ))}

      {SHELF_SPOTS.map(([x, y, rowIdx], index) => {
        const mark = marks[index];
        const code = COIL_CODES[index] ?? `A${index + 1}`;
        const floorY = SHELF_FLOORS[rowIdx] ?? 0.46;
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
            isRouletteLit={rouletteSlotIndex === index}
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
  activeHighlight,
  onPress,
}: {
  label: string;
  variant: "letter" | "number" | "clr" | "ok";
  position: [number, number, number];
  disabled: boolean;
  activeHighlight?: boolean;
  onPress: (key: string) => void;
}) {
  const { gl } = useThree();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tex = useMemo(() => getKeycapTexture(label, variant), [label, variant]);

  return (
    <mesh
      position={[position[0], position[1], position[2] + (pressed ? -0.005 : 0)]}
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
      <boxGeometry args={[0.048, 0.032, 0.014]} />
      <meshStandardMaterial
        map={tex}
        metalness={0.45}
        roughness={0.28}
        emissive={
          hovered || activeHighlight
            ? variant === "ok"
              ? "#10b981"
              : variant === "clr"
                ? "#ef4444"
                : "#38bdf8"
            : "#000000"
        }
        emissiveIntensity={hovered ? 0.45 : activeHighlight ? 0.3 : 0}
      />
    </mesh>
  );
}

function RightBezelControls({
  playStep,
  typedCode,
  activeCode,
  coinGlow,
  nudgeWarn,
  onCoinClick,
  onCoinReturn,
  onKeyPress,
}: {
  playStep: PlayStep;
  typedCode: string;
  activeCode: string | null;
  coinGlow: string;
  nudgeWarn?: boolean;
  onCoinClick: () => void;
  onCoinReturn?: () => void;
  onKeyPress: (key: string) => void;
}) {
  const { gl } = useThree();
  const [ledTex, setLedTex] = useState<THREE.CanvasTexture | null>(null);
  const [returnPressed, setReturnPressed] = useState(false);

  const ledState = useMemo(() => {
    if (nudgeWarn) {
      return { line1: "WARN: TILT!", line2: "DO NOT SHAKE", color: "#f43f5e" };
    }
    if (playStep === "need_coin") {
      return activeCode
        ? { line1: `SLOT ${activeCode} $1`, line2: "INSERT COIN", color: "#fbbf24" }
        : { line1: "READY $1.00", line2: "INSERT COIN", color: "#fbbf24" };
    }
    if (playStep === "coin_entering") {
      return { line1: "VALIDATOR", line2: "READING...", color: "#38bdf8" };
    }
    if (playStep === "select_item") {
      return {
        line1: "CREDIT $1.00",
        line2: typedCode ? `CODE: ${typedCode}` : "PICK A1-D4",
        color: "#34d399",
      };
    }
    if (playStep === "vending") {
      return { line1: "MOTOR ON", line2: `COIL ${activeCode ?? ""}`, color: "#38bdf8" };
    }
    if (playStep === "in_tray") {
      return { line1: "DROPPED!", line2: "PUSH FLAP", color: "#34d399" };
    }
    if (playStep === "collecting") {
      return { line1: "OPENING...", line2: "ENJOY!", color: "#facc15" };
    }
    return { line1: "DISPENSED", line2: "PLAY AGAIN", color: "#e2e8f0" };
  }, [playStep, typedCode, activeCode, nudgeWarn]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#020612";
      ctx.fillRect(0, 0, 280, 140);
      ctx.strokeStyle = ledState.color;
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, 272, 132);
      ctx.font = "bold 26px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(ledState.line1, 140, 48);
      ctx.font = "bold 38px monospace";
      ctx.fillStyle = ledState.color;
      ctx.fillText(ledState.line2, 140, 102);
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
    { label: "A", variant: "letter", pos: [-0.028, 0.045, 0.01] },
    { label: "B", variant: "letter", pos: [0.028, 0.045, 0.01] },
    { label: "C", variant: "letter", pos: [-0.028, 0.005, 0.01] },
    { label: "D", variant: "letter", pos: [0.028, 0.005, 0.01] },
    { label: "1", variant: "number", pos: [-0.028, -0.035, 0.01] },
    { label: "2", variant: "number", pos: [0.028, -0.035, 0.01] },
    { label: "3", variant: "number", pos: [-0.028, -0.075, 0.01] },
    { label: "4", variant: "number", pos: [0.028, -0.075, 0.01] },
    { label: "CLR", variant: "clr", pos: [-0.028, -0.115, 0.01] },
    { label: "OK", variant: "ok", pos: [0.028, -0.115, 0.01] },
  ];

  const keypadDisabled = playStep === "coin_entering" || playStep === "vending" || playStep === "in_tray" || playStep === "collecting";

  return (
    <group position={[0.59, 0.06, 0.378]}>
      {/* Sculpted Slate Control Fascia */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.19, 0.88, 0.016]} />
        <meshStandardMaterial color="#070d1a" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Large Digital VFD Screen (world y = 1.48) */}
      {ledTex ? (
        <mesh position={[0, 0.34, 0.01]}>
          <planeGeometry args={[0.165, 0.082]} />
          <meshBasicMaterial map={ledTex} />
        </mesh>
      ) : null}

      {/* Brushed Chrome Coin Acceptor (world y = 1.32) */}
      <group
        position={[0, 0.18, 0.012]}
        onClick={(e) => {
          e.stopPropagation();
          if (playStep === "need_coin" || playStep === "revealed") onCoinClick();
        }}
        onPointerOver={() => {
          if (playStep === "need_coin" || playStep === "revealed") gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "";
        }}
      >
        <RoundedBox args={[0.12, 0.11, 0.018]} radius={0.006} smoothness={2}>
          <meshPhysicalMaterial
            color="#334155"
            metalness={0.88}
            roughness={0.2}
            emissive={playStep === "need_coin" || playStep === "revealed" ? coinGlow : "#000000"}
            emissiveIntensity={playStep === "need_coin" || playStep === "revealed" ? 0.25 : 0}
          />
        </RoundedBox>
        {/* Dark Vertical Coin Slit */}
        <mesh position={[0, 0.008, 0.01]}>
          <boxGeometry args={[0.011, 0.056, 0.008]} />
          <meshStandardMaterial color="#020408" roughness={0.2} metalness={0.95} />
        </mesh>
        {/* Coin Guide Arrow Light */}
        <mesh position={[0.028, 0.008, 0.01]}>
          <circleGeometry args={[0.007, 12]} />
          <meshStandardMaterial
            color={playStep === "need_coin" || playStep === "revealed" ? "#fbbf24" : "#34d399"}
            emissive={playStep === "need_coin" || playStep === "revealed" ? "#fbbf24" : "#34d399"}
            emissiveIntensity={2.0}
          />
        </mesh>
        {/* Chrome Coin Return Push Button */}
        <mesh
          position={[-0.032, -0.028, returnPressed ? 0.007 : 0.012]}
          onClick={(e) => {
            e.stopPropagation();
            if (playStep === "select_item") {
              setReturnPressed(true);
              onCoinReturn?.();
              window.setTimeout(() => setReturnPressed(false), 180);
            }
          }}
          onPointerOver={(e) => {
            if (playStep === "select_item") {
              e.stopPropagation();
              gl.domElement.style.cursor = "pointer";
            }
          }}
        >
          <boxGeometry args={[0.026, 0.022, 0.012]} />
          <meshStandardMaterial
            color={playStep === "select_item" ? "#ef4444" : "#64748b"}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Tactile 3D Push Keypad (A-D, 1-4, CLR/OK) */}
      <group position={[0, -0.02, 0.004]}>
        {keys.map((k) => {
          const isTyped =
            (typedCode && typedCode.includes(k.label)) ||
            (activeCode && activeCode.includes(k.label));
          return (
            <KeypadButton
              key={k.label}
              label={k.label}
              variant={k.variant}
              position={k.pos}
              disabled={keypadDisabled}
              activeHighlight={Boolean(isTyped)}
              onPress={onKeyPress}
            />
          );
        })}
      </group>

      {/* Lower Coin Return Dish */}
      <group position={[0, -0.28, 0.012]}>
        <RoundedBox args={[0.095, 0.095, 0.022]} radius={0.01} smoothness={2}>
          <meshStandardMaterial color="#090d16" metalness={0.85} roughness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.008, 0.012]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.068, 0.044, 0.008]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

export function Machine({
  phase,
  playStep = "need_coin",
  coinStarted = 0,
  coinMs = 1100,
  vendStarted,
  vendMs,
  collectStarted = 0,
  product,
  canInsert,
  onInsert,
  onCoinReturn,
  onNudgeMachine,
  stock = [],
  topic = "technology",
  targetedSlotIndex = null,
  rouletteSlotIndex = null,
  vendingSlotIndex = null,
  typedCode = "",
  coinPlayer = "Dad",
  nudgeWarn = false,
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
  collectStarted?: number;
  product: Product | null;
  canInsert: boolean;
  onInsert: () => void;
  onCoinReturn?: () => void;
  onNudgeMachine?: () => void;
  stock?: { shape: string; name?: string; color: string; claimed: boolean; rarity?: Rarity }[];
  topic?: GiftTopic;
  targetedSlotIndex?: number | null;
  rouletteSlotIndex?: number | null;
  vendingSlotIndex?: number | null;
  typedCode?: string;
  coinPlayer?: CoinPlayer;
  nudgeWarn?: boolean;
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
  const binLight = useRef<PointLight>(null);
  const rig = useRef<Group>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const held = useRef(false);
  const wasCoinEntering = useRef(false);
  const playedWhir = useRef(false);
  const playedTeeter = useRef(false);
  const playedThud = useRef(false);
  const impactAt = useRef(0);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const insertRef = useRef(onInsert);
  const allowRef = useRef(canInsert);
  insertRef.current = onInsert;
  allowRef.current = canInsert;
  const { camera, gl, controls } = useThree();
  const rarity: Rarity | null = product?.rarity ?? null;
  const trayTagTex = useMemo(() => getTrayTagTexture("PUSH TO OPEN!"), []);

  const activeSlotCode =
    vendingSlotIndex !== null
      ? (COIL_CODES[vendingSlotIndex] ?? null)
      : targetedSlotIndex !== null
        ? (COIL_CODES[targetedSlotIndex] ?? null)
        : null;

  const capsuleOpenRef = useRef(0);

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
      if (!playedWhir.current && progress >= 0.04) {
        playedWhir.current = true;
        playCoilWhir();
      }
      if (!playedTeeter.current && progress >= 0.48) {
        playedTeeter.current = true;
        playTeeterCreak();
      }
      if (!playedThud.current && progress >= 0.85) {
        playedThud.current = true;
        impactAt.current = performance.now();
        playBinThud();
      }
    }

    if (bulb.current) {
      const dip = Math.sin(t * 13.7) * Math.sin(t * 2.3);
      let intensity = dip > 0.82 ? 0.55 : 2.1 + dip * 0.14;
      if (acknowledging) intensity = 3.6;
      if (vending && rarity === "rare") intensity = Math.sin(t * 48) > 0 ? 5.5 : 0.35;
      if (vending && rarity === "legendary") intensity = 2.6 + Math.abs(Math.sin(t * 22)) * 4;
      if (vending && rarity === "impossible") intensity = Math.sin(t * 60) > 0.15 ? 7 : 0.04;
      if (phase === "revealed" && rarity === "impossible") intensity = Math.sin(t * 70) > 0.15 ? 7.5 : 0.08;
      bulb.current.intensity = intensity;
    }

    if (binLight.current) {
      binLight.current.intensity = playStep === "in_tray" ? 2.4 + Math.sin(t * 7) * 0.7 : 0.2;
    }

    if (lamp.current) {
      lamp.current.emissiveIntensity =
        playStep === "in_tray" ? 4.5 + Math.sin(t * 8) * 2.0 : acknowledging ? 4.8 : 1.4;
    }

    if (rig.current) {
      let x = 0;
      let z = 0;
      let pitch = 0;
      if (phase === "idle" && twitch.active) {
        x = twitch.x;
        z = twitch.z;
      }
      if (nudgeWarn) {
        x = Math.sin(t * 58) * 0.025;
        z = Math.cos(t * 44) * 0.016;
        pitch = Math.sin(t * 48) * 0.02;
      } else if (vending && progress >= 0.84 && progress < 0.94) {
        const hit = 1 - (progress - 0.84) / 0.1;
        pitch = Math.sin(hit * Math.PI) * 0.02;
      }
      if (vending && rarity === "rare") {
        x = Math.sin(t * 46) * 0.012;
        z = Math.sin(t * 37) * 0.009;
      }
      if (vending && rarity === "legendary") {
        x = Math.sin(t * 34) * 0.025;
        z = Math.sin(t * 28) * 0.022;
        pitch = Math.sin(t * 22) * 0.036;
      }
      if (vending && rarity === "impossible") {
        const jam = Math.sin(t * 9) > 0.4;
        x = jam ? 0.035 : -0.012;
        z = jam ? -0.025 : 0.018;
        pitch = jam ? 0.045 : -0.018;
      }
      if (phase === "revealed" && rarity === "impossible") {
        const shudder = Math.sin(t * 28) > 0.35;
        x = shudder ? (Math.random() - 0.5) * 0.022 : 0;
        z = shudder ? (Math.random() - 0.5) * 0.018 : 0;
        pitch = shudder ? (Math.random() - 0.5) * 0.025 : 0;
      }
      rig.current.position.x = x;
      rig.current.rotation.z = z;
      rig.current.rotation.x = pitch;
    }

    if (flap.current) {
      let angle = 0;
      const sinceImpact = impactAt.current > 0 ? (performance.now() - impactAt.current) / 1000 : 99;
      if (sinceImpact < 0.85 && vending) {
        // Spring damped kick outward when heavy capsule slams against flap
        angle = -Math.abs(Math.sin(sinceImpact * 16)) * Math.exp(-sinceImpact * 4.5) * 0.65;
      } else if (playStep === "collecting" && collectStarted > 0) {
        const ct = Math.min(1, (performance.now() - collectStarted) / COLLECT_MS);
        angle = -Math.sin(ct * Math.PI) * 1.15;
      } else if (playStep === "in_tray") {
        angle = -0.18 + Math.sin(t * 5) * 0.06;
      } else if (phase === "idle") {
        angle = twitch.flap;
      }
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
        // Tilt edge-on as player drags close to the vertical coin slot!
        const closeness = THREE.MathUtils.clamp(1 - mesh.position.distanceTo(COIN_SLOT) / 0.5, 0, 1);
        mesh.rotation.set(THREE.MathUtils.lerp(Math.PI / 2, 0, closeness), closeness * (Math.PI / 2), closeness * (Math.PI / 2));
        mesh.scale.setScalar(THREE.MathUtils.lerp(0.65, 0.45, closeness));
      } else if (enteringNow && coinStarted > 0) {
        const coinT = Math.min(1, Math.max(0, (performance.now() - coinStarted) / coinMs));
        const pose = animateCoinArc(coinLaunch, coinT, mesh.position, coinPlayer);
        mesh.visible = pose.visible;
        mesh.rotation.set(pose.rotX, pose.rotY, pose.rollZ);
        mesh.scale.setScalar(pose.scale);
      } else if (playStep === "need_coin" || playStep === "revealed") {
        mesh.visible = true;
        coinBob.copy(COIN_REST);
        coinBob.y += Math.sin(t * 2.2) * 0.008;
        mesh.position.lerp(coinBob, 0.2);
        mesh.rotation.set(Math.PI / 2 - 0.12, Math.sin(t * 1.4) * 0.15, 0);
        mesh.scale.setScalar(0.62);
      } else {
        mesh.visible = false;
      }
    }

    if (drop.current) {
      if (vending && progress >= 0.85) {
        // Capsule settles inside lower pickup pocket behind flap
        const settle = (progress - 0.85) / 0.15;
        drop.current.visible = true;
        drop.current.position.set(-0.07, 0.22 + (1 - settle) * 0.08, 0.24 + settle * 0.03);
        drop.current.rotation.set(0.2 * (1 - settle), settle * 2.2, 0);
        capsuleOpenRef.current = 0;
      } else if (playStep === "in_tray") {
        // Sitting unmistakably inside illuminated bin behind the smoked clear PUSH door
        drop.current.visible = true;
        drop.current.position.set(-0.07, 0.20, 0.27);
        drop.current.rotation.set(0.08, Math.sin(t * 2.2) * 0.28, 0);
        capsuleOpenRef.current = 0;
      } else if (playStep === "collecting" && collectStarted > 0) {
        const ct = Math.min(1, (performance.now() - collectStarted) / COLLECT_MS);
        const eased = VEND_EASE(ct);
        drop.current.visible = true;
        drop.current.position.set(
          THREE.MathUtils.lerp(-0.07, 0, eased),
          THREE.MathUtils.lerp(0.20, 0.42, eased) + Math.sin(ct * Math.PI) * 0.16,
          THREE.MathUtils.lerp(0.27, 0.96, eased),
        );
        drop.current.rotation.set(0, eased * Math.PI * 0.5, 0);
        capsuleOpenRef.current = Math.max(0, (ct - 0.6) / 0.4);
      } else if (phase === "revealed" || playStep === "revealed") {
        drop.current.visible = true;
        drop.current.position.set(0, 0.42, 0.96);
        drop.current.rotation.set(0, 0, 0);
        capsuleOpenRef.current = 1;
      } else {
        drop.current.visible = false;
        capsuleOpenRef.current = 0;
      }
    }
  });

  const podColor = rarity ? RARITY_COLOR[rarity] : "#e0b15a";
  const coinInteractive = allowRef.current && (playStep === "need_coin" || playStep === "revealed");
  const canNudgeGlass = playStep === "vending" && typeof onNudgeMachine === "function";

  return (
    <group ref={rig} visible={phase !== "reality"}>
      <group position={[0, 1.08, 0]}>
        <CabinetShell accent={theme.lamp} />

        {/* Front Glass Pane — raycast disabled unless vending & user taps/nudges glass */}
        <mesh
          position={[-0.07, 0.10, 0.37]}
          castShadow
          raycast={canNudgeGlass ? undefined : () => null}
          onClick={(e) => {
            if (canNudgeGlass) {
              e.stopPropagation();
              onNudgeMachine();
            }
          }}
        >
          <boxGeometry args={[1.02, 1.50, 0.008]} />
          <meshPhysicalMaterial
            color="#a5f3fc"
            transmission={0.93}
            thickness={0.03}
            roughness={0.04}
            metalness={0}
            ior={1.45}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>

        <Shelves
          marks={stock}
          activeTopicIndex={activeTopicIndex}
          targetedSlotIndex={targetedSlotIndex}
          rouletteSlotIndex={rouletteSlotIndex}
          vendingSlotIndex={vendingSlotIndex}
          isVending={phase === "vending"}
          vendStarted={vendStarted}
          vendMs={vendMs}
          accent={theme.lamp}
          onSelectSlot={onSelectSlotIndex}
        />

        <pointLight ref={bulb} position={[-0.07, 0.38, 0.25]} intensity={2.2} distance={2.5} color={theme.bulb} />

        {/* Right console beacon lamp */}
        <mesh position={[0.59, 0.56, 0.375]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial ref={lamp} color={theme.lamp} emissive={theme.lamp} emissiveIntensity={2.2} />
        </mesh>

        {/* Right Bezel: Large LED Screen, Coin Slot, Return Lever & 3D Keypad */}
        <RightBezelControls
          playStep={playStep}
          typedCode={typedCode}
          activeCode={activeSlotCode}
          coinGlow={theme.coinGlow}
          nudgeWarn={nudgeWarn}
          onCoinClick={() => {
            if (coinInteractive) insertRef.current();
          }}
          onCoinReturn={onCoinReturn}
          onKeyPress={(k) => onKeyPress?.(k)}
        />

        {/* Side Coin Rest Stand attached to Right Wall (holds stacked tokens & interactive coin) */}
        <group position={[0.82, -0.14, 0.44]}>
          <RoundedBox args={[0.20, 0.024, 0.18]} radius={0.006} smoothness={2} castShadow>
            <meshPhysicalMaterial color="#1e293b" metalness={0.75} roughness={0.25} />
          </RoundedBox>
          <mesh position={[-0.1, 0, -0.02]}>
            <boxGeometry args={[0.04, 0.018, 0.06]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Decorative stacked pocket coins sitting in corner of tray */}
          {[0, 1, 2].map((ci) => (
            <mesh key={ci} position={[-0.045, 0.018 + ci * 0.009, -0.035]}>
              <cylinderGeometry args={[0.028, 0.028, 0.008, 20]} />
              <meshStandardMaterial color="#eab308" metalness={0.92} roughness={0.22} />
            </mesh>
          ))}
        </group>

        {/* Recessed Pickup Chute Cavity (under Shelf D, world y = 0.08..0.40) */}
        <group position={[-0.07, -0.84, 0.21]}>
          <mesh position={[0, -0.11, 0]}>
            <boxGeometry args={[0.88, 0.02, 0.28]} />
            <meshStandardMaterial color="#0b1120" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Rear angled chute ramp */}
          <mesh position={[0, -0.01, -0.09]} rotation={[0.55, 0, 0]}>
            <boxGeometry args={[0.88, 0.22, 0.016]} />
            <meshStandardMaterial color="#17253b" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Interior pocket pickup LED */}
          <pointLight ref={binLight} position={[0, 0.06, 0.05]} intensity={0.2} distance={0.7} color="#34d399" />
        </group>

        {/* Hinged Clear-Smoked "PUSH" Delivery Flap (world hinge y = 0.37) */}
        <group
          ref={flap}
          position={[-0.07, -0.71, 0.35]}
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
          {/* Chrome hinge bar */}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.86, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Translucent smoked polycarbonate door */}
          <mesh position={[0, -0.125, 0.006]}>
            <boxGeometry args={[0.84, 0.22, 0.01]} />
            <meshPhysicalMaterial
              color={playStep === "in_tray" ? "#10b981" : "#1e293b"}
              emissive={playStep === "in_tray" ? "#10b981" : "#000000"}
              emissiveIntensity={playStep === "in_tray" ? 0.22 : 0}
              metalness={0.35}
              roughness={0.18}
              transparent
              opacity={0.62}
              clearcoat={0.7}
            />
          </mesh>
          {/* Chrome bottom handle bar */}
          <mesh position={[0, -0.22, 0.016]}>
            <boxGeometry args={[0.64, 0.022, 0.016]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.18} />
          </mesh>
          {playStep === "in_tray" ? (
            <mesh position={[0, -0.11, 0.018]}>
              <planeGeometry args={[0.46, 0.092]} />
              <meshBasicMaterial map={trayTagTex} />
            </mesh>
          ) : null}
        </group>

        <mesh position={[-0.07, -1.03, 0.06]}>
          <boxGeometry args={[1.04, 0.06, 0.54]} />
          <meshPhysicalMaterial color="#0b1322" metalness={0.9} roughness={0.22} clearcoat={0.3} />
        </mesh>
      </group>

      {/* Velvet & Chrome Front Display Showcase Plinth */}
      <group position={[0, 0.13, 0.96]}>
        <RoundedBox args={[0.78, 0.26, 0.52]} radius={0.025} smoothness={2} castShadow receiveShadow>
          <meshPhysicalMaterial color="#0f172a" metalness={0.65} roughness={0.32} clearcoat={0.25} />
        </RoundedBox>
      </group>
      <mesh position={[0, 0.275, 0.96]} receiveShadow>
        <boxGeometry args={[0.64, 0.028, 0.38]} />
        <meshPhysicalMaterial color="#cbd5e1" metalness={0.88} roughness={0.18} />
      </mesh>

      {/* Single Continuous Interactive Brass $1 Coin */}
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
            const nearSlot = coin.current ? coin.current.position.distanceTo(COIN_SLOT) < 0.45 : false;
            held.current = false;
            if ((nearSlot || movedPx < 10) && coinInteractive) {
              insertRef.current();
            }
          };
          gl.domElement.addEventListener("pointermove", place);
          gl.domElement.addEventListener("pointerup", release);
        }}
      >
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.016, 36]} />
            <meshPhysicalMaterial
              color="#facc15"
              emissive={theme.coinGlow}
              emissiveIntensity={0.28}
              metalness={0.96}
              roughness={0.18}
              clearcoat={0.6}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.075, 0.008, 10, 32]} />
            <meshPhysicalMaterial color="#fef08a" metalness={1} roughness={0.14} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.002, 24]} />
            <meshPhysicalMaterial color="#ca8a04" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Dispensed Capsule & Unboxed Prize */}
      <group
        ref={drop}
        position={[0, 0.42, 0.96]}
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
          openAmountRef={capsuleOpenRef}
          rarity={rarity}
          color={podColor}
        />
        {playStep === "in_tray" || playStep === "collecting" ? (
          <RevealedItem product={product} rarity={rarity} stock={stock} insidePod />
        ) : null}
        {phase === "revealed" && playStep === "revealed" ? (
          <>
            <RevealedItem product={product} rarity={rarity} stock={stock} />
            <RarityVFX rarity={rarity} active />
          </>
        ) : null}
      </group>
    </group>
  );
}
