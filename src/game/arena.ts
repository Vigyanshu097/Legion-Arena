import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import type { AABBBox, RampSurface } from './types';

export interface ReflexTargetNode {
  id: string;
  pivot: THREE.Group;
  hitMesh: THREE.Mesh;
  active: boolean;
  hitAnim: number;
  basePos: THREE.Vector3;
  patrolAmp: number;
  patrolSpeed: number;
  phase: number;
}

export interface DepotArenaBuild {
  group: THREE.Group;
  colliders: AABBBox[];
  ramps: RampSurface[];
  arenaHalfExtent: number;
  alliesSpawns: Array<{ x: number; y: number; z: number; yaw: number }>;
  axisSpawns: Array<{ x: number; y: number; z: number; yaw: number }>;
  reflexTargets: ReflexTargetNode[];
  dispose: () => void;
}

export function buildDepotArena(
  textures: ProceduralTextureSet,
  includeReflexTargets: boolean
): DepotArenaBuild {
  const group = new THREE.Group();
  const colliders: AABBBox[] = [];
  const ramps: RampSurface[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const reflexTargets: ReflexTargetNode[] = [];
  const arenaHalfExtent = 26;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Materials
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.concreteMap,
      bumpMap: textures.concreteBump,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const outerEarthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4034,
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.brickMap,
      bumpMap: textures.brickBump,
      bumpScale: 0.05,
      roughness: 0.84,
      metalness: 0.04,
    })
  );
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.steelMap,
      roughness: 0.42,
      metalness: 0.72,
    })
  );
  const darkIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x26292c,
      roughness: 0.48,
      metalness: 0.78,
    })
  );
  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.crateMap,
      roughness: 0.76,
      metalness: 0.06,
    })
  );
  const sandbagMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.sandbagMap,
      roughness: 0.92,
      metalness: 0.02,
    })
  );
  const hazardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.hazardMap,
      roughness: 0.65,
      metalness: 0.15,
    })
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x333638,
      roughness: 0.75,
      metalness: 0.35,
    })
  );

  // 1. Extended outer terrain (prevents floating box in empty void)
  const outerGround = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(240, 240)),
    outerEarthMat
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.05;
  outerGround.receiveShadow = true;
  group.add(outerGround);

  // 2. Main concrete depot courtyard floor (offset +0.05 above outer earth)
  const courtyard = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(54, 54)),
    groundMat
  );
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.position.y = 0;
  courtyard.receiveShadow = true;
  group.add(courtyard);

  const addBox = (
    id: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    kind: AABBBox['kind'],
    castShadow = true
  ) => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);

    colliders.push({
      id,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      kind,
    });
    return mesh;
  };

  // 3. Perimeter Depot Warehouse Walls & Fencing with exterior hills/trees
  addBox('perim_n', 0, 2.2, -26.5, 54, 4.4, 1.2, brickMat, 'wall');
  addBox('perim_s', 0, 2.2, 26.5, 54, 4.4, 1.2, brickMat, 'wall');
  addBox('perim_w', -26.5, 2.2, 0, 1.2, 4.4, 54, brickMat, 'wall');
  addBox('perim_e', 26.5, 2.2, 0, 1.2, 4.4, 54, brickMat, 'wall');

  // Distant Landmark: Depot Water Tower & Gantry Crane outside perimeter (visible in vista)
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-18, 0, -34);
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.34, 10, 8));
  for (const [lx, lz] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [-1.6, 1.6],
    [1.6, 1.6],
  ]) {
    const leg = new THREE.Mesh(legGeo, darkIronMat);
    leg.position.set(lx, 5, lz);
    towerGroup.add(leg);
  }
  const tankBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(2.8, 2.8, 3.8, 16)),
    steelMat
  );
  tankBody.position.y = 11.8;
  towerGroup.add(tankBody);
  const tankRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(3.1, 1.8, 16)),
    roofMat
  );
  tankRoof.position.y = 14.6;
  towerGroup.add(tankRoof);
  group.add(towerGroup);

  // Exterior perimeter pine/cypress grove & berms via InstancedMesh
  const treeCount = 44;
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.25, 0.38, 3.5, 7));
  const foliageGeo = trackGeo(new THREE.ConeGeometry(1.9, 6.2, 7));
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.9 })
  );
  const foliageMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2f432b, roughness: 0.88 })
  );
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopies = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2;
    const dist = 34 + (i % 5) * 6.5;
    const tx = Math.cos(angle) * dist;
    const tz = Math.sin(angle) * dist;
    const s = 0.85 + (i % 4) * 0.14;
    dummy.position.set(tx, 1.75 * s, tz);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = i * 0.7;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 5.2 * s, tz);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.29, 0.25, 0.19 + (i % 3) * 0.04);
    canopies.setColorAt(i, tint);
  }
  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();
  group.add(trunks, canopies);

  // 4. Parallel Train Tracks running along X = -4.5 and X = 4.5 (offset Y >= 0.02)
  const railGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.09, 50));
  for (const trackX of [-4.5, 4.5]) {
    const leftRail = new THREE.Mesh(railGeo, darkIronMat);
    leftRail.position.set(trackX - 0.72, 0.045, 0);
    group.add(leftRail);
    const rightRail = new THREE.Mesh(railGeo, darkIronMat);
    rightRail.position.set(trackX + 0.72, 0.045, 0);
    group.add(rightRail);
  }
  // Wooden rail sleepers via InstancedMesh
  const sleeperGeo = trackGeo(new THREE.BoxGeometry(2.1, 0.05, 0.34));
  const sleeperMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 0.92 })
  );
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, 52);
  for (let i = 0; i < 26; i++) {
    const z = -24 + i * 1.9;
    dummy.position.set(-4.5, 0.025, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i * 2, dummy.matrix);
    dummy.position.set(4.5, 0.025, z);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i * 2 + 1, dummy.matrix);
  }
  sleepers.computeBoundingSphere();
  group.add(sleepers);

  // 5. Two Composite 6-Part Armored Train Boxcars
  const buildTrainCar = (id: string, cx: number, cz: number, length: number) => {
    const car = new THREE.Group();
    car.position.set(cx, 0, cz);

    // Chassis + wheel bogies
    const chassis = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.7, 0.35, length)),
      darkIronMat
    );
    chassis.position.y = 0.55;
    car.add(chassis);

    const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12));
    for (const wz of [-length * 0.36, -length * 0.24, length * 0.24, length * 0.36]) {
      for (const wx of [-0.74, 0.74]) {
        const wheel = new THREE.Mesh(wheelGeo, darkIronMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.34, wz);
        car.add(wheel);
      }
    }

    // Main riveted hull
    const hull = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.65, 2.25, length - 0.3)),
      steelMat
    );
    hull.position.y = 1.85;
    hull.castShadow = true;
    hull.receiveShadow = true;
    car.add(hull);

    // Pitched metal roof + hatch
    const roof = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.8, 0.18, length + 0.1)),
      roofMat
    );
    roof.position.y = 3.04;
    car.add(roof);

    // Side sliding door frame detail
    const door = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.74, 1.9, 2.1)),
      darkIronMat
    );
    door.position.y = 1.8;
    car.add(door);

    group.add(car);
    colliders.push({
      id,
      minX: cx - 1.4,
      maxX: cx + 1.4,
      minY: 0,
      maxY: 3.15,
      minZ: cz - length / 2,
      maxZ: cz + length / 2,
      kind: 'train',
    });
  };

  buildTrainCar('train_west', -4.5, -6.5, 9.2);
  buildTrainCar('train_east', 4.5, 6.5, 9.2);

  // 6. Brick Warehouse Cover Walls & Chokepoint Pillars
  addBox('cover_mid_l', -11.5, 1.4, 2.0, 4.4, 2.8, 1.2, brickMat, 'wall');
  addBox('cover_mid_r', 11.5, 1.4, -2.0, 4.4, 2.8, 1.2, brickMat, 'wall');
  addBox('cover_center', 0, 1.15, 0, 2.6, 2.3, 2.6, brickMat, 'wall');

  // 7. Military Timber Supply Crates (clustered naturally)
  addBox('crate_1', -10.5, 0.7, -11.5, 1.6, 1.4, 1.6, crateMat, 'crate');
  addBox('crate_2', -8.8, 0.55, -12.1, 1.2, 1.1, 1.2, crateMat, 'crate');
  addBox('crate_3', 10.5, 0.7, 11.5, 1.6, 1.4, 1.6, crateMat, 'crate');
  addBox('crate_4', 8.8, 0.55, 12.1, 1.2, 1.1, 1.2, crateMat, 'crate');
  addBox('crate_5', -1.8, 0.65, 11.0, 1.4, 1.3, 1.4, crateMat, 'crate');
  addBox('crate_6', 1.8, 0.65, -11.0, 1.4, 1.3, 1.4, crateMat, 'crate');

  // 8. Sandbag Bunkers near Spawn Lanes
  addBox('sandbag_s1', -11.5, 0.52, 16.5, 4.2, 1.04, 1.0, sandbagMat, 'sandbag');
  addBox('sandbag_s2', 11.5, 0.52, -16.5, 4.2, 1.04, 1.0, sandbagMat, 'sandbag');
  addBox('sandbag_c1', -0.2, 0.48, 7.5, 3.0, 0.96, 0.9, sandbagMat, 'sandbag');
  addBox('sandbag_c2', 0.2, 0.48, -7.5, 3.0, 0.96, 0.9, sandbagMat, 'sandbag');

  // 9. Elevated Loading Dock Catwalk (West Flank X = -19.5, Y = 2.0) + Two Walkable Ramps
  addBox('catwalk_w', -19.5, 1.0, 0, 4.2, 2.0, 11.0, steelMat, 'platform');
  // Guard rail posts along catwalk edge (thin visual + low lip)
  const railLip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.16, 0.45, 11.0)),
    hazardMat
  );
  railLip.position.set(-17.48, 2.22, 0);
  group.add(railLip);

  // North & South Ramps leading up to catwalk (y = 0 -> y = 2.0)
  const buildRamp = (
    id: string,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    startY: number,
    endY: number
  ) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const rise = endY - startY;
    const len = Math.sqrt(d * d + rise * rise);
    const angle = Math.atan2(rise, d);

    const rampMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, 0.22, len)),
      hazardMat
    );
    rampMesh.position.set((minX + maxX) / 2, (startY + endY) / 2 - 0.1, (minZ + maxZ) / 2);
    // If endY > startY along +Z, tilt negative X; else positive X
    rampMesh.rotation.x = endY > startY ? -angle : angle;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    ramps.push({
      id,
      minX,
      maxX,
      minZ,
      maxZ,
      startY,
      endY,
      axis: 'z',
    });
  };

  buildRamp('ramp_w_north', -21.4, -17.6, -12.5, -5.5, 0, 2.0);
  buildRamp('ramp_w_south', -21.4, -17.6, 5.5, 12.5, 2.0, 0);

  // East Elevated Overwatch Platform (X = 19.5, Y = 2.0) + Ramps
  addBox('catwalk_e', 19.5, 1.0, 0, 4.2, 2.0, 11.0, steelMat, 'platform');
  const railLipE = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.16, 0.45, 11.0)),
    hazardMat
  );
  railLipE.position.set(17.48, 2.22, 0);
  group.add(railLipE);
  buildRamp('ramp_e_north', 17.6, 21.4, -12.5, -5.5, 0, 2.0);
  buildRamp('ramp_e_south', 17.6, 21.4, 5.5, 12.5, 2.0, 0);

  // 10. Reflex Arena Tactical Pop-Up Targets (when mode === 'reflex')
  if (includeReflexTargets) {
    const targetCoords: Array<[number, number, number, number, number]> = [
      [-11, 1.4, 4, 0, 0],
      [11, 1.4, -4, 0, 0],
      [-7.5, 1.4, -2, 1.4, 1.8],
      [7.5, 1.4, 2, 1.4, 1.8],
      [0, 2.6, 0, 0, 0],
      [-19.5, 3.1, 0, 0, 0],
      [19.5, 3.1, 0, 0, 0],
      [-14, 1.4, -15, 2.0, 1.4],
      [14, 1.4, -15, 2.0, 1.4],
      [-14, 1.4, 15, 2.0, 1.4],
      [14, 1.4, 15, 2.0, 1.4],
      [0, 1.4, -18, 3.0, 1.6],
      [0, 1.4, 18, 3.0, 1.6],
      [-4.5, 4.0, -6.5, 0, 0],
      [4.5, 4.0, 6.5, 0, 0],
      [-20, 1.4, -17, 0, 0],
      [20, 1.4, 17, 0, 0],
      [0, 1.4, -10.5, 0, 0],
    ];

    const ringOuterMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd94336,
        emissive: 0x44100c,
        roughness: 0.4,
      })
    );
    const ringInnerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf4efe6,
        roughness: 0.45,
      })
    );
    const bullseyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xeb9e28,
        emissive: 0x6b3e05,
        roughness: 0.3,
      })
    );

    targetCoords.forEach(([x, y, z, amp, spd], idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);

      const post = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8)),
        darkIronMat
      );
      post.position.y = -0.5;
      pivot.add(post);

      const plate = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 20)),
        ringOuterMat
      );
      plate.rotation.x = Math.PI / 2;
      plate.userData = { reflexTargetId: `target_${idx}` };
      pivot.add(plate);

      const whiteRing = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.11, 20)),
        ringInnerMat
      );
      whiteRing.rotation.x = Math.PI / 2;
      whiteRing.userData = { reflexTargetId: `target_${idx}` };
      pivot.add(whiteRing);

      const bull = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.13, 16)),
        bullseyeMat
      );
      bull.rotation.x = Math.PI / 2;
      bull.userData = { reflexTargetId: `target_${idx}` };
      pivot.add(bull);

      group.add(pivot);
      reflexTargets.push({
        id: `target_${idx}`,
        pivot,
        hitMesh: plate,
        active: true,
        hitAnim: 0,
        basePos: new THREE.Vector3(x, y, z),
        patrolAmp: amp,
        patrolSpeed: spd,
        phase: idx * 0.9,
      });
    });
  }

  // Verified clear spawns facing into the arena (never facing a wall)
  const alliesSpawns = [
    { x: 0, y: 0, z: 21.5, yaw: 0 },
    { x: -16.5, y: 0, z: 18.5, yaw: -0.35 },
    { x: 16.5, y: 0, z: 18.5, yaw: 0.35 },
    { x: -12.5, y: 0, z: 13.5, yaw: -0.15 },
  ];

  const axisSpawns = [
    { x: 0, y: 0, z: -21.5, yaw: Math.PI },
    { x: -15.5, y: 0, z: -20.5, yaw: Math.PI + 0.35 },
    { x: 15.5, y: 0, z: -20.5, yaw: Math.PI - 0.35 },
    { x: 9, y: 0, z: -22.0, yaw: Math.PI + 0.15 },
  ];

  return {
    group,
    colliders,
    ramps,
    arenaHalfExtent,
    alliesSpawns,
    axisSpawns,
    reflexTargets,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
