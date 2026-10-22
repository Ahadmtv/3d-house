"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MutableRefObject, ReactNode, RefObject } from "react";

const HOUSE = {
  width: 10,
  depth: 14,
  wallHeight: 5.2,
  wallThickness: 0.24,
  sideX: 4.88,
  frontZ: 7,
  backZ: -7,
  roofRidgeY: 7.85,
};

const CAMERA_STOPS = [
  { progress: 0, position: [9, 7.4, 20] as const, target: [0, 2.2, 0] as const },
  { progress: 0.09, position: [3.1, 3.9, 11.5] as const, target: [0, 2, 6.9] as const },
  { progress: 0.17, position: [0, 2.55, 7.8] as const, target: [0, 2, -1] as const },
  { progress: 0.28, position: [0, 2.45, 2.3] as const, target: [0, 2.25, -6.7] as const },
  { progress: 0.43, position: [0.35, 2.45, -0.7] as const, target: [-4.78, 2.35, -3.4] as const },
  { progress: 0.58, position: [-0.25, 2.45, -0.8] as const, target: [4.78, 2.3, -2.5] as const },
  { progress: 0.73, position: [0.1, 2.45, -0.1] as const, target: [4.78, 2.35, 0.5] as const },
  { progress: 0.88, position: [0.1, 2.45, -1.6] as const, target: [3.45, 2.6, -6.84] as const },
  { progress: 1, position: [0.1, 2.45, -1.6] as const, target: [3.45, 2.6, -6.84] as const },
];

const WALL_MOUNTS = {
  welcome: {
    wall: "back",
    wallPosition: [0, 0, HOUSE.backZ] as [number, number, number],
    position: [0, 2.6, HOUSE.wallThickness / 2 + 0.04] as [number, number, number],
    rotation: 0,
  },
  about: {
    wall: "left",
    wallPosition: [-HOUSE.sideX, 0, 0] as [number, number, number],
    position: [HOUSE.wallThickness / 2 + 0.04, 2.6, -2.75] as [number, number, number],
    rotation: Math.PI / 2,
  },
  services: {
    wall: "right",
    wallPosition: [HOUSE.sideX, 0, 0] as [number, number, number],
    position: [-HOUSE.wallThickness / 2 - 0.04, 2.6, -3.35] as [number, number, number],
    rotation: -Math.PI / 2,
  },
  work: {
    wall: "right",
    wallPosition: [HOUSE.sideX, 0, 0] as [number, number, number],
    position: [-HOUSE.wallThickness / 2 - 0.04, 2.6, 0.65] as [number, number, number],
    rotation: -Math.PI / 2,
  },
  contact: {
    wall: "back",
    wallPosition: [3.45, 0, HOUSE.backZ] as [number, number, number],
    position: [0, 2.6, HOUSE.wallThickness / 2 + 0.04] as [number, number, number],
    rotation: 0,
  },
} as const;

const PANEL_LAYOUTS = {
  welcome: { widths: [360, 300, 264], heights: [390, 350, 315] },
  about: { widths: [340, 300, 264], heights: [390, 350, 315] },
  services: { widths: [360, 300, 264], heights: [390, 350, 315] },
  work: { widths: [325, 300, 264], heights: [340, 350, 315] },
  contact: { widths: [300, 300, 286], heights: [390, 350, 315] },
} as const;

const PANEL_DISTANCE_FACTOR = 2.5;

type WallRefs = Record<"back" | "left" | "right", MutableRefObject<THREE.Mesh | null>>;

type WaypointKey = "position" | "target";

