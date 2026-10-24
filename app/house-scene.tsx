"use client";

import { ContactShadows, Environment, Html, Lightformer, RoundedBox, useProgress } from "@react-three/drei";
import { CHARCOAL, TRAVERTINE, W, UMBER } from "../src/lib/fh-tokens";
import { gradientTexture, radialTexture, stripeTexture } from "../src/lib/fh-textures";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  welcome: { widths: [350, 300, 264], heights: [410, 350, 315] },
  about: { widths: [350, 300, 264], heights: [410, 350, 315] },
  services: { widths: [350, 300, 264], heights: [410, 350, 315] },
  work: { widths: [350, 300, 264], heights: [410, 350, 315] },
  contact: { widths: [350, 300, 264], heights: [410, 350, 315] },
} as const;

const PANEL_DISTANCE_FACTOR = 2.5;
const STAGE_PROGRESS = [0, 0.14, 0.28, 0.43, 0.58, 0.73, 0.88];

type WallRefs = Record<"back" | "left" | "right", MutableRefObject<THREE.Mesh | null>>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const easeInOut = (value: number) => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2;

function arrivalCamera(aspect: number, width: number, origin: THREE.Vector3) {
  const fov = 30;
  const elevation = THREE.MathUtils.degToRad(14.5);
  const azimuth = THREE.MathUtils.degToRad(22);
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const horizontalTangent = verticalTangent * aspect;
  const fraction = aspect >= 1 ? 0.667 : 0.92;
  const radius = Math.max((3 * width) / (2 * horizontalTangent * fraction), 4.43 * width);
  const look = origin.clone().add(new THREE.Vector3(0, 0.35 * width, -0.1 * width));
  const position = look.clone().add(new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).multiplyScalar(radius));
  return { position, look, fov };
}

type HouseSceneProps = {
  progressRef: MutableRefObject<number>;
  activeStage: number;
  inside: boolean;
  reducedMotion: boolean;
  onState(stage: number, inside: boolean): void;
};

