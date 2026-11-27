import { useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import * as THREE from "three";

type JourneyStage = "auto_trip" | "parking_bay" | "mall_walkthrough";

type DirKeys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

type Props = {
  stage: JourneyStage;
  autoStep: number;
  carProgress: number;
  walkPhase: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  cabinY: number;
  doorsOpen: boolean;
  familyX: number;
};

function makeSignTexture(text: string, bg: string, fg: string, border: string, width = 320, height = 72) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = border;
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, width - 6, height - 6);
    ctx.fillStyle = fg;
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Handles initial camera positioning & smooth stage tracking ONLY until the user grabs OrbitControls.
function CameraRig({
  goalPos,
  goalTarget,
  userMovedRef,
  resetSeq,
  stageKey,
}: {
  goalPos: THREE.Vector3;
  goalTarget: THREE.Vector3;
  userMovedRef: MutableRefObject<boolean>;
  resetSeq: number;
  stageKey: string;
}) {
  const orbitRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastStage = useRef("");
  const lastReset = useRef(resetSeq);

  useEffect(() => {
    if (stageKey !== lastStage.current || resetSeq !== lastReset.current) {
      lastStage.current = stageKey;
      lastReset.current = resetSeq;
      userMovedRef.current = false;
    }
  }, [stageKey, resetSeq, userMovedRef]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(0.05, delta);
    if (!userMovedRef.current) {
      camera.position.lerp(goalPos, 1 - Math.exp(-dt * 5.2));
      if (orbitRef.current) {
        orbitRef.current.target.lerp(goalTarget, 1 - Math.exp(-dt * 5.2));
        orbitRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.08}
      minDistance={1.8}
      maxDistance={15}
      maxPolarAngle={Math.PI / 2.04}
      minPolarAngle={0.2}
      onStart={() => {
        userMovedRef.current = true;
      }}
    />
  );
}

function MiniActor({
  x = 0,
  y = 0,
  z = 0,
  yaw = 0,
  scale = 1,
  shirt,
  coat = "#1e293b",
  hair = "#241c18",
  walking = false,
  jumping = false,
  holdCoin = false,
  cap = false,
}: {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  scale?: number;
  shirt: string;
  coat?: string;
  hair?: string;
  walking?: boolean;
  jumping?: boolean;
  holdCoin?: boolean;
  cap?: boolean;
}) {
  const root = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      const hop = jumping ? Math.abs(Math.sin(t * 7)) * 0.22 : walking ? Math.abs(Math.sin(t * 10)) * 0.04 : 0;
      root.current.position.y = y + hop;
    }
    const swing = walking ? Math.sin(t * 10) * 0.58 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = jumping ? -2.4 : 0.1 - swing * 0.8;
    if (armR.current) armR.current.rotation.x = holdCoin ? -1.9 : jumping ? -2.4 : 0.1 + swing * 0.8;
  });

  return (
    <group ref={root} position={[x, y, z]} rotation={[0, yaw, 0]} scale={scale}>
      <group ref={legL} position={[-0.08, 0.48, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.34, 4, 8]} />
          <meshStandardMaterial color={coat} roughness={0.8} />
        </mesh>
      </group>
      <group ref={legR} position={[0.08, 0.48, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.34, 4, 8]} />
          <meshStandardMaterial color={coat} roughness={0.8} />
        </mesh>
      </group>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.34, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.55} />
      </mesh>
      <group ref={armL} position={[-0.2, 0.96, 0]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.042, 0.26, 3, 6]} />
          <meshStandardMaterial color={shirt} roughness={0.55} />
        </mesh>
      </group>
      <group ref={armR} position={[0.2, 0.96, 0]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.042, 0.26, 3, 6]} />
          <meshStandardMaterial color={shirt} roughness={0.55} />
        </mesh>
        {holdCoin ? (
          <mesh position={[0, -0.34, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.018, 18]} />
            <meshStandardMaterial color="#facc15" emissive="#fbbf24" emissiveIntensity={1.0} metalness={0.95} roughness={0.15} />
          </mesh>
        ) : null}
      </group>
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.135, 14, 12]} />
        <meshStandardMaterial color="#e8ba94" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.27, -0.01]}>
        <sphereGeometry args={[0.138, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={hair} roughness={0.7} />
      </mesh>
      {cap ? (
        <mesh position={[0, 1.32, 0.08]}>
          <boxGeometry args={[0.15, 0.03, 0.14]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.45} />
        </mesh>
      ) : null}
    </group>
  );
}