function sampleCameraPath(
  progress: number,
  key: WaypointKey,
  narrow: boolean,
  result: THREE.Vector3,
) {
  let endIndex = 1;
  while (endIndex < CAMERA_STOPS.length - 1 && progress > CAMERA_STOPS[endIndex].progress) {
    endIndex += 1;
  }

  const startIndex = endIndex - 1;
  const start = CAMERA_STOPS[startIndex];
  const end = CAMERA_STOPS[endIndex];
  const duration = end.progress - start.progress;
  const t = THREE.MathUtils.clamp((progress - start.progress) / duration, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const startWeight = 2 * t3 - 3 * t2 + 1;
  const startTangentWeight = t3 - 2 * t2 + t;
  const endWeight = -2 * t3 + 3 * t2;
  const endTangentWeight = t3 - t2;
  const previousIndex = Math.max(startIndex - 1, 0);
  const nextIndex = Math.min(endIndex + 1, CAMERA_STOPS.length - 1);
  const previousTime = CAMERA_STOPS[previousIndex].progress;
  const nextTime = CAMERA_STOPS[nextIndex].progress;
  const holdIndex = CAMERA_STOPS.length - 2;

  const coordinate = (index: number, axis: 0 | 1 | 2) => {
    const point = CAMERA_STOPS[index][key];
    if (key !== "position" || !narrow) return point[axis];
    if (axis === 0) return point[axis] * 0.45;
    if (axis === 2) return point[axis] + THREE.MathUtils.smoothstep(point[2], 7.8, 11.5) * 2.5;
    return point[axis];
  };

  const value = (axis: 0 | 1 | 2) => {
    const startValue = coordinate(startIndex, axis);
    const endValue = coordinate(endIndex, axis);
    const startTangent = startIndex === holdIndex || startIndex === CAMERA_STOPS.length - 1
      ? 0
      : startIndex === 0
        ? (endValue - startValue) / duration
        : (endValue - coordinate(previousIndex, axis)) / (end.progress - previousTime);
    const endTangent = endIndex === holdIndex || endIndex === CAMERA_STOPS.length - 1
      ? 0
      : (coordinate(nextIndex, axis) - startValue) / (nextTime - start.progress);

    return startWeight * startValue
      + startTangentWeight * duration * startTangent
      + endWeight * endValue
      + endTangentWeight * duration * endTangent;
  };

  result.set(value(0), value(1), value(2));
}

type HouseSceneProps = {
  progressRef: MutableRefObject<number>;
  activeStage: number;
};

function CameraJourney({ progressRef, doorRef }: Pick<HouseSceneProps, "progressRef"> & {
  doorRef: MutableRefObject<THREE.Group | null>;
}) {
  const cameraPositionRef = useRef(new THREE.Vector3());
  const cameraTargetRef = useRef(new THREE.Vector3());

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
    sampleCameraPath(progress, "position", isNarrow, cameraPositionRef.current);
    sampleCameraPath(progress, "target", false, cameraTargetRef.current);
    camera.position.copy(cameraPositionRef.current);
    camera.lookAt(cameraTargetRef.current);

    if (doorRef.current) {
      const opening = THREE.MathUtils.clamp((progress - 0.07) / 0.1, 0, 1);
      doorRef.current.rotation.y = Math.sin(opening * Math.PI * 0.5) * 1.36;
    }
  });

  return null;
}

