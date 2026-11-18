import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import * as THREE from "three";
import { RARITY_COLOR, type Product, type Rarity } from "../generate";
import { Creature } from "./Creature";
import type { GiftTopic } from "../stock";
import { playCoinPickup } from "../audio";

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
  children,
}: {
  phase: Phase;
  sky: string;
  topic?: GiftTopic;
  children: ReactNode;
}) {
  const { scene, camera } = useThree();
  const realityPose = useRef(new THREE.Vector3(0, 1.25, 5.2));
  const theme = THEME_CONFIG[topic] ?? THEME_CONFIG.technology;
  const currentBg = useRef(new THREE.Color(theme.bg));
  const targetBg = useRef(new THREE.Color(theme.bg));

  useFrame((_, delta) => {
    const dest = phase === "reality" ? sky : theme.bg;
    targetBg.current.set(dest);
    currentBg.current.lerp(targetBg.current, 1 - Math.exp(-delta * 3.5));
    scene.background = currentBg.current;
    if (scene.fog) {
      (scene.fog as THREE.Fog).color.copy(currentBg.current);
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
      {phase !== "reality" ? <fog attach="fog" args={[theme.bg, 9, 16]} /> : null}
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
const COIN_SLOT = new THREE.Vector3(0.66, 1.36, 0.4);
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

function curveCoin(from: THREE.Vector3, amount: number, target: THREE.Vector3) {
  coinMid.copy(from).lerp(COIN_SLOT, 0.5);
  coinMid.y += 0.42;
  const remain = 1 - amount;
  target
    .copy(from)
    .multiplyScalar(remain * remain)
    .addScaledVector(coinMid, 2 * remain * amount)
    .addScaledVector(COIN_SLOT, amount * amount);
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

function Coil() {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 9;
    const steps = 160;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      points.push(new THREE.Vector3(Math.cos(angle) * 0.16, 0.58 - t * 1.2, Math.sin(angle) * 0.1));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 200, 0.022, 8, false);
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0.08, 0.08]}>
      <meshStandardMaterial color="#f2eee6" metalness={0.94} roughness={0.14} />
    </mesh>
  );
}

function PrizeShape({ shape, color }: { shape: string; color: string }) {
  if (shape === "phone") {
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.14, 0.01]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.005, 0.006]}>
          <boxGeometry args={[0.055, 0.1, 0.002]} />
          <meshStandardMaterial color="#1c1c1e" roughness={0.2} metalness={0.4} />
        </mesh>
      </group>
    );
  }
  if (shape === "laptop") {
    return (
      <group position={[0, -0.02, 0]}>
        <mesh position={[0, 0.012, 0]} castShadow>
          <boxGeometry args={[0.18, 0.012, 0.12]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.3} />
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
          <torusGeometry args={[0.045, 0.012, 8, 18]} />
          <meshStandardMaterial color="#b9c0c8" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.028, 0.028, 0.012, 16]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
        </mesh>
      </group>
    );
  }
  if (shape === "chocolate") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.12, 0.028, 0.07]} />
        <meshStandardMaterial color="#6b3e22" roughness={0.55} />
      </mesh>
    );
  }
  if (shape === "buds") {
    return (
      <group>
        <mesh position={[-0.03, 0, 0]} castShadow>
          <sphereGeometry args={[0.022, 12, 10]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0.03, 0, 0]} castShadow>
          <sphereGeometry args={[0.022, 12, 10]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.07, 0.012, 0.03]} />
          <meshStandardMaterial color="#eceae4" roughness={0.45} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[-0.03, 0, 0]} rotation={[0, 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0.03, 0, 0]} rotation={[0, -0.2, -0.1]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  );
}

function Shelves({ marks }: { marks: { shape: string; color: string; claimed: boolean }[] }) {
  const spots: [number, number][] = [-0.39, -0.13, 0.13, 0.39].flatMap((x): [number, number][] =>
    [0.57, 0.17, -0.23, -0.63].map((y): [number, number] => [x, y]),
  );
  return (
    <group>
      {[0.76, 0.36, -0.04, -0.44, -0.84].map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <boxGeometry args={[1.05, 0.02, 0.28]} />
          <meshStandardMaterial color="#0d1a2a" roughness={0.7} />
        </mesh>
      ))}
      {spots.map(([x, y], index) => {
        const mark = marks[index];
        if (!mark || mark.claimed) return null;
        return (
          <group key={`${mark.shape}-${index}`} position={[x, y, 0]}>
            <PrizeShape shape={mark.shape} color={mark.color} />
          </group>
        );
      })}
    </group>
  );
}