function Sedan3D({
  x = 0,
  y = 0,
  z = 0,
  yaw = 0,
  bodyColor = "#0284c7",
  headlights = true,
  drivingSpeed = 0,
  showPassengers = true,
}: {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  bodyColor?: string;
  headlights?: boolean;
  drivingSpeed?: number;
  showPassengers?: boolean;
}) {
  const wheelFL = useRef<Group>(null);
  const wheelFR = useRef<Group>(null);
  const wheelRL = useRef<Group>(null);
  const wheelRR = useRef<Group>(null);
  const carBody = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(0.05, delta);
    if (drivingSpeed !== 0) {
      [wheelFL, wheelFR, wheelRL, wheelRR].forEach((w) => {
        if (w.current) w.current.rotation.z -= drivingSpeed * dt * 6;
      });
      if (carBody.current) {
        carBody.current.position.y = Math.sin(clock.elapsedTime * 18) * 0.01;
      }
    }
  });

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <group ref={carBody}>
        <RoundedBox args={[2.35, 0.48, 1.08]} radius={0.08} smoothness={2} position={[0, 0.42, 0]} castShadow>
          <meshPhysicalMaterial color={bodyColor} metalness={0.65} roughness={0.25} clearcoat={0.75} />
        </RoundedBox>
        <mesh position={[0, 0.34, 0.545]}>
          <boxGeometry args={[2.0, 0.035, 0.012]} />
          <meshStandardMaterial color="#38bdf8" emissive="#00f5ff" emissiveIntensity={1.6} />
        </mesh>
        <mesh position={[0, 0.34, -0.545]}>
          <boxGeometry args={[2.0, 0.035, 0.012]} />
          <meshStandardMaterial color="#38bdf8" emissive="#00f5ff" emissiveIntensity={1.6} />
        </mesh>
        <RoundedBox args={[1.25, 0.42, 0.94]} radius={0.09} smoothness={2} position={[-0.08, 0.78, 0]}>
          <meshPhysicalMaterial color="#7dd3fc" transparent opacity={0.55} metalness={0.2} roughness={0.1} />
        </RoundedBox>
        {showPassengers ? (
          <group position={[-0.08, 0.76, 0]}>
            <mesh position={[0.25, 0.02, 0.16]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
            <mesh position={[-0.22, -0.02, 0.18]}>
              <sphereGeometry args={[0.09, 10, 10]} />
              <meshStandardMaterial color="#ff5f8f" />
            </mesh>
            <mesh position={[-0.22, -0.04, -0.18]}>
              <sphereGeometry args={[0.085, 10, 10]} />
              <meshStandardMaterial color="#38bdf8" />
            </mesh>
          </group>
        ) : null}
        <mesh position={[1.18, 0.42, 0.34]}>
          <boxGeometry args={[0.04, 0.1, 0.18]} />
          <meshStandardMaterial color="#e0f2fe" emissive={headlights ? "#00f5ff" : "#334155"} emissiveIntensity={headlights ? 2.6 : 0} />
        </mesh>
        <mesh position={[1.18, 0.42, -0.34]}>
          <boxGeometry args={[0.04, 0.1, 0.18]} />
          <meshStandardMaterial color="#e0f2fe" emissive={headlights ? "#00f5ff" : "#334155"} emissiveIntensity={headlights ? 2.6 : 0} />
        </mesh>
        {headlights ? (
          <>
            <mesh position={[2.6, 0.32, 0.34]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.52, 2.8, 16, 1, true]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[2.6, 0.32, -0.34]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.52, 2.8, 16, 1, true]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>
          </>
        ) : null}
      </group>
      {[
        { ref: wheelFL, pos: [0.74, 0.24, 0.52] as [number, number, number] },
        { ref: wheelFR, pos: [0.74, 0.24, -0.52] as [number, number, number] },
        { ref: wheelRL, pos: [-0.74, 0.24, 0.52] as [number, number, number] },
        { ref: wheelRR, pos: [-0.74, 0.24, -0.52] as [number, number, number] },
      ].map((w, idx) => (
        <group key={idx} ref={w.ref} position={w.pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.14, 20]} />
            <meshStandardMaterial color="#111827" roughness={0.7} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.15, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive="#00f5ff" emissiveIntensity={0.8} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HomeScene({
  autoStep,
  keysRef,
  goalPos,
  goalTarget,
}: {
  autoStep: number;
  keysRef: MutableRefObject<DirKeys>;
  goalPos: THREE.Vector3;
  goalTarget: THREE.Vector3;
}) {
  const walkersRef = useRef<Group>(null);
  const carDriveRef = useRef<Group>(null);
  const manualOffset = useRef({ x: 0, z: 0 });
  const [userWalking, setUserWalking] = useState(false);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const k = keysRef.current;
    const mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const activeWalk = mx !== 0 || mz !== 0;
    if (activeWalk !== userWalking) setUserWalking(activeWalk);

    if (activeWalk) {
      manualOffset.current.x = THREE.MathUtils.clamp(manualOffset.current.x + mx * 2.2 * dt, -2.5, 4.0);
      manualOffset.current.z = THREE.MathUtils.clamp(manualOffset.current.z + mz * 2.2 * dt, -1.8, 2.2);
    }

    if (walkersRef.current) {
      const targetWalkX = (autoStep === 1 ? 2.2 : 0) + manualOffset.current.x;
      walkersRef.current.position.x = THREE.MathUtils.lerp(walkersRef.current.position.x, targetWalkX, 1 - Math.exp(-dt * 4));
      walkersRef.current.position.z = THREE.MathUtils.lerp(walkersRef.current.position.z, manualOffset.current.z, 1 - Math.exp(-dt * 4));
    }
    if (carDriveRef.current) {
      const targetCarX = autoStep >= 3 ? 4.4 : 2.1;
      carDriveRef.current.position.x = THREE.MathUtils.lerp(carDriveRef.current.position.x, targetCarX, 1 - Math.exp(-dt * 2.0));
    }

    goalPos.set(autoStep >= 2 ? 2.6 : 0.4, 2.3, 6.2);
    goalTarget.set(autoStep >= 3 ? 2.4 : 0.4, 0.9, 0.4);
  });

  return (
    <group>
      <hemisphereLight args={["#dbeafe", "#0f172a", 1.1]} />
      <pointLight position={[-2.2, 2.8, 2.2]} intensity={18} color="#fde047" />
      <directionalLight position={[4, 6, 4]} intensity={1.8} color="#bae6fd" castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 14]} />
        <meshStandardMaterial color="#0d3b26" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.2, 0.01, 1.2]} receiveShadow>
        <planeGeometry args={[6.8, 2.8]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      <group position={[-2.4, 0, -0.6]}>
        <RoundedBox args={[3.4, 2.2, 2.4]} radius={0.05} smoothness={2} position={[0, 1.1, 0]} castShadow>
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, 2.65, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.7, 1.3, 4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.75} />
        </mesh>
        {[-0.95, 0.95].map((wx) => (
          <mesh key={wx} position={[wx, 1.3, 1.21]}>
            <planeGeometry args={[0.72, 0.64]} />
            <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={1.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.78, 1.21]}>
          <planeGeometry args={[0.68, 1.45]} />
          <meshStandardMaterial color="#fef9c3" emissive="#facc15" emissiveIntensity={2.0} />
        </mesh>
      </group>

      {autoStep < 2 ? (
        <group ref={walkersRef}>
          <MiniActor x={-1.8} z={1.15} yaw={Math.PI / 2} shirt="#3b82f6" walking={autoStep === 1 || userWalking} />
          <MiniActor x={-2.1} z={1.45} yaw={Math.PI / 2} scale={0.78} shirt="#ff5f8f" walking={autoStep === 1 || userWalking} holdCoin />
          <MiniActor x={-2.4} z={1.25} yaw={Math.PI / 2} scale={0.66} shirt="#38bdf8" walking={autoStep === 1 || userWalking} cap />
        </group>
      ) : null}

      <group ref={carDriveRef} position={[2.1, 0, 0]}>
        <Sedan3D x={0} y={0} z={1.2} bodyColor="#0284c7" headlights={autoStep >= 2} drivingSpeed={autoStep >= 3 ? 2.5 : 0} showPassengers={autoStep >= 2} />
      </group>
    </group>
  );
}

