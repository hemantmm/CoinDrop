import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
import type { CoinPlayer, PlayStep } from "../stock";
import type { Phase } from "./Machine";

type Role = "queue" | "watch";

type Figure = {
  position: [number, number, number];
  coat: string;
  skin: string;
  hair: string;
  bag: boolean;
  coin: boolean;
  role: Role;
};

type Look = { coat: string; skin: string; hair: string };

type KidLook = {
  shirt: string;
  skin: string;
  hair: string;
  shoes: string;
  scale: number;
  point: boolean;
};

type Family = Look & {
  id: number;
  bag: boolean;
  joined: number;
  kids: [KidLook, KidLook];
};

const LOOKS: Look[] = [
  { coat: "#31425f", skin: "#e4b48f", hair: "#2a211c" },
  { coat: "#6a3034", skin: "#c68642", hair: "#1a1412" },
  { coat: "#2c4a3c", skin: "#8d5524", hair: "#3a2a22" },
  { coat: "#4d4030", skin: "#f0c7a4", hair: "#241c18" },
  { coat: "#3a3558", skin: "#e4b48f", hair: "#1c1614" },
  { coat: "#243044", skin: "#6b3e26", hair: "#2c241e" },
];

// Queue slots behind the velvet rope on the right side
const QUEUE_ANCHORS: [number, number, number][] = [
  [2.15, 0, 2.05],
  [2.75, 0, 2.05],
  [3.35, 0, 1.45],
];

const QUEUE_SPREAD = {
  parent: [0, 0, 0] as [number, number, number],
  kids: [
    [-0.26, 0, -0.2],
    [0.26, 0, -0.16],
  ] as [number, number, number][],
};

const SHIRTS = ["#f2c14e", "#e25b4a", "#3d9b8f", "#7aa2d6"];

const SPAWN: [number, number, number] = [3.95, 0, 0.72];
const EXIT: [number, number, number] = [-2.8, 0, 2.55];

const WATCHERS: Figure[] = [
  { position: [-1.72, 0, 1.55], coat: "#3a3558", skin: "#e4b48f", hair: "#1c1614", bag: true, coin: false, role: "watch" },
  { position: [-2.15, 0, 0.55], coat: "#5c4632", skin: "#6b3e26", hair: "#2c241e", bag: false, coin: false, role: "watch" },
  { position: [2.35, 0, 0.15], coat: "#243044", skin: "#c68642", hair: "#1a1412", bag: false, coin: false, role: "watch" },
  { position: [-0.85, 0, -0.85], coat: "#6a5a3a", skin: "#f1c9a5", hair: "#3a2a22", bag: true, coin: false, role: "watch" },
];

const POSTS: [number, number, number][] = [
  [1.85, 0, 2.4],
  [3.65, 0, 2.4],
  [3.65, 0, 1.15],
];

// Hero Family (Dad, Maya 7, Leo 5) Entry & Machine Standing Positions
const HERO_ENTRY_POS = {
  dad: new THREE.Vector3(2.1, 0, 1.5),
  maya: new THREE.Vector3(1.85, 0, 1.68),
  leo: new THREE.Vector3(2.0, 0, 1.78),
};

const HERO_STAND_POS = {
  dad: new THREE.Vector3(1.04, 0, 0.72),
  maya: new THREE.Vector3(-0.90, 0, 0.74),
  leo: new THREE.Vector3(-0.72, 0, 1.14),
};

const COIN_SLOT_STAND = new THREE.Vector3(0.76, 0, 0.56);
const COIN_SLOT_WORLD = new THREE.Vector3(0.62, 1.36, 0.36);
const MACHINE_CENTER = new THREE.Vector3(0, 0, 0.15);

let nextPersonId = 1;

function makeFamily(joined: number): Family {
  const look = LOOKS[nextPersonId % LOOKS.length] ?? LOOKS[0];
  const shirtA = SHIRTS[nextPersonId % SHIRTS.length] ?? SHIRTS[0];
  const shirtB = SHIRTS[(nextPersonId + 2) % SHIRTS.length] ?? SHIRTS[1];
  const family: Family = {
    id: nextPersonId,
    ...look,
    bag: nextPersonId % 2 === 0,
    joined,
    kids: [
      { shirt: shirtA, skin: look.skin, hair: look.hair, shoes: shirtB, scale: 0.78, point: true },
      { shirt: shirtB, skin: look.skin, hair: "#1a1412", shoes: shirtA, scale: 0.66, point: false },
    ],
  };
  nextPersonId += 1;
  return family;
}

