"use client";

import { Html, Sky, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useLayoutEffect, useMemo, useRef } from "react";
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
  welcome: { widths: [360, 300, 264], heights: [430, 420, 390] },
  about: { widths: [340, 300, 264], heights: [460, 440, 420] },
  services: { widths: [360, 300, 264], heights: [480, 450, 430] },
  work: { widths: [325, 300, 264], heights: [400, 380, 360] },
  contact: { widths: [300, 300, 286], heights: [520, 490, 470] },
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
  stageProgress: number;
  reducedMotion: boolean;
};

type SceneErrorBoundaryState = { hasError: boolean };

class SceneErrorBoundary extends Component<{ children: ReactNode }, SceneErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="scene-fallback" role="status">
          <div className="scene-fallback-copy">
            <p className="eyebrow">A simpler way in</p>
            <h2>Good work starts with a feeling.</h2>
            <p>
              The 3D view isn’t available here. Fieldhouse brings strategy, design,
              and craft together to make places, identities, and digital experiences.
            </p>
            <a className="contact-link" href="mailto:hello@fieldhouse.studio">
              hello@fieldhouse.studio
            </a>
          </div>
          <div className="scene-fallback-gallery" aria-hidden="true">
            <figure className="scene-fallback-image scene-fallback-image-main">
              <img src="/images/editorial-reference-exterior.webp" alt="" />
              <figcaption>Architecture / stone · timber · daylight</figcaption>
            </figure>
            <figure className="scene-fallback-image scene-fallback-image-garden">
              <img src="/images/editorial-reference-courtyard.webp" alt="" />
              <figcaption>Landscape / a quieter arrival</figcaption>
            </figure>
            <figure className="scene-fallback-image scene-fallback-image-entry">
              <img src="/images/editorial-reference-entry.webp" alt="" />
              <figcaption>Material study / vertical oak</figcaption>
            </figure>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function CameraJourney({ progressRef, stageProgress, reducedMotion, doorRef }: Pick<HouseSceneProps, "progressRef" | "stageProgress" | "reducedMotion"> & {
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

    const progress = reducedMotion
      ? stageProgress
      : THREE.MathUtils.clamp(progressRef.current, 0, 1);
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

function StandingSeamRoof({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const seamCount = 40;
  const seamRef = useRef<THREE.InstancedMesh>(null);
  const seamGeometry = useMemo(() => new THREE.BoxGeometry(5.5, 0.045, 0.035), []);
  const seamMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#29342c", roughness: 0.38, metalness: 0.55 }), []);

  useLayoutEffect(() => {
    if (!seamRef.current) return;

    const matrix = new THREE.Matrix4();
    for (let index = 0; index < seamCount; index += 1) {
      const z = (index - (seamCount - 1) / 2) * 0.38;
      matrix.makeTranslation(0, 0.17, z);
      seamRef.current.setMatrixAt(index, matrix);
      seamRef.current.setColorAt(index, new THREE.Color(index % 4 === 0 ? "#364238" : "#202a23"));
    }

    seamRef.current.instanceMatrix.needsUpdate = true;
    seamRef.current.instanceColor!.needsUpdate = true;
    seamRef.current.computeBoundingSphere();
  }, [seamCount]);

  return (
    <group position={position} rotation={[0, 0, rotation]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[5.66, 0.3, 15.2]} />
        <meshStandardMaterial color="#27332b" roughness={0.42} metalness={0.48} />
      </mesh>
      <instancedMesh ref={seamRef} args={[seamGeometry, seamMaterial, seamCount]} castShadow receiveShadow />
    </group>
  );
}

function HouseArchitecture({
  doorRef,
  wallRefs,
  reducedMotion,
}: {
  doorRef: MutableRefObject<THREE.Group | null>;
  wallRefs: WallRefs;
  reducedMotion: boolean;
}) {
  const [
    sidingTexture,
    oakTexture,
    stoneTexture,
    lawnTexture,
    sidingNormal,
    oakNormal,
    stoneNormal,
  ] = useTexture([
    "/textures/painted-siding.svg",
    "/textures/dark-oak.svg",
    "/textures/flagstone.svg",
    "/textures/soft-lawn.svg",
    "/textures/siding-normal.svg",
    "/textures/oak-normal.svg",
    "/textures/stone-normal.svg",
  ]);
  const { gl } = useThree();
  const gable = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-HOUSE.width / 2, 0);
    shape.lineTo(0, HOUSE.roofRidgeY - HOUSE.wallHeight);
    shape.lineTo(HOUSE.width / 2, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  useLayoutEffect(() => {
    const colorTextures = [sidingTexture, oakTexture, stoneTexture, lawnTexture];
    const normalTextures = [sidingNormal, oakNormal, stoneNormal];
    for (const texture of [...colorTextures, ...normalTextures]) {
      texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }
    for (const texture of colorTextures) texture.colorSpace = THREE.SRGBColorSpace;
    sidingTexture.repeat.set(2, 2.5);
    sidingNormal.repeat.set(2, 2.5);
    oakNormal.repeat.copy(oakTexture.repeat);
    stoneNormal.repeat.copy(stoneTexture.repeat);
    lawnTexture.repeat.set(32, 32);
    for (const texture of [...colorTextures, ...normalTextures]) texture.needsUpdate = true;
  }, [gl, lawnTexture, oakNormal, oakTexture, sidingNormal, sidingTexture, stoneNormal, stoneTexture]);

  return (
    <group>
      <mesh position={[0, -0.265, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width + HOUSE.wallThickness, 0.53, HOUSE.depth + HOUSE.wallThickness]} />
        <meshStandardMaterial color="#a59b89" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.16, 0.16]} roughness={0.94} />
      </mesh>
      <mesh ref={wallRefs.back} position={[0, HOUSE.wallHeight / 2, HOUSE.backZ]} receiveShadow>
        <boxGeometry args={[HOUSE.width, HOUSE.wallHeight, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#ebe4d7" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
      </mesh>
      <mesh ref={wallRefs.left} position={[-HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#e8e0d2" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.86} />
      </mesh>
      <mesh ref={wallRefs.right} position={[HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#e8e0d2" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.86} />
      </mesh>
      <FrontOpeningWall centerX={-3.8} wallTexture={sidingTexture} wallNormal={sidingNormal} />
      <FrontOpeningWall centerX={3.8} wallTexture={sidingTexture} wallNormal={sidingNormal} />
      {[-2, 2].map((centerX) => (
        <mesh key={centerX} position={[centerX, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[1.2, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#ebe4d7" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 4.575, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[2.8, 1.25, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#ebe4d7" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.frontZ + HOUSE.wallThickness / 2]}>
        <meshStandardMaterial color="#e7dfd2" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.backZ - HOUSE.wallThickness / 2]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color="#e7dfd2" map={sidingTexture} normalMap={sidingNormal} normalScale={[0.18, 0.18]} roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
      <StandingSeamRoof position={[-2.5, 6.525, 0]} rotation={0.487} />
      <StandingSeamRoof position={[2.5, 6.525, 0]} rotation={-0.487} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 5.08, 5.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.16, 15.45]} />
            <meshStandardMaterial color="#303a32" roughness={0.4} metalness={0.54} />
          </mesh>
          <mesh position={[side * 5.08, 2.58, 7.08]} castShadow>
            <boxGeometry args={[0.1, 5.12, 0.1]} />
            <meshStandardMaterial color="#303a32" roughness={0.42} metalness={0.48} />
          </mesh>
        </group>
      ))}
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
      <mesh position={[0, 0.12, 7.18]} receiveShadow>
        <boxGeometry args={[2.96, 0.16, 0.48]} />
        <meshStandardMaterial color="#bbb09c" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.18, 0.18]} roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.08, 7.45]} receiveShadow>
        <boxGeometry args={[3.4, 0.22, 0.78]} />
        <meshStandardMaterial color="#9f988b" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.18, 0.18]} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.25, 7.78]} receiveShadow>
        <boxGeometry args={[3.85, 0.22, 0.76]} />
        <meshStandardMaterial color="#a7a091" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.18, 0.18]} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.42, 8.12]} receiveShadow>
        <boxGeometry args={[4.3, 0.22, 0.78]} />
        <meshStandardMaterial color="#b8af9e" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.18, 0.18]} roughness={0.9} />
      </mesh>
      <group>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.65, 1.95, 7.68]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 3.9, 0.22]} />
            <meshStandardMaterial color="#d2c8b6" roughness={0.82} />
          </mesh>
        ))}
        <mesh position={[0, 4.06, 7.72]} castShadow receiveShadow>
          <boxGeometry args={[4.15, 0.22, 1.26]} />
          <meshStandardMaterial color="#303a35" roughness={0.66} />
        </mesh>
        <mesh position={[0, 3.94, 7.72]}>
          <boxGeometry args={[3.88, 0.035, 1.05]} />
          <meshStandardMaterial color="#8a6948" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.68} />
        </mesh>
      </group>
      <group>
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 5 }, (_, index) => (
            <mesh
              key={`${side}-${index}`}
              position={[side * (1.92 + index * 0.1), 1.9, 7.15]}
              castShadow
            >
              <boxGeometry args={[0.045, 3.55, 0.075]} />
              <meshStandardMaterial color="#806347" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.68} />
            </mesh>
          )),
        )}
      </group>
      <group>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 2.78, 2.8, 7.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.18, 0.42, 0.12]} />
              <meshStandardMaterial color="#4a5148" roughness={0.55} metalness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.075]}>
              <boxGeometry args={[0.09, 0.25, 0.025]} />
              <meshStandardMaterial color="#efd8a8" emissive="#c99a54" emissiveIntensity={0.55} />
            </mesh>
            <pointLight color="#efd9b3" intensity={4} distance={4.5} decay={2} />
          </group>
        ))}
      </group>
      <Door ref={doorRef} oakTexture={oakTexture} oakNormal={oakNormal} />
      <DoorFrame oakTexture={oakTexture} oakNormal={oakNormal} />
      <FrontWindow position={[-3.8, 2.7, 7.17]} oakTexture={oakTexture} oakNormal={oakNormal} />
      <FrontWindow position={[3.8, 2.7, 7.17]} oakTexture={oakTexture} oakNormal={oakNormal} />
      <HouseDetails
        reducedMotion={reducedMotion}
        oakTexture={oakTexture}
        oakNormal={oakNormal}
        stoneTexture={stoneTexture}
        stoneNormal={stoneNormal}
        lawnTexture={lawnTexture}
      />
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