function HouseArchitecture({
  doorRef,
  wallRefs,
}: {
  doorRef: MutableRefObject<THREE.Group | null>;
  wallRefs: WallRefs;
}) {
  const gable = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-HOUSE.width / 2, 0);
    shape.lineTo(0, HOUSE.roofRidgeY - HOUSE.wallHeight);
    shape.lineTo(HOUSE.width / 2, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  return (
    <group>
      <mesh position={[0, -0.265, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width + HOUSE.wallThickness, 0.53, HOUSE.depth + HOUSE.wallThickness]} />
        <meshStandardMaterial color="#d5cbb8" roughness={0.9} />
      </mesh>
      <mesh ref={wallRefs.back} position={[0, HOUSE.wallHeight / 2, HOUSE.backZ]} receiveShadow>
        <boxGeometry args={[HOUSE.width, HOUSE.wallHeight, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh ref={wallRefs.left} position={[-HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#e4dccd" roughness={0.92} />
      </mesh>
      <mesh ref={wallRefs.right} position={[HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#e4dccd" roughness={0.92} />
      </mesh>
      <FrontOpeningWall centerX={-3.8} />
      <FrontOpeningWall centerX={3.8} />
      {[-2, 2].map((centerX) => (
        <mesh key={centerX} position={[centerX, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[1.2, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 4.575, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[2.8, 1.25, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.frontZ + HOUSE.wallThickness / 2]}>
        <meshStandardMaterial color="#d9d1c1" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.backZ - HOUSE.wallThickness / 2]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color="#d9d1c1" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-2.5, 6.525, 0]} rotation={[0, 0, 0.487]} castShadow receiveShadow>
        <boxGeometry args={[5.66, 0.3, 15.2]} />
        <meshStandardMaterial color="#465650" roughness={0.78} />
      </mesh>
      <mesh position={[2.5, 6.525, 0]} rotation={[0, 0, -0.487]} castShadow receiveShadow>
        <boxGeometry args={[5.66, 0.3, 15.2]} />
        <meshStandardMaterial color="#465650" roughness={0.78} />
      </mesh>
      <mesh position={[-2.425, 6.224, 0]} rotation={[0, 0, 0.487]} receiveShadow>
        <boxGeometry args={[5.6, 0.025, 14.75]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[2.425, 6.224, 0]} rotation={[0, 0, -0.487]} receiveShadow>
        <boxGeometry args={[5.6, 0.025, 14.75]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.72, 0]} castShadow>
        <boxGeometry args={[0.2, 0.24, 15.45]} />
        <meshStandardMaterial color="#465650" roughness={0.78} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 4.72, 0.14, 0]}>
          <boxGeometry args={[0.08, 0.28, 13.6]} />
          <meshStandardMaterial color="#c4b69c" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 0.14, -6.84]}>
        <boxGeometry args={[9.4, 0.28, 0.08]} />
        <meshStandardMaterial color="#c4b69c" roughness={0.72} />
      </mesh>
      <mesh position={[-3.8, 0.14, 6.84]}>
        <boxGeometry args={[2.25, 0.28, 0.08]} />
        <meshStandardMaterial color="#c4b69c" roughness={0.72} />
      </mesh>
      <mesh position={[3.8, 0.14, 6.84]}>
        <boxGeometry args={[2.25, 0.28, 0.08]} />
        <meshStandardMaterial color="#c4b69c" roughness={0.72} />
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
      <DoorFrame />
      <FrontWindow position={[-3.8, 2.7, 7.17]} />
      <FrontWindow position={[3.8, 2.7, 7.17]} />
      <HouseDetails />
    </group>
  );
}

function InteriorFloorboards() {
  const boardsRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.374, 0.025, 4.56), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.86 }), []);

  useLayoutEffect(() => {
    if (!boardsRef.current) return;

    const matrix = new THREE.Matrix4();
    const boardCount = 24;
    const startX = -(boardCount * 0.374 + (boardCount - 1) * 0.018) / 2 + 0.187;
    const colors = ["#c8bda9", "#c4b79f", "#cfc3ae"];
    let index = 0;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < boardCount; column += 1) {
        matrix.makeTranslation(startX + column * 0.392, 0.028, (row - 1) * 4.6);
        boardsRef.current.setMatrixAt(index, matrix);
        boardsRef.current.setColorAt(index, new THREE.Color(colors[(row * 7 + column * 3) % 3]));
        index += 1;
      }
    }

    boardsRef.current.instanceMatrix.needsUpdate = true;
    boardsRef.current.instanceColor!.needsUpdate = true;
    boardsRef.current.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh
      ref={boardsRef}
      args={[geometry, material, 72]}
      castShadow
      receiveShadow
    />
  );
}

