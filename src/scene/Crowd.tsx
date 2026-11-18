import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
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

const ANCHORS: [number, number, number][] = [
  [0, 0, 1.42],
  [2.15, 0, 2.05],
  [2.75, 0, 2.05],
  [3.35, 0, 1.45],
];

const PLAY_SPREAD = {
  parent: [0.08, 0, -0.08] as [number, number, number],
  kids: [
    [-0.62, 0, 0.42],
    [0.18, 0, 0.5],
  ] as [number, number, number][],
};

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

function openingLine(): Family[] {
  return [0, 1, 2, 3].map(() => makeFamily(0));
}

function yawTowardMachine(position: [number, number, number]) {
  return Math.atan2(-position[0], -position[2]);
}

function Body({
  coat,
  skin,
  hair,
  bag,
  coin,
}: {
  coat: string;
  skin: string;
  hair: string;
  bag: boolean;
  coin: boolean;
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
      <mesh position={[0.22, 0.86, 0]} rotation={[0.15, 0, -0.55]}>
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
        <mesh position={[0.28, 1.05, 0.08]} rotation={[0.4, 0.2, 1.1]}>
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

function KidBody({ shirt, skin, hair, shoes, point }: Omit<KidLook, "scale">) {
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
      <mesh position={[-0.2, 0.7, 0.02]} rotation={[0.2, 0, 0.7]}>
        <capsuleGeometry args={[0.04, 0.22, 3, 6]} />
        <meshStandardMaterial color={shirt} roughness={0.62} />
      </mesh>
      <mesh position={[0.2, 0.78, 0.06]} rotation={point ? [-1.15, 0.2, -0.35] : [0.35, 0, -0.45]}>
        <capsuleGeometry args={[0.04, 0.24, 3, 6]} />
        <meshStandardMaterial color={shirt} roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <sphereGeometry args={[0.145, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.16, -0.01]}>
        <sphereGeometry args={[0.148, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.72} />
      </mesh>
    </group>
  );
}

function KidHop({ excited, seed, children }: { excited: boolean; seed: number; children: ReactNode }) {
  const rig = useRef<Group>(null);

  useFrame(({ clock }) => {
    const group = rig.current;
    if (!group) return;
    const t = clock.elapsedTime + seed;
    group.position.y = Math.abs(Math.sin(t * (excited ? 7 : 2.4))) * (excited ? 0.045 : 0.014);
    group.rotation.x = excited ? 0.22 : Math.sin(t * 0.7) * 0.04;
  });

  return <group ref={rig}>{children}</group>;
}

function FamilyBodies({
  family,
  atGlass,
  phase,
  coin,
}: {
  family: Family;
  atGlass: boolean;
  phase: Phase;
  coin: boolean;
}) {
  const spread = atGlass ? PLAY_SPREAD : QUEUE_SPREAD;
  const excited = atGlass && (phase === "vending" || phase === "revealed");
  return (
    <>
      <group position={spread.parent}>
        <Body coat={family.coat} skin={family.skin} hair={family.hair} bag={family.bag} coin={coin} />
      </group>
      {family.kids.map((kid, index) => (
        <group key={`${family.id}-${index}`} position={spread.kids[index]} scale={kid.scale}>
          <KidHop excited={excited} seed={family.id + index}>
            <KidBody shirt={kid.shirt} skin={kid.skin} hair={kid.hair} shoes={kid.shoes} point={atGlass && kid.point} />
          </KidHop>
        </group>
      ))}
    </>
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

function muteRaycast(group: Group | null) {
  group?.traverse((obj) => {
    obj.raycast = () => null;
  });
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
  const start = fresh ? SPAWN : ANCHORS[slot];
  const here = useRef(new THREE.Vector3(...start));
  const goal = useRef(new THREE.Vector3(...ANCHORS[slot]));
  const face = useRef(yawTowardMachine(ANCHORS[slot]));

  useEffect(() => {
    goal.current.set(...ANCHORS[slot]);
  }, [slot]);

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
      <FamilyBodies family={family} atGlass={slot === 0} phase={phase} coin={slot === 0} />
    </group>
  );
}

function Leaver({ family, phase, onDone }: { family: Family; phase: Phase; onDone: (id: number) => void }) {
  const rig = useRef<Group>(null);
  const here = useRef(new THREE.Vector3(...ANCHORS[0]));
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
    <group ref={rig} position={ANCHORS[0]}>
      <FamilyBodies family={family} atGlass phase={phase} coin={false} />
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

export function Crowd({ phase, advance }: { phase: Phase; advance: number }) {
  const [line, setLine] = useState<Family[]>(openingLine);
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
      {line.map((family, slot) => (
        <FamilyGroup
          key={family.id}
          family={family}
          slot={slot}
          fresh={family.joined > 0 && family.joined === advance}
          phase={phase}
        />
      ))}
      {leaving ? <Leaver family={leaving} phase={phase} onDone={() => setLeaving(null)} /> : null}
      {WATCHERS.map((figure, index) => (
        <Person key={figure.position.join(",")} figure={figure} index={index} phase={phase} />
      ))}
    </group>
  );
}
