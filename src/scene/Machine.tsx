import { useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import * as THREE from "three";
import { RARITY_COLOR, type Product, type Rarity } from "../generate";
import { Creature } from "./Creature";

export type Phase = "idle" | "vending" | "revealed" | "reality";

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
  children,
}: {
  phase: Phase;
  sky: string;
  children: ReactNode;
}) {
  const { scene, camera } = useThree();
  const painted = useRef("");
  const realityPose = useRef(new THREE.Vector3(0, 1.25, 5.2));

  useFrame(() => {
    const color = phase === "reality" ? sky : "#14110e";
    if (painted.current !== color) {
      scene.background = new THREE.Color(color);
      painted.current = color;
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
          target={[0, 0.95, 0]}
          minDistance={2.6}
          maxDistance={6.8}
          minPolarAngle={0.5}
          maxPolarAngle={1.45}
          minAzimuthAngle={-1.15}
          maxAzimuthAngle={1.15}
        />
      ) : null}
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
  canInsert,
  onInsert,
}: {
  phase: Phase;
  vendStarted: number;
  vendMs: number;
  product: Product | null;
  canInsert: boolean;
  onInsert: () => void;
}) {
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
      if (mesh.visible) mesh.quaternion.copy(camera.quaternion);
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
    <group ref={rig} visible={phase !== "reality"}>
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
          <meshStandardMaterial ref={lamp} color="#ffe1a3" emissive="#e0b15a" emissiveIntensity={1.2} />
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
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.02, 40]} />
          <meshStandardMaterial color="#ffd98a" emissive="#e0b15a" emissiveIntensity={0.45} metalness={1} roughness={0.18} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.024, 24]} />
          <meshStandardMaterial color="#8a5a22" metalness={0.8} roughness={0.3} />
        </mesh>
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