function FrontOpeningWall({ centerX }: { centerX: number }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[centerX + side * 0.99, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[0.42, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[centerX, 0.975, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.95, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
      <mesh position={[centerX, 4.325, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.75, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#e8e1d4" roughness={0.92} />
      </mesh>
    </group>
  );
}

function DoorFrame() {
  return (
    <group position={[0, 0, 7.16]}>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.95, 0]} castShadow>
          <boxGeometry args={[0.14, 3.9, 0.22]} />
          <meshStandardMaterial color="#d2bd91" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.87, 0]} castShadow>
        <boxGeometry args={[2.94, 0.16, 0.22]} />
        <meshStandardMaterial color="#d2bd91" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.1, 0.07]}>
        <boxGeometry args={[2.94, 0.12, 0.34]} />
        <meshStandardMaterial color="#b7a47f" roughness={0.72} />
      </mesh>
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
        <boxGeometry args={[1.46, 1.48, 0.13]} />
        <meshStandardMaterial color="#d2bd91" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[1.19, 1.25, 0.05]} />
        <meshStandardMaterial color="#81938c" roughness={0.28} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.045, 1.21, 0.045]} />
        <meshStandardMaterial color="#e3d7bf" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[1.15, 0.045, 0.045]} />
        <meshStandardMaterial color="#e3d7bf" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.82, 0.12]} castShadow>
        <boxGeometry args={[1.64, 0.12, 0.32]} />
        <meshStandardMaterial color="#c7b28c" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.82, 0.12]} castShadow>
        <boxGeometry args={[1.64, 0.12, 0.32]} />
        <meshStandardMaterial color="#c7b28c" roughness={0.72} />
      </mesh>
    </group>
  );
}

function HouseDetails() {
  return (
    <group>
      <mesh position={[0, -0.445, 0]} receiveShadow castShadow>
        <boxGeometry args={[HOUSE.width + 0.3, 0.17, HOUSE.depth + 0.3]} />
        <meshStandardMaterial color="#aaa18f" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width - HOUSE.wallThickness, 0.015, HOUSE.depth - HOUSE.wallThickness]} />
        <meshStandardMaterial color="#c8bda9" roughness={0.94} />
      </mesh>
      <InteriorFloorboards />
      <mesh position={[-2.45, 0.035, -2.15]} receiveShadow>
        <boxGeometry args={[3.1, 0.05, 4.25]} />
        <meshStandardMaterial color="#a99579" roughness={0.95} />
      </mesh>
      <mesh position={[-2.45, 0.075, -2.15]} receiveShadow>
        <boxGeometry args={[2.76, 0.03, 3.9]} />
        <meshStandardMaterial color="#bdad94" roughness={0.92} />
      </mesh>
      <group position={[-2.65, 0, -2.65]}>
        {[-0.86, 0.86].flatMap((x) => [-0.28, 0.28].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.11, z]} castShadow>
            <boxGeometry args={[0.12, 0.14, 0.12]} />
            <meshStandardMaterial color="#6d5b45" roughness={0.78} />
          </mesh>
        )))}
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
        <mesh key={x} position={[x, 0.23, -2.55]} castShadow>
          <boxGeometry args={[0.08, 0.38, 0.08]} />
          <meshStandardMaterial color="#896b4e" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 6.15, -1.5]}>
        <cylinderGeometry args={[0.018, 0.018, 2.6, 12]} />
        <meshStandardMaterial color="#8d8069" roughness={0.72} />
      </mesh>
      <mesh position={[0, 4.72, -1.5]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#d9bc87" emissive="#6f4820" emissiveIntensity={0.45} />
      </mesh>
      <pointLight position={[0, 4.45, -1.5]} color="#f0d9a9" intensity={26} distance={10} decay={2} />
      <mesh position={[0, -0.58, 14]} receiveShadow>
        <boxGeometry args={[200, 0.1, 200]} />
        <meshStandardMaterial color="#aab0a1" roughness={1} />
      </mesh>
    </group>
  );
}