function CameraJourney({ progressRef, doorRef, reducedMotion, onState }: Pick<HouseSceneProps, "progressRef" | "reducedMotion" | "onState"> & {
  doorRef: MutableRefObject<THREE.Group | null>;
}) {
  const currentProgress = useRef(0);
  const cameraPositionRef = useRef(new THREE.Vector3());
  const cameraTargetRef = useRef(new THREE.Vector3());
  const fromPositionRef = useRef(new THREE.Vector3());
  const toPositionRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const arrivalRef = useRef<ReturnType<typeof arrivalCamera> | null>(null);
  const arrivalAspectRef = useRef(-1);
  const insideRef = useRef(false);
  const lastStageRef = useRef(-1);
  const lastInsideRef = useRef(false);
  const layerValues = useRef<Record<string, number>>({});
  const origin = useMemo(() => new THREE.Vector3(0.41, 0, 6.03), []);

  useFrame(({ camera, size, clock }, delta) => {
    currentProgress.current = THREE.MathUtils.damp(
      currentProgress.current,
      clamp01(progressRef.current),
      reducedMotion ? 20 : 4.5,
      delta,
    );
    const progress = currentProgress.current;
    const keys = CAMERA_STOPS;
    const aspect = size.width / Math.max(1, size.height);
    if (aspect !== arrivalAspectRef.current) {
      arrivalRef.current = arrivalCamera(aspect, W, origin);
      arrivalAspectRef.current = aspect;
    }
    const arrival = arrivalRef.current!;
    let endIndex = 1;
    while (endIndex < keys.length - 1 && progress > keys[endIndex].progress) endIndex += 1;
    const start = keys[endIndex - 1];
    const end = keys[endIndex];
    const local = clamp01((progress - start.progress) / (end.progress - start.progress));
    const t = easeInOut(clamp01((local - 0.15) / 0.7));
    if (endIndex === 1) {
      fromPositionRef.current.copy(arrival.position);
      fromTargetRef.current.copy(arrival.look);
    } else {
      fromPositionRef.current.set(...start.position);
      fromTargetRef.current.set(...start.target);
    }
    toPositionRef.current.set(...end.position);
    toTargetRef.current.set(...end.target);
    cameraPositionRef.current.copy(fromPositionRef.current).lerp(toPositionRef.current, t);
    cameraTargetRef.current.copy(fromTargetRef.current).lerp(toTargetRef.current, t);

    const doorProgress = smooth(clamp01((progress - 0.14) / 0.14));
    const fieldOfView = THREE.MathUtils.lerp(30, 38, doorProgress);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fieldOfView) {
      camera.fov = fieldOfView;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(cameraPositionRef.current);
    camera.lookAt(cameraTargetRef.current);
    if (!reducedMotion) {
      camera.position.y += Math.sin(clock.elapsedTime * 0.6) * 0.004 * W;
      cameraTargetRef.current.x += Math.sin(clock.elapsedTime * 0.4) * 0.003 * W;
      camera.lookAt(cameraTargetRef.current);
    }

    if (doorRef.current) {
      const opening = clamp01((progress - 0.07) / 0.1);
      doorRef.current.rotation.y = Math.sin(opening * Math.PI * 0.5) * 1.36;
    }

    const distancePastDoor = HOUSE.frontZ - camera.position.z;
    if (!insideRef.current && distancePastDoor > 0.15 * W) insideRef.current = true;
    else if (insideRef.current && distancePastDoor < 0.05 * W) insideRef.current = false;

    let nearest = 0;
    for (let index = 1; index < STAGE_PROGRESS.length; index += 1) {
      if (Math.abs(progress - STAGE_PROGRESS[index]) < Math.abs(progress - STAGE_PROGRESS[nearest])) nearest = index;
    }
    if (nearest !== lastStageRef.current || insideRef.current !== lastInsideRef.current) {
      lastStageRef.current = nearest;
      lastInsideRef.current = insideRef.current;
      onState(nearest, insideRef.current);
    }

    const t0 = clamp01((progress - keys[0].progress) / (keys[1].progress - keys[0].progress));
    const values = {
      "--hero-o": 1 - smooth(clamp01((t0 - 0.05) / 0.45)),
      "--wm-o": 1 - smooth(clamp01((t0 - 0.2) / 0.6)),
      "--wm-y": -60 * smooth(t0),
      "--wm-s": 1 + 0.06 * smooth(t0),
    };
    for (const [name, value] of Object.entries(values)) {
      const previous = layerValues.current[name];
      if (previous === undefined || Math.abs(value - previous) > 0.01) {
        document.documentElement.style.setProperty(name, name === "--wm-y" ? `${value.toFixed(1)}px` : String(value));
        layerValues.current[name] = value;
      }
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
  const facadeTexture = useMemo(() => stripeTexture({
    vertical: true,
    lineFrac: 0.07,
    bg: "#EFE8D8",
    line: "#D3C5A6",
    repeat: [16, 1],
  }), []);
  const sideTexture = useMemo(() => stripeTexture({
    vertical: false,
    lineFrac: 0.05,
    bg: "#B9AC92",
    line: "#A89A7F",
    repeat: [1, 7],
  }), []);
  const windowTexture = useMemo(() => gradientTexture([
    [0, "#202523"],
    [0.5, "#3B4038"],
    [1, "#F2C47C"],
  ]), []);

  return (
    <group>
      <mesh position={[0, -0.265, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width + HOUSE.wallThickness, 0.53, HOUSE.depth + HOUSE.wallThickness]} />
        <meshStandardMaterial color="#d5cbb8" roughness={0.9} />
      </mesh>
      <mesh ref={wallRefs.back} position={[0, HOUSE.wallHeight / 2, HOUSE.backZ]} receiveShadow>
        <boxGeometry args={[HOUSE.width, HOUSE.wallHeight, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#CDBE9F" roughness={0.95} />
      </mesh>
      <mesh ref={wallRefs.left} position={[-HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#B9AC92" map={sideTexture} roughness={0.92} />
      </mesh>
      <mesh ref={wallRefs.right} position={[HOUSE.sideX, HOUSE.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.wallThickness, HOUSE.wallHeight, HOUSE.depth]} />
        <meshStandardMaterial color="#B9AC92" map={sideTexture} roughness={0.92} />
      </mesh>
      <FrontOpeningWall centerX={-3.8} facadeTexture={facadeTexture} />
      <FrontOpeningWall centerX={3.8} facadeTexture={facadeTexture} />
      {[-2, 2].map((centerX) => (
        <mesh key={centerX} position={[centerX, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[1.2, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 4.575, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[2.8, 1.25, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.92} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.frontZ + HOUSE.wallThickness / 2]}>
        <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gable} position={[0, HOUSE.wallHeight, HOUSE.backZ - HOUSE.wallThickness / 2]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-2.5, 6.525, 0]} rotation={[0, 0, 0.487]} castShadow receiveShadow>
        <boxGeometry args={[5.66, 0.3, 15.2]} />
        <meshStandardMaterial color="#232320" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[2.5, 6.525, 0]} rotation={[0, 0, -0.487]} castShadow receiveShadow>
        <boxGeometry args={[5.66, 0.3, 15.2]} />
        <meshStandardMaterial color="#232320" metalness={0.35} roughness={0.55} />
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
        <meshStandardMaterial color="#232320" metalness={0.35} roughness={0.55} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 4.72, 0.14, 0]}>
          <boxGeometry args={[0.08, 0.28, 13.6]} />
          <meshStandardMaterial color="#B3A07E" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 0.14, -6.84]}>
        <boxGeometry args={[9.4, 0.28, 0.08]} />
        <meshStandardMaterial color="#B3A07E" roughness={0.72} />
      </mesh>
      <mesh position={[-3.8, 0.14, 6.84]}>
        <boxGeometry args={[2.25, 0.28, 0.08]} />
        <meshStandardMaterial color="#B3A07E" roughness={0.72} />
      </mesh>
      <mesh position={[3.8, 0.14, 6.84]}>
        <boxGeometry args={[2.25, 0.28, 0.08]} />
        <meshStandardMaterial color="#B3A07E" roughness={0.72} />
      </mesh>
      <Door ref={doorRef} />
      <DoorFrame />
      <FrontWindow position={[-3.8, 3.08, 7.17]} glassTexture={windowTexture} />
      <FrontWindow position={[3.8, 3.08, 7.17]} glassTexture={windowTexture} />
      <HouseDetails />
    </group>
  );
}

function ExteriorModel({ inside }: { inside: boolean }) {
  const plinthTexture = useMemo(() => radialTexture("#F4ECDA", "#D6C8AB"), []);
  const shadowTexture = useMemo(() => radialTexture("rgba(58,46,28,0.30)"), []);
  const windowTexture = useMemo(() => gradientTexture([
    [0, "#202523"],
    [0.5, "#3B4038"],
    [1, "#F2C47C"],
  ]), []);
  const doorLightTexture = useMemo(() => gradientTexture([
    [0, "#F6D58E"],
    [1, "#E9A95A"],
  ]), []);
  const glowTexture = useMemo(() => radialTexture("rgba(240,194,122,0.45)"), []);
  const lampTexture = useMemo(() => radialTexture("rgba(246,213,142,0.85)"), []);
  const roofSeamMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#3A3A35",
    roughness: 0.55,
  }), []);
  const pathShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.15, -0.18);
    shape.lineTo(0.15, -0.18);
    shape.lineTo(0.23, -1.42);
    shape.lineTo(-0.23, -1.42);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  return (
    <>
      <group position={[0.41, 0, 6.03]} scale={W} visible={!inside}>
        <mesh position={[0, -0.04375, 0]} receiveShadow>
          <cylinderGeometry args={[1.5, 1.5, 0.0875, 128]} />
          <meshStandardMaterial color={TRAVERTINE} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.5, 128]} />
          <meshStandardMaterial color="#EAE0CB" map={plinthTexture} roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.002, 6, 128]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
        </mesh>
        <mesh position={[-0.05, 0.022, -0.45]} receiveShadow castShadow>
          <boxGeometry args={[1.04, 0.044, 1.14]} />
          <meshStandardMaterial color="#D6C8AA" roughness={0.9} />
        </mesh>
        <mesh geometry={pathShape} position={[-0.05, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <meshStandardMaterial color="#F3EBDA" roughness={0.95} />
        </mesh>
        <mesh position={[-0.05, 0.033, 0.12]} castShadow receiveShadow>
          <boxGeometry args={[0.2875, 0.022, 0.06]} />
          <meshStandardMaterial color="#F1E8D4" roughness={0.9} />
        </mesh>
        <mesh position={[-0.05, 0.011, 0.15]} castShadow receiveShadow>
          <boxGeometry args={[0.3375, 0.022, 0.06]} />
          <meshStandardMaterial color="#DFD2B7" roughness={0.9} />
        </mesh>
        <mesh position={[-0.05, 0.377, 0.145]} castShadow>
          <boxGeometry args={[0.3625, 0.022, 0.09]} />
          <meshStandardMaterial color="#151513" roughness={0.55} />
        </mesh>
        <mesh position={[-0.05, 0.355, 0.192]}>
          <planeGeometry args={[0.3625, 0.05]} />
          <meshBasicMaterial map={glowTexture} transparent depthWrite={false} />
        </mesh>
        <mesh position={[0.05, 0.22, 0.126]}>
          <boxGeometry args={[0.056, 0.344, 0.008]} />
          <meshBasicMaterial map={doorLightTexture} toneMapped={false} />
        </mesh>
        {[-0.194, 0.094].map((x) => (
          <group key={x} position={[x, 0.256, 0.117]}>
            <mesh>
              <boxGeometry args={[0.019, 0.044, 0.02]} />
              <meshStandardMaterial color="#151513" roughness={0.55} />
            </mesh>
            <sprite position={[0, -0.025, 0.015]} scale={[0.12, 0.12, 1]}>
              <spriteMaterial map={lampTexture} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </sprite>
            <pointLight color="#F6D58E" intensity={0.8} distance={0.7} decay={2} />
          </group>
        ))}
        {[-0.421, 0.339].map((x) => (
          <sprite key={x} position={[x, 0.27, 0.137]} scale={[0.34, 0.42, 1]}>
            <spriteMaterial map={glowTexture} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[-0.05 + side * 1.05, 0.0625, side < 0 ? -0.1 : -0.3]}
            castShadow
          >
            <cylinderGeometry args={[0.006, 0.006, side < 0 ? 0.125 : 0.11, 12]} />
            <meshStandardMaterial color="#5A4630" roughness={0.9} />
            <mesh position={[0, side < 0 ? 0.125 : 0.11, 0]} scale={[1, 0.95, 1.02]}>
              <icosahedronGeometry args={[side < 0 ? 0.125 : 0.106, 3]} />
              <meshStandardMaterial color="#7B8160" roughness={1} />
            </mesh>
          </mesh>
        ))}
        {[
          [-0.52, 0.04, 0.78, 0.094],
          [0.12, 0.03, 0.85, 0.07],
        ].map(([x, y, z, radius]) => (
          <mesh key={`${x}-${z}`} position={[x, y, z]} scale={[1, 0.66, 1]}>
            <icosahedronGeometry args={[radius, 2]} />
            <meshStandardMaterial color="#7B8160" roughness={1} />
          </mesh>
        ))}
      </group>
      <ContactShadows
        position={[0.41, 0.03, 3.03]}
        opacity={0.4}
        scale={3.4 * W}
        blur={2.6}
        far={1.2 * W}
        resolution={1024}
        color="#3B2F1D"
        frames={1}
        visible={!inside}
      />
      <group visible={!inside}>
        {Array.from({ length: 9 }, (_, index) => {
          const z = -6.4 + index * 1.6;
          return (
            <group key={z}>
              <mesh position={[-1.25, 6.6, z]} rotation={[0, 0, 0.487]}>
                <boxGeometry args={[5.7, 0.025, 0.02]} />
                <primitive object={roofSeamMaterial} attach="material" />
              </mesh>
              <mesh position={[1.25, 6.6, z]} rotation={[0, 0, -0.487]}>
                <boxGeometry args={[5.7, 0.025, 0.02]} />
                <primitive object={roofSeamMaterial} attach="material" />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}

function InteriorFloorboards() {
  const boardsRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.176, 0.035, 14), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8E6D48", roughness: 0.38, envMapIntensity: 0.6 }), []);

  useLayoutEffect(() => {
    if (!boardsRef.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color("#8E6D48");

    for (let index = 0; index < 56; index += 1) {
      matrix.makeTranslation(-5 + index * 0.18 + 0.09, 0.04, 0);
      boardsRef.current.setMatrixAt(index, matrix);
      const variation = ((index * 17) % 9 - 4) * 0.01;
      boardsRef.current.setColorAt(index, color.clone().offsetHSL(0, 0, variation));
    }

    boardsRef.current.instanceMatrix.needsUpdate = true;
    boardsRef.current.instanceColor!.needsUpdate = true;
    boardsRef.current.computeBoundingSphere();
  }, []);

  return <instancedMesh ref={boardsRef} args={[geometry, material, 56]} receiveShadow />;
}

function FrontOpeningWall({ centerX, facadeTexture }: { centerX: number; facadeTexture: THREE.Texture }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[centerX + side * 0.99, HOUSE.wallHeight / 2, HOUSE.frontZ]} receiveShadow>
          <boxGeometry args={[0.42, HOUSE.wallHeight, HOUSE.wallThickness]} />
          <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[centerX, 0.975, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.95, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.92} />
      </mesh>
      <mesh position={[centerX, 4.325, HOUSE.frontZ]} receiveShadow>
        <boxGeometry args={[1.3, 1.75, HOUSE.wallThickness]} />
        <meshStandardMaterial color="#EFE8D8" map={facadeTexture} roughness={0.92} />
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
          <meshStandardMaterial color="#161614" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.87, 0]} castShadow>
        <boxGeometry args={[2.94, 0.16, 0.22]} />
        <meshStandardMaterial color="#161614" roughness={0.6} />
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
        <meshStandardMaterial color="#241911" roughness={0.63} />
      </mesh>
      {[0.36, 1.3, 2.25].map((height) => (
        <mesh key={height} position={[1.27, height, 0.105]}>
          <boxGeometry args={[2.1, 0.66, 0.045]} />
          <meshStandardMaterial color="#241911" roughness={0.66} />
        </mesh>
      ))}
      <mesh position={[2.24, 1.85, 0.17]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#c7a873" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FrontWindow({ position, glassTexture }: { position: [number, number, number]; glassTexture: THREE.Texture }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.625, 2.69, 0.13]} />
        <meshStandardMaterial color="#161614" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[1.375, 2.44, 0.05]} />
        <meshBasicMaterial map={glassTexture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[0.075, 2.4, 0.045]} />
        <meshStandardMaterial color="#161614" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[1.15, 0.045, 0.045]} />
        <meshStandardMaterial color="#161614" roughness={0.6} />
      </mesh>
      <mesh position={[0, -1.4, 0.12]} castShadow>
        <boxGeometry args={[1.875, 0.125, 0.3]} />
        <meshStandardMaterial color="#D6C8AA" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.82, 0.12]} castShadow>
        <boxGeometry args={[1.64, 0.12, 0.32]} />
        <meshStandardMaterial color="#D6C8AA" roughness={0.72} />
      </mesh>
    </group>
  );
}