function HighwayScene({
  carProgress,
  keysRef,
  goalPos,
  goalTarget,
}: {
  carProgress: number;
  keysRef: MutableRefObject<DirKeys>;
  goalPos: THREE.Vector3;
  goalTarget: THREE.Vector3;
}) {
  const stripesRef = useRef<Group>(null);
  const polesRef = useRef<Group>(null);
  const steerCarRef = useRef<Group>(null);
  const laneZ = useRef(1.1);
  const speedBoost = useRef(1);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const k = keysRef.current;
    const steer = (k.down || k.right ? 1 : 0) - (k.up || k.left ? 1 : 0);
    laneZ.current = THREE.MathUtils.clamp(laneZ.current + steer * 3.2 * dt, -2.0, 2.0);
    speedBoost.current = k.right || k.up ? 1.55 : k.left ? 0.7 : 1;

    if (steerCarRef.current) {
      steerCarRef.current.position.z = THREE.MathUtils.lerp(steerCarRef.current.position.z, laneZ.current, 0.2);
      steerCarRef.current.rotation.y = THREE.MathUtils.lerp(steerCarRef.current.rotation.y, -steer * 0.12, 0.16);
    }
    if (stripesRef.current) stripesRef.current.position.x = (stripesRef.current.position.x - dt * 16 * speedBoost.current) % 4;
    if (polesRef.current) polesRef.current.position.x = (polesRef.current.position.x - dt * 18 * speedBoost.current) % 8;

    goalPos.set(-4.2, 2.2, 4.4);
    goalTarget.set(3.5, 1.1, 0);
  });

  const mallX = THREE.MathUtils.lerp(22, 8.5, carProgress);

  return (
    <group>
      <hemisphereLight args={["#bae6fd", "#0f172a", 1.0]} />
      <pointLight position={[2, 4, 3]} intensity={14} color="#38bdf8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 7]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.2} />
      </mesh>
      <group ref={stripesRef}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-12 + i * 4, 0.02, 0]}>
            <planeGeometry args={[1.8, 0.16]} />
            <meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>
      <group ref={polesRef}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} position={[-12 + i * 8, 0, -3.2]}>
            <mesh position={[0, 2.0, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 4.0, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} />
            </mesh>
            <mesh position={[0, 3.9, 0.5]}>
              <boxGeometry args={[0.25, 0.08, 0.7]} />
              <meshStandardMaterial color="#7dd3fc" emissive="#00f5ff" emissiveIntensity={2.5} />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[mallX, 0, -2.2]}>
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[3.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#6d28d9" emissive="#bf5af2" emissiveIntensity={1.1} metalness={0.5} roughness={0.2} wireframe />
        </mesh>
        <RoundedBox args={[7.4, 2.2, 4.2]} radius={0.1} position={[0, 1.1, 0]}>
          <meshStandardMaterial color="#1e1b4b" emissive="#00f5ff" emissiveIntensity={0.4} />
        </RoundedBox>
      </group>

      <group ref={steerCarRef} position={[-1.4, 0, 1.1]}>
        <Sedan3D x={0} y={0} z={0} bodyColor="#0284c7" headlights drivingSpeed={4.5} showPassengers />
      </group>
    </group>
  );
}

