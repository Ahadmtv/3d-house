"use client";

import { Sparkles } from "@react-three/drei";

type V3 = [number, number, number];

const TREES: [number, number, number][] = [
  [-11, 4, 1.1], [-13, -6, 1.4], [12, -2, 1.2], [14, 9, 1.5], [-8, -14, 1.3],
  [9, -15, 1.1], [-16, 12, 1.6], [17, -12, 1.4], [-6, 17, 1.2], [8, 18, 1],
];

const BUSHES: [number, number, number][] = [
  [-5.6, 7.9, 0.8], [5.6, 7.9, 0.8], [-5.9, 3, 0.6], [5.9, -2, 0.7], [-5.9, -5, 0.7], [5.9, -8, 0.6],
];

function Tree({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, -0.53, z]}>
      <mesh position={[0, 0.8 * s, 0]} castShadow>
        <cylinderGeometry args={[0.18 * s, 0.26 * s, 1.6 * s, 8]} />
        <meshStandardMaterial color="#7a5a40" roughness={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, (2.2 + i * 1.05) * s, 0]} castShadow>
          <coneGeometry args={[(1.9 - i * 0.45) * s, 2.5 * s, 9]} />
          <meshStandardMaterial color={i % 2 ? "#6a8a5f" : "#587a58"} roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Lantern({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.3, 8]} />
        <meshStandardMaterial color="#3d4a43" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshStandardMaterial color="#ffd48a" emissive="#ffb85c" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0, 1.45, 0]} color="#ffc778" intensity={7} distance={7} decay={2} />
    </group>
  );
}

function Plant({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.22, 0.56, 16]} />
        <meshStandardMaterial color="#b98a5e" roughness={0.8} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.2, 1.05, Math.sin(a) * 0.2]}
            rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}
            scale={[0.2, 0.75, 0.07]}
            castShadow
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={i % 2 ? "#5f8460" : "#7a9c68"} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Scenery() {
  return (
    <group>
      {TREES.map(([x, z, s]) => <Tree key={`${x}-${z}`} x={x} z={z} s={s} />)}
      {BUSHES.map(([x, z, r]) => (
        <mesh key={`${x}-${z}`} position={[x, r * 0.55 - 0.3, z]} scale={[1.3, 0.9, 1]} castShadow>
          <sphereGeometry args={[r, 14, 12]} />
          <meshStandardMaterial color="#6f8c5e" roughness={0.95} flatShading />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[i % 2 ? 0.3 : -0.3, -0.5, 9.6 + i * 1.5]} scale={[1, 1, 0.7]} receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.06, 20]} />
          <meshStandardMaterial color="#cfc6b2" roughness={0.9} />
        </mesh>
      ))}
      <Lantern position={[-2.75, -0.45, 7.6]} />
      <Lantern position={[2.75, -0.45, 7.6]} />
      <Plant position={[-4.1, 0, -6.2]} />
      <Plant position={[4.1, 0, 3.6]} />
      <Sparkles count={70} scale={[8.5, 4.5, 13]} position={[0, 3, 0]} size={2.4} speed={0.25} opacity={0.75} color="#ffe2a8" />
    </group>
  );
}