export function Machine({
  phase,
  vendStarted,
  vendMs,
  product,
  canInsert,
  onInsert,
  stock = [],
  topic = "technology",
}: {
  phase: Phase;
  vendStarted: number;
  vendMs: number;
  product: Product | null;
  canInsert: boolean;
  onInsert: () => void;
  stock?: { shape: string; color: string; claimed: boolean }[];
  topic?: GiftTopic;
}) {
  const theme = THEME_CONFIG[topic] ?? THEME_CONFIG.technology;
  const flap = useRef<Group>(null);
  const coin = useRef<Group>(null);
  const drop = useRef<Group>(null);
  const pod = useRef<Mesh>(null);
  const creatureWrap = useRef<Group>(null);
  const bulb = useRef<PointLight>(null);
  const spin = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const held = useRef(false);
  const wasVending = useRef(false);
  const insertRef = useRef(onInsert);
  const allowRef = useRef(canInsert);
  insertRef.current = onInsert;
  allowRef.current = canInsert;
  const { camera, gl, controls } = useThree();
  const rarity: Rarity | null = product?.rarity ?? null;
  const creature = product?.type === "creature" && product.payload.kind === "creature" ? product.payload : null;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const progress = progressOf(phase, vendStarted, vendMs);
    const vending = phase === "vending";
    const twitch = idleTwitch(t);
    const acknowledging = vending && progress < 0.28;

    if (spin.current) {
      let speed = 0.012;
      if (vending && rarity === "legendary") speed = 0.42;
      else if (vending && rarity === "rare") speed = 0.24;
      else if (vending && rarity === "impossible") speed = Math.sin(t * 9) > 0.35 ? 0.55 : 0;
      else if (vending) speed = 0.18;
      else if (twitch.active) speed = 0.09;
      spin.current.rotation.y += speed;
    }

    if (bulb.current) {
      const dip = Math.sin(t * 13.7) * Math.sin(t * 2.3);
      let intensity = dip > 0.82 ? 0.45 : 1.55 + dip * 0.12;
      if (acknowledging) intensity = 4.2;
      if (vending && rarity === "rare") intensity = Math.sin(t * 48) > 0 ? 5.5 : 0.25;
      if (vending && rarity === "legendary") intensity = 2.4 + Math.abs(Math.sin(t * 22)) * 4;
      if (vending && rarity === "impossible") intensity = Math.sin(t * 60) > 0.15 ? 7 : 0.04;
      if (phase === "revealed" && rarity === "impossible") intensity = 1.2 + Math.abs(Math.sin(t * 8)) * 2.5;
      bulb.current.intensity = intensity;
    }

    if (lamp.current) {
      lamp.current.emissiveIntensity = acknowledging ? 6 : 1.2;
    }

    if (rig.current) {
      let x = 0;
      let z = 0;
      let pitch = 0;
      if (phase === "idle" && twitch.active) {
        x = twitch.x;
        z = twitch.z;
      }
      if (vending && acknowledging) pitch = Math.sin(progress / 0.28 * Math.PI) * 0.03;
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
      rig.current.position.x = x;
      rig.current.rotation.z = z;
      rig.current.rotation.x = pitch;
    }

    if (flap.current) {
      let angle = 0;
      if (progress >= 0.55 && progress < 0.86) angle = -1.15 * VEND_EASE((progress - 0.55) / 0.31);
      else if (progress >= 0.86) angle = -0.28;
      if (phase === "idle") angle = twitch.flap;
      if (vending && rarity === "legendary") angle += Math.sin(t * 30) * 0.2;
      if (vending && rarity === "impossible") angle += Math.sin(t * 9) > 0.4 ? -0.7 : 0.05;
      flap.current.rotation.x = angle;
    }

    if (coin.current) {
      const mesh = coin.current;
      const vendingNow = vending;
      if (vendingNow && !wasVending.current) coinLaunch.copy(mesh.position);
      wasVending.current = vendingNow;

      if (held.current) {
        mesh.visible = true;
      } else if (vendingNow && progress < 0.46) {
        const amount = VEND_EASE(Math.min(1, progress / 0.46));
        curveCoin(coinLaunch, amount, mesh.position);
        mesh.visible = true;
      } else if (vendingNow || phase === "reality") {
        mesh.visible = false;
      } else {
        mesh.visible = true;
        coinBob.copy(COIN_REST);
        coinBob.y += Math.sin(t * 2) * 0.03;
        mesh.position.lerp(coinBob, 0.18);
      }
      const closeness = THREE.MathUtils.clamp(1 - mesh.position.distanceTo(COIN_SLOT) / 1.5, 0, 1);
      mesh.scale.setScalar(THREE.MathUtils.lerp(1.35, 0.62, closeness));
    }

    const falling = progress > 0.46;
    const fallT = falling ? VEND_EASE(Math.min(1, (progress - 0.46) / 0.54)) : 0;
    const y = falling || phase === "revealed" ? 1.25 + (0.42 - 1.25) * (phase === "vending" ? fallT : 1) : 1.25;
    if (drop.current) {
      drop.current.visible = phase !== "idle" && phase !== "reality" && (falling || phase === "revealed");
      drop.current.position.y = y;
      drop.current.rotation.y = vending ? progress * 5 : 0;
    }
    if (pod.current) {
      const hidePod = phase === "revealed" || (Boolean(creature) && progress > 0.9);
      pod.current.visible = !hidePod;
    }
    if (creatureWrap.current) {
      creatureWrap.current.visible = Boolean(creature) && (phase === "revealed" || progress > 0.62);
    }
  });

  const podColor = rarity ? RARITY_COLOR[rarity] : "#e0b15a";

  return (
    <group ref={rig} visible={phase !== "reality"}>
      <group position={[0, 1.08, 0]}>
        <CabinetShell />
        <mesh position={[0, 0.12, 0.38]} castShadow>
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
        <Shelves marks={stock} />
        <group ref={spin}>
          <Coil />
        </group>
        <pointLight ref={bulb} position={[0, 0.35, 0.28]} intensity={2} distance={2.4} color={theme.bulb} />
        <mesh position={[0.66, 0.28, 0.34]}>
          <boxGeometry args={[0.045, 0.16, 0.03]} />
          <meshStandardMaterial color="#040810" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0.66, 0.4, 0.35]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial ref={lamp} color={theme.lamp} emissive={theme.lamp} emissiveIntensity={2.5} />
        </mesh>
        <group ref={flap} position={[0, -0.92, 0.28]}>
          <mesh position={[0, -0.07, 0.08]}>
            <boxGeometry args={[0.72, 0.12, 0.08]} />
            <meshPhysicalMaterial color="#1a2a3a" metalness={1} roughness={0.15} clearcoat={0.35} />
          </mesh>
        </group>
        <mesh position={[0, -1.02, 0.02]}>
          <boxGeometry args={[1.2, 0.08, 0.5]} />
          <meshPhysicalMaterial color="#0d1a2a" metalness={0.9} roughness={0.2} clearcoat={0.3} />
        </mesh>
      </group>

      <mesh position={[0, 0.12, 0.95]} castShadow receiveShadow>
        <boxGeometry args={[0.86, 0.28, 0.56]} />
        <meshPhysicalMaterial color="#0d1118" metalness={0.55} roughness={0.38} clearcoat={0.2} />
      </mesh>
      <mesh position={[0, 0.28, 0.95]} receiveShadow>
        <boxGeometry args={[0.7, 0.03, 0.4]} />
        <meshPhysicalMaterial color="#c8e0f0" metalness={0.85} roughness={0.22} />
      </mesh>

      <group
        ref={coin}
        position={[COIN_REST.x, COIN_REST.y, COIN_REST.z]}
        onPointerOver={() => {
          if (allowRef.current) gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!held.current) gl.domElement.style.cursor = "";
        }}
        onPointerDown={(event) => {
          if (!allowRef.current || phase === "vending" || phase === "reality") return;
          event.stopPropagation();
          held.current = true;
          playCoinPickup();
          gl.domElement.style.cursor = "grabbing";
          const orbit = controls as { enabled?: boolean } | null;
          if (orbit) orbit.enabled = false;
          const place = (native: PointerEvent) => {
            const hit = pointOnCoinPlane(native.clientX, native.clientY, camera, gl.domElement);
            if (hit && coin.current) coin.current.position.copy(hit);
          };
          const release = () => {
            gl.domElement.removeEventListener("pointermove", place);
            gl.domElement.removeEventListener("pointerup", release);
            gl.domElement.style.cursor = "";
            if (orbit) orbit.enabled = true;
            const nearSlot = coin.current ? coin.current.position.distanceTo(COIN_SLOT) < 0.34 : false;
            held.current = false;
            if (nearSlot && allowRef.current) insertRef.current();
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

      <group ref={drop} position={[0, 0.42, 0.95]}>
        <mesh ref={pod}>
          <sphereGeometry args={[0.11, 24, 24]} />
          <meshStandardMaterial
            color={podColor}
            emissive={podColor}
            emissiveIntensity={0.35}
            metalness={0.4}
            roughness={0.25}
            transparent
            opacity={0.92}
          />
        </mesh>
        <group ref={creatureWrap} visible={false}>
          {creature ? <Creature spec={creature} /> : null}
        </group>
      </group>
    </group>
  );
}
