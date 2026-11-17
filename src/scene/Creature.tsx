import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { CreaturePayload } from "../generate";

function Limb({
  index,
  count,
  length,
  color,
}: {
  index: number;
  count: number;
  length: number;
  color: string;
}) {
  const ref = useRef<Group>(null);
  const angle = (index / count) * Math.PI * 2;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 2.2 + index) * 0.35;
  });
  return (
    <group position={[Math.cos(angle) * 0.1, -0.02, Math.sin(angle) * 0.1]} rotation={[0, -angle, 0]}>
      <group ref={ref} rotation={[0.4, 0, 0.8]}>
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.045, length, 7]} />
          <meshStandardMaterial color={color} roughness={0.48} metalness={0.08} />
        </mesh>
      </group>
    </group>
  );
}

function Tail({ color }: { color: string }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.45;
  });
  return (
    <group ref={ref} position={[0, -0.02, -0.12]}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[0, -0.03 * index, -0.07 * (index + 1)]}>
          <sphereGeometry args={[0.055 - index * 0.012, 14, 14]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Creature({ spec }: { spec: CreaturePayload }) {
  const group = useRef<Group>(null);
  const [sx, sy, sz] = spec.body;
  const bodyColor = spec.palette[0];
  const accent = spec.palette[1];

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.y = Math.sin(t * spec.bobSpeed) * 0.045;
    group.current.rotation.y = Math.sin(t * 0.45) * 0.35;
  });

  const blinkScale = (elapsed: number) => ((elapsed % spec.blinkEvery) < 0.12 ? 0.08 : 1);

  return (
    <group ref={group} scale={0.78}>
      <mesh scale={[sx, sy, sz]} castShadow>
        <sphereGeometry args={[1, 28, 22]} />
        <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.12} emissive={accent} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, -sy * 0.15, sz * 0.55]} scale={[sx * 0.55, sy * 0.45, sz * 0.35]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      {Array.from({ length: spec.eyeCount }, (_, index) => {
        const spread = spec.eyeCount === 1 ? 0 : (index - (spec.eyeCount - 1) / 2) * sx * 0.55;
        return (
          <BlinkEye key={index} x={spread} y={sy * 0.28} z={sz * 0.92} blinkScale={blinkScale} />
        );
      })}
      {Array.from({ length: spec.horns }, (_, index) => {
        const side = spec.horns === 1 ? 0 : (index - (spec.horns - 1) / 2) * sx * 0.7;
        return (
          <mesh key={index} position={[side, sy * 0.85, 0]} rotation={[0.2, 0, side * 0.4]}>
            <coneGeometry args={[0.045, 0.16 + (index % 2) * 0.05, 8]} />
            <meshStandardMaterial color={accent} roughness={0.35} metalness={0.2} />
          </mesh>
        );
      })}
      {Array.from({ length: spec.limbCount }, (_, index) => (
        <Limb
          key={index}
          index={index}
          count={spec.limbCount}
          length={0.18 + (index % 3) * 0.05}
          color={accent}
        />
      ))}
      {spec.tail ? <Tail color={accent} /> : null}
    </group>
  );
}

function BlinkEye({
  x,
  y,
  z,
  blinkScale,
}: {
  x: number;
  y: number;
  z: number;
  blinkScale: (elapsed: number) => number;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.scale.y = blinkScale(clock.elapsedTime);
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshStandardMaterial color="#f6f3ec" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.028]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial color="#16130f" />
      </mesh>
    </group>
  );
}
