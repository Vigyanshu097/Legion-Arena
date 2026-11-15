import * as THREE from 'three';
import type { TeamId, WeaponId } from './types';

export type BotArchetype = 'rusher' | 'marksman' | 'flanker';

export interface SoldierRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  hitMeshes: THREE.Object3D[];
  setHitFlash: (active: boolean) => void;
  setWalkCycle: (phase: number, speedNorm: number, crouching: boolean) => void;
  setDeadPose: (koProgress: number) => void;
  dispose: () => void;
}

export function createProceduralSoldier(
  entityId: string,
  team: TeamId,
  archetype: BotArchetype = 'rusher',
  weaponId: WeaponId = 'mp40'
): SoldierRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Distinct team & archetype palettes (high contrast against concrete/brick depot)
  const tunicColor =
    team === 'allies'
      ? archetype === 'flanker'
        ? 0x4f5f3b
        : 0x5c6b43
      : archetype === 'marksman'
        ? 0x3b4248
        : 0x4a4f52;
  const helmetColor =
    team === 'allies' ? 0x455336 : archetype === 'flanker' ? 0x2f3438 : 0x383e42;
  const trimAccent = team === 'allies' ? 0x3a7ca5 : 0xb33a2c;

  const tunicMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: tunicColor,
      roughness: 0.82,
      metalness: 0.05,
    })
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: team === 'allies' ? 0x625a45 : 0x3e4144,
      roughness: 0.86,
      metalness: 0.04,
    })
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c2017,
      roughness: 0.55,
      metalness: 0.12,
    })
  );
  const helmetMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: helmetColor,
      roughness: 0.42,
      metalness: 0.45,
    })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb68b6c,
      roughness: 0.78,
      metalness: 0.02,
    })
  );
  const brassBadgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: trimAccent,
      roughness: 0.35,
      metalness: 0.5,
      emissive: trimAccent,
      emissiveIntensity: 0.18,
    })
  );
  const gunMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1f2226,
      roughness: 0.32,
      metalness: 0.82,
    })
  );

  // Contact shadow disc grounded at y = 0.015
  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.42, 16));
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x050605,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // 1-2. Legs & Boots
  const legGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.72, 0.2));
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.12, 0.42, 0);
  leftLeg.castShadow = true;
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.12, 0.42, 0);
  rightLeg.castShadow = true;
  bodyPivot.add(rightLeg);

  const bootGeo = trackGeo(new THREE.BoxGeometry(0.19, 0.16, 0.27));
  const leftBoot = new THREE.Mesh(bootGeo, leatherMat);
  leftBoot.position.set(0, -0.32, 0.03);
  leftLeg.add(leftBoot);

  const rightBoot = new THREE.Mesh(bootGeo, leatherMat);
  rightBoot.position.set(0, -0.32, 0.03);
  rightLeg.add(rightBoot);

  // 3. Torso Tunic (Hitbox: body)
  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.46, 0.62, 0.26)),
    tunicMat
  );
  torsoMesh.position.set(0, 1.08, 0);
  torsoMesh.castShadow = true;
  torsoMesh.userData = { entityId, hitZone: 'body' };
  bodyPivot.add(torsoMesh);

  // 4. Webbing Belt & Ammo Pouches
  const belt = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.48, 0.09, 0.28)),
    leatherMat
  );
  belt.position.set(0, 0.84, 0);
  bodyPivot.add(belt);

  // 5. Team Armband / Chest Insignia for instant silhouette team readability
  const armband = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.49, 0.1, 0.27)),
    brassBadgeMat
  );
  armband.position.set(0, 1.24, 0);
  bodyPivot.add(armband);

  // 6. Backpack / Field Gear (distinct per archetype)
  const pack = new THREE.Mesh(
    trackGeo(
      new THREE.BoxGeometry(
        archetype === 'marksman' ? 0.28 : 0.34,
        archetype === 'flanker' ? 0.28 : 0.38,
        0.16
      )
    ),
    leatherMat
  );
  pack.position.set(0, 1.1, -0.19);
  bodyPivot.add(pack);

  // 7. Head + Steel Helmet + Tactical Goggles/Collar (Hitbox: head)
  const collar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 0.12, 12)),
    leatherMat
  );
  collar.position.set(0, 1.4, 0);
  bodyPivot.add(collar);

  const headMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.145, 14, 12)),
    skinMat
  );
  headMesh.position.set(0, 1.54, 0);
  headMesh.castShadow = true;
  headMesh.userData = { entityId, hitZone: 'head' };
  bodyPivot.add(headMesh);

  const goggles = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.055, 0.14)),
    leatherMat
  );
  goggles.position.set(0, 0.03, 0.085);
  headMesh.add(goggles);

  const helmetCrown = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    helmetMat
  );
  helmetCrown.position.set(0, 0.035, 0);
  helmetCrown.userData = { entityId, hitZone: 'head' };
  headMesh.add(helmetCrown);

  const helmetBrim = new THREE.Mesh(
    trackGeo(
      new THREE.CylinderGeometry(
        team === 'allies' ? 0.21 : 0.185,
        team === 'allies' ? 0.22 : 0.195,
        0.04,
        14
      )
    ),
    helmetMat
  );
  helmetBrim.position.set(0, 0.025, 0);
  headMesh.add(helmetBrim);

  // 8. Left Arm & Right Weapon Arm
  const armGeo = trackGeo(new THREE.BoxGeometry(0.13, 0.48, 0.13));
  const leftArm = new THREE.Mesh(armGeo, tunicMat);
  leftArm.position.set(-0.3, 1.12, 0.14);
  leftArm.rotation.x = -Math.PI / 4;
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.3, 1.24, 0.04);
  const rightArmMesh = new THREE.Mesh(armGeo, tunicMat);
  rightArmMesh.position.set(0, -0.14, 0.16);
  rightArmMesh.rotation.x = -Math.PI / 2.6;
  rightArm.add(rightArmMesh);

  // World weapon silhouette held by soldier
  const gunLen = weaponId === 'kar98k' ? 0.78 : weaponId === 'shotgun' ? 0.72 : 0.52;
  const gunBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, 0.09, gunLen)),
    gunMat
  );
  gunBody.position.set(-0.08, -0.14, 0.42);
  rightArm.add(gunBody);
  bodyPivot.add(rightArm);

  const flashTargets = [tunicMat, helmetMat, pantsMat, skinMat];

  return {
    root,
    bodyPivot,
    headMesh,
    torsoMesh,
    leftLeg,
    rightLeg,
    rightArm,
    hitMeshes: [headMesh, helmetCrown, torsoMesh],
    setHitFlash: (active: boolean) => {
      for (const m of flashTargets) {
        m.emissive.setHex(active ? 0xffffff : 0x000000);
        m.emissiveIntensity = active ? 0.65 : 0;
      }
    },
    setWalkCycle: (phase: number, speedNorm: number, crouching: boolean) => {
      const swing = Math.sin(phase) * 0.55 * Math.min(1, speedNorm);
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      bodyPivot.position.y = crouching ? -0.34 : Math.abs(Math.cos(phase)) * 0.03 * speedNorm;
      bodyPivot.rotation.set(crouching ? 0.18 : 0, 0, 0);
    },
    setDeadPose: (koProgress: number) => {
      const t = Math.max(0, Math.min(1, koProgress));
      bodyPivot.rotation.x = -t * (Math.PI / 2.1);
      bodyPivot.position.y = t * 0.22;
      bodyPivot.position.z = -t * 0.35;
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