function openingQueue(): Family[] {
  return [0, 1, 2].map(() => makeFamily(0));
}

function yawTowardPoint(from: [number, number, number], to: [number, number, number]) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function yawTowardMachine(position: [number, number, number]) {
  return Math.atan2(-position[0], -position[2]);
}

function lerpAngle(current: number, target: number, alpha: number) {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * alpha;
}

function Body({
  coat,
  skin,
  hair,
  bag,
  coin,
  reachArm = false,
}: {
  coat: string;
  skin: string;
  hair: string;
  bag: boolean;
  coin: boolean;
  reachArm?: boolean;
}) {
  return (
    <>
      <mesh position={[0, 0.46, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.38, 4, 8]} />
        <meshStandardMaterial color="#1c1916" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.36, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.72} />
      </mesh>
      <mesh position={[-0.22, 0.86, 0]} rotation={[0.15, 0, 0.55]}>
        <capsuleGeometry args={[0.045, 0.32, 3, 6]} />
        <meshStandardMaterial color={coat} roughness={0.72} />
      </mesh>
      <mesh
        position={reachArm ? [0.20, 1.18, 0.16] : [0.22, 0.86, 0]}
        rotation={reachArm ? [-1.35, -0.1, -0.15] : [0.15, 0, -0.55]}
      >
        <capsuleGeometry args={[0.045, 0.32, 3, 6]} />
        <meshStandardMaterial color={coat} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.48, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.54, 0]}>
        <sphereGeometry args={[0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <meshStandardMaterial color={hair} roughness={0.7} />
      </mesh>
      {coin ? (
        <mesh
          position={reachArm ? [0.18, 1.32, 0.32] : [0.28, 1.05, 0.08]}
          rotation={[0.4, 0.2, 1.1]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.012, 16]} />
          <meshStandardMaterial color="#e0b15a" metalness={0.9} roughness={0.25} />
        </mesh>
      ) : null}
      {bag ? (
        <group position={[0.28, 0.72, 0.02]}>
          <mesh>
            <boxGeometry args={[0.14, 0.16, 0.08]} />
            <meshStandardMaterial color="#c4a574" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <torusGeometry args={[0.045, 0.008, 6, 12]} />
            <meshStandardMaterial color="#8d6a3e" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ) : null}
    </>
  );
}