function WallPanel({
  panel,
  eyebrow,
  title,
  children,
  wallRefs,
}: {
  panel: keyof typeof WALL_MOUNTS;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  wallRefs: WallRefs;
}) {
  const { size } = useThree();
  const mount = WALL_MOUNTS[panel];
  const layout = PANEL_LAYOUTS[panel];
  const breakpoint = size.width < 540 ? 2 : size.width < 800 ? 1 : 0;
  const contentWidth = layout.widths[breakpoint] * PANEL_DISTANCE_FACTOR / 400;
  const contentHeight = layout.heights[breakpoint] * PANEL_DISTANCE_FACTOR / 400;
  const frameWidth = contentWidth + 0.31;
  const frameHeight = contentHeight + 0.28;
  const matWidth = contentWidth + 0.19;
  const matHeight = contentHeight + 0.16;

  return (
    <group position={mount.wallPosition}>
      <group position={mount.position} rotation={[0, mount.rotation, 0]}>
        <mesh position={[0, 0, -0.04]} castShadow receiveShadow>
          <boxGeometry args={[frameWidth, frameHeight, 0.07]} />
          <meshStandardMaterial color="#98764e" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <boxGeometry args={[matWidth, matHeight, 0.018]} />
          <meshStandardMaterial color="#d9d1c1" roughness={0.88} />
        </mesh>
        <Html
          transform
          position={[0, 0, 0.014]}
          distanceFactor={PANEL_DISTANCE_FACTOR}
          occlude={[wallRefs[mount.wall] as unknown as RefObject<THREE.Object3D>]}
          zIndexRange={[10, 0]}
        >
          <article className={`wall-panel panel-${panel}`}>
            <p className="panel-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            {children}
          </article>
        </Html>
      </group>
    </group>
  );
}

function SceneContents({ progressRef, activeStage }: HouseSceneProps) {
  const doorRef = useRef<THREE.Group | null>(null);
  const wallRefs: WallRefs = {
    back: useRef<THREE.Mesh | null>(null),
    left: useRef<THREE.Mesh | null>(null),
    right: useRef<THREE.Mesh | null>(null),
  };

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
      <HouseArchitecture doorRef={doorRef} wallRefs={wallRefs} />
      <CameraJourney progressRef={progressRef} doorRef={doorRef} />
      {activeStage === 2 && (
        <WallPanel
          panel="welcome"
          wallRefs={wallRefs}
          eyebrow="01 / A warm welcome"
          title={<>Good work<br />starts with<br />a feeling.</>}
        >
          <p>We make places, identities, and digital experiences with warmth, purpose, and a point of view.</p>
          <span className="panel-mark" aria-hidden="true">F—01</span>
        </WallPanel>
      )}
      {activeStage === 3 && (
        <WallPanel
          panel="about"
          wallRefs={wallRefs}
          eyebrow="02 / Our story"
          title={<>Small studio.<br />Room for<br />big ideas.</>}
        >
          <p>Fieldhouse brings strategy, design, and craft together to make work with a lasting sense of place.</p>
          <span className="panel-mark" aria-hidden="true">EST. MMXVI</span>
        </WallPanel>
      )}
      {activeStage === 4 && (
        <WallPanel
          panel="services"
          wallRefs={wallRefs}
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
          panel="work"
          wallRefs={wallRefs}
          eyebrow="04 / A few good things"
          title={<>Made to<br />belong.</>}
        >
          <p>From quiet neighborhood landmarks to ambitious digital homes, we make the useful feel unforgettable.</p>
          <a className="panel-link" href="mailto:hello@fieldhouse.studio?subject=Selected%20work">Ask us about our work <span aria-hidden="true">↗</span></a>
        </WallPanel>
      )}
      {activeStage === 6 && (
        <WallPanel
          panel="contact"
          wallRefs={wallRefs}
          eyebrow="05 / Come say hello"
          title={<>There’s room<br />for what’s<br />next.</>}
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
        fallback={
          <div className="scene-fallback">
            <p className="eyebrow">A simpler way in</p>
            <h2>Good work starts with a feeling.</h2>
            <p>
              The 3D view isn’t available in this browser. Fieldhouse brings
              strategy, design, and craft together to make places, identities,
              and digital experiences with a lasting sense of place.
            </p>
            <a className="contact-link" href="mailto:hello@fieldhouse.studio">
              hello@fieldhouse.studio
            </a>
          </div>
        }
      >
        <SceneContents progressRef={progressRef} activeStage={activeStage} />
      </Canvas>
    </div>
  );
}