function FlutedWall({ length, height, position, rotation }: {
  length: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const pitch = 0.06;
  const count = Math.floor(length / pitch);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      matrix.makeTranslation(-length / 2 + pitch * (index + 0.5), 0, 0.009);
      ref.current.setMatrixAt(index, matrix);
      const random = Math.sin(index * 12.9898) * 43758.5453;
      color.set("#8E6A44").offsetHSL(0, 0, (random - Math.floor(random) - 0.5) * 0.05);
      ref.current.setColorAt(index, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [count, length]);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.005]} receiveShadow>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial color="#2E1F12" roughness={1} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
        <boxGeometry args={[0.04, height, 0.018]} />
        <meshStandardMaterial color="#8E6A44" roughness={0.55} />
      </instancedMesh>
    </group>
  );
}

const VASE_PROFILE = [
  [0, 0], [0.07, 0], [0.095, 0.06], [0.1, 0.13], [0.085, 0.21], [0.05, 0.28], [0.04, 0.33], [0.048, 0.35],
].map(([radius, height]) => new THREE.Vector2(radius, height));

function HouseDetails() {
  const slotGlow = useMemo(() => radialTexture("rgba(255,228,168,0.5)"), []);
  const backShade = useMemo(() => gradientTexture([
    [0, "rgba(255,244,220,0.10)"],
    [1, "rgba(60,40,15,0.12)"],
  ]), []);
  const leftShade = useMemo(() => gradientTexture([
    [0, "rgba(20,12,4,0.55)"],
    [1, "rgba(20,12,4,0)"],
  ], { vertical: false }), []);
  const rightShade = useMemo(() => gradientTexture([
    [0, "rgba(30,20,8,0.45)"],
    [1, "rgba(30,20,8,0)"],
  ], { vertical: false }), []);
  const floorShade = useMemo(() => gradientTexture([
    [0, "rgba(20,10,0,0.55)"],
    [1, "rgba(20,10,0,0)"],
  ]), []);
  const ceilingShade = useMemo(() => gradientTexture([
    [0, "rgba(0,0,0,0.5)"],
    [1, "rgba(0,0,0,0)"],
  ]), []);
  const lightCone = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.05, 5.2);
    shape.lineTo(1.05, 5.2);
    shape.lineTo(3.8, 0);
    shape.lineTo(-3.8, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const floorPool = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.9, 0);
    shape.lineTo(0.9, 0);
    shape.lineTo(1.8, -4.2);
    shape.lineTo(-1.8, -4.2);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const coneTexture = useMemo(() => gradientTexture([
    [0, "rgba(255,240,200,0.7)"],
    [1, "rgba(255,240,200,0)"],
  ]), []);
  const floorPoolTexture = useMemo(() => radialTexture("rgba(255,235,192,0.13)"), []);
  const contactTexture = useMemo(() => radialTexture("rgba(0,0,0,0.4)"), []);
  const nicheTexture = useMemo(() => gradientTexture([[0, "#7F6D52"], [1, "#C4B394"]]), []);
  const nicheShape = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 0.095 * HOUSE.width;
    const height = 0.36 * HOUSE.wallHeight;
    const radius = width / 2;
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, height - radius);
    shape.absarc(0, height - radius, radius, 0, Math.PI, false);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const branch = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.04, 0.18, 0),
      new THREE.Vector3(0.02, 0.38, 0),
      new THREE.Vector3(0.08, 0.55, 0),
    ]),
    12,
    0.004,
    6,
    false,
  ), []);
  const spotlightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 2.6, HOUSE.backZ);
    return target;
  }, []);
  const nicheX = 3.475;
  const nicheY = 0.1 * HOUSE.wallHeight;
  const nicheZ = HOUSE.backZ + HOUSE.wallThickness / 2 + 0.02;

  return (
    <group>
      <mesh position={[0, -0.445, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width + 0.3, 0.17, HOUSE.depth + 0.3]} />
        <meshStandardMaterial color="#2A211A" roughness={1} />
      </mesh>
      <mesh position={[0, 0.018, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width, 0.03, HOUSE.depth]} />
        <meshStandardMaterial color="#24180D" roughness={1} />
      </mesh>
      <InteriorFloorboards />
      <mesh position={[0, HOUSE.wallHeight, 0]} receiveShadow>
        <boxGeometry args={[HOUSE.width, 0.08, HOUSE.depth]} />
        <meshStandardMaterial color="#3A2D22" roughness={1} />
      </mesh>
      <FlutedWall length={HOUSE.depth} height={HOUSE.wallHeight} position={[-HOUSE.sideX + 0.12, HOUSE.wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh position={[HOUSE.sideX - HOUSE.wallThickness / 2 - 0.004, HOUSE.wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[HOUSE.depth, HOUSE.wallHeight]} />
        <meshStandardMaterial color="#9C8B6E" roughness={0.95} />
      </mesh>
      <mesh position={[0, HOUSE.wallHeight / 2, HOUSE.backZ + HOUSE.wallThickness / 2 + 0.006]}>
        <planeGeometry args={[HOUSE.width, HOUSE.wallHeight]} />
        <meshBasicMaterial map={backShade} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[-HOUSE.sideX + 0.145, HOUSE.wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[HOUSE.depth, HOUSE.wallHeight]} />
        <meshBasicMaterial map={leftShade} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[HOUSE.sideX - HOUSE.wallThickness / 2 - 0.002, HOUSE.wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[HOUSE.depth, HOUSE.wallHeight]} />
        <meshBasicMaterial map={rightShade} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[0, HOUSE.wallHeight - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HOUSE.width, HOUSE.depth]} />
        <meshBasicMaterial map={ceilingShade} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HOUSE.width, HOUSE.depth]} />
        <meshBasicMaterial map={floorShade} transparent depthWrite={false} />
      </mesh>
      {[-HOUSE.sideX + 0.12, HOUSE.sideX - 0.12].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry args={[0.015, 0.07, HOUSE.depth]} />
          <meshStandardMaterial color="#B3A07E" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.035, HOUSE.backZ + 0.12]}>
        <boxGeometry args={[HOUSE.width, 0.07, 0.015]} />
        <meshStandardMaterial color="#B3A07E" roughness={0.8} />
      </mesh>
      <mesh position={[0, HOUSE.wallHeight - 0.025, HOUSE.backZ + 0.16]}>
        <boxGeometry args={[0.66 * HOUSE.width, 0.015 * HOUSE.wallHeight, 0.04]} />
        <meshBasicMaterial color="#FFF1CC" toneMapped={false} />
      </mesh>
      <mesh position={[0, HOUSE.wallHeight - 0.035, HOUSE.backZ + 0.18]}>
        <planeGeometry args={[0.72 * HOUSE.width, 0.05 * HOUSE.wallHeight]} />
        <meshBasicMaterial map={slotGlow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={nicheShape} position={[nicheX, nicheY, nicheZ]}>
        <meshBasicMaterial map={nicheTexture} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[nicheX, nicheY, nicheZ + 0.02]}>
        <boxGeometry args={[0.12 * HOUSE.width, 0.016 * HOUSE.wallHeight, 0.12]} />
        <meshStandardMaterial color="#EADFCB" roughness={0.8} />
      </mesh>
      <mesh position={[nicheX, nicheY + 0.04, nicheZ + 0.09]}>
        <latheGeometry args={[VASE_PROFILE, 48]} />
        <meshStandardMaterial color="#E8DDC7" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={branch} position={[nicheX, nicheY + 0.39, nicheZ + 0.09]}>
        <meshStandardMaterial color="#5A4630" roughness={0.85} />
      </mesh>
      <mesh position={[nicheX + 0.05, nicheY + 0.68, nicheZ + 0.09]} rotation={[0, 0, 0.48]}>
        <cylinderGeometry args={[0.004, 0.004, 0.24, 6]} />
        <meshStandardMaterial color="#5A4630" roughness={0.85} />
      </mesh>
      <mesh position={[nicheX + 0.01, nicheY + 0.58, nicheZ + 0.09]} rotation={[0, 0, -0.38]}>
        <cylinderGeometry args={[0.004, 0.004, 0.18, 6]} />
        <meshStandardMaterial color="#5A4630" roughness={0.85} />
      </mesh>
      <RoundedBox args={[1.8, 0.42, 0.5]} radius={0.12} smoothness={6} position={[-0.16 * HOUSE.width, 0.21, HOUSE.backZ + 1.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#E5D9C3" roughness={0.9} />
      </RoundedBox>
      <mesh position={[-1.6, 0.06, HOUSE.backZ + 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 0.9]} />
        <meshBasicMaterial map={contactTexture} transparent depthWrite={false} />
      </mesh>
      <mesh position={[3, 0.04, HOUSE.backZ + 1.2]} scale={1.6}>
        <latheGeometry args={[VASE_PROFILE, 48]} />
        <meshStandardMaterial color="#D8CBB0" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[3, 0.06, HOUSE.backZ + 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.5]} />
        <meshBasicMaterial map={contactTexture} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={lightCone} position={[0, 0, HOUSE.backZ + HOUSE.wallThickness / 2 + 0.012]}>
        <meshBasicMaterial map={coneTexture} transparent blending={THREE.AdditiveBlending} opacity={0.55} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={floorPool} position={[0, 0.06, HOUSE.backZ + 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial map={floorPoolTexture} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <primitive object={spotlightTarget} />
      <pointLight color="#FFD9A0" intensity={6} distance={8} decay={2} position={[0, HOUSE.wallHeight * 0.7, 0]} />
      <spotLight color="#FFF0C8" intensity={60} angle={0.5} penumbra={0.85} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} position={[0, HOUSE.wallHeight - 0.15, HOUSE.backZ + 0.9]} target={spotlightTarget} />
      <hemisphereLight args={["#FFE9C4", "#4A3623", 0.35]} />
    </group>
  );
}