function KidBody({
  shirt,
  skin,
  hair,
  shoes,
  point,
  cap = false,
  reachHigh = false,
  coin = false,
}: Omit<KidLook, "scale"> & { cap?: boolean; reachHigh?: boolean; coin?: boolean }) {
  return (
    <group>
      <mesh position={[-0.08, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.22, 3, 6]} />
        <meshStandardMaterial color="#1c1916" roughness={0.8} />
      </mesh>
      <mesh position={[0.08, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.055, 0.22, 3, 6]} />
        <meshStandardMaterial color="#1c1916" roughness={0.8} />
      </mesh>
      <mesh position={[-0.08, 0.1, 0.04]}>
        <boxGeometry args={[0.09, 0.06, 0.14]} />
        <meshStandardMaterial color={shoes} roughness={0.55} />
      </mesh>
      <mesh position={[0.08, 0.1, 0.04]}>
        <boxGeometry args={[0.09, 0.06, 0.14]} />
        <meshStandardMaterial color={shoes} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.28, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.62} />
      </mesh>
      <mesh
        position={reachHigh ? [-0.18, 0.96, 0.12] : [-0.2, 0.7, 0.02]}
        rotation={reachHigh ? [-2.2, 0, 0.35] : [0.2, 0, 0.7]}
      >
        <capsuleGeometry args={[0.04, 0.24, 3, 6]} />
        <meshStandardMaterial color={shirt} roughness={0.62} />
      </mesh>
      <mesh
        position={reachHigh ? [0.18, 0.98, 0.14] : [0.2, 0.78, 0.06]}
        rotation={reachHigh ? [-2.3, 0.1, -0.25] : point ? [-1.15, 0.2, -0.35] : [0.35, 0, -0.45]}
      >
        <capsuleGeometry args={[0.04, 0.26, 3, 6]} />
        <meshStandardMaterial color={shirt} roughness={0.62} />
      </mesh>
      {coin ? (
        <mesh
          position={reachHigh ? [0.14, 1.24, 0.26] : [0.26, 0.96, 0.16]}
          rotation={[0.3, 0.2, 1.1]}
        >
          <cylinderGeometry args={[0.052, 0.052, 0.015, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.2} />
        </mesh>
      ) : null}
      <mesh position={[0, 1.08, 0]} castShadow>
        <sphereGeometry args={[0.145, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.16, -0.01]}>
        <sphereGeometry args={[0.148, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.72} />
      </mesh>
      {cap ? (
        <mesh position={[0, 1.22, 0.06]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.16, 0.03, 0.14]} />
          <meshStandardMaterial color="#0284c7" roughness={0.5} />
        </mesh>
      ) : (
        <mesh position={[0, 1.22, -0.14]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={hair} roughness={0.72} />
        </mesh>
      )}
    </group>
  );
}

function KidHop({ excited, tiptoe, seed, children }: { excited: boolean; tiptoe?: boolean; seed: number; children: ReactNode }) {
  const rig = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = rig.current;
    if (!group) return;
    const t = clock.elapsedTime + seed;
    const baseLift = tiptoe ? 0.11 : 0;
    const hop = Math.abs(Math.sin(t * (excited ? 7 : 2.4))) * (excited ? 0.055 : 0.014);
    group.position.y = baseLift + hop;
    group.rotation.x = tiptoe ? -0.06 : excited ? 0.18 : Math.sin(t * 0.7) * 0.04;
  });

  return <group ref={rig}>{children}</group>;
}

function muteRaycast(group: Group | null) {
  group?.traverse((obj) => {
    obj.raycast = () => null;
  });
}

