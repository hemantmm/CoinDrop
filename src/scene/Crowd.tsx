import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
import type { Rarity } from "../generate";
import type { CoinPlayer, GiftTopic, PlayStep } from "../stock";
import { SHELF_SPOTS, type Phase } from "./Machine";

type Role = "queue" | "watch";
type Expression = "calm" | "cheer" | "gasp";

type Figure = {
  position: [number, number, number];
  coat: string;
  skin: string;
  hair: string;
  bag: boolean;
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

type PoseInput = {
  walkSpeedRef: MutableRefObject<number>;
  stridePhaseRef: MutableRefObject<number>;
  lookPitchRef: MutableRefObject<number>;
  headYawRef?: MutableRefObject<number>;
  spineLeanRef?: MutableRefObject<number>;
  leftArmTarget?: [number, number, number]; // shoulder rot [x, y, z]
  rightArmTarget?: [number, number, number];
  elbowBendL?: number;
  elbowBendR?: number;
  kneeCrouchRef?: MutableRefObject<number>;
  tiptoeRef?: MutableRefObject<number>;
  clapping?: boolean;
};

const LOOKS: Look[] = [
  { coat: "#31425f", skin: "#e4b48f", hair: "#2a211c" },
  { coat: "#6a3034", skin: "#c68642", hair: "#1a1412" },
  { coat: "#2c4a3c", skin: "#8d5524", hair: "#3a2a22" },
  { coat: "#4d4030", skin: "#f0c7a4", hair: "#241c18" },
  { coat: "#3a3558", skin: "#e4b48f", hair: "#1c1614" },
  { coat: "#243044", skin: "#6b3e26", hair: "#2c241e" },
];

const QUEUE_ANCHORS: [number, number, number][] = [
  [2.28, 0, 2.05],
  [2.88, 0, 2.05],
  [3.44, 0, 1.45],
];

const QUEUE_SPREAD = {
  parent: [0, 0, 0] as [number, number, number],
  kids: [
    [-0.26, 0, -0.2],
    [0.26, 0, -0.16],
  ] as [number, number, number][],
};

const SHIRTS = ["#f2c14e", "#e25b4a", "#3d9b8f", "#7aa2d6"];
const SPAWN: [number, number, number] = [4.0, 0, 0.72];
const EXIT: [number, number, number] = [-2.95, 0, 2.55];

const WATCHERS: Figure[] = [
  { position: [-1.92, 0, 1.55], coat: "#3a3558", skin: "#e4b48f", hair: "#1c1614", bag: true, role: "watch" },
  { position: [-2.28, 0, 0.55], coat: "#5c4632", skin: "#6b3e26", hair: "#2c241e", bag: false, role: "watch" },
  { position: [2.46, 0, 0.15], coat: "#243044", skin: "#c68642", hair: "#1a1412", bag: false, role: "watch" },
  { position: [-1.05, 0, -0.85], coat: "#6a5a3a", skin: "#f1c9a5", hair: "#3a2a22", bag: true, role: "watch" },
];

const POSTS: [number, number, number][] = [
  [1.92, 0, 2.42],
  [3.72, 0, 2.42],
  [3.72, 0, 1.15],
];

// Arrival entry beside stanchion
const HERO_ENTRY_POS = {
  dad: new THREE.Vector3(1.85, 0, 1.55),
  maya: new THREE.Vector3(1.58, 0, 1.72),
  leo: new THREE.Vector3(1.75, 0, 1.84),
};

// Key architectural targets safely outside plinth [x:-0.40..0.40, z:0.70..1.22] and machine [x:-0.70..0.72, z:-0.35..0.39]
const DAD_BROWSE = new THREE.Vector3(1.06, 0, 0.82);
const DAD_KEYPAD_STAND = new THREE.Vector3(0.74, 0, 0.76);
const DAD_COIN_PASS = new THREE.Vector3(0.92, 0, 0.82);
const DAD_SLOT_STAND = new THREE.Vector3(0.84, 0, 0.70);
const DAD_COLLECT_STAND = new THREE.Vector3(0.46, 0, 0.62);
const DAD_PLINTH_VIEW = new THREE.Vector3(0.84, 0, 1.06);
const DAD_NUDGE_POS = new THREE.Vector3(0.88, 0, 0.46);

const MAYA_LEFT_VIEW = new THREE.Vector3(-0.98, 0, 0.76);
const MAYA_PLINTH_VIEW = new THREE.Vector3(-0.74, 0, 1.02);
const MAYA_WAIT_COIN = new THREE.Vector3(0.72, 0, 0.88);
const MAYA_SLOT_STAND = new THREE.Vector3(0.60, 0, 0.68);
const MAYA_TRAY_CROUCH = new THREE.Vector3(-0.46, 0, 0.62);

const LEO_LEFT_VIEW = new THREE.Vector3(-0.82, 0, 1.18);
const LEO_PLINTH_VIEW = new THREE.Vector3(-0.56, 0, 1.28);
const LEO_WAIT_COIN = new THREE.Vector3(0.72, 0, 0.90);
const LEO_SLOT_STAND = new THREE.Vector3(0.60, 0, 0.68);
const LEO_TRAY_CROUCH = new THREE.Vector3(-0.24, 0, 0.58);

const COIN_SLOT_WORLD = new THREE.Vector3(0.59, 1.32, 0.39);
const KEYPAD_WORLD = new THREE.Vector3(0.59, 1.12, 0.39);
const TRAY_CENTER = new THREE.Vector3(-0.07, 0.22, 0.35);
const PLINTH_CENTER = new THREE.Vector3(0, 0.46, 0.96);

const TOPIC_ROW_INDEX: Record<GiftTopic, number> = {
  technology: 0,
  audio: 1,
  snacks: 2,
  style: 3,
};

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

// Routes around the showcase plinth [x:-0.45..0.52, z:0.66..1.28] & glass aisle cleanly without clipping!
function steerAroundPlinth(
  pos: THREE.Vector3,
  goal: THREE.Vector3,
  maxSpeed: number,
  dt: number,
  allowGlassAisle: boolean,
  outNextTarget: THREE.Vector3,
): { movedDist: number; walking: boolean; dirX: number; dirZ: number } {
  const dxFull = goal.x - pos.x;
  const dzFull = goal.z - pos.z;
  const distFull = Math.hypot(dxFull, dzFull);
  if (distFull < 0.025) {
    outNextTarget.copy(goal);
    return { movedDist: 0, walking: false, dirX: 0, dirZ: 0 };
  }

  // Route cleanly past the plinth corners before turning north/south so nobody grazes the plinth
  const goingRightPastPlinth = goal.x > 0.46 && pos.x < 0.46;
  const goingLeftPastPlinth = goal.x < -0.46 && pos.x > -0.46;
  const crossingWidth = goingRightPastPlinth || goingLeftPastPlinth;

  if (crossingWidth && allowGlassAisle && pos.z <= 0.64 && goal.z <= 0.64) {
    // Kids slip along front glass corridor safely behind plinth!
    outNextTarget.set(goal.x, 0, 0.56);
  } else if (crossingWidth && (pos.z > 0.64 || goal.z > 0.64)) {
    // Clear the plinth completely around the front promenade (z = 1.44) before turning toward goal
    const clearX = goingRightPastPlinth ? Math.max(0.56, Math.min(goal.x, 0.78)) : Math.min(-0.56, Math.max(goal.x, -0.78));
    outNextTarget.set(clearX, 0, 1.44);
  } else if (
    !crossingWidth &&
    pos.z > 0.68 &&
    pos.z < 1.25 &&
    goal.x > -0.44 &&
    goal.x < 0.48
  ) {
    outNextTarget.set(pos.x, 0, goal.z < 0.68 ? 0.56 : 1.42);
  } else {
    outNextTarget.copy(goal);
  }

  const dx = outNextTarget.x - pos.x;
  const dz = outNextTarget.z - pos.z;
  const dist = Math.hypot(dx, dz);
  const stepTarget = dist < 0.01 ? distFull : dist;
  const speed = Math.min(maxSpeed, Math.max(0.25, stepTarget * 3.8));
  const step = Math.min(dist, speed * dt);

  const dirX = dist > 0.001 ? dx / dist : 0;
  const dirZ = dist > 0.001 ? dz / dist : 0;
  pos.x += dirX * step;
  pos.z += dirZ * step;

  // Soft collision push out of plinth footprint [x:-0.44..0.44, z:0.68..1.24]
  if (pos.x > -0.44 && pos.x < 0.44 && pos.z > 0.68 && pos.z < 1.24) {
    const pushFront = 1.25 - pos.z;
    const pushBack = pos.z - 0.66;
    const pushLeft = pos.x - (-0.45);
    const pushRight = 0.45 - pos.x;
    const minP = Math.min(pushFront, pushBack, pushLeft, pushRight);
    if (minP === pushFront) pos.z = 1.25;
    else if (minP === pushBack) pos.z = 0.66;
    else if (minP === pushLeft) pos.x = -0.45;
    else pos.x = 0.45;
  }

  // Soft push outside machine front glass plane z < 0.50
  if (pos.x > -0.74 && pos.x < 0.74 && pos.z < 0.50) {
    pos.z = 0.50;
  }

  return { movedDist: step, walking: distFull > 0.04, dirX, dirZ };
}

function FacialFeatures({
  expression = "calm",
  seed = 0,
  headRadius = 0.13,
  rosyCheeks = false,
}: {
  expression?: Expression;
  seed?: number;
  headRadius?: number;
  rosyCheeks?: boolean;
}) {
  const eyeLRef = useRef<Group>(null);
  const eyeRRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const cycle = (clock.elapsedTime + seed * 1.17) % 3.6;
    const blink = cycle < 0.11 ? 0.12 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.y = blink;
    if (eyeRRef.current) eyeRRef.current.scale.y = blink;
  });

  const zFace = headRadius * 0.92;
  const eyeSpread = headRadius * 0.34;
  const eyeY = headRadius * 0.08;

  return (
    <group>
      <group ref={eyeLRef} position={[-eyeSpread, eyeY, zFace]}>
        <mesh>
          <sphereGeometry args={[headRadius * 0.14, 10, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, headRadius * 0.08]}>
          <sphereGeometry args={[headRadius * 0.085, 8, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.15} />
        </mesh>
      </group>
      <group ref={eyeRRef} position={[eyeSpread, eyeY, zFace]}>
        <mesh>
          <sphereGeometry args={[headRadius * 0.14, 10, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, headRadius * 0.08]}>
          <sphereGeometry args={[headRadius * 0.085, 8, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.15} />
        </mesh>
      </group>
      <mesh
        position={[-eyeSpread, eyeY + headRadius * (expression === "gasp" ? 0.26 : 0.19), zFace]}
        rotation={[0, 0, expression === "gasp" ? 0.18 : 0.04]}
      >
        <boxGeometry args={[headRadius * 0.24, headRadius * 0.045, headRadius * 0.04]} />
        <meshStandardMaterial color="#1f1612" roughness={0.8} />
      </mesh>
      <mesh
        position={[eyeSpread, eyeY + headRadius * (expression === "gasp" ? 0.26 : 0.19), zFace]}
        rotation={[0, 0, expression === "gasp" ? -0.18 : -0.04]}
      >
        <boxGeometry args={[headRadius * 0.24, headRadius * 0.045, headRadius * 0.04]} />
        <meshStandardMaterial color="#1f1612" roughness={0.8} />
      </mesh>
      {rosyCheeks ? (
        <>
          <mesh position={[-eyeSpread * 1.35, -headRadius * 0.16, zFace * 0.94]}>
            <sphereGeometry args={[headRadius * 0.13, 8, 8]} />
            <meshStandardMaterial color="#fb7185" transparent opacity={0.42} roughness={0.8} />
          </mesh>
          <mesh position={[eyeSpread * 1.35, -headRadius * 0.16, zFace * 0.94]}>
            <sphereGeometry args={[headRadius * 0.13, 8, 8]} />
            <meshStandardMaterial color="#fb7185" transparent opacity={0.42} roughness={0.8} />
          </mesh>
        </>
      ) : null}
      {expression === "gasp" ? (
        <mesh position={[0, -headRadius * 0.34, zFace * 0.96]}>
          <torusGeometry args={[headRadius * 0.11, headRadius * 0.04, 8, 16]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
        </mesh>
      ) : expression === "cheer" ? (
        <mesh position={[0, -headRadius * 0.3, zFace * 0.96]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[headRadius * 0.38, headRadius * 0.14, headRadius * 0.05]} />
          <meshStandardMaterial color="#991b1b" roughness={0.4} />
        </mesh>
      ) : (
        <mesh position={[0, -headRadius * 0.3, zFace * 0.96]}>
          <boxGeometry args={[headRadius * 0.26, headRadius * 0.05, headRadius * 0.04]} />
          <meshStandardMaterial color="#9a3412" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

function Body({
  coat,
  skin,
  hair,
  bag,
  pose,
  expression = "calm",
  seed = 0,
}: {
  coat: string;
  skin: string;
  hair: string;
  bag: boolean;
  pose?: PoseInput;
  expression?: Expression;
  seed?: number;
}) {
  const pelvis = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const thighL = useRef<Group>(null);
  const thighR = useRef<Group>(null);
  const shinL = useRef<Group>(null);
  const shinR = useRef<Group>(null);
  const shL = useRef<Group>(null);
  const shR = useRef<Group>(null);
  const elL = useRef<Group>(null);
  const elR = useRef<Group>(null);
  const head = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const speed = pose ? pose.walkSpeedRef.current : 0;
    const stride = THREE.MathUtils.clamp(speed * 1.4, 0, 1);
    const phi = pose ? pose.stridePhaseRef.current : t * 8;
    const legSwing = Math.sin(phi) * 0.56 * stride;
    const kneeFlexL = Math.max(0, Math.cos(phi)) * 0.72 * stride;
    const kneeFlexR = Math.max(0, -Math.cos(phi)) * 0.72 * stride;
    const crouch = pose?.kneeCrouchRef ? pose.kneeCrouchRef.current : 0;

    if (pelvis.current) {
      const lift = stride > 0.05 ? Math.abs(Math.sin(phi)) * 0.025 : 0;
      pelvis.current.position.y = lift - crouch * 0.16;
    }

    if (thighL.current) thighL.current.rotation.x = legSwing - crouch * 0.75;
    if (thighR.current) thighR.current.rotation.x = -legSwing - crouch * 0.75;
    if (shinL.current) shinL.current.rotation.x = kneeFlexL + crouch * 1.4;
    if (shinR.current) shinR.current.rotation.x = kneeFlexR + crouch * 1.4;

    if (torso.current) {
      const leanTarget = (pose?.spineLeanRef ? pose.spineLeanRef.current : 0) + stride * 0.06;
      torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, leanTarget, 0.16);
      torso.current.rotation.y = Math.sin(phi) * 0.07 * stride;
    }

    const clapWave = pose?.clapping ? Math.sin(t * 14) * 0.18 : 0;
    const targetArmL = pose?.leftArmTarget ?? [0.12 - legSwing * 0.75, 0, 0.12];
    const targetArmR = pose?.rightArmTarget ?? [0.12 + legSwing * 0.75, 0, -0.12];

    if (shL.current) {
      shL.current.rotation.x = THREE.MathUtils.lerp(
        shL.current.rotation.x,
        pose?.clapping ? -0.95 : pose?.leftArmTarget ? targetArmL[0] : 0.1 - legSwing * 0.78,
        0.22,
      );
      shL.current.rotation.y = THREE.MathUtils.lerp(
        shL.current.rotation.y,
        pose?.clapping ? 0.55 + clapWave : targetArmL[1],
        0.22,
      );
      shL.current.rotation.z = THREE.MathUtils.lerp(shL.current.rotation.z, targetArmL[2], 0.22);
    }

    if (shR.current) {
      shR.current.rotation.x = THREE.MathUtils.lerp(
        shR.current.rotation.x,
        pose?.clapping ? -0.95 : pose?.rightArmTarget ? targetArmR[0] : 0.1 + legSwing * 0.78,
        0.22,
      );
      shR.current.rotation.y = THREE.MathUtils.lerp(
        shR.current.rotation.y,
        pose?.clapping ? -0.55 - clapWave : targetArmR[1],
        0.22,
      );
      shR.current.rotation.z = THREE.MathUtils.lerp(shR.current.rotation.z, targetArmR[2], 0.22);
    }

    if (elL.current) {
      const targetElL = pose?.clapping ? -1.1 : pose?.elbowBendL ?? -0.25 - Math.max(0, legSwing) * 0.4;
      elL.current.rotation.x = THREE.MathUtils.lerp(elL.current.rotation.x, targetElL, 0.22);
    }
    if (elR.current) {
      const targetElR = pose?.clapping ? -1.1 : pose?.elbowBendR ?? -0.25 - Math.max(0, -legSwing) * 0.4;
      elR.current.rotation.x = THREE.MathUtils.lerp(elR.current.rotation.x, targetElR, 0.22);
    }

    if (head.current) {
      const targetPitch = pose ? pose.lookPitchRef.current : 0;
      const targetYaw = pose?.headYawRef ? pose.headYawRef.current : 0;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, targetPitch, 0.16);
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, targetYaw, 0.16);
    }
  });

  return (
    <group ref={pelvis}>
      {/* Left Leg (Hip -> Knee -> Shoe) */}
      <group ref={thighL} position={[-0.088, 0.74, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.062, 0.22, 4, 8]} />
          <meshStandardMaterial color="#18181b" roughness={0.82} />
        </mesh>
        <group ref={shinL} position={[0, -0.35, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.22, 4, 8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.35, 0.045]}>
            <boxGeometry args={[0.09, 0.06, 0.17]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Right Leg (Hip -> Knee -> Shoe) */}
      <group ref={thighR} position={[0.088, 0.74, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.062, 0.22, 4, 8]} />
          <meshStandardMaterial color="#18181b" roughness={0.82} />
        </mesh>
        <group ref={shinR} position={[0, -0.35, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.22, 4, 8]} />
            <meshStandardMaterial color="#0f172a" roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.35, 0.045]}>
            <boxGeometry args={[0.09, 0.06, 0.17]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Articulated Torso + Shoulders + Elbows + Head */}
      <group ref={torso} position={[0, 0.78, 0]}>
        <mesh position={[0, 0.26, 0]} castShadow>
          <capsuleGeometry args={[0.175, 0.34, 4, 8]} />
          <meshStandardMaterial color={coat} roughness={0.72} />
        </mesh>

        {/* Left Shoulder + Elbow + Hand */}
        <group ref={shL} position={[-0.22, 0.45, 0]}>
          <mesh position={[0, -0.11, 0]}>
            <capsuleGeometry args={[0.046, 0.16, 3, 6]} />
            <meshStandardMaterial color={coat} roughness={0.72} />
          </mesh>
          <group ref={elL} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.04, 0.16, 3, 6]} />
              <meshStandardMaterial color={coat} roughness={0.72} />
            </mesh>
            <mesh position={[0, -0.23, 0]}>
              <sphereGeometry args={[0.044, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
          </group>
        </group>

        {/* Right Shoulder + Elbow + Hand */}
        <group ref={shR} position={[0.22, 0.45, 0]}>
          <mesh position={[0, -0.11, 0]}>
            <capsuleGeometry args={[0.046, 0.16, 3, 6]} />
            <meshStandardMaterial color={coat} roughness={0.72} />
          </mesh>
          <group ref={elR} position={[0, -0.24, 0]}>
            <mesh position={[0, -0.11, 0]}>
              <capsuleGeometry args={[0.04, 0.16, 3, 6]} />
              <meshStandardMaterial color={coat} roughness={0.72} />
            </mesh>
            <mesh position={[0, -0.23, 0]}>
              <sphereGeometry args={[0.044, 10, 10]} />
              <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
          </group>
        </group>

        {/* Head & Neck */}
        <group ref={head} position={[0, 0.69, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshStandardMaterial color={skin} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.06, -0.01]}>
            <sphereGeometry args={[0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
            <meshStandardMaterial color={hair} roughness={0.7} />
          </mesh>
          <FacialFeatures expression={expression} seed={seed} headRadius={0.13} />
        </group>

        {bag ? (
          <group position={[0.28, 0.02, 0.02]}>
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
      </group>
    </group>
  );
}

function KidBody({
  shirt,
  skin,
  hair,
  shoes,
  cap = false,
  pose,
  expression = "calm",
  seed = 0,
}: Omit<KidLook, "scale" | "point"> & {
  cap?: boolean;
  pose?: PoseInput;
  expression?: Expression;
  seed?: number;
}) {
  const pelvis = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const thighL = useRef<Group>(null);
  const thighR = useRef<Group>(null);
  const shinL = useRef<Group>(null);
  const shinR = useRef<Group>(null);
  const footL = useRef<Group>(null);
  const footR = useRef<Group>(null);
  const shL = useRef<Group>(null);
  const shR = useRef<Group>(null);
  const elL = useRef<Group>(null);
  const elR = useRef<Group>(null);
  const head = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const speed = pose ? pose.walkSpeedRef.current : 0;
    const stride = THREE.MathUtils.clamp(speed * 1.5, 0, 1);
    const phi = pose ? pose.stridePhaseRef.current : t * 10;
    const legSwing = Math.sin(phi) * 0.62 * stride;
    const kneeFlexL = Math.max(0, Math.cos(phi)) * 0.85 * stride;
    const kneeFlexR = Math.max(0, -Math.cos(phi)) * 0.85 * stride;
    const crouch = pose?.kneeCrouchRef ? pose.kneeCrouchRef.current : 0;
    const tiptoe = pose?.tiptoeRef ? pose.tiptoeRef.current : 0;

    if (pelvis.current) {
      const lift = stride > 0.05 ? Math.abs(Math.sin(phi)) * 0.028 : 0;
      pelvis.current.position.y = lift - crouch * 0.12 + tiptoe * 0.14;
    }

    if (thighL.current) thighL.current.rotation.x = legSwing - crouch * 0.85;
    if (thighR.current) thighR.current.rotation.x = -legSwing - crouch * 0.85;
    if (shinL.current) shinL.current.rotation.x = kneeFlexL + crouch * 1.55;
    if (shinR.current) shinR.current.rotation.x = kneeFlexR + crouch * 1.55;
    if (footL.current) footL.current.rotation.x = tiptoe * 0.58 - crouch * 0.4;
    if (footR.current) footR.current.rotation.x = tiptoe * 0.58 - crouch * 0.4;

    if (torso.current) {
      const leanTarget = (pose?.spineLeanRef ? pose.spineLeanRef.current : 0) + stride * 0.08;
      torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, leanTarget, 0.18);
      torso.current.rotation.y = Math.sin(phi) * 0.09 * stride;
    }

    const clapWave = pose?.clapping ? Math.sin(t * 15) * 0.22 : 0;
    const targetArmL = pose?.leftArmTarget ?? [0.16 - legSwing * 0.85, 0, 0.2];
    const targetArmR = pose?.rightArmTarget ?? [0.16 + legSwing * 0.85, 0, -0.2];

    if (shL.current) {
      shL.current.rotation.x = THREE.MathUtils.lerp(
        shL.current.rotation.x,
        pose?.clapping ? -1.05 : pose?.leftArmTarget ? targetArmL[0] : 0.14 - legSwing * 0.85,
        0.24,
      );
      shL.current.rotation.y = THREE.MathUtils.lerp(
        shL.current.rotation.y,
        pose?.clapping ? 0.58 + clapWave : targetArmL[1],
        0.24,
      );
      shL.current.rotation.z = THREE.MathUtils.lerp(shL.current.rotation.z, targetArmL[2], 0.24);
    }

    if (shR.current) {
      shR.current.rotation.x = THREE.MathUtils.lerp(
        shR.current.rotation.x,
        pose?.clapping ? -1.05 : pose?.rightArmTarget ? targetArmR[0] : 0.14 + legSwing * 0.85,
        0.24,
      );
      shR.current.rotation.y = THREE.MathUtils.lerp(
        shR.current.rotation.y,
        pose?.clapping ? -0.58 - clapWave : targetArmR[1],
        0.24,
      );
      shR.current.rotation.z = THREE.MathUtils.lerp(shR.current.rotation.z, targetArmR[2], 0.24);
    }

    if (elL.current) {
      const targetElL = pose?.clapping ? -1.15 : pose?.elbowBendL ?? -0.22 - Math.max(0, legSwing) * 0.45;
      elL.current.rotation.x = THREE.MathUtils.lerp(elL.current.rotation.x, targetElL, 0.24);
    }
    if (elR.current) {
      const targetElR = pose?.clapping ? -1.15 : pose?.elbowBendR ?? -0.22 - Math.max(0, -legSwing) * 0.45;
      elR.current.rotation.x = THREE.MathUtils.lerp(elR.current.rotation.x, targetElR, 0.24);
    }

    if (head.current) {
      const targetPitch = pose ? pose.lookPitchRef.current : 0;
      const targetYaw = pose?.headYawRef ? pose.headYawRef.current : 0;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, targetPitch, 0.18);
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, targetYaw, 0.18);
    }
  });

  return (
    <group ref={pelvis}>
      {/* Left Leg (Thigh -> Knee/Shin -> Articulated Sneaker) */}
      <group ref={thighL} position={[-0.08, 0.46, 0]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <capsuleGeometry args={[0.052, 0.11, 3, 6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <group ref={shinL} position={[0, -0.19, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.044, 0.12, 3, 6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <group ref={footL} position={[0, -0.21, 0]}>
            <mesh position={[0, -0.015, 0.045]}>
              <boxGeometry args={[0.09, 0.055, 0.15]} />
              <meshStandardMaterial color={shoes} roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Right Leg (Thigh -> Knee/Shin -> Articulated Sneaker) */}
      <group ref={thighR} position={[0.08, 0.46, 0]}>
        <mesh position={[0, -0.09, 0]} castShadow>
          <capsuleGeometry args={[0.052, 0.11, 3, 6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <group ref={shinR} position={[0, -0.19, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.044, 0.12, 3, 6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <group ref={footR} position={[0, -0.21, 0]}>
            <mesh position={[0, -0.015, 0.045]}>
              <boxGeometry args={[0.09, 0.055, 0.15]} />
              <meshStandardMaterial color={shoes} roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Torso + Shoulders + Elbows + Head */}
      <group ref={torso} position={[0, 0.48, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <capsuleGeometry args={[0.155, 0.26, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.62} />
        </mesh>

        {/* Left Arm */}
        <group ref={shL} position={[-0.19, 0.36, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <capsuleGeometry args={[0.038, 0.11, 3, 6]} />
            <meshStandardMaterial color={shirt} roughness={0.62} />
          </mesh>
          <group ref={elL} position={[0, -0.18, 0]}>
            <mesh position={[0, -0.085, 0]}>
              <capsuleGeometry args={[0.034, 0.11, 3, 6]} />
              <meshStandardMaterial color={shirt} roughness={0.62} />
            </mesh>
            <mesh position={[0, -0.17, 0]}>
              <sphereGeometry args={[0.038, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
          </group>
        </group>

        {/* Right Arm */}
        <group ref={shR} position={[0.19, 0.36, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <capsuleGeometry args={[0.038, 0.11, 3, 6]} />
            <meshStandardMaterial color={shirt} roughness={0.62} />
          </mesh>
          <group ref={elR} position={[0, -0.18, 0]}>
            <mesh position={[0, -0.085, 0]}>
              <capsuleGeometry args={[0.034, 0.11, 3, 6]} />
              <meshStandardMaterial color={shirt} roughness={0.62} />
            </mesh>
            <mesh position={[0, -0.17, 0]}>
              <sphereGeometry args={[0.038, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
          </group>
        </group>

        {/* Head & Expressive Face */}
        <group ref={head} position={[0, 0.57, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.145, 16, 12]} />
            <meshStandardMaterial color={skin} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.08, -0.01]}>
            <sphereGeometry args={[0.148, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={hair} roughness={0.72} />
          </mesh>
          {cap ? (
            <mesh position={[0, 0.14, 0.06]} rotation={[0.12, 0, 0]}>
              <boxGeometry args={[0.16, 0.03, 0.14]} />
              <meshStandardMaterial color="#0284c7" roughness={0.5} />
            </mesh>
          ) : (
            <mesh position={[0, 0.14, -0.14]}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshStandardMaterial color={hair} roughness={0.72} />
            </mesh>
          )}
          <FacialFeatures expression={expression} seed={seed} headRadius={0.145} rosyCheeks />
        </group>
      </group>
    </group>
  );
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
  coinStarted = 0,
  coinMs = 1200,
  vendStarted = 0,
  vendMs = 3500,
  isSuspenseHanging,
  topicBounce,
  arrivalSeq,
  focusSlotIndex,
  topic = "technology",
  keyTapAt = 0,
  nudgeWarn = false,
  rarity = null,
}: {
  phase: Phase;
  playStep: PlayStep;
  coinPlayer: CoinPlayer;
  coinStarted?: number;
  coinMs?: number;
  vendStarted?: number;
  vendMs?: number;
  isSuspenseHanging: boolean;
  topicBounce: number;
  arrivalSeq: number;
  focusSlotIndex: number | null;
  topic?: GiftTopic;
  keyTapAt?: number;
  nudgeWarn?: boolean;
  rarity?: Rarity | null;
}) {
  const rootRef = useRef<Group>(null);
  const dadRef = useRef<Group>(null);
  const mayaRef = useRef<Group>(null);
  const leoRef = useRef<Group>(null);

  const dadPos = useRef(HERO_ENTRY_POS.dad.clone());
  const mayaPos = useRef(HERO_ENTRY_POS.maya.clone());
  const leoPos = useRef(HERO_ENTRY_POS.leo.clone());
  const tmpNext = useRef(new THREE.Vector3());

  const dadSpeed = useRef(0);
  const mayaSpeed = useRef(0);
  const leoSpeed = useRef(0);
  const dadPhase = useRef(0);
  const mayaPhase = useRef(1.2);
  const leoPhase = useRef(2.4);

  const dadPitch = useRef(0);
  const mayaPitch = useRef(-0.2);
  const leoPitch = useRef(-0.25);

  const dadHeadYaw = useRef(0);
  const mayaHeadYaw = useRef(0);
  const leoHeadYaw = useRef(0);

  const dadLean = useRef(0);
  const mayaLean = useRef(0);
  const leoLean = useRef(0);

  const dadCrouch = useRef(0);
  const mayaCrouch = useRef(0);
  const leoCrouch = useRef(0);

  const mayaTiptoe = useRef(0);
  const leoTiptoe = useRef(0);

  const dadYaw = useRef(-1.2);
  const mayaYaw = useRef(-1.0);
  const leoYaw = useRef(-1.0);

  const [bouncing, setBouncing] = useState(false);

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
      const id = window.setTimeout(() => setBouncing(false), 2200);
      return () => window.clearTimeout(id);
    }
  }, [topicBounce]);

  useLayoutEffect(() => {
    muteRaycast(rootRef.current);
  }, []);

  const focusShelfY =
    focusSlotIndex !== null && SHELF_SPOTS[focusSlotIndex]
      ? 1.08 + SHELF_SPOTS[focusSlotIndex][1]
      : 1.08 + (SHELF_SPOTS[TOPIC_ROW_INDEX[topic] * 4]?.[1] ?? 0.4);
  const focusShelfX =
    focusSlotIndex !== null && SHELF_SPOTS[focusSlotIndex]
      ? SHELF_SPOTS[focusSlotIndex][0]
      : -0.07;

  const coinProgress = () =>
    playStep === "coin_entering" && coinStarted > 0
      ? Math.min(1, Math.max(0, (performance.now() - coinStarted) / coinMs))
      : 0;

  const vendProgress = () =>
    phase === "vending" && vendStarted > 0
      ? Math.min(1, Math.max(0, (performance.now() - vendStarted) / vendMs))
      : 0;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, delta);
    const cT = coinProgress();
    const vT = vendProgress();

    // Dynamic natural wandering goals per character based on current game beat!
    const browseCycle = Math.floor(t / 3.4);
    const colIndices = [-0.43, -0.19, 0.05, 0.29];
    const mayaBrowseX =
      focusSlotIndex !== null ? focusShelfX - 0.18 : colIndices[(browseCycle + 1) % 4] ?? -0.22;
    const leoBrowseX =
      focusSlotIndex !== null ? focusShelfX + 0.16 : colIndices[(browseCycle + 2) % 4] ?? 0.12;

    let dadGoal = DAD_BROWSE;
    let mayaGoal = MAYA_LEFT_VIEW;
    let leoGoal = LEO_LEFT_VIEW;

    if (playStep === "need_coin") {
      if (coinPlayer === "Maya") {
        dadGoal = DAD_COIN_PASS;
        mayaGoal = MAYA_WAIT_COIN; // Maya walks right over to Dad's side holding/waiting for coin!
        leoGoal = new THREE.Vector3(leoBrowseX, 0, 0.56); // Leo patrols front glass peeking at shelves!
      } else if (coinPlayer === "Leo") {
        dadGoal = DAD_COIN_PASS;
        leoGoal = LEO_WAIT_COIN; // Leo walks right over to Dad eagerly ready to push coin!
        mayaGoal = new THREE.Vector3(mayaBrowseX, 0, 0.56); // Maya points out prizes behind glass!
      } else {
        dadGoal = DAD_BROWSE;
        mayaGoal = new THREE.Vector3(Math.max(-0.56, mayaBrowseX), 0, 0.57);
        leoGoal = LEO_LEFT_VIEW;
      }
    } else if (playStep === "coin_entering") {
      if (coinPlayer === "Dad") {
        dadGoal = DAD_SLOT_STAND;
        mayaGoal = MAYA_LEFT_VIEW;
        leoGoal = LEO_LEFT_VIEW;
      } else if (coinPlayer === "Maya") {
        dadGoal = DAD_COIN_PASS;
        mayaGoal = MAYA_SLOT_STAND;
        leoGoal = new THREE.Vector3(0.18, 0, 0.58);
      } else {
        dadGoal = DAD_COIN_PASS;
        leoGoal = LEO_SLOT_STAND;
        mayaGoal = new THREE.Vector3(-0.32, 0, 0.58);
      }
    } else if (playStep === "select_item") {
      dadGoal = DAD_KEYPAD_STAND;
      mayaGoal = new THREE.Vector3(THREE.MathUtils.clamp(mayaBrowseX, -0.52, 0.28), 0, 0.56);
      leoGoal = new THREE.Vector3(THREE.MathUtils.clamp(leoBrowseX, -0.52, 0.34), 0, 0.56);
    } else if (playStep === "vending" || phase === "vending") {
      dadGoal = nudgeWarn ? DAD_NUDGE_POS : DAD_KEYPAD_STAND;
      mayaGoal = new THREE.Vector3(THREE.MathUtils.clamp(focusShelfX - 0.16, -0.52, 0.18), 0, 0.55);
      leoGoal = new THREE.Vector3(THREE.MathUtils.clamp(focusShelfX + 0.14, -0.35, 0.36), 0, 0.55);
    } else if (playStep === "in_tray") {
      dadGoal = DAD_COLLECT_STAND;
      mayaGoal = MAYA_TRAY_CROUCH;
      leoGoal = LEO_TRAY_CROUCH;
    } else if (playStep === "collecting") {
      dadGoal = DAD_COLLECT_STAND;
      mayaGoal = MAYA_PLINTH_VIEW;
      leoGoal = LEO_PLINTH_VIEW;
    } else if (phase === "revealed") {
      dadGoal = DAD_PLINTH_VIEW;
      mayaGoal = MAYA_PLINTH_VIEW;
      leoGoal = LEO_PLINTH_VIEW;
    }

    const activeCoinSpot = new THREE.Vector3(0.59, 1.32, 0.39);
    const activeTargetLook =
      playStep === "in_tray"
        ? TRAY_CENTER
        : phase === "revealed" || playStep === "collecting"
          ? PLINTH_CENTER
          : playStep === "vending" && vT > 0.69
            ? TRAY_CENTER
            : playStep === "vending" || playStep === "select_item"
              ? new THREE.Vector3(focusShelfX, focusShelfY, 0.12)
              : playStep === "coin_entering"
                ? activeCoinSpot
                : new THREE.Vector3(focusShelfX, focusShelfY, 0.12);

    const stepActor = (
      group: Group | null,
      pos: THREE.Vector3,
      goal: THREE.Vector3,
      yawRef: { current: number },
      speedRef: MutableRefObject<number>,
      phaseRef: MutableRefObject<number>,
      maxSpeed: number,
      allowGlassAisle: boolean,
      lookPoint: THREE.Vector3,
      extraY: number,
      pitchRef: MutableRefObject<number>,
      headYawRef: MutableRefObject<number>,
      bodyRefHeight: number,
    ) => {
      if (!group) return;
      const steer = steerAroundPlinth(pos, goal, maxSpeed, dt, allowGlassAisle, tmpNext.current);
      const vNow = dt > 0.0005 ? steer.movedDist / dt : 0;
      speedRef.current = THREE.MathUtils.lerp(speedRef.current, vNow, 0.3);
      if (steer.walking) {
        phaseRef.current += dt * (4.5 + vNow * 5.2);
      }

      const desiredBodyYaw = steer.walking
        ? Math.atan2(steer.dirX, steer.dirZ)
        : yawTowardPoint([pos.x, 0, pos.z], [lookPoint.x, 0, lookPoint.z]);
      yawRef.current = lerpAngle(yawRef.current, desiredBodyYaw, 1 - Math.exp(-dt * 9.5));

      group.position.set(pos.x, extraY, pos.z);
      group.rotation.y = yawRef.current;

      // Compute head pitch & subtle curiosity yaw toward target
      const dy = lookPoint.y - bodyRefHeight;
      const horiz = Math.max(0.25, Math.hypot(lookPoint.x - pos.x, lookPoint.z - pos.z));
      pitchRef.current = THREE.MathUtils.clamp(-Math.atan2(dy, horiz), -0.7, 0.55);

      const angleToLook = yawTowardPoint([pos.x, 0, pos.z], [lookPoint.x, 0, lookPoint.z]);
      let relHeadYaw = angleToLook - yawRef.current;
      while (relHeadYaw < -Math.PI) relHeadYaw += Math.PI * 2;
      while (relHeadYaw > Math.PI) relHeadYaw -= Math.PI * 2;
      headYawRef.current = THREE.MathUtils.clamp(relHeadYaw, -0.55, 0.55);
    };

    // Per-character vertical hops, tiptoes, crouches & leans
    let mayaY = 0;
    let leoY = 0;
    let mayaCr = 0;
    let leoCr = 0;
    let dadCr = 0;
    let mayaTip = 0;
    let leoTip = 0;

    if (playStep === "coin_entering" && coinPlayer === "Maya") {
      if (cT < 0.28) {
        mayaCr = 0;
      } else if (cT < 0.42) {
        mayaCr = Math.sin(((cT - 0.28) / 0.14) * Math.PI) * 0.6;
      } else if (cT < 0.86) {
        const jT = (cT - 0.42) / 0.44;
        mayaY = Math.abs(Math.sin(jT * Math.PI * 2)) * 0.19;
      }
    } else if (playStep === "coin_entering" && coinPlayer === "Leo") {
      if (cT >= 0.3 && cT < 0.88) {
        const ramp = Math.min(1, (cT - 0.3) / 0.16);
        leoTip = ramp * (0.9 + Math.sin(t * 20) * 0.08);
      }
    } else if (playStep === "in_tray") {
      mayaCr = 0.55;
      leoCr = 0.65;
      dadCr = 0.28;
    } else if (phase === "revealed") {
      if (rarity === "legendary") {
        mayaY = Math.abs(Math.sin(t * 7.5)) * 0.11;
        leoY = Math.abs(Math.sin(t * 8.2 + 0.8)) * 0.13;
      } else if (rarity === "rare" || rarity === "impossible") {
        mayaY = Math.abs(Math.sin(t * 5.2)) * 0.04;
        leoY = Math.abs(Math.sin(t * 5.8 + 0.6)) * 0.05;
      }
    } else if (playStep === "select_item" || bouncing) {
      mayaY = Math.abs(Math.sin(t * 6.5)) * 0.032;
      leoY = Math.abs(Math.sin(t * 7.2 + 1.1)) * 0.038;
    }

    dadLean.current =
      playStep === "need_coin" && coinPlayer !== "Dad"
        ? 0.24
        : playStep === "in_tray"
          ? 0.3
          : isSuspenseHanging
            ? 0.18
            : nudgeWarn
              ? -0.14
              : 0;
    mayaLean.current =
      playStep === "in_tray"
        ? 0.44
        : isSuspenseHanging
          ? 0.24
          : phase === "vending"
            ? 0.14
            : 0;
    leoLean.current =
      playStep === "in_tray"
        ? 0.48
        : isSuspenseHanging
          ? 0.26
          : playStep === "coin_entering" && coinPlayer === "Leo"
            ? -0.1
            : phase === "vending"
              ? 0.14
              : 0;

    dadCrouch.current = THREE.MathUtils.lerp(dadCrouch.current, dadCr, 0.16);
    mayaCrouch.current = THREE.MathUtils.lerp(mayaCrouch.current, mayaCr, 0.2);
    leoCrouch.current = THREE.MathUtils.lerp(leoCrouch.current, leoCr, 0.2);
    mayaTiptoe.current = THREE.MathUtils.lerp(mayaTiptoe.current, mayaTip, 0.22);
    leoTiptoe.current = THREE.MathUtils.lerp(leoTiptoe.current, leoTip, 0.22);

    const dadLookTarget =
      playStep === "need_coin" && coinPlayer !== "Dad"
        ? coinPlayer === "Maya"
          ? mayaPos.current
          : leoPos.current
        : playStep === "select_item"
          ? KEYPAD_WORLD
          : playStep === "coin_entering" && coinPlayer === "Dad"
            ? COIN_SLOT_WORLD
            : activeTargetLook;

    const mayaLookTarget =
      playStep === "need_coin" && coinPlayer === "Maya"
        ? dadPos.current
        : playStep === "coin_entering" && coinPlayer === "Maya"
          ? COIN_SLOT_WORLD
          : activeTargetLook;

    const leoLookTarget =
      playStep === "need_coin" && coinPlayer === "Leo"
        ? dadPos.current
        : playStep === "coin_entering" && coinPlayer === "Leo"
          ? COIN_SLOT_WORLD
          : activeTargetLook;

    stepActor(
      dadRef.current,
      dadPos.current,
      dadGoal,
      dadYaw,
      dadSpeed,
      dadPhase,
      1.15,
      false,
      dadLookTarget,
      0,
      dadPitch,
      dadHeadYaw,
      1.45,
    );
    stepActor(
      mayaRef.current,
      mayaPos.current,
      mayaGoal,
      mayaYaw,
      mayaSpeed,
      mayaPhase,
      1.45,
      true,
      mayaLookTarget,
      mayaY,
      mayaPitch,
      mayaHeadYaw,
      0.92,
    );
    stepActor(
      leoRef.current,
      leoPos.current,
      leoGoal,
      leoYaw,
      leoSpeed,
      leoPhase,
      1.55,
      true,
      leoLookTarget,
      leoY,
      leoPitch,
      leoHeadYaw,
      0.78,
    );
  });

  const recentlyTappedKey = keyTapAt > 0 && Date.now() - keyTapAt < 450;

  // Dynamic upper-body arm poses
  const dadPose: PoseInput = {
    walkSpeedRef: dadSpeed,
    stridePhaseRef: dadPhase,
    lookPitchRef: dadPitch,
    headYawRef: dadHeadYaw,
    spineLeanRef: dadLean,
    kneeCrouchRef: dadCrouch,
    clapping: phase === "revealed" && (rarity === "rare" || rarity === "legendary"),
    rightArmTarget:
      nudgeWarn
        ? [-1.35, 0.25, -0.3]
        : playStep === "coin_entering" && coinPlayer === "Dad"
          ? [-1.52, -0.05, -0.1]
          : playStep === "need_coin" && coinPlayer !== "Dad"
            ? [-0.92, 0.15, -0.15] // Extending coin warmly toward Maya/Leo!
            : recentlyTappedKey || playStep === "select_item"
              ? [recentlyTappedKey ? -1.42 : -1.08, 0.12, -0.1]
              : playStep === "collecting"
                ? [-0.75, 0.2, -0.1]
                : undefined,
    elbowBendR:
      recentlyTappedKey ? -0.15 : playStep === "need_coin" && coinPlayer !== "Dad" ? -0.35 : undefined,
  };

  const mayaCoinReach = playStep === "coin_entering" && coinPlayer === "Maya";
  const mayaPose: PoseInput = {
    walkSpeedRef: mayaSpeed,
    stridePhaseRef: mayaPhase,
    lookPitchRef: mayaPitch,
    headYawRef: mayaHeadYaw,
    spineLeanRef: mayaLean,
    kneeCrouchRef: mayaCrouch,
    tiptoeRef: mayaTiptoe,
    clapping: phase === "revealed" && rarity !== "impossible",
    leftArmTarget: isSuspenseHanging
      ? [-1.45, 0.38, -0.18] // Hands to cheeks/face in suspense gasp
      : mayaCoinReach
        ? [-2.55, 0.1, 0.35] // High joyful cheer arm
        : playStep === "need_coin" && coinPlayer === "Maya"
          ? [-0.85, -0.1, 0.18]
          : rarity === "impossible" && phase === "revealed"
            ? [-1.25, -0.4, 0.65]
            : undefined,
    rightArmTarget: isSuspenseHanging
      ? [-1.45, -0.38, 0.18]
      : mayaCoinReach
        ? [-2.55, -0.1, -0.2]
        : playStep === "in_tray"
          ? [-1.25, 0.1, -0.12]
          : playStep === "select_item" || playStep === "vending" || playStep === "need_coin"
            ? [-1.15, 0.15, -0.15]
            : rarity === "impossible" && phase === "revealed"
              ? [-1.25, 0.4, -0.65]
              : undefined,
    elbowBendL: isSuspenseHanging ? -1.55 : mayaCoinReach ? -0.25 : undefined,
    elbowBendR: isSuspenseHanging ? -1.55 : mayaCoinReach ? -0.2 : undefined,
  };

  const leoCoinReach = playStep === "coin_entering" && coinPlayer === "Leo";
  const leoPose: PoseInput = {
    walkSpeedRef: leoSpeed,
    stridePhaseRef: leoPhase,
    lookPitchRef: leoPitch,
    headYawRef: leoHeadYaw,
    spineLeanRef: leoLean,
    kneeCrouchRef: leoCrouch,
    tiptoeRef: leoTiptoe,
    clapping: phase === "revealed" && rarity !== "impossible",
    leftArmTarget: isSuspenseHanging
      ? [-1.45, 0.38, -0.18]
      : leoCoinReach
        ? [-2.65, 0.08, 0.28] // Both hands stretched high on tiptoes!
        : playStep === "need_coin" && coinPlayer === "Leo"
          ? [-0.95, -0.15, 0.2]
          : rarity === "impossible" && phase === "revealed"
            ? [-1.35, -0.45, 0.7]
            : undefined,
    rightArmTarget: isSuspenseHanging
      ? [-1.45, -0.38, 0.18]
      : leoCoinReach
        ? [-2.72, -0.05, -0.22]
        : playStep === "in_tray"
          ? [-1.32, 0.08, -0.1]
          : playStep === "select_item" || playStep === "vending" || bouncing
            ? [-1.22, 0.12, -0.15]
            : rarity === "impossible" && phase === "revealed"
              ? [-1.35, 0.45, -0.7]
              : undefined,
    elbowBendL: isSuspenseHanging ? -1.55 : leoCoinReach ? -0.12 : undefined,
    elbowBendR: isSuspenseHanging ? -1.55 : leoCoinReach ? -0.12 : undefined,
  };

  const kidExpression: Expression = isSuspenseHanging
    ? "gasp"
    : phase === "revealed" || playStep === "in_tray" || playStep === "coin_entering" || bouncing
      ? "cheer"
      : "calm";

  const dadExpression: Expression = isSuspenseHanging
    ? "gasp"
    : phase === "revealed" || nudgeWarn
      ? "cheer"
      : "calm";

  return (
    <group ref={rootRef}>
      <group ref={dadRef} position={[HERO_ENTRY_POS.dad.x, 0, HERO_ENTRY_POS.dad.z]}>
        <Body coat="#1e293b" skin="#e4b48f" hair="#241c18" bag={false} pose={dadPose} expression={dadExpression} seed={1} />
      </group>
      <group ref={mayaRef} position={[HERO_ENTRY_POS.maya.x, 0, HERO_ENTRY_POS.maya.z]} scale={0.78}>
        <KidBody shirt="#ff5f8f" skin="#e4b48f" hair="#2a1d17" shoes="#f8fafc" cap={false} pose={mayaPose} expression={kidExpression} seed={11} />
      </group>
      <group ref={leoRef} position={[HERO_ENTRY_POS.leo.x, 0, HERO_ENTRY_POS.leo.z]} scale={0.66}>
        <KidBody shirt="#38bdf8" skin="#e4b48f" hair="#1a1412" shoes="#facc15" cap pose={leoPose} expression={kidExpression} seed={29} />
      </group>
    </group>
  );
}

function MallWalker({ seed, startX, laneZ, dir }: { seed: number; startX: number; laneZ: number; dir: 1 | -1 }) {
  const rig = useRef<Group>(null);
  const xPos = useRef(startX);
  const speedRef = useRef(1.05);
  const phaseRef = useRef(seed);
  const lookPitchRef = useRef(0);
  const headYawRef = useRef(0);
  const look = LOOKS[seed % LOOKS.length] ?? LOOKS[0];

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    xPos.current += dir * 0.85 * dt;
    if (dir === 1 && xPos.current > 4.2) xPos.current = -4.2;
    if (dir === -1 && xPos.current < -4.2) xPos.current = 4.2;
    phaseRef.current += dt * 7.8;

    // Glance toward the glowing Impossible Machine while walking past the middle promenade!
    const nearCenter = Math.abs(xPos.current) < 1.8;
    headYawRef.current = nearCenter ? (dir === 1 ? -0.55 : 0.55) : 0;

    if (rig.current) {
      rig.current.position.set(xPos.current, 0, laneZ);
      rig.current.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }
  });

  const pose: PoseInput = {
    walkSpeedRef: speedRef,
    stridePhaseRef: phaseRef,
    lookPitchRef,
    headYawRef,
  };

  return (
    <group ref={rig} position={[startX, 0, laneZ]} raycast={() => null}>
      <Body coat={look.coat} skin={look.skin} hair={look.hair} bag={seed % 2 === 0} pose={pose} seed={seed} />
    </group>
  );
}

function Person({ figure, index, phase }: { figure: Figure; index: number; phase: Phase }) {
  const rig = useRef<Group>(null);
  const watching = phase === "vending" || phase === "revealed";
  const yaw = yawTowardMachine(figure.position);
  const speedRef = useRef(0);
  const phaseRef = useRef(index);
  const lookPitchRef = useRef(-0.08);
  const leanRef = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 1.3;
    leanRef.current = watching && figure.role === "watch" ? 0.1 : Math.sin(t * 0.7) * 0.025;
    lookPitchRef.current = phase === "revealed" ? 0.14 : -0.1;
    if (!rig.current) return;
    rig.current.position.x = figure.position[0] + Math.sin(t * 0.45) * 0.03;
  });

  const pose: PoseInput = {
    walkSpeedRef: speedRef,
    stridePhaseRef: phaseRef,
    lookPitchRef,
    spineLeanRef: leanRef,
    clapping: phase === "revealed",
  };

  return (
    <group ref={rig} position={figure.position} rotation={[0, yaw, 0]} raycast={() => null}>
      <Body coat={figure.coat} skin={figure.skin} hair={figure.hair} bag={figure.bag} pose={pose} expression={watching ? "cheer" : "calm"} seed={index + 4} />
    </group>
  );
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
  const speedRef = useRef(0);
  const stridePhaseRef = useRef(family.id);
  const lookPitchRef = useRef(-0.08);

  useEffect(() => {
    goal.current.set(...anchor);
  }, [anchor]);

  useLayoutEffect(() => {
    muteRaycast(rig.current);
  }, []);

  useFrame((_, delta) => {
    const group = rig.current;
    if (!group) return;
    const dt = Math.min(0.05, delta);
    const dx = goal.current.x - here.current.x;
    const dz = goal.current.z - here.current.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.03;
    const oldX = here.current.x;
    const oldZ = here.current.z;
    here.current.lerp(goal.current, 1 - Math.exp(-dt * 2.5));
    const vNow = dt > 0.0005 ? Math.hypot(here.current.x - oldX, here.current.z - oldZ) / dt : 0;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, moving ? vNow : 0, 0.3);
    if (moving) stridePhaseRef.current += dt * (4 + vNow * 5);

    const targetYaw = moving ? Math.atan2(dx, dz) : yawTowardMachine([here.current.x, 0, here.current.z]);
    face.current = lerpAngle(face.current, targetYaw, 1 - Math.exp(-dt * 7));
    group.position.set(here.current.x, 0, here.current.z);
    group.rotation.y = face.current;
  });

  const parentPose: PoseInput = { walkSpeedRef: speedRef, stridePhaseRef, lookPitchRef, clapping: phase === "revealed" };
  const kidPose: PoseInput = { walkSpeedRef: speedRef, stridePhaseRef, lookPitchRef, clapping: phase === "vending" || phase === "revealed" };

  return (
    <group ref={rig} position={start}>
      <group position={QUEUE_SPREAD.parent}>
        <Body coat={family.coat} skin={family.skin} hair={family.hair} bag={family.bag} pose={parentPose} seed={family.id} />
      </group>
      {family.kids.map((kid, index) => (
        <group key={`${family.id}-${index}`} position={QUEUE_SPREAD.kids[index]} scale={kid.scale}>
          <KidBody shirt={kid.shirt} skin={kid.skin} hair={kid.hair} shoes={kid.shoes} pose={kidPose} expression={phase === "revealed" ? "cheer" : "calm"} seed={family.id + index} />
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
  const speedRef = useRef(1.1);
  const stridePhaseRef = useRef(family.id);
  const lookPitchRef = useRef(0);

  useLayoutEffect(() => {
    muteRaycast(rig.current);
  }, []);

  useFrame((_, delta) => {
    const group = rig.current;
    if (!group || finished.current) return;
    const dt = Math.min(0.05, delta);
    const dx = goal.current.x - here.current.x;
    const dz = goal.current.z - here.current.z;
    here.current.lerp(goal.current, 1 - Math.exp(-dt * 1.4));
    stridePhaseRef.current += dt * 8.5;
    group.position.set(here.current.x, 0, here.current.z);
    group.rotation.y = Math.atan2(dx, dz);
    if (here.current.distanceTo(goal.current) < 0.15) {
      finished.current = true;
      onDone(family.id);
    }
  });

  const pose: PoseInput = { walkSpeedRef: speedRef, stridePhaseRef, lookPitchRef };

  return (
    <group ref={rig} position={QUEUE_ANCHORS[0]}>
      <group position={QUEUE_SPREAD.parent}>
        <Body coat={family.coat} skin={family.skin} hair={family.hair} bag={family.bag} pose={pose} seed={family.id} />
      </group>
      {family.kids.map((kid, index) => (
        <group key={`${family.id}-leave-${index}`} position={QUEUE_SPREAD.kids[index]} scale={kid.scale}>
          <KidBody shirt={kid.shirt} skin={kid.skin} hair={kid.hair} shoes={kid.shoes} pose={pose} expression="cheer" seed={family.id + index} />
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
  coinStarted = 0,
  coinMs = 1200,
  vendStarted = 0,
  vendMs = 3500,
  isSuspenseHanging = false,
  arrivalSeq = 0,
  focusSlotIndex = null,
  topic = "technology",
  keyTapAt = 0,
  nudgeWarn = false,
  rarity = null,
}: {
  phase: Phase;
  advance: number;
  topicBounce?: number;
  playStep?: PlayStep;
  coinPlayer?: CoinPlayer;
  coinStarted?: number;
  coinMs?: number;
  vendStarted?: number;
  vendMs?: number;
  isSuspenseHanging?: boolean;
  arrivalSeq?: number;
  focusSlotIndex?: number | null;
  topic?: GiftTopic;
  keyTapAt?: number;
  nudgeWarn?: boolean;
  rarity?: Rarity | null;
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
        <ringGeometry args={[1.42, 1.54, 64]} />
        <meshStandardMaterial color="#8d6a3e" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.78, 0.007, 1.75]} raycast={() => null}>
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
        coinStarted={coinStarted}
        coinMs={coinMs}
        vendStarted={vendStarted}
        vendMs={vendMs}
        isSuspenseHanging={isSuspenseHanging}
        topicBounce={topicBounce}
        arrivalSeq={arrivalSeq}
        focusSlotIndex={focusSlotIndex}
        topic={topic}
        keyTapAt={keyTapAt}
        nudgeWarn={nudgeWarn}
        rarity={rarity}
      />
      <MallWalker seed={2} startX={-3.2} laneZ={-1.15} dir={1} />
      <MallWalker seed={5} startX={2.8} laneZ={-1.35} dir={-1} />
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
