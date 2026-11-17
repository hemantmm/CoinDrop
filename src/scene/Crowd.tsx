import { useEffect, useMemo, useRef, useState } from "react";
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

type Queued = Look & { id: number; bag: boolean; joined: number };

const LOOKS: Look[] = [
  { coat: "#31425f", skin: "#e4b48f", hair: "#2a211c" },
  { coat: "#6a3034", skin: "#c68642", hair: "#1a1412" },
  { coat: "#2c4a3c", skin: "#8d5524", hair: "#3a2a22" },
  { coat: "#4d4030", skin: "#f0c7a4", hair: "#241c18" },
  { coat: "#3a3558", skin: "#e4b48f", hair: "#1c1614" },
  { coat: "#243044", skin: "#6b3e26", hair: "#2c241e" },
];

const SLOTS: [number, number, number][] = [
  [2.15, 0, 2.05],
  [2.75, 0, 2.05],
  [3.35, 0, 2.05],
  [3.35, 0, 1.42],
];

const SPAWN: [number, number, number] = [3.95, 0, 0.72];
const EXIT: [number, number, number] = [0.2, 0, 3.75];

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

function makePerson(bag: boolean, joined: number): Queued {
  const look = LOOKS[nextPersonId % LOOKS.length] ?? LOOKS[0];
  const person = { id: nextPersonId, ...look, bag, joined };
  nextPersonId += 1;
  return person;
}

function openingLine(): Queued[] {
  return [false, true, false, true].map((bag) => makePerson(bag, 0));
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

function QueuedPerson({ person, slot, fresh }: { person: Queued; slot: number; fresh: boolean }) {
  const rig = useRef<Group>(null);
  const here = useRef(new THREE.Vector3(...(fresh ? SPAWN : SLOTS[slot])));
  const goal = useRef(new THREE.Vector3(...SLOTS[slot]));
  const face = useRef(yawTowardMachine(SLOTS[slot]));

  useEffect(() => {
    goal.current.set(...SLOTS[slot]);
  }, [slot]);

  useFrame(({ clock }, delta) => {
    const group = rig.current;
    if (!group) return;
    const dx = goal.current.x - here.current.x;
    const dz = goal.current.z - here.current.z;
    const moving = dx * dx + dz * dz > 0.0004;
    here.current.lerp(goal.current, 1 - Math.exp(-delta * 2.4));
    if (moving) face.current = Math.atan2(dx, dz);
    else face.current = yawTowardMachine(SLOTS[slot]);
    const bob = Math.sin(clock.elapsedTime * 1.35 + person.id) * 0.012;
    placeAt(group, here.current, bob, face.current);
  });

  return (
    <group ref={rig} position={fresh ? SPAWN : SLOTS[slot]} raycast={() => null}>
      <Body coat={person.coat} skin={person.skin} hair={person.hair} bag={person.bag} coin={slot === 0} />
    </group>
  );
}

function Leaver({ person, onDone }: { person: Queued; onDone: (id: number) => void }) {
  const rig = useRef<Group>(null);
  const here = useRef(new THREE.Vector3(...SLOTS[0]));
  const goal = useRef(new THREE.Vector3(...EXIT));
  const finished = useRef(false);

  useFrame((_, delta) => {
    const group = rig.current;
    if (!group || finished.current) return;
    here.current.lerp(goal.current, 1 - Math.exp(-delta * 1.6));
    const yaw = Math.atan2(goal.current.x - SLOTS[0][0], goal.current.z - SLOTS[0][2]);
    placeAt(group, here.current, 0, yaw);
    if (here.current.distanceTo(goal.current) < 0.08) {
      finished.current = true;
      onDone(person.id);
    }
  });

  return (
    <group ref={rig} position={SLOTS[0]} raycast={() => null}>
      <Body coat={person.coat} skin={person.skin} hair={person.hair} bag={person.bag} coin={false} />
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
  const [line, setLine] = useState<Queued[]>(openingLine);
  const [leaving, setLeaving] = useState<Queued | null>(null);
  const lineRef = useRef(line);
  const seen = useRef(advance);

  useEffect(() => {
    if (advance === seen.current) return;
    seen.current = advance;
    const front = lineRef.current[0];
    if (!front) return;
    const next = [...lineRef.current.slice(1), makePerson(advance % 2 === 0, advance)];
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
      {line.map((person, slot) => (
        <QueuedPerson key={person.id} person={person} slot={slot} fresh={person.joined > 0 && person.joined === advance} />
      ))}
      {leaving ? <Leaver person={leaving} onDone={() => setLeaving(null)} /> : null}
      {WATCHERS.map((figure, index) => (
        <Person key={figure.position.join(",")} figure={figure} index={index} phase={phase} />
      ))}
    </group>
  );
}