function PlayerFamily({
  phase,
  playStep,
  coinPlayer,
  isSuspenseHanging,
  topicBounce,
  arrivalSeq,
}: {
  phase: Phase;
  playStep: PlayStep;
  coinPlayer: CoinPlayer;
  isSuspenseHanging: boolean;
  topicBounce: number;
  arrivalSeq: number;
}) {
  const rootRef = useRef<Group>(null);
  const dadRef = useRef<Group>(null);
  const mayaRef = useRef<Group>(null);
  const leoRef = useRef<Group>(null);

  const dadPos = useRef(HERO_ENTRY_POS.dad.clone());
  const mayaPos = useRef(HERO_ENTRY_POS.maya.clone());
  const leoPos = useRef(HERO_ENTRY_POS.leo.clone());

  const dadYaw = useRef(-0.8);
  const mayaYaw = useRef(0.7);
  const leoYaw = useRef(0.5);

  const [bouncing, setBouncing] = useState(false);

  // Trigger family walk-up animation whenever arrivalSeq changes (or page loads)
  useEffect(() => {
    dadPos.current.copy(HERO_ENTRY_POS.dad);
    mayaPos.current.copy(HERO_ENTRY_POS.maya);
    leoPos.current.copy(HERO_ENTRY_POS.leo);
    setBouncing(true);
    const id = window.setTimeout(() => setBouncing(false), 2600);
    return () => window.clearTimeout(id);
  }, [arrivalSeq]);

  useEffect(() => {
    if (topicBounce > 0) {
      setBouncing(true);
      const id = window.setTimeout(() => setBouncing(false), 2400);
      return () => window.clearTimeout(id);
    }
  }, [topicBounce]);

  useLayoutEffect(() => {
    muteRaycast(rootRef.current);
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, delta);

    const dadGoal =
      playStep === "coin_entering" && coinPlayer === "Dad"
        ? COIN_SLOT_STAND
        : HERO_STAND_POS.dad;
    const mayaGoal =
      playStep === "coin_entering" && coinPlayer === "Maya"
        ? COIN_SLOT_STAND
        : HERO_STAND_POS.maya;
    const leoGoal =
      playStep === "coin_entering" && coinPlayer === "Leo"
        ? COIN_SLOT_STAND
        : HERO_STAND_POS.leo;

    const updateActor = (
      group: Group | null,
      pos: THREE.Vector3,
      goal: THREE.Vector3,
      yawRef: { current: number },
      extraY = 0,
      lookTarget: THREE.Vector3 = MACHINE_CENTER,
    ) => {
      if (!group) return;
      const dx = goal.x - pos.x;
      const dz = goal.z - pos.z;
      const distSq = dx * dx + dz * dz;
      const walking = distSq > 0.0025;
      pos.lerp(goal, 1 - Math.exp(-dt * 3.8));
      const targetYaw = walking
        ? Math.atan2(dx, dz)
        : yawTowardPoint([pos.x, 0, pos.z], [lookTarget.x, 0, lookTarget.z]);
      yawRef.current = lerpAngle(yawRef.current, targetYaw, 1 - Math.exp(-dt * 8));
      const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.035 : Math.sin(t * 1.4) * 0.008;
      group.position.set(pos.x, bob + extraY, pos.z);
      group.rotation.y = yawRef.current;
    };

    const mayaJumpY =
      playStep === "coin_entering" && coinPlayer === "Maya"
        ? Math.abs(Math.sin(t * 6.5)) * 0.16
        : 0;
    const leoTiptoeY =
      playStep === "coin_entering" && coinPlayer === "Leo"
        ? 0.08 + Math.abs(Math.sin(t * 8)) * 0.04
        : 0;

    updateActor(
      dadRef.current,
      dadPos.current,
      dadGoal,
      dadYaw,
      0,
      playStep === "coin_entering" && coinPlayer === "Dad" ? COIN_SLOT_WORLD : MACHINE_CENTER,
    );
    updateActor(
      mayaRef.current,
      mayaPos.current,
      mayaGoal,
      mayaYaw,
      mayaJumpY,
      playStep === "coin_entering" && coinPlayer === "Maya" ? COIN_SLOT_WORLD : MACHINE_CENTER,
    );
    updateActor(
      leoRef.current,
      leoPos.current,
      leoGoal,
      leoYaw,
      leoTiptoeY,
      playStep === "coin_entering" && coinPlayer === "Leo" ? COIN_SLOT_WORLD : MACHINE_CENTER,
    );
  });

  const kidsExcited =
    !isSuspenseHanging &&
    (phase === "vending" ||
      phase === "revealed" ||
      playStep === "select_item" ||
      playStep === "in_tray" ||
      bouncing);

  return (
    <group ref={rootRef}>
      {/* Dad */}
      <group ref={dadRef} position={[HERO_ENTRY_POS.dad.x, 0, HERO_ENTRY_POS.dad.z]}>
        <Body
          coat="#1e293b"
          skin="#e4b48f"
          hair="#241c18"
          bag={false}
          coin={(playStep === "need_coin" || playStep === "coin_entering") && coinPlayer === "Dad"}
          reachArm={playStep === "coin_entering" && coinPlayer === "Dad"}
        />
      </group>

      {/* Maya (7) */}
      <group ref={mayaRef} position={[HERO_ENTRY_POS.maya.x, 0, HERO_ENTRY_POS.maya.z]} scale={0.78}>
        <KidHop excited={kidsExcited} seed={11}>
          <KidBody
            shirt="#ff5f8f"
            skin="#e4b48f"
            hair="#2a1d17"
            shoes="#f8fafc"
            point={playStep === "need_coin" || playStep === "select_item" || playStep === "in_tray" || bouncing}
            cap={false}
            reachHigh={playStep === "coin_entering" && coinPlayer === "Maya"}
            coin={(playStep === "need_coin" || playStep === "coin_entering") && coinPlayer === "Maya"}
          />
        </KidHop>
      </group>

      {/* Leo (5) */}
      <group ref={leoRef} position={[HERO_ENTRY_POS.leo.x, 0, HERO_ENTRY_POS.leo.z]} scale={0.66}>
        <KidHop
          excited={kidsExcited}
          tiptoe={playStep === "coin_entering" && coinPlayer === "Leo"}
          seed={29}
        >
          <KidBody
            shirt="#38bdf8"
            skin="#e4b48f"
            hair="#1a1412"
            shoes="#facc15"
            point={playStep === "select_item" || playStep === "in_tray" || bouncing}
            cap
            reachHigh={playStep === "coin_entering" && coinPlayer === "Leo"}
            coin={(playStep === "need_coin" || playStep === "coin_entering") && coinPlayer === "Leo"}
          />
        </KidHop>
      </group>
    </group>
  );
}

