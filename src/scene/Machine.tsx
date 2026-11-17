import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import type { Group, Mesh, PointLight } from "three";
import * as THREE from "three";
import { RARITY_COLOR, type Product, type Rarity } from "../generate";
import { Creature } from "./Creature";

export type Phase = "idle" | "vending" | "revealed" | "reality";

const VEND_EASE = (t: number) => 1 - (1 - t) ** 3;

function progressOf(phase: Phase, vendStarted: number, vendMs: number): number {
  if (phase === "idle") return 0;
  if (phase !== "vending") return 1;
  if (vendStarted <= 0) return 0;
  return Math.min(1, Math.max(0, (performance.now() - vendStarted) / vendMs));
}

export function Gallery({
  phase,
  sky,
  children,
}: {
  phase: Phase;
  sky: string;
  children: ReactNode;
}) {
  const { scene } = useThree();
  const desired = useRef(new THREE.Vector3(0.22, 1.12, 4.35));
  const painted = useRef("");

  useFrame(({ camera, clock }) => {
    const color = phase === "reality" ? sky : "#14110e";
    if (painted.current !== color) {
      scene.background = new THREE.Color(color);
      painted.current = color;
    }
    const drift = Math.sin(clock.elapsedTime * 0.18) * 0.05;
    if (phase === "reality") desired.current.set(0, 1.25, 5.2);
    else desired.current.set(0.22 + drift, 1.12, 4.35);
    camera.position.lerp(desired.current, 0.06);
    camera.lookAt(0, 0.92, 0);
  });

  return (
    <>
      {phase !== "reality" ? <fog attach="fog" args={["#14110e", 7.5, 13]} /> : null}
      <hemisphereLight args={["#f0e2cc", "#241c16", 0.55]} />
      <spotLight
        position={[3.4, 5.4, 3.2]}
        angle={0.45}
        penumbra={0.8}
        intensity={28}
        color="#ffe1bf"
      />
      <pointLight position={[-2.4, 1.6, 2.2]} intensity={8} color="#9eb6d6" />
      {children}
      {phase !== "reality" ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
            <circleGeometry args={[7, 64]} />
            <meshStandardMaterial color="#1a1613" metalness={0.28} roughness={0.62} />
          </mesh>
          <mesh position={[0, 1.8, -1.8]}>
            <planeGeometry args={[16, 7]} />
            <meshStandardMaterial color="#171410" />
          </mesh>
          <ContactShadows position={[0, 0.001, 0.35]} opacity={0.48} scale={9} blur={2.4} far={3.2} />
        </>
      ) : null}
    </>
  );
}