function ParkingBayScene({
  keysRef,
  goalPos,
  goalTarget,
}: {
  keysRef: MutableRefObject<DirKeys>;
  goalPos: THREE.Vector3;
  goalTarget: THREE.Vector3;
}) {
  const baySign = useMemo(() => makeSignTexture("BAY P2-23 · PARK", "#064e3b", "#6ee7b7", "#10b981"), []);
  const lobbySign = useMemo(() => makeSignTexture("MALL LIFT LOBBY", "#0f172a", "#38bdf8", "#00f5ff"), []);

  useEffect(() => () => {
    baySign.dispose();
    lobbySign.dispose();
  }, [baySign, lobbySign]);

  // Interactive drivable EV in Bay P2-23!
  const carRef = useRef<Group>(null);
  const carPose = useRef({ x: 0.1, z: 0.2, yaw: Math.PI / 2, wheelSpeed: 0 });
  const [inBay, setInBay] = useState(true);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const k = keysRef.current;
    const throttle = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    const turn = (k.left ? 1 : 0) - (k.right ? 1 : 0);

    if (throttle !== 0 || turn !== 0) {
      if (throttle !== 0) {
        carPose.current.yaw += turn * throttle * 2.1 * dt;
      } else {
        // Allow tank/curb nudge turning too so directional controls always visibly respond
        carPose.current.yaw += turn * 1.6 * dt;
      }
      // Sedan3D front points along +X when yaw=0; +yaw rotates CCW around Y, so forward is (cos(yaw), -sin(yaw))
      const fx = Math.cos(carPose.current.yaw);
      const fz = -Math.sin(carPose.current.yaw);
      carPose.current.x = THREE.MathUtils.clamp(carPose.current.x + fx * throttle * 3.4 * dt, -4.6, 3.8);
      carPose.current.z = THREE.MathUtils.clamp(carPose.current.z + fz * throttle * 3.4 * dt, -1.6, 3.2);
    }

    if (carRef.current) {
      carRef.current.position.set(carPose.current.x, 0, carPose.current.z);
      carRef.current.rotation.y = carPose.current.yaw;
    }

    const aligned = Math.abs(carPose.current.x - 0.1) < 1.1 && Math.abs(carPose.current.z - (-0.4)) < 1.4;
    if (aligned !== inBay) setInBay(aligned);

    goalPos.set(0.4, 3.1, 5.9);
    goalTarget.set(0.4, 0.7, -0.3);
  });

  return (
    <group>
      <hemisphereLight args={["#e0f2fe", "#1e293b", 1.25]} />
      <directionalLight position={[1, 6, 4]} intensity={1.8} color="#f8fafc" />
      <pointLight position={[0.1, 3.0, 1.2]} intensity={22} color="#34d399" />
      <pointLight position={[4.5, 2.4, 0.6]} intensity={24} color="#38bdf8" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.75} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.9, -2.5]}>
        <boxGeometry args={[16, 3.8, 0.3]} />
        <meshStandardMaterial color="#273449" roughness={0.85} />
      </mesh>
      {[-2.8, 0.1, 3.2].map((lx) => (
        <mesh key={lx} position={[lx, 3.35, -0.4]}>
          <boxGeometry args={[1.6, 0.08, 0.18]} />
          <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={2.2} />
        </mesh>
      ))}

      <group position={[-2.9, 0, -0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <planeGeometry args={[2.3, 3.3]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 2.7, -1.2]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.5} />
        </mesh>
        <Sedan3D x={0} z={0} yaw={Math.PI / 2} bodyColor="#64748b" headlights={false} showPassengers={false} />
      </group>

      {/* BAY P2-23 */}
      <group position={[0.1, 0, -0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshStandardMaterial color={inBay ? "#065f46" : "#1e3a5f"} emissive={inBay ? "#10b981" : "#38bdf8"} emissiveIntensity={0.65} />
        </mesh>
        <mesh position={[0, 2.55, -1.7]}>
          <planeGeometry args={[1.9, 0.44]} />
          <meshBasicMaterial map={baySign} />
        </mesh>
        <mesh position={[0, 2.9, -1.2]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={inBay ? "#00ff88" : "#fbbf24"} emissive={inBay ? "#00ff88" : "#fbbf24"} emissiveIntensity={3.2} />
        </mesh>
      </group>

      {/* Player Steerable Family EV Car */}
      <group ref={carRef} position={[0.1, 0, 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <Sedan3D x={0} y={0} z={0} yaw={0} bodyColor="#0ea5e9" headlights showPassengers />
      </group>

      <group position={[2.8, 0, -0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <planeGeometry args={[2.2, 3.3]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 2.7, -1.2]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.5} />
        </mesh>
        <Sedan3D x={0} z={0} yaw={Math.PI / 2} bodyColor="#475569" headlights={false} showPassengers={false} />
      </group>

      <group position={[5.0, 1.35, -0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <RoundedBox args={[2.6, 2.7, 0.2]} radius={0.05}>
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.48} emissive="#0ea5e9" emissiveIntensity={1.1} />
        </RoundedBox>
        <mesh position={[0, 1.55, 0.14]}>
          <planeGeometry args={[2.4, 0.5]} />
          <meshBasicMaterial map={lobbySign} />
        </mesh>
      </group>
    </group>
  );
}

function MallAtriumScene({
  walkPhase,
  cabinY,
  doorsOpen,
  familyX,
  keysRef,
  goalPos,
  goalTarget,
}: {
  walkPhase: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  cabinY: number;
  doorsOpen: boolean;
  familyX: number;
  keysRef: MutableRefObject<DirKeys>;
  goalPos: THREE.Vector3;
  goalTarget: THREE.Vector3;
}) {
  const arcadeSign = useMemo(() => makeSignTexture("LEVEL 2 PLAY AREA", "#2e1065", "#f8fafc", "#00f5ff"), []);
  const liftSign = useMemo(() => makeSignTexture("GLASS ELEVATOR", "#020617", "#34d399", "#00ff88"), []);

  useEffect(() => () => {
    arcadeSign.dispose();
    liftSign.dispose();
  }, [arcadeSign, liftSign]);

  const baseFamilyX = ((familyX - 80) / (660 - 80)) * 7.2 - 3.8;
  const worldCabinY = ((285 - cabinY) / (285 - 45)) * 3.4;
  const worldFamilyY = walkPhase <= 1 ? 0 : walkPhase === 2 || walkPhase === 3 ? worldCabinY : 3.4;
  const autoWalking = walkPhase === 0 || walkPhase === 1 || walkPhase === 4 || walkPhase === 5;
  const arrivingMachine = walkPhase >= 5;

  const doorLRef = useRef<THREE.Mesh>(null);
  const doorRRef = useRef<THREE.Mesh>(null);
  const familyGroupRef = useRef<Group>(null);
  const manualOffset = useRef({ x: 0, z: 0, yaw: Math.PI / 2 });
  const [manualWalking, setManualWalking] = useState(false);
  const [walkFacing, setWalkFacing] = useState(Math.PI / 2);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const doorOffset = doorsOpen ? 0.68 : 0.0;
    if (doorLRef.current) doorLRef.current.position.x = THREE.MathUtils.lerp(doorLRef.current.position.x, -0.34 - doorOffset, 0.16);
    if (doorRRef.current) doorRRef.current.position.x = THREE.MathUtils.lerp(doorRRef.current.position.x, 0.34 + doorOffset, 0.16);

    const k = keysRef.current;
    const mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const steering = mx !== 0 || mz !== 0;
    if (steering !== manualWalking) setManualWalking(steering);

    if (steering && walkPhase !== 2 && walkPhase !== 3) {
      manualOffset.current.x = THREE.MathUtils.clamp(manualOffset.current.x + mx * 2.4 * dt, -3.5, 3.5);
      manualOffset.current.z = THREE.MathUtils.clamp(manualOffset.current.z + mz * 2.0 * dt, -1.0, 1.3);
      const nextYaw = Math.atan2(mx, mz);
      if (Math.abs(nextYaw - manualOffset.current.yaw) > 0.01) {
        manualOffset.current.yaw = nextYaw;
        setWalkFacing(nextYaw);
      }
    }

    const totalX = THREE.MathUtils.clamp(baseFamilyX + manualOffset.current.x, -4.2, 4.2);
    const totalZ = (walkPhase <= 3 ? 0.05 : -0.1) + manualOffset.current.z;
    if (familyGroupRef.current) {
      familyGroupRef.current.position.set(totalX, worldFamilyY + 0.09, totalZ);
    }

    const targetCamX = THREE.MathUtils.clamp(totalX * 0.65, -2.5, 2.5);
    const targetCamY = worldFamilyY + 2.05;
    const targetCamZ = walkPhase === 3 ? 6.5 : walkPhase >= 5 ? 5.2 : 5.9;
    goalPos.set(targetCamX, targetCamY, targetCamZ);
    goalTarget.set(totalX * 0.85, worldFamilyY + 0.95, totalZ);
  });

  const facingYaw = manualWalking
    ? walkFacing
    : autoWalking
      ? Math.PI / 2
      : walkPhase === 2 || walkPhase === 3
        ? 0
        : Math.PI / 2;

  const walkingNow = autoWalking || manualWalking;

  return (
    <group>
      <hemisphereLight args={["#e0f2fe", "#0f172a", 1.2]} />
      <directionalLight position={[2, 7, 5]} intensity={1.6} color="#ffffff" />
      <pointLight position={[0, 4.8, 3.5]} intensity={36} color="#e0f2fe" />
      <pointLight position={[3.6, 4.6, 1.5]} intensity={28} color="#00f5ff" />
      <pointLight position={[-3.2, 2.6, 1.5]} intensity={22} color="#f472b6" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 7]} />
        <meshStandardMaterial color="#1e293b" metalness={0.35} roughness={0.25} />
      </mesh>
      <group position={[-4.5, 1.1, -0.6]}>
        <mesh>
          <boxGeometry args={[0.2, 2.2, 1.8]} />
          <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.42} emissive="#0ea5e9" emissiveIntensity={0.85} />
        </mesh>
      </group>

      <group position={[-2.9, 1.7, -0.4]}>
        <RoundedBox args={[4.2, 0.16, 2.6]} radius={0.03}>
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </RoundedBox>
        {[-1.3, 0, 1.3].map((sx, idx) => (
          <mesh key={sx} position={[sx, 0.85, -0.8]}>
            <boxGeometry args={[1.1, 1.4, 0.4]} />
            <meshStandardMaterial
              color="#1e293b"
              emissive={idx === 0 ? "#38bdf8" : idx === 1 ? "#f472b6" : "#facc15"}
              emissiveIntensity={0.9}
            />
          </mesh>
        ))}
      </group>

      <group position={[2.8, 3.4, -0.2]}>
        <RoundedBox args={[4.2, 0.18, 2.8]} radius={0.03} receiveShadow>
          <meshStandardMaterial color="#2e1065" metalness={0.45} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 1.9, -0.8]}>
          <planeGeometry args={[2.8, 0.5]} />
          <meshBasicMaterial map={arcadeSign} />
        </mesh>
        <mesh position={[0, 0.45, 1.35]}>
          <boxGeometry args={[4.1, 0.72, 0.04]} />
          <meshPhysicalMaterial color="#f43f5e" transparent opacity={0.32} />
        </mesh>
        <RoundedBox args={[0.55, 1.2, 0.55]} radius={0.04} position={[-0.7, 0.68, -0.7]}>
          <meshStandardMaterial color="#312e81" emissive="#818cf8" emissiveIntensity={0.7} />
        </RoundedBox>
        <group position={[1.15, 0.98, -0.35]} rotation={[0, -0.42, 0]}>
          <RoundedBox args={[0.92, 1.65, 0.54]} radius={0.04} castShadow>
            <meshPhysicalMaterial color="#17253b" metalness={0.85} roughness={0.22} />
          </RoundedBox>
          <mesh position={[0, 0.15, 0.28]}>
            <planeGeometry args={[0.68, 0.96]} />
            <meshStandardMaterial color="#0284c7" emissive="#00f5ff" emissiveIntensity={1.1} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.74, 0.28]}>
            <planeGeometry args={[0.76, 0.14]} />
            <meshStandardMaterial color="#bf5af2" emissive="#bf5af2" emissiveIntensity={1.6} />
          </mesh>
        </group>
      </group>

      <group position={[0, 0, -0.1]}>
        {[-0.85, 0.85].map((cx) => (
          <group key={cx}>
            <mesh position={[cx, 2.6, 0.65]}>
              <boxGeometry args={[0.08, 5.2, 0.08]} />
              <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[cx, 2.6, -0.65]}>
              <boxGeometry args={[0.08, 5.2, 0.08]} />
              <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 5.2, 0.65]}>
          <planeGeometry args={[1.6, 0.36]} />
          <meshBasicMaterial map={liftSign} />
        </mesh>
        <mesh position={[0, 2.6, -0.65]}>
          <planeGeometry args={[1.65, 5.2]} />
          <meshPhysicalMaterial color="#00f5ff" transparent opacity={0.18} />
        </mesh>
        <mesh position={[-0.25, 2.7 + worldCabinY * 0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.015, Math.max(0.2, 5.1 - worldCabinY), 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
        <mesh position={[0.25, 2.7 + worldCabinY * 0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.015, Math.max(0.2, 5.1 - worldCabinY), 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>

        <group position={[0, worldCabinY, 0]}>
          <RoundedBox args={[1.48, 0.1, 1.18]} radius={0.02} position={[0, 0.04, 0]}>
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </RoundedBox>
          <RoundedBox args={[1.48, 0.1, 1.18]} radius={0.02} position={[0, 1.68, 0]}>
            <meshStandardMaterial color="#1e293b" emissive="#00ff88" emissiveIntensity={0.65} />
          </RoundedBox>
          <pointLight position={[0, 1.45, 0]} intensity={12} distance={3} color="#bae6fd" />
          <mesh ref={doorLRef} position={[-0.34, 0.86, 0.58]}>
            <boxGeometry args={[0.66, 1.54, 0.03]} />
            <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.46} metalness={0.3} />
          </mesh>
          <mesh ref={doorRRef} position={[0.34, 0.86, 0.58]}>
            <boxGeometry args={[0.66, 1.54, 0.03]} />
            <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.46} metalness={0.3} />
          </mesh>
        </group>
      </group>

      <group ref={familyGroupRef} position={[baseFamilyX, worldFamilyY + 0.09, walkPhase <= 3 ? 0.05 : -0.1]}>
        <MiniActor x={-0.36} yaw={facingYaw} shirt="#3b82f6" walking={walkingNow} />
        <MiniActor x={0} z={0.14} yaw={facingYaw} scale={0.78} shirt="#ff5f8f" walking={walkingNow} holdCoin jumping={arrivingMachine && !manualWalking} />
        <MiniActor x={0.34} z={0.04} yaw={facingYaw} scale={0.66} shirt="#38bdf8" walking={walkingNow} jumping={arrivingMachine && !manualWalking} cap />
      </group>
    </group>
  );
}