function Person({ figure, index, phase }: { figure: Figure; index: number; phase: Phase }) {
  const rig = useRef<Group>(null);
  const watching = phase === "vending" || phase === "revealed";
  const yaw = yawTowardMachine(figure.position);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 1.3;
    if (!rig.current) return;
    rig.current.position.y = Math.sin(t * 1.35) * 0.012;
    const lean = watching && figure.role === "watch" ? 0.08 : 0;
    rig.current.rotation.x = Math.sin(t * 0.6) * 0.015 + lean;
  });

  return (
    <group ref={rig} position={figure.position} rotation={[0, yaw, 0]} raycast={() => null}>
      <Body coat={figure.coat} skin={figure.skin} hair={figure.hair} bag={figure.bag} coin={figure.coin} />
    </group>
  );
}

function placeAt(target: Group, point: THREE.Vector3, bob: number, yaw: number) {
  target.position.set(point.x, bob, point.z);
  target.rotation.y = yaw;
}

function FamilyGroup({
  family,
  slot,
  fresh,
  phase,
}: {
  family: Family;
  slot: number;
  fresh: boolean;
  phase: Phase;
}) {
  const rig = useRef<Group>(null);
  const anchor = QUEUE_ANCHORS[slot] ?? QUEUE_ANCHORS[0];
  const start = fresh ? SPAWN : anchor;
  const here = useRef(new THREE.Vector3(...start));
  const goal = useRef(new THREE.Vector3(...anchor));
  const face = useRef(yawTowardMachine(anchor));

  useEffect(() => {
    goal.current.set(...anchor);
  }, [anchor]);

  useLayoutEffect(() => {
    muteRaycast(rig.current);
  }, []);

  useFrame(({ clock }, delta) => {
    const group = rig.current;
    if (!group) return;
    const dx = goal.current.x - here.current.x;
    const dz = goal.current.z - here.current.z;
    const moving = dx * dx + dz * dz > 0.0008;
    here.current.lerp(goal.current, 1 - Math.exp(-delta * 2.1));
    if (moving) face.current = Math.atan2(dx, dz);
    else face.current = yawTowardMachine([here.current.x, 0, here.current.z]);
    const bob = moving
      ? Math.abs(Math.sin(clock.elapsedTime * 8 + family.id)) * 0.035
      : Math.sin(clock.elapsedTime * 1.3 + family.id) * 0.01;
    placeAt(group, here.current, bob, face.current);
  });

  return (
    <group ref={rig} position={start}>
      <group position={QUEUE_SPREAD.parent}>
        <Body coat={family.coat} skin={family.skin} hair={family.hair} bag={family.bag} coin={false} />
      </group>
      {family.kids.map((kid, index) => (
        <group key={`${family.id}-${index}`} position={QUEUE_SPREAD.kids[index]} scale={kid.scale}>
          <KidHop excited={phase === "revealed"} seed={family.id + index}>
            <KidBody shirt={kid.shirt} skin={kid.skin} hair={kid.hair} shoes={kid.shoes} point={false} />
          </KidHop>
        </group>
      ))}
    </group>
  );
}