function FrontOpeningWall({ centerX, wallTexture, wallNormal }: {
  centerX: number;
  wallTexture: THREE.Texture;
  wallNormal: THREE.Texture;
}) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[centerX + side * 0.99, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[0.42, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#ebe4d7" map={wallTexture} normalMap={wallNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[centerX, 0.975, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.95, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#ebe4d7" map={wallTexture} normalMap={wallNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
      </mesh>
      <mesh position={[centerX, 4.325, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.75, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#ebe4d7" map={wallTexture} normalMap={wallNormal} normalScale={[0.18, 0.18]} roughness={0.82} />
      </mesh>
    </group>
  );
}

function DoorFrame({ oakTexture, oakNormal }: { oakTexture: THREE.Texture; oakNormal: THREE.Texture }) {
  return (
    <group position={[0, 0, 7.16]}>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.95, 0]} castShadow>
          <boxGeometry args={[0.14, 3.9, 0.22]} />
          <meshStandardMaterial color="#725638" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[0, 3.87, 0]} castShadow>
        <boxGeometry args={[2.94, 0.16, 0.22]} />
        <meshStandardMaterial color="#725638" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.1, 0.07]} receiveShadow>
        <boxGeometry args={[2.94, 0.12, 0.34]} />
        <meshStandardMaterial color="#b7a47f" roughness={0.76} />
      </mesh>
    </group>
  );
}