function WallPanel({
  panel,
  eyebrow,
  title,
  children,
  wallRefs,
  footerRight = "NEXT CHAPTER →",
}: {
  panel: keyof typeof WALL_MOUNTS;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  wallRefs: WallRefs;
  footerRight?: string;
}) {
  const { size } = useThree();
  const mount = WALL_MOUNTS[panel];
  const layout = PANEL_LAYOUTS[panel];
  const breakpoint = size.width < 540 ? 2 : size.width < 800 ? 1 : 0;
  const contentWidth = layout.widths[breakpoint] * PANEL_DISTANCE_FACTOR / 400;
  const contentHeight = layout.heights[breakpoint] * PANEL_DISTANCE_FACTOR / 400;
  const frameWidth = contentWidth + 0.035;
  const frameHeight = contentHeight + 0.035;

  return (
    <group position={mount.wallPosition}>
      <group position={mount.position} rotation={[0, mount.rotation, 0]}>
        {panel === "about" && (
          <mesh position={[0, 0, -0.13]} castShadow receiveShadow>
            <boxGeometry args={[frameWidth + 0.5, frameHeight + 0.5, 0.02]} />
            <meshStandardMaterial color="#8E6A44" roughness={0.7} />
          </mesh>
        )}
        <mesh position={[0, 0, -0.04]} castShadow receiveShadow>
          <boxGeometry args={[frameWidth, frameHeight, 0.07]} />
          <meshStandardMaterial color="#5A3A22" roughness={0.55} />
        </mesh>
        <Html
          transform
          position={[0, 0, 0.014]}
          distanceFactor={PANEL_DISTANCE_FACTOR}
          occlude={[wallRefs[mount.wall] as unknown as RefObject<THREE.Object3D>]}
          zIndexRange={[10, 0]}
        >
          <article className={`wall-panel panel-${panel}`}>
            <div className="panel-paper">
              <p className="panel-eyebrow">{eyebrow}</p>
              <div className="panel-image" aria-hidden="true" />
              <h2>{title}</h2>
              <div className="panel-copy">{children}</div>
              <footer className="panel-footer">
                <span>F — {panel === "welcome" ? "01" : panel === "about" ? "02" : panel === "services" ? "03" : panel === "work" ? "04" : "05"}</span>
                <span>{footerRight}</span>
              </footer>
            </div>
          </article>
        </Html>
        <mesh position={[0, -frameHeight / 2 - 0.1375, 0.025]}>
          <boxGeometry args={[0.6, 0.1, 0.02]} />
          <meshStandardMaterial color="#B8975E" metalness={0.6} roughness={0.4} />
        </mesh>
        <Html transform position={[0, -frameHeight / 2 - 0.1375, 0.039]} distanceFactor={PANEL_DISTANCE_FACTOR} zIndexRange={[10, 0]}>
          <div className="panel-nameplate">FIELDHOUSE</div>
        </Html>
      </group>
    </group>
  );
}

