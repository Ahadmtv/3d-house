"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { MutableRefObject, ReactNode } from "react";

const CAMERA_STOPS = [
  { progress: 0, position: [9, 7.4, 20] as const, target: [0, 2.2, 0] as const },
  { progress: 0.09, position: [3.1, 3.9, 11.5] as const, target: [0, 2, 6.9] as const },
  { progress: 0.17, position: [0, 2.55, 7.8] as const, target: [0, 2, -1] as const },
  { progress: 0.28, position: [0, 2.45, 2.3] as const, target: [0, 2.25, -6.7] as const },
  { progress: 0.43, position: [0.35, 2.45, -0.7] as const, target: [-4.78, 2.35, -3.4] as const },
  { progress: 0.58, position: [-0.25, 2.45, -0.8] as const, target: [4.78, 2.3, -2.5] as const },
  { progress: 0.73, position: [0.1, 2.45, -0.1] as const, target: [4.78, 2.35, 0.5] as const },
  { progress: 0.88, position: [0.1, 2.45, -1.6] as const, target: [3.72, 2.35, 6.75] as const },
  { progress: 1, position: [0.1, 2.45, -1.6] as const, target: [3.72, 2.35, 6.75] as const },
];

type HouseSceneProps = {
  progressRef: MutableRefObject<number>;
  activeStage: number;
};

function CameraJourney({ progressRef, doorRef }: Pick<HouseSceneProps, "progressRef"> & {
  doorRef: MutableRefObject<THREE.Group | null>;
}) {
  useFrame(({ camera, size }) => {
    const isNarrow = size.width < 700;
    if (camera instanceof THREE.PerspectiveCamera) {
      const fieldOfView = isNarrow ? 54 : 41;
      if (camera.fov !== fieldOfView) {
        camera.fov = fieldOfView;
        camera.updateProjectionMatrix();
      }
    }

    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    let nextStop = 1;
    while (nextStop < CAMERA_STOPS.length - 1 && progress > CAMERA_STOPS[nextStop].progress) {
      nextStop += 1;
    }
    const start = CAMERA_STOPS[nextStop - 1];
    const end = CAMERA_STOPS[nextStop];
    const range = end.progress - start.progress || 1;
    const rawProgress = THREE.MathUtils.clamp((progress - start.progress) / range, 0, 1);
    const easedProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    const cameraPosition = new THREE.Vector3(...start.position).lerp(
      new THREE.Vector3(...end.position),
      easedProgress,
    );
    const lookTarget = new THREE.Vector3(...start.target).lerp(
      new THREE.Vector3(...end.target),
      easedProgress,
    );
    if (isNarrow) {
      cameraPosition.x *= 0.45;
      if (cameraPosition.z > 8) cameraPosition.z += 2.5;
    }

    camera.position.copy(cameraPosition);
    camera.lookAt(lookTarget);

    if (doorRef.current) {
      const opening = THREE.MathUtils.clamp((progress - 0.07) / 0.1, 0, 1);
      doorRef.current.rotation.y = Math.sin(opening * Math.PI * 0.5) * 1.36;
    }
  });

  return null;
}

function HouseArchitecture({ doorRef }: { doorRef: MutableRefObject<THREE.Group | null> }) {
  const gable = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-5, 0);
    shape.lineTo(0, 2.65);
    shape.lineTo(5, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  return (
    <group>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[10, 0.36, 14]} />
        <meshStandardMaterial color="#d5cbb8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.6, -7]} receiveShadow>
        <boxGeometry args={[10, 5.2, 0.24]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh position={[-4.88, 2.6, 0]} receiveShadow>
        <boxGeometry args={[0.24, 5.2, 14]} />
        <meshStandardMaterial color="#e4dccd" roughness={0.92} />
      </mesh>
      <mesh position={[4.88, 2.6, 0]} receiveShadow>
        <boxGeometry args={[0.24, 5.2, 14]} />
        <meshStandardMaterial color="#e4dccd" roughness={0.92} />
      </mesh>
      <mesh position={[-3.8, 2.6, 7]} receiveShadow>
        <boxGeometry args={[2.4, 5.2, 0.24]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh position={[3.8, 2.6, 7]} receiveShadow>
        <boxGeometry args={[2.4, 5.2, 0.24]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh position={[0, 4.75, 7]} receiveShadow>
        <boxGeometry args={[2.8, 0.9, 0.24]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh geometry={gable} position={[0, 5.2, 7.13]}>
        <meshStandardMaterial color="#d9d1c1" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gable} position={[0, 5.2, -7.13]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color="#d9d1c1" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-1.45, 6.38, 0]} rotation={[0, 0, 0.71]} castShadow>
        <boxGeometry args={[3.95, 0.3, 15.2]} />
        <meshStandardMaterial color="#465650" roughness={0.78} />
      </mesh>
      <mesh position={[1.45, 6.38, 0]} rotation={[0, 0, -0.71]} castShadow>
        <boxGeometry args={[3.95, 0.3, 15.2]} />
        <meshStandardMaterial color="#465650" roughness={0.78} />
      </mesh>
      <mesh position={[0, 5.22, 0]} castShadow>
        <boxGeometry args={[0.18, 0.22, 15.45]} />
        <meshStandardMaterial color="#374742" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, 7.18]}>
        <boxGeometry args={[2.96, 0.16, 0.48]} />
        <meshStandardMaterial color="#d9c9a6" roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.08, 7.45]} receiveShadow>
        <boxGeometry args={[3.4, 0.22, 0.78]} />
        <meshStandardMaterial color="#aaa18f" roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.25, 7.78]} receiveShadow>
        <boxGeometry args={[3.85, 0.22, 0.76]} />
        <meshStandardMaterial color="#b9b1a1" roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.42, 8.12]} receiveShadow>
        <boxGeometry args={[4.3, 0.22, 0.78]} />
        <meshStandardMaterial color="#c7bead" roughness={0.86} />
      </mesh>
      <Door ref={doorRef} />
      <FrontWindow position={[-3.78, 2.7, 7.17]} />
      <FrontWindow position={[3.78, 2.7, 7.17]} />
      <HouseDetails />
    </group>
  );
}