function Door({ ref, oakTexture, oakNormal }: {
  ref: MutableRefObject<THREE.Group | null>;
  oakTexture: THREE.Texture;
  oakNormal: THREE.Texture;
}) {
  return (
    <group ref={ref} position={[-1.36, 0, 7.03]}>
      <mesh position={[1.27, 1.86, 0]} castShadow>
        <boxGeometry args={[2.54, 3.72, 0.18]} />
        <meshStandardMaterial color="#8a694a" map={oakTexture} normalMap={oakNormal} normalScale={[0.14, 0.14]} roughness={0.62} />
      </mesh>
      {[0.36, 1.3, 2.25].map((height) => (
        <mesh key={height} position={[1.27, height, 0.105]}>
          <boxGeometry args={[2.1, 0.66, 0.045]} />
          <meshStandardMaterial color="#986b4c" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.64} />
        </mesh>
      ))}
      <mesh position={[2.24, 1.85, 0.17]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#c7a873" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FrontWindow({ position, oakTexture, oakNormal }: {
  position: [number, number, number];
  oakTexture: THREE.Texture;
  oakNormal: THREE.Texture;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.46, 1.48, 0.13]} />
        <meshStandardMaterial color="#705339" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[1.19, 1.25, 0.05]} />
        <meshStandardMaterial color="#718080" roughness={0.18} metalness={0.12} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.045, 1.21, 0.045]} />
        <meshStandardMaterial color="#604a35" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.66} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[1.15, 0.045, 0.045]} />
        <meshStandardMaterial color="#604a35" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.66} />
      </mesh>
      <mesh position={[0, -0.82, 0.12]} castShadow>
        <boxGeometry args={[1.64, 0.12, 0.32]} />
        <meshStandardMaterial color="#705339" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.64} />
      </mesh>
      <mesh position={[0, 0.82, 0.12]} castShadow>
        <boxGeometry args={[1.64, 0.12, 0.32]} />
        <meshStandardMaterial color="#705339" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.64} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.83, 0, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.16, 1.56, 0.1]} />
            <meshStandardMaterial color="#674b33" map={oakTexture} normalMap={oakNormal} normalScale={[0.13, 0.13]} roughness={0.67} />
          </mesh>
          {[-0.56, -0.28, 0, 0.28, 0.56].map((height) => (
            <mesh key={height} position={[0, height, 0.065]}>
              <boxGeometry args={[0.22, 0.045, 0.035]} />
              <meshStandardMaterial color="#91714f" map={oakTexture} normalMap={oakNormal} normalScale={[0.12, 0.12]} roughness={0.64} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function HouseDetails({ reducedMotion, oakTexture, oakNormal, stoneTexture, stoneNormal, lawnTexture }: {
  reducedMotion: boolean;
  oakTexture: THREE.Texture;
  oakNormal: THREE.Texture;
  stoneTexture: THREE.Texture;
  stoneNormal: THREE.Texture;
  lawnTexture: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, -0.445, 0]} receiveShadow castShadow>
        <boxGeometry args={[HOUSE.width + 0.3, 0.17, HOUSE.depth + 0.3]} />
        <meshStandardMaterial color="#aaa18f" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.14, 0.14]} roughness={0.9} />
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
      <ExteriorGarden reducedMotion={reducedMotion} stoneTexture={stoneTexture} stoneNormal={stoneNormal} lawnTexture={lawnTexture} />
    </group>
  );
}