function SceneLoader() {
  const { progress } = useProgress();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (progress < 100) return;
    const timeout = window.setTimeout(() => setVisible(false), 600);
    return () => window.clearTimeout(timeout);
  }, [progress]);

  if (!visible) return null;
  return (
    <Html fullscreen>
      <div className={`scene-loader${progress >= 100 ? " scene-loader--ready" : ""}`} aria-live="polite">
        <span>FIELDHOUSE</span>
        <div className="scene-loader__track"><div style={{ width: `${progress}%` }} /></div>
      </div>
    </Html>
  );
}

function SceneContents({ progressRef, activeStage, inside, reducedMotion, onState }: HouseSceneProps) {
  const doorRef = useRef<THREE.Group | null>(null);
  const wallRefs: WallRefs = {
    back: useRef<THREE.Mesh | null>(null),
    left: useRef<THREE.Mesh | null>(null),
    right: useRef<THREE.Mesh | null>(null),
  };

  return (
    <>
      <hemisphereLight args={["#FFF3DC", "#9A9170", 0.55]} />
      <directionalLight
        position={[-0.9 * W, 1.9 * W, 1.6 * W]}
        intensity={2.4}
        color="#FFE8C2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02 * W}
        shadow-camera-near={0.1 * W}
        shadow-camera-far={6 * W}
        shadow-camera-left={-2 * W}
        shadow-camera-right={2 * W}
        shadow-camera-top={2 * W}
        shadow-camera-bottom={-2 * W}
      />
      <directionalLight color="#F3E3C8" intensity={0.35} position={[2 * W, 0.8 * W, 1 * W]} />
      <Environment resolution={128} frames={1} environmentIntensity={0.3}>
        <Lightformer form="rect" intensity={2} color="#FFF1D6" position={[-3, 4, 5]} scale={[8, 5, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#F3E3C8" position={[5, 2, 2]} scale={[6, 4, 1]} />
      </Environment>
      <SceneLoader />
      <HouseArchitecture doorRef={doorRef} wallRefs={wallRefs} />
      <ExteriorModel inside={inside} />
      <CameraJourney progressRef={progressRef} doorRef={doorRef} reducedMotion={reducedMotion} onState={onState} />
      {activeStage === 2 && (
        <WallPanel
          panel="welcome"
          wallRefs={wallRefs}
          eyebrow="(01) A warm welcome"
          title={<>Good work starts with <i>a feeling.</i></>}
          footerRight="NEXT CHAPTER →"
        >
          <p>We make places, identities, and digital experiences with warmth, purpose, and a point of view.</p>
        </WallPanel>
      )}
      {activeStage === 3 && (
        <WallPanel
          panel="about"
          wallRefs={wallRefs}
          eyebrow="(02) Our story"
          title={<>Small studio. Room for <i>big ideas.</i></>}
          footerRight="Est. MMXVI"
        >
          <p>Fieldhouse brings strategy, design, and craft together to make work with a lasting sense of place.</p>
        </WallPanel>
      )}
      {activeStage === 4 && (
        <WallPanel
          panel="services"
          wallRefs={wallRefs}
          eyebrow="(03) What we do"
          title={<>From first sketch to <i>final detail.</i></>}
          footerRight="A good place to begin"
        >
          <ul className="service-list">
            <li><span>01</span>Brand &amp; identity</li>
            <li><span>02</span>Places &amp; spaces</li>
            <li><span>03</span>Digital experiences</li>
          </ul>
        </WallPanel>
      )}
      {activeStage === 5 && (
        <WallPanel
          panel="work"
          wallRefs={wallRefs}
          eyebrow="(04) A few good things"
          title={<>Made to <i>belong.</i></>}
          footerRight="NEXT CHAPTER →"
        >
          <p>From quiet neighborhood landmarks to ambitious digital homes, we make the useful feel unforgettable.</p>
          <a className="panel-link" href="mailto:hello@fieldhouse.studio?subject=Selected%20work">Ask us about our work <span aria-hidden="true">↗</span></a>
        </WallPanel>
      )}
      {activeStage === 6 && (
        <WallPanel
          panel="contact"
          wallRefs={wallRefs}
          eyebrow="(05) Come say hello"
          title={<>There’s room for what’s <i>next.</i></>}
          footerRight="Thanks for stopping by"
        >
          <p>Tell us what you’re imagining. We’d love to hear about it.</p>
          <a className="panel-link" href="mailto:hello@fieldhouse.studio">hello@fieldhouse.studio <span aria-hidden="true">↗</span></a>
        </WallPanel>
      )}
    </>
  );
}

export function HouseScene(props: HouseSceneProps) {
  const { progressRef } = props;
  return (
    <div className="three-scene" aria-label="An interactive three-dimensional house">
      <Canvas
        shadows="soft"
        dpr={[1, 1.75]}
        camera={{ position: [9, 7.4, 20], fov: 30, near: 0.05, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = null;
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
        <SceneContents {...props} />
      </Canvas>
    </div>
  );
}
