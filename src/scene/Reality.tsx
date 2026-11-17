import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { RealityPayload } from "../generate";

export function Reality({ spec, startedAt }: { spec: RealityPayload; startedAt: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    ref.current.rotation.y = elapsed * 0.7;
    ref.current.rotation.x = Math.sin(elapsed * 0.8) * 0.35;
    const scale = 0.85 + Math.sin(elapsed * 1.6) * 0.06;
    ref.current.scale.setScalar(scale);
  });

  return (
    <group>
      <ambientLight intensity={0.7} />
      <pointLight position={[2, 3, 2]} intensity={18} color="#f3e6c8" />
      <pointLight position={[-2, 1, -1]} intensity={10} color={spec.sky} />
      <mesh ref={ref} position={[0, 1.15, 0]}>
        {spec.shape === "torus" ? <torusGeometry args={[0.62, 0.2, 28, 64]} /> : null}
        {spec.shape === "octa" ? <octahedronGeometry args={[0.78, 0]} /> : null}
        {spec.shape === "icosa" ? <icosahedronGeometry args={[0.72, 0]} /> : null}
        {spec.shape === "knot" ? <torusKnotGeometry args={[0.42, 0.13, 90, 12]} /> : null}
        <meshStandardMaterial
          color="#f6f0e4"
          roughness={0.22}
          metalness={0.62}
          emissive="#f0d7a4"
          emissiveIntensity={0.45}
        />
      </mesh>
    </group>
  );
}
