import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import * as THREE from "three";
import type { RealityPayload } from "../generate";

export function Reality({ spec, startedAt }: { spec: RealityPayload; startedAt: number }) {
  const artifactRef = useRef<Mesh>(null);
  const ringARef = useRef<Group>(null);
  const ringBRef = useRef<Group>(null);
  const pillarsRef = useRef<Group>(null);
  const starsRef = useRef<THREE.Points>(null);

  const [starPos, starCol] = useMemo(() => {
    const count = 320;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const baseA = new THREE.Color(spec.sky);
    const baseB = new THREE.Color("#fde68a");
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.random() * 8.5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.35) * 6.5;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r - 1.5;

      const mix = baseA.clone().lerp(baseB, 0.35 + Math.random() * 0.65);
      col[i * 3] = mix.r;
      col[i * 3 + 1] = mix.g;
      col[i * 3 + 2] = mix.b;
    }
    return [pos, col];
  }, [spec.sky]);

  useFrame(() => {
    const elapsed = Math.max(0, (performance.now() - startedAt) / 1000);
    if (artifactRef.current) {
      artifactRef.current.rotation.y = elapsed * 0.85;
      artifactRef.current.rotation.x = Math.sin(elapsed * 0.9) * 0.38;
      const scale = 0.82 + Math.sin(elapsed * 2.2) * 0.08;
      artifactRef.current.scale.setScalar(scale);
      artifactRef.current.position.y = 1.15 + Math.sin(elapsed * 1.4) * 0.08;
    }
    if (ringARef.current) {
      ringARef.current.rotation.z = elapsed * 0.55;
      ringARef.current.rotation.x = Math.PI * 0.28 + Math.sin(elapsed * 0.7) * 0.18;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.y = -elapsed * 0.7;
      ringBRef.current.rotation.z = Math.cos(elapsed * 0.8) * 0.25;
    }
    if (pillarsRef.current) {
      pillarsRef.current.rotation.y = elapsed * 0.14;
    }
    if (starsRef.current) {
      starsRef.current.rotation.y = -elapsed * 0.06;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.65} />
      <pointLight position={[2.2, 3.2, 2.4]} intensity={24} color="#fef3c7" />
      <pointLight position={[-2.4, 1.2, -1.2]} intensity={14} color={spec.sky} />
      <pointLight position={[0, 1.15, 0]} intensity={8} color="#f5d0fe" distance={5} />

      {/* Drifting dimensional stardust */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[starCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </points>

      {/* Luminous Horizon Grid Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
        <ringGeometry args={[1.1, 7.5, 48, 8]} />
        <meshBasicMaterial color="#f5deb3" wireframe transparent opacity={0.14} />
      </mesh>

      {/* Orbiting Monolith Ring */}
      <group ref={pillarsRef} position={[0, 0.9, 0]}>
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const ang = (idx / 6) * Math.PI * 2;
          return (
            <group key={idx} position={[Math.cos(ang) * 3.1, Math.sin(idx) * 0.35, Math.sin(ang) * 3.1]} rotation={[0.1 * idx, -ang, 0.08]}>
              <mesh>
                <boxGeometry args={[0.16, 1.85, 0.16]} />
                <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.25} emissive={spec.sky} emissiveIntensity={0.45} />
              </mesh>
              <mesh position={[0, 0.98, 0]}>
                <octahedronGeometry args={[0.1, 0]} />
                <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={1.6} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Central Portal Gyro Rings */}
      <group position={[0, 1.15, 0]}>
        <group ref={ringARef}>
          <mesh>
            <torusGeometry args={[1.38, 0.022, 12, 64]} />
            <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={1.3} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
        <group ref={ringBRef}>
          <mesh>
            <torusGeometry args={[1.72, 0.016, 12, 64]} />
            <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={1.4} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      </group>

      {/* Impossible Seeded Portal Core */}
      <mesh ref={artifactRef} position={[0, 1.15, 0]} castShadow>
        {spec.shape === "torus" ? <torusGeometry args={[0.62, 0.2, 28, 64]} /> : null}
        {spec.shape === "octa" ? <octahedronGeometry args={[0.78, 0]} /> : null}
        {spec.shape === "icosa" ? <icosahedronGeometry args={[0.72, 0]} /> : null}
        {spec.shape === "knot" ? <torusKnotGeometry args={[0.42, 0.13, 90, 12]} /> : null}
        <meshPhysicalMaterial
          color="#f8fafc"
          roughness={0.14}
          metalness={0.78}
          clearcoat={0.85}
          emissive="#fde68a"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}