function GardenTree({
  position,
  reducedMotion,
  variant = 0,
}: {
  position: [number, number, number];
  reducedMotion: boolean;
  variant?: number;
}) {
  const canopyRef = useRef<THREE.Group>(null);
  const leafColors = ["#788369", "#899078", "#737c65"];

  useFrame(({ clock }) => {
    if (!canopyRef.current || reducedMotion) return;
    canopyRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.35 + variant) * 0.012;
    canopyRef.current.rotation.x = Math.cos(clock.elapsedTime * 0.28 + variant) * 0.008;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.48, 0.68, 18, 1, true]} />
        <meshStandardMaterial color="#8d6b52" roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <torusGeometry args={[0.59, 0.035, 8, 20]} />
        <meshStandardMaterial color="#9b785c" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 0.06, 18]} />
        <meshStandardMaterial color="#514a38" roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.19, 3, 8]} />
        <meshStandardMaterial color="#80664d" roughness={0.92} />
      </mesh>
      <group ref={canopyRef} position={[0, 3.1, 0]}>
        {[
          [0, 0, 0, 1.15],
          [-0.62, 0.16, 0.14, 0.72],
          [0.58, 0.22, -0.12, 0.78],
          [0.08, 0.55, 0.38, 0.64],
          [-0.14, -0.34, -0.34, 0.66],
        ].map(([x, y, z, scale], index) => (
          <mesh
            key={index}
            position={[x, y, z]}
            scale={[scale, scale * 0.76, scale * 0.82]}
            castShadow
          >
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={leafColors[(index + variant) % leafColors.length]} roughness={0.96} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GardenPlanter({ position, stoneTexture, stoneNormal }: {
  position: [number, number, number];
  stoneTexture: THREE.Texture;
  stoneNormal: THREE.Texture;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <boxGeometry args={[2.7, 0.48, 5.6]} />
        <meshStandardMaterial color="#b8b0a0" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.16, 0.16]} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[2.48, 0.06, 5.36]} />
        <meshStandardMaterial color="#514e42" roughness={1} />
      </mesh>
      {[-2, -1.05, -0.1, 0.85, 1.8].map((z, index) => (
        <group key={z} position={[(index % 2 ? 0.38 : -0.38), 0.5, z]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <sphereGeometry args={[0.38, 12, 10]} />
            <meshStandardMaterial color={index % 2 ? "#79836b" : "#8b937b"} roughness={0.96} />
          </mesh>
          {[0, 1, 2].map((blade) => (
            <mesh key={blade} position={[(blade - 1) * 0.09, 0.53, 0]} rotation={[0, 0, (blade - 1) * 0.18]} castShadow>
              <cylinderGeometry args={[0.018, 0.036, 0.92, 5]} />
              <meshStandardMaterial color="#a3a78a" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function GardenBollard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.11, 0.84, 10]} />
        <meshStandardMaterial color="#343d37" roughness={0.55} metalness={0.42} />
      </mesh>
      <mesh position={[0, 0.77, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.08, 10]} />
        <meshStandardMaterial color="#f0d8a9" emissive="#d4a868" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 0.85, 0]} color="#f0dbb5" intensity={1.4} distance={3.8} decay={2} />
    </group>
  );
}

function ExteriorGarden({ reducedMotion, stoneTexture, stoneNormal, lawnTexture }: {
  reducedMotion: boolean;
  stoneTexture: THREE.Texture;
  stoneNormal: THREE.Texture;
  lawnTexture: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, -0.58, 14]} receiveShadow>
        <boxGeometry args={[200, 0.1, 200]} />
        <meshStandardMaterial color="#a7ad98" map={lawnTexture} roughness={1} />
      </mesh>
      <mesh position={[0, -0.43, 8.95]} receiveShadow>
        <boxGeometry args={[7.2, 0.18, 3.2]} />
        <meshStandardMaterial color="#c8c0af" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.16, 0.16]} roughness={0.94} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[0, -0.43, 9.3 + index * 1.38]} receiveShadow>
          <boxGeometry args={[3.25, 0.14, 1.22]} />
          <meshStandardMaterial color={index % 2 ? "#d4ccbd" : "#cfc7b8"} map={stoneTexture} normalMap={stoneNormal} normalScale={[0.14, 0.14]} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 11.7, -0.27, 13.3]} receiveShadow>
            <boxGeometry args={[0.28, 0.62, 17]} />
            <meshStandardMaterial color="#b7b19f" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.12, 0.12]} roughness={0.9} />
          </mesh>
          <GardenPlanter position={[side * 6.15, -0.48, 13.15]} stoneTexture={stoneTexture} stoneNormal={stoneNormal} />
          <GardenTree position={[side * 6.15, -0.52, 12.8]} reducedMotion={reducedMotion} variant={side + 1} />
          {[10.75, 14.5].map((z) => (
            <GardenBollard key={z} position={[side * 2.18, -0.53, z]} />
          ))}
        </group>
      ))}
      <mesh position={[0, -0.505, 17.8]} receiveShadow>
        <boxGeometry args={[18.5, 0.16, 0.24]} />
        <meshStandardMaterial color="#b7b19f" map={stoneTexture} normalMap={stoneNormal} normalScale={[0.12, 0.12]} roughness={0.9} />
      </mesh>
    </group>
  );
}