function CabinetShell() {
  return (
    <group>
      <RoundedBox args={[1.28, 1.96, 0.08]} radius={0.02} smoothness={2} position={[0, 0, -0.28]}>
        <meshStandardMaterial color="#8d6a3e" metalness={0.78} roughness={0.32} />
      </RoundedBox>
      <RoundedBox args={[0.09, 1.96, 0.64]} radius={0.02} smoothness={2} position={[-0.62, 0, 0.02]}>
        <meshStandardMaterial color="#7d5c34" metalness={0.74} roughness={0.34} />
      </RoundedBox>
      <RoundedBox args={[0.09, 1.96, 0.64]} radius={0.02} smoothness={2} position={[0.62, 0, 0.02]}>
        <meshStandardMaterial color="#7d5c34" metalness={0.74} roughness={0.34} />
      </RoundedBox>
      <RoundedBox args={[1.36, 0.12, 0.7]} radius={0.02} smoothness={2} position={[0, 1.0, 0.02]}>
        <meshStandardMaterial color="#9a7344" metalness={0.8} roughness={0.28} />
      </RoundedBox>
      <RoundedBox args={[1.36, 0.14, 0.7]} radius={0.02} smoothness={2} position={[0, -0.96, 0.02]}>
        <meshStandardMaterial color="#6a4d28" metalness={0.7} roughness={0.36} />
      </RoundedBox>
      <mesh position={[0, 0.12, -0.22]}>
        <planeGeometry args={[1.16, 1.7]} />
        <meshStandardMaterial color="#1a1612" roughness={0.9} />
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

function Shelves() {
  const columns = [-0.42, -0.24, 0.24, 0.42];
  const rows = [0.42, -0.18];
  return (
    <group>
      {rows.map((y) => (
        <group key={y}>
          <mesh position={[-0.33, y - 0.12, -0.02]}>
            <boxGeometry args={[0.46, 0.02, 0.22]} />
            <meshStandardMaterial color="#3a3128" roughness={0.7} />
          </mesh>
          <mesh position={[0.33, y - 0.12, -0.02]}>
            <boxGeometry args={[0.46, 0.02, 0.22]} />
            <meshStandardMaterial color="#3a3128" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {rows.flatMap((y, row) =>
        columns.map((x, column) => (
          <mesh key={`${row}-${column}`} position={[x, y, -0.02]}>
            <cylinderGeometry args={[0.055, 0.055, 0.15, 12]} />
            <meshStandardMaterial
              color={(row + column) % 2 === 0 ? "#6a5340" : "#4d5960"}
              metalness={0.45}
              roughness={0.42}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Machine({
  phase,
  vendStarted,
  vendMs,
  product,
}: {
  phase: Phase;
  vendStarted: number;
  vendMs: number;
  product: Product | null;
}) {
  const flap = useRef<Group>(null);
  const coin = useRef<Mesh>(null);
  const drop = useRef<Group>(null);
  const pod = useRef<Mesh>(null);
  const creatureWrap = useRef<Group>(null);
  const bulb = useRef<PointLight>(null);
  const spin = useRef<Group>(null);
  const rarity: Rarity | null = product?.rarity ?? null;
  const creature = product?.type === "creature" && product.payload.kind === "creature" ? product.payload : null;

  useFrame(({ clock }) => {
    const progress = progressOf(phase, vendStarted, vendMs);
    const vending = phase === "vending";
    if (spin.current) spin.current.rotation.y += vending ? 0.18 : 0.01;

    if (bulb.current) {
      const pulse = 1.6 + Math.sin(clock.elapsedTime * 2.2) * 0.35;
      const boost = rarity === "impossible" ? 4 : rarity === "legendary" ? 2.4 : 0;
      bulb.current.intensity = phase === "revealed" ? pulse + boost : pulse;
    }

    if (flap.current) {
      let angle = 0;
      if (progress >= 0.55 && progress < 0.86) angle = -1.15 * VEND_EASE((progress - 0.55) / 0.31);
      else if (progress >= 0.86) angle = -0.28;
      flap.current.rotation.x = angle;
    }

    if (coin.current) {
      const traveling = vending && progress < 0.24;
      coin.current.visible = phase === "idle" || traveling;
      if (phase === "idle") {
        coin.current.position.set(0.66, 1.38 + Math.sin(clock.elapsedTime * 2) * 0.015, 0.42);
      } else if (traveling) {
        const t = VEND_EASE(progress / 0.24);
        coin.current.position.set(0.66 - t * 0.08, 1.38 - t * 0.12, 0.42 - t * 0.16);
      }
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
      const hideForCreature = Boolean(creature) && (phase === "revealed" || progress > 0.9);
      pod.current.visible = !hideForCreature;
    }
    if (creatureWrap.current) {
      creatureWrap.current.visible = Boolean(creature) && (phase === "revealed" || progress > 0.62);
    }
  });

  const podColor = rarity ? RARITY_COLOR[rarity] : "#e0b15a";

  return (
    <group visible={phase !== "reality"}>
      <group position={[0, 1.08, 0]}>
        <CabinetShell />
        <mesh position={[0, 0.12, 0.34]}>
          <planeGeometry args={[1.08, 1.55]} />
          <meshStandardMaterial
            color="#d5e7f4"
            transparent
            opacity={0.14}
            roughness={0.04}
            metalness={0.04}
            depthWrite={false}
          />
        </mesh>
        <Shelves />
        <group ref={spin}>
          <Coil />
        </group>
        <pointLight ref={bulb} position={[0, 0.35, 0.28]} intensity={2} distance={2.4} color="#ffc58a" />
        <mesh position={[0.66, 0.28, 0.34]}>
          <boxGeometry args={[0.045, 0.16, 0.03]} />
          <meshStandardMaterial color="#120e0a" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0.66, 0.4, 0.35]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#ffe1a3" emissive="#e0b15a" emissiveIntensity={1.2} />
        </mesh>
        <group ref={flap} position={[0, -0.92, 0.28]}>
          <mesh position={[0, -0.07, 0.08]}>
            <boxGeometry args={[0.72, 0.12, 0.08]} />
            <meshStandardMaterial color="#6d522f" metalness={0.7} roughness={0.38} />
          </mesh>
        </group>
        <mesh position={[0, -1.02, 0.02]}>
          <boxGeometry args={[1.2, 0.08, 0.5]} />
          <meshStandardMaterial color="#5c431f" metalness={0.55} roughness={0.4} />
        </mesh>
      </group>

      <mesh position={[0, 0.12, 0.95]}>
        <boxGeometry args={[0.78, 0.24, 0.48]} />
        <meshStandardMaterial color="#2a241e" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, 0.95]}>
        <boxGeometry args={[0.62, 0.02, 0.34]} />
        <meshStandardMaterial color="#cbb892" metalness={0.6} roughness={0.28} />
      </mesh>

      <mesh ref={coin} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.012, 24]} />
        <meshStandardMaterial color="#ffd98a" emissive="#e0b15a" emissiveIntensity={0.45} metalness={1} roughness={0.18} />
      </mesh>

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