function Leaver({ family, onDone }: { family: Family; onDone: (id: number) => void }) {
  const rig = useRef<Group>(null);
  const here = useRef(new THREE.Vector3(...QUEUE_ANCHORS[0]));
  const goal = useRef(new THREE.Vector3(...EXIT));
  const finished = useRef(false);

  useLayoutEffect(() => {
    muteRaycast(rig.current);
  }, []);

  useFrame(({ clock }, delta) => {
    const group = rig.current;
    if (!group || finished.current) return;
    const dx = goal.current.x - here.current.x;
    const dz = goal.current.z - here.current.z;
    here.current.lerp(goal.current, 1 - Math.exp(-delta * 1.5));
    const bob = Math.abs(Math.sin(clock.elapsedTime * 8 + family.id)) * 0.03;
    placeAt(group, here.current, bob, Math.atan2(dx, dz));
    if (here.current.distanceTo(goal.current) < 0.12) {
      finished.current = true;
      onDone(family.id);
    }
  });

  return (
    <group ref={rig} position={QUEUE_ANCHORS[0]}>
      <group position={QUEUE_SPREAD.parent}>
        <Body coat={family.coat} skin={family.skin} hair={family.hair} bag={family.bag} coin={false} />
      </group>
      {family.kids.map((kid, index) => (
        <group key={`${family.id}-leave-${index}`} position={QUEUE_SPREAD.kids[index]} scale={kid.scale}>
          <KidBody shirt={kid.shirt} skin={kid.skin} hair={kid.hair} shoes={kid.shoes} point={false} />
        </group>
      ))}
    </group>
  );
}

function Rope({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(from[0], 0.72, from[2]);
    const end = new THREE.Vector3(to[0], 0.72, to[2]);
    const mid = start.clone().lerp(end, 0.5);
    mid.y -= 0.06;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    return new THREE.TubeGeometry(curve, 12, 0.012, 6, false);
  }, [from, to]);

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial color="#6e2430" roughness={0.55} />
    </mesh>
  );
}

function Post({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} raycast={() => null}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.032, 0.92, 10]} />
        <meshStandardMaterial color="#c9a36a" metalness={0.75} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color="#e0b15a" metalness={0.8} roughness={0.28} />
      </mesh>
    </group>
  );
}

export function Crowd({
  phase,
  advance,
  topicBounce = 0,
  playStep = "need_coin",
  coinPlayer = "Dad",
  isSuspenseHanging = false,
  arrivalSeq = 0,
}: {
  phase: Phase;
  advance: number;
  topicBounce?: number;
  playStep?: PlayStep;
  coinPlayer?: CoinPlayer;
  isSuspenseHanging?: boolean;
  arrivalSeq?: number;
}) {
  const [line, setLine] = useState<Family[]>(openingQueue);
  const [leaving, setLeaving] = useState<Family | null>(null);
  const lineRef = useRef(line);
  const seen = useRef(advance);

  useEffect(() => {
    if (advance === seen.current) return;
    seen.current = advance;
    const front = lineRef.current[0];
    if (!front) return;
    const next = [...lineRef.current.slice(1), makeFamily(advance)];
    lineRef.current = next;
    setLine(next);
    setLeaving(front);
  }, [advance]);

  if (phase === "reality") return null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.35]} raycast={() => null}>
        <ringGeometry args={[1.35, 1.48, 64]} />
        <meshStandardMaterial color="#8d6a3e" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.7, 0.007, 1.75]} raycast={() => null}>
        <planeGeometry args={[2.1, 0.07]} />
        <meshStandardMaterial color="#6e2430" roughness={0.8} />
      </mesh>
      {POSTS.map((position) => (
        <Post key={position.join(",")} position={position} />
      ))}
      <Rope from={POSTS[0]} to={POSTS[1]} />
      <Rope from={POSTS[1]} to={POSTS[2]} />
      <PlayerFamily
        phase={phase}
        playStep={playStep}
        coinPlayer={coinPlayer}
        isSuspenseHanging={isSuspenseHanging}
        topicBounce={topicBounce}
        arrivalSeq={arrivalSeq}
      />
      {line.map((family, slot) => (
        <FamilyGroup
          key={family.id}
          family={family}
          slot={slot}
          fresh={family.joined > 0 && family.joined === advance}
          phase={phase}
        />
      ))}
      {leaving ? <Leaver family={leaving} onDone={() => setLeaving(null)} /> : null}
      {WATCHERS.map((figure, index) => (
        <Person key={figure.position.join(",")} figure={figure} index={index} phase={phase} />
      ))}
    </group>
  );
}