function Door({ ref }: { ref: MutableRefObject<THREE.Group | null> }) {
  return (
    <group ref={ref} position={[-1.36, 0, 7.03]}>
      <mesh position={[1.27, 1.86, 0]} castShadow>
        <boxGeometry args={[2.54, 3.72, 0.18]} />
        <meshStandardMaterial color="#865b3f" roughness={0.63} />
      </mesh>
      {[0.36, 1.3, 2.25].map((height) => (
        <mesh key={height} position={[1.27, height, 0.105]}>
          <boxGeometry args={[2.1, 0.66, 0.045]} />
          <meshStandardMaterial color="#986b4c" roughness={0.66} />
        </mesh>
      ))}
      <mesh position={[2.24, 1.85, 0.17]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#c7a873" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FrontWindow({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.46, 1.65, 0.13]} />
        <meshStandardMaterial color="#d2bd91" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[1.19, 1.38, 0.05]} />
        <meshStandardMaterial color="#81938c" roughness={0.28} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.045, 1.34, 0.045]} />
        <meshStandardMaterial color="#e3d7bf" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[1.15, 0.045, 0.045]} />
        <meshStandardMaterial color="#e3d7bf" roughness={0.6} />
      </mesh>
    </group>
  );
}

function HouseDetails() {
  return (
    <group>
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <boxGeometry args={[9.55, 0.015, 13.55]} />
        <meshStandardMaterial color="#c8bda9" roughness={0.94} />
      </mesh>
      <mesh position={[-2.45, 0.035, -2.15]} receiveShadow>
        <boxGeometry args={[3.1, 0.05, 4.25]} />
        <meshStandardMaterial color="#a99579" roughness={0.95} />
      </mesh>
      <mesh position={[-2.45, 0.075, -2.15]} receiveShadow>
        <boxGeometry args={[2.76, 0.03, 3.9]} />
        <meshStandardMaterial color="#bdad94" roughness={0.92} />
      </mesh>
      <group position={[-2.65, 0, -2.65]}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[2.35, 0.95, 0.9]} />
          <meshStandardMaterial color="#7d8070" roughness={0.91} />
        </mesh>
        <mesh position={[0, 1.1, -0.31]} castShadow>
          <boxGeometry args={[2.35, 0.26, 0.25]} />
          <meshStandardMaterial color="#747766" roughness={0.9} />
        </mesh>
        <mesh position={[-0.87, 0.83, 0.46]} castShadow>
          <boxGeometry args={[0.26, 0.95, 0.18]} />
          <meshStandardMaterial color="#777968" roughness={0.9} />
        </mesh>
        <mesh position={[0.87, 0.83, 0.46]} castShadow>
          <boxGeometry args={[0.26, 0.95, 0.18]} />
          <meshStandardMaterial color="#777968" roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[0.12, 0.42, -2.55]} castShadow>
        <boxGeometry args={[1.7, 0.12, 1.08]} />
        <meshStandardMaterial color="#9b7958" roughness={0.7} />
      </mesh>
      {[-0.58, 0.82].map((x) => (
        <mesh key={x} position={[x, 0.19, -2.55]} castShadow>
          <boxGeometry args={[0.08, 0.42, 0.08]} />
          <meshStandardMaterial color="#896b4e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 4.72, -1.5]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#d9bc87" emissive="#6f4820" emissiveIntensity={0.45} />
      </mesh>
      <pointLight position={[0, 4.45, -1.5]} color="#f0d9a9" intensity={26} distance={10} decay={2} />
      <mesh position={[0, -0.48, 14]} receiveShadow>
        <boxGeometry args={[200, 0.1, 200]} />
        <meshStandardMaterial color="#aab0a1" roughness={1} />
      </mesh>
    </group>
  );
}

function WallPanel({
  position,
  rotation = 0,
  distanceFactor,
  className,
  eyebrow,
  title,
  children,
}: {
  position: [number, number, number];
  rotation?: number;
  distanceFactor: number;
  className: string;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Html
      transform
      position={position}
      rotation={[0, rotation, 0]}
      distanceFactor={distanceFactor}
      zIndexRange={[10, 0]}
    >
      <article className={`wall-panel ${className}`}>
        <p className="panel-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {children}
      </article>
    </Html>
  );
}

function SceneContents({ progressRef, activeStage }: HouseSceneProps) {
  const doorRef = useRef<THREE.Group | null>(null);

  return (
    <>
      <color attach="background" args={["#b7c0b6"]} />
      <fog attach="fog" args={["#b7c0b6", 26, 58]} />
      <ambientLight intensity={1.65} color="#fff3dd" />
      <directionalLight
        position={[-8, 14, 11]}
        intensity={3.2}
        color="#fff1d6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={16}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[8, 9, -10]} intensity={1.25} color="#dae7dc" />
      <HouseArchitecture doorRef={doorRef} />
      <CameraJourney progressRef={progressRef} doorRef={doorRef} />
      {activeStage === 2 && (
        <WallPanel
          position={[0, 2.5, -6.83]}
          distanceFactor={9}
          className="panel-welcome"
          eyebrow="01 / A warm welcome"
          title={<>Good work<br />starts with<br />a feeling.</>}
        >
          <p>We make places, identities, and digital experiences with warmth, purpose, and a point of view.</p>
          <span className="panel-mark" aria-hidden="true">F—01</span>
        </WallPanel>
      )}
      {activeStage === 3 && (
        <WallPanel
          position={[-4.72, 2.5, -2.75]}
          rotation={Math.PI / 2}
          distanceFactor={4.6}
          className="panel-about"
          eyebrow="02 / Our story"
          title={<>Small studio.<br />Room for<br />big ideas.</>}
        >
          <p>Fieldhouse brings strategy, design, and craft together to make work with a lasting sense of place.</p>
          <span className="panel-mark" aria-hidden="true">EST. MMXVI</span>
        </WallPanel>
      )}
      {activeStage === 4 && (
        <WallPanel
          position={[4.72, 2.5, -3.35]}
          rotation={-Math.PI / 2}
          distanceFactor={4.6}
          className="panel-services"
          eyebrow="03 / What we do"
          title={<>From first sketch<br />to final detail.</>}
        >
          <ul className="service-list">
            <li>Brand &amp; identity</li>
            <li>Places &amp; spaces</li>
            <li>Digital experiences</li>
          </ul>
          <span className="panel-mark" aria-hidden="true">A GOOD PLACE TO BEGIN</span>
        </WallPanel>
      )}
      {activeStage === 5 && (
        <WallPanel
          position={[4.72, 2.5, 0.65]}
          rotation={-Math.PI / 2}
          distanceFactor={4.8}
          className="panel-work"
          eyebrow="04 / A few good things"
          title={<>Made to<br />belong.</>}
        >
          <p>From quiet neighborhood landmarks to ambitious digital homes, we make the useful feel unforgettable.</p>
          <a className="panel-link" href="#portfolio">A little more about us <span aria-hidden="true">↗</span></a>
        </WallPanel>
      )}
      {activeStage === 6 && (
        <WallPanel
          position={[3.78, 2.5, 6.86]}
          rotation={Math.PI}
          distanceFactor={8.5}
          className="panel-contact"
          eyebrow="05 / Come say hello"
          title={<>There’s room<br />for what’s next.</>}
        >
          <p>Tell us what you’re imagining. We’d love to hear about it.</p>
          <a className="panel-link" href="mailto:hello@fieldhouse.studio">hello@fieldhouse.studio <span aria-hidden="true">↗</span></a>
          <span className="panel-mark" aria-hidden="true">THANKS FOR STOPPING BY</span>
        </WallPanel>
      )}
    </>
  );
}

export function HouseScene({ progressRef, activeStage }: HouseSceneProps) {
  return (
    <div className="three-scene" aria-label="An interactive three-dimensional house">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [9, 7.4, 20], fov: 41, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <SceneContents progressRef={progressRef} activeStage={activeStage} />
      </Canvas>
    </div>
  );
}