export function Journey3D(props: Props) {
  const { stage, autoStep, carProgress, walkPhase, cabinY, doorsOpen, familyX } = props;
  const keysRef = useRef<DirKeys>({ up: false, down: false, left: false, right: false });
  const userMovedRef = useRef(false);
  const [resetSeq, setResetSeq] = useState(0);
  const goalPos = useMemo(() => new THREE.Vector3(0.4, 3.1, 5.9), []);
  const goalTarget = useMemo(() => new THREE.Vector3(0.4, 0.7, -0.3), []);

  useEffect(() => {
    const setDir = (key: string, pressed: boolean) => {
      const k = key.toLowerCase();
      if (k === "arrowup" || k === "w") keysRef.current.up = pressed;
      else if (k === "arrowdown" || k === "s") keysRef.current.down = pressed;
      else if (k === "arrowleft" || k === "a") keysRef.current.left = pressed;
      else if (k === "arrowright" || k === "d") keysRef.current.right = pressed;
    };

    const onDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      setDir(e.key, true);
    };
    const onUp = (e: KeyboardEvent) => setDir(e.key, false);
    const clearAll = () => {
      keysRef.current = { up: false, down: false, left: false, right: false };
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clearAll);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clearAll);
    };
  }, []);

  const holdPad = (dir: keyof DirKeys, pressed: boolean) => {
    keysRef.current[dir] = pressed;
  };

  return (
    <div className="journey-3d-viewport">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0.4, 2.8, 6.0], fov: 48 }}>
        <color attach="background" args={["#071126"]} />
        <fog attach="fog" args={["#071126", 14, 36]} />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={3.2} position={[0, 5, 3]} scale={[9, 5, 1]} color="#e0f2fe" />
          <Lightformer form="rect" intensity={2.0} position={[5, 2, -2]} scale={[5, 4, 1]} color="#bf5af2" />
        </Environment>

        <CameraRig
          goalPos={goalPos}
          goalTarget={goalTarget}
          userMovedRef={userMovedRef}
          resetSeq={resetSeq}
          stageKey={`${stage}-${autoStep < 4 ? "home" : "road"}`}
        />

        {stage === "auto_trip" && autoStep < 4 ? (
          <HomeScene autoStep={autoStep} keysRef={keysRef} goalPos={goalPos} goalTarget={goalTarget} />
        ) : null}
        {stage === "auto_trip" && autoStep >= 4 ? (
          <HighwayScene carProgress={carProgress} keysRef={keysRef} goalPos={goalPos} goalTarget={goalTarget} />
        ) : null}
        {stage === "parking_bay" ? (
          <ParkingBayScene keysRef={keysRef} goalPos={goalPos} goalTarget={goalTarget} />
        ) : null}
        {stage === "mall_walkthrough" ? (
          <MallAtriumScene
            walkPhase={walkPhase}
            cabinY={cabinY}
            doorsOpen={doorsOpen}
            familyX={familyX}
            keysRef={keysRef}
            goalPos={goalPos}
            goalTarget={goalTarget}
          />
        ) : null}
      </Canvas>

      {/* Interactive Steering D-Pad + Camera Controls */}
      <div className="journey-3d-hud-top">
        <span className="journey-3d-hint">🖱 Drag: Rotate · Scroll: Zoom · WASD / Arrows: Move</span>
        <button
          type="button"
          className="journey-reset-cam"
          onClick={() => {
            userMovedRef.current = false;
            setResetSeq((s) => s + 1);
          }}
        >
          ⟲ Reset View
        </button>
      </div>

      <div className="dpad-overlay" aria-label="Directional movement controls">
        <button
          type="button"
          className="dpad-btn up"
          onPointerDown={() => holdPad("up", true)}
          onPointerUp={() => holdPad("up", false)}
          onPointerLeave={() => holdPad("up", false)}
          title="Move Forward / Up (W or ↑)"
        >
          ▲
        </button>
        <div className="dpad-mid">
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => holdPad("left", true)}
            onPointerUp={() => holdPad("left", false)}
            onPointerLeave={() => holdPad("left", false)}
            title="Move Left (A or ←)"
          >
            ◀
          </button>
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => holdPad("down", true)}
            onPointerUp={() => holdPad("down", false)}
            onPointerLeave={() => holdPad("down", false)}
            title="Move Back / Down (S or ↓)"
          >
            ▼
          </button>
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => holdPad("right", true)}
            onPointerUp={() => holdPad("right", false)}
            onPointerLeave={() => holdPad("right", false)}
            title="Move Right (D or →)"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
