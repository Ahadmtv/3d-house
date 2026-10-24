import * as THREE from "three";

type GradientStop = [number, string];

export function gradientTexture(
  stops: GradientStop[],
  options: { vertical?: boolean; size?: number } = {},
) {
  const { vertical = true, size = 256 } = options;
  const canvas = document.createElement("canvas");
  canvas.width = vertical ? 4 : size;
  canvas.height = vertical ? size : 4;
  const context = canvas.getContext("2d")!;
  const gradient = vertical
    ? context.createLinearGradient(0, 0, 0, size)
    : context.createLinearGradient(0, 0, size, 0);

  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function radialTexture(
  inner: string,
  outer = "rgba(0,0,0,0)",
  size = 256,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );

  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function stripeTexture(options: {
  vertical: boolean;
  lineFrac: number;
  bg: string;
  line: string;
  repeat: [number, number];
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = options.bg;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = options.line;
  const thickness = Math.max(1, Math.round(128 * options.lineFrac));

  if (options.vertical) context.fillRect(0, 0, thickness, 128);
  else context.fillRect(0, 0, 128, thickness);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeat[0], options.repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
