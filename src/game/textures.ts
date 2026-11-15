import * as THREE from 'three';

export interface ProceduralTextureSet {
  concreteMap: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  brickBump: THREE.CanvasTexture;
  steelMap: THREE.CanvasTexture;
  crateMap: THREE.CanvasTexture;
  sandbagMap: THREE.CanvasTexture;
  hazardMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextureSet(
  maxAnisotropy: number
): ProceduralTextureSet {
  // 1. Depot Concrete Floor (color + bump)
  const [concC, concCtx] = makeCanvas(256);
  const [concBC, concBCtx] = makeCanvas(256);
  concCtx.fillStyle = '#4a4c47';
  concCtx.fillRect(0, 0, 256, 256);
  concBCtx.fillStyle = '#808080';
  concBCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 60 + Math.floor(Math.random() * 34);
    concCtx.fillStyle = `rgb(${shade},${shade},${shade - 3})`;
    concCtx.fillRect(x, y, 2, 2);

    const bShade = 105 + Math.floor(Math.random() * 48);
    concBCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
    concBCtx.fillRect(x, y, 2, 2);
  }
  // Expansion joints
  concCtx.strokeStyle = 'rgba(22, 23, 20, 0.55)';
  concCtx.lineWidth = 3;
  concCtx.strokeRect(1.5, 1.5, 253, 253);
  concCtx.beginPath();
  concCtx.moveTo(128, 0);
  concCtx.lineTo(128, 256);
  concCtx.moveTo(0, 128);
  concCtx.lineTo(256, 128);
  concCtx.stroke();

  concBCtx.strokeStyle = '#303030';
  concBCtx.lineWidth = 3;
  concBCtx.strokeRect(1.5, 1.5, 253, 253);

  // 2. Weathered Warehouse Brick
  const [brickC, brickCtx] = makeCanvas(256);
  const [brickBC, brickBCtx] = makeCanvas(256);
  brickCtx.fillStyle = '#6f695e';
  brickCtx.fillRect(0, 0, 256, 256);
  brickBCtx.fillStyle = '#404040';
  brickBCtx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const bh = 256 / rows;
  const bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let c = -1; c <= cols; c++) {
      const bx = c * bw + offset;
      const by = r * bh;
      const red = 105 + Math.floor(Math.random() * 28);
      const green = 55 + Math.floor(Math.random() * 18);
      const blue = 44 + Math.floor(Math.random() * 14);
      brickCtx.fillStyle = `rgb(${red},${green},${blue})`;
      brickCtx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      brickBCtx.fillStyle = '#cfcfcf';
      brickBCtx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    }
  }

  // 3. Riveted Armored Steel
  const [steelC, steelCtx] = makeCanvas(256);
  steelCtx.fillStyle = '#484f52';
  steelCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    const y = Math.random() * 256;
    steelCtx.fillStyle =
      Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    steelCtx.fillRect(0, y, 256, 2);
  }
  steelCtx.strokeStyle = '#2c3133';
  steelCtx.lineWidth = 4;
  steelCtx.strokeRect(2, 2, 252, 252);
  steelCtx.beginPath();
  steelCtx.moveTo(0, 128);
  steelCtx.lineTo(256, 128);
  steelCtx.stroke();
  // Rivets
  steelCtx.fillStyle = '#687175';
  for (let x = 16; x < 256; x += 32) {
    for (const y of [14, 114, 142, 242]) {
      steelCtx.beginPath();
      steelCtx.arc(x, y, 3.2, 0, Math.PI * 2);
      steelCtx.fill();
    }
  }

  // 4. Military Timber Crate
  const [crateC, crateCtx] = makeCanvas(256);
  crateCtx.fillStyle = '#6c5335';
  crateCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 48; i++) {
    crateCtx.fillStyle =
      i % 2 === 0 ? 'rgba(40,28,15,0.22)' : 'rgba(130,104,68,0.16)';
    crateCtx.fillRect(0, i * 5.4, 256, 2.5);
  }
  // Outer frame + diagonal brace
  crateCtx.strokeStyle = '#4a3721';
  crateCtx.lineWidth = 18;
  crateCtx.strokeRect(9, 9, 238, 238);
  crateCtx.beginPath();
  crateCtx.moveTo(14, 14);
  crateCtx.lineTo(242, 242);
  crateCtx.stroke();
  // Stencil mark
  crateCtx.fillStyle = 'rgba(226, 212, 168, 0.72)';
  crateCtx.font = 'bold 26px monospace';
  crateCtx.fillText('ORD-44', 76, 136);

  // 5. Sandbag Burlap
  const [sandC, sandCtx] = makeCanvas(128);
  sandCtx.fillStyle = '#8b7b5b';
  sandCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    sandCtx.fillStyle =
      y % 8 === 0 ? 'rgba(45,38,24,0.18)' : 'rgba(220,200,165,0.12)';
    sandCtx.fillRect(0, y, 128, 2);
  }
  for (let x = 0; x < 128; x += 4) {
    sandCtx.fillStyle = 'rgba(30,25,18,0.1)';
    sandCtx.fillRect(x, 0, 1, 128);
  }

  // 6. Hazard Stripe for Ramp Edges
  const [hazC, hazCtx] = makeCanvas(128);
  hazCtx.fillStyle = '#c48d24';
  hazCtx.fillRect(0, 0, 128, 128);
  hazCtx.fillStyle = '#1e201d';
  for (let i = -128; i < 256; i += 32) {
    hazCtx.beginPath();
    hazCtx.moveTo(i, 0);
    hazCtx.lineTo(i + 16, 0);
    hazCtx.lineTo(i + 144, 128);
    hazCtx.lineTo(i + 128, 128);
    hazCtx.closePath();
    hazCtx.fill();
  }

  const concreteMap = configureColorTexture(concC, 18, 18, maxAnisotropy);
  const concreteBump = configureDataTexture(concBC, 18, 18);
  const brickMap = configureColorTexture(brickC, 3, 1.5, maxAnisotropy);
  const brickBump = configureDataTexture(brickBC, 3, 1.5);
  const steelMap = configureColorTexture(steelC, 2, 1, maxAnisotropy);
  const crateMap = configureColorTexture(crateC, 1, 1, maxAnisotropy);
  const sandbagMap = configureColorTexture(sandC, 2, 1, maxAnisotropy);
  const hazardMap = configureColorTexture(hazC, 4, 1, maxAnisotropy);

  return {
    concreteMap,
    concreteBump,
    brickMap,
    brickBump,
    steelMap,
    crateMap,
    sandbagMap,
    hazardMap,
    dispose: () => {
      concreteMap.dispose();
      concreteBump.dispose();
      brickMap.dispose();
      brickBump.dispose();
      steelMap.dispose();
      crateMap.dispose();
      sandbagMap.dispose();
      hazardMap.dispose();
    },
  };
}