function WallPhotograph({
  src,
  alt,
  caption,
  className = "",
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={`panel-photograph ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function WallPanel({
  panel,
  eyebrow,
  title,
  children,
  media,
  wallRefs,
}: {
  panel: keyof typeof WALL_MOUNTS;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  media?: ReactNode;
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
          <meshStandardMaterial color="#98764e" roughness={0.62} metalness={0.16} />
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
            {media}
            <h2>{title}</h2>
            {children}
          </article>
        </Html>
      </group>
    </group>
  );
}

function SceneContents({ progressRef, activeStage, stageProgress, reducedMotion }: HouseSceneProps) {
  const doorRef = useRef<THREE.Group | null>(null);
  const wallRefs: WallRefs = {
    back: useRef<THREE.Mesh | null>(null),
    left: useRef<THREE.Mesh | null>(null),
    right: useRef<THREE.Mesh | null>(null),
  };

  return (
    <>
      <color attach="background" args={["#e0d4c0"]} />
      <fog attach="fog" args={["#e0d4c0", 40, 96]} />
      <Sky distance={450000} sunPosition={[0.8, 0.55, 0.3]} turbidity={7} rayleigh={1.7} />
      <hemisphereLight args={["#fff5e4", "#8e8778", 0.72]} />
      <directionalLight
        position={[-8, 14, 11]}
        intensity={2.5}
        color="#fff2df"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={16}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[8, 9, -10]} intensity={0.62} color="#e3e3d6" />
      <HouseArchitecture doorRef={doorRef} wallRefs={wallRefs} reducedMotion={reducedMotion} />
      <CameraJourney
        progressRef={progressRef}
        stageProgress={stageProgress}
        reducedMotion={reducedMotion}
        doorRef={doorRef}
      />
      {activeStage === 2 && (
        <WallPanel
          panel="welcome"
          wallRefs={wallRefs}
          eyebrow="01 / A warm welcome"
          title={<>Good work<br />starts with<br />a feeling.</>}
          media={(
            <WallPhotograph
              src="/images/editorial-reference-exterior.webp"
              alt="A contemporary home with a limestone facade, timber details, and a quiet courtyard."
              caption="Architecture reference / stone · timber · light"
            />
          )}
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
          media={(
            <WallPhotograph
              src="/images/editorial-reference-living-room.webp"
              alt="A light-filled living room with tall windows, natural wood, and calm neutral materials."
              caption="Atmosphere / daylight · material · proportion"
            />
          )}
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
          media={(
            <WallPhotograph
              src="/images/editorial-reference-courtyard.webp"
              alt="A spare contemporary courtyard with sculptural trees and a stone bench."
              caption="Landscape reference / stillness · shade"
              className="panel-photograph-compact"
            />
          )}
        >
          <ul className="service-list">
            <li><span>01</span>Brand &amp; identity</li>
            <li><span>02</span>Places &amp; spaces</li>
            <li><span>03</span>Digital experiences</li>
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
          media={(
            <WallPhotograph
              src="/images/editorial-reference-entry.webp"
              alt="A modern residential entry with warm vertical timber fins and planted greenery."
              caption="Entry reference / timber · planting"
            />
          )}
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
          media={(
            <WallPhotograph
              src="/images/editorial-reference-interior.webp"
              alt="An understated interior hallway with limestone flooring and a warm oak feature wall."
              caption="Material notes / limestone · oak"
              className="panel-photograph-compact"
            />
          )}
        >
          <p>Tell us what you’re imagining. We’d love to hear about it.</p>
          <a className="panel-link" href="mailto:hello@fieldhouse.studio">hello@fieldhouse.studio <span aria-hidden="true">↗</span></a>
          <span className="panel-mark" aria-hidden="true">THANKS FOR STOPPING BY</span>
        </WallPanel>
      )}
    </>
  );
}

export function HouseScene({ progressRef, activeStage, stageProgress, reducedMotion }: HouseSceneProps) {
  return (
    <div className="three-scene" aria-label="An interactive three-dimensional house">
      <SceneErrorBoundary>
        <Canvas
        shadows="percentage"
        dpr={[1, 1.4]}
        camera={{ position: [9, 7.4, 20], fov: 41, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
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
          <SceneContents progressRef={progressRef} activeStage={activeStage} stageProgress={stageProgress} reducedMotion={reducedMotion} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
