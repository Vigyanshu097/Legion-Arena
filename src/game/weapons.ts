import * as THREE from 'three';
import type { WeaponId } from './types';

export interface WeaponModelBuild {
  root: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  hipOffset: THREE.Vector3;
  adsOffset: THREE.Vector3;
  dispose: () => void;
}

export function buildProceduralWeaponModel(
  weaponId: WeaponId,
  isSoftwareGl: boolean
): WeaponModelBuild {
  const root = new THREE.Group();
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

  const bluedSteel = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262a2e,
      metalness: 0.86,
      roughness: 0.28,
    })
  );
  const darkIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x181a1c,
      metalness: 0.78,
      roughness: 0.42,
    })
  );
  const walnutWood = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5d3720,
      metalness: 0.05,
      roughness: 0.72,
    })
  );
  const bakelite = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b2218,
      metalness: 0.08,
      roughness: 0.5,
    })
  );
  const brassGold = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9a436,
      metalness: 0.94,
      roughness: 0.18,
      clearcoat: 0.6,
    })
  );
  const chromeBlade = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc8d0d6,
      metalness: 0.92,
      roughness: 0.2,
    })
  );
  const lensGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x8ad8ff,
      metalness: 0.1,
      roughness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: isSoftwareGl ? 0.45 : 1.0,
      ior: 1.52,
    })
  );

  const muzzleAnchor = new THREE.Object3D();
  let hipOffset = new THREE.Vector3(0.24, -0.22, -0.44);
  let adsOffset = new THREE.Vector3(0, -0.145, -0.34);

  if (weaponId === 'mp40') {
    // 1. Upper receiver tube
    const receiver = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 14)),
      bluedSteel
    );
    receiver.rotation.x = Math.PI / 2;
    root.add(receiver);

    // 2. Barrel + barrel nut
    const barrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.011, 0.013, 0.24, 12)),
      darkIron
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.002, -0.28);
    root.add(barrel);

    // 3. Under-barrel resting bar
    const restBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.014, 0.014, 0.15)),
      bakelite
    );
    restBar.position.set(0, -0.018, -0.23);
    root.add(restBar);

    // 4. Vertical stick magazine
    const mag = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.19, 0.036)),
      darkIron
    );
    mag.position.set(0, -0.11, -0.12);
    mag.rotation.x = -0.08;
    root.add(mag);

    // 5. Mag housing collar
    const magWell = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.034, 0.05, 0.048)),
      bluedSteel
    );
    magWell.position.set(0, -0.03, -0.12);
    root.add(magWell);

    // 6. Bakelite grip frame & pistol grip
    const gripFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.032, 0.035, 0.18)),
      bakelite
    );
    gripFrame.position.set(0, -0.026, 0.04);
    root.add(gripFrame);

    const grip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.028, 0.11, 0.042)),
      bakelite
    );
    grip.position.set(0, -0.08, 0.09);
    grip.rotation.x = 0.26;
    root.add(grip);

    // 7. Folding stock struts
    const stockBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.036, 0.014, 0.16)),
      bluedSteel
    );
    stockBar.position.set(0, -0.015, 0.18);
    root.add(stockBar);

    // 8. Front sight hood & rear notch
    const frontSight = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.022, 10)),
      darkIron
    );
    frontSight.position.set(0, 0.022, -0.37);
    root.add(frontSight);

    const rearSight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.018, 0.016)),
      darkIron
    );
    rearSight.position.set(0, 0.028, 0.12);
    root.add(rearSight);

    muzzleAnchor.position.set(0, 0.002, -0.41);
    adsOffset = new THREE.Vector3(0, -0.048, -0.35);
  } else if (weaponId === 'tommy') {
    // M1A1 Thompson
    const receiver = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.048, 0.056, 0.34)),
      bluedSteel
    );
    root.add(receiver);

    const barrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.013, 0.015, 0.24, 12)),
      darkIron
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.27);
    root.add(barrel);

    // Wood foregrip
    const foregrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.044, 0.042, 0.17)),
      walnutWood
    );
    foregrip.position.set(0, -0.022, -0.22);
    root.add(foregrip);

    // Wood rear stock
    const stock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.044, 0.095, 0.22)),
      walnutWood
    );
    stock.position.set(0, -0.028, 0.24);
    stock.rotation.x = 0.08;
    root.add(stock);

    // Wood pistol grip
    const grip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.032, 0.11, 0.044)),
      walnutWood
    );
    grip.position.set(0, -0.078, 0.08);
    grip.rotation.x = 0.25;
    root.add(grip);

    // Drum / stick mag (drum silhouette for iconic WW2 Thompson)
    const drum = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.038, 18)),
      darkIron
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.07, -0.08);
    root.add(drum);

    const rearSight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.028, 0.022, 0.018)),
      darkIron
    );
    rearSight.position.set(0, 0.036, 0.13);
    root.add(rearSight);

    muzzleAnchor.position.set(0, 0.008, -0.4);
    adsOffset = new THREE.Vector3(0, -0.056, -0.35);
  } else if (weaponId === 'shotgun') {
    // M1897 Trench Shotgun
    const receiver = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.044, 0.056, 0.2)),
      bluedSteel
    );
    root.add(receiver);

    const barrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.015, 0.016, 0.48, 12)),
      bluedSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.014, -0.32);
    root.add(barrel);

    // Under-barrel tube magazine
    const tubeMag = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 10)),
      darkIron
    );
    tubeMag.rotation.x = Math.PI / 2;
    tubeMag.position.set(0, -0.016, -0.29);
    root.add(tubeMag);

    // Perforated heat shield sleeve
    const heatShield = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.021, 0.021, 0.24, 12)),
      darkIron
    );
    heatShield.rotation.x = Math.PI / 2;
    heatShield.position.set(0, 0.014, -0.36);
    root.add(heatShield);

    // Ribbed pump handle
    const pump = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12)),
      walnutWood
    );
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.018, -0.22);
    root.add(pump);

    // Walnut stock
    const stock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.04, 0.09, 0.25)),
      walnutWood
    );
    stock.position.set(0, -0.032, 0.2);
    stock.rotation.x = 0.14;
    root.add(stock);

    const bead = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.005, 8, 8)),
      brassGold
    );
    bead.position.set(0, 0.033, -0.54);
    root.add(bead);

    muzzleAnchor.position.set(0, 0.014, -0.57);
    adsOffset = new THREE.Vector3(0, -0.052, -0.36);
  } else if (weaponId === 'kar98k') {
    // Kar98k Bolt-Action Sniper Rifle
    const fullStock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.042, 0.062, 0.62)),
      walnutWood
    );
    fullStock.position.set(0, -0.015, -0.06);
    root.add(fullStock);

    const buttStock = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.04, 0.1, 0.24)),
      walnutWood
    );
    buttStock.position.set(0, -0.038, 0.28);
    buttStock.rotation.x = 0.12;
    root.add(buttStock);

    const receiver = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.019, 0.019, 0.22, 12)),
      bluedSteel
    );
    receiver.rotation.x = Math.PI / 2;
    receiver.position.set(0, 0.016, 0.02);
    root.add(receiver);

    const barrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.01, 0.013, 0.48, 12)),
      bluedSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.34);
    root.add(barrel);

    // Bolt handle + ball
    const boltStem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.055, 8)),
      chromeBlade
    );
    boltStem.rotation.z = -Math.PI / 3;
    boltStem.position.set(0.032, 0.012, 0.06);
    root.add(boltStem);

    const boltKnob = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.011, 10, 10)),
      chromeBlade
    );
    boltKnob.position.set(0.052, -0.004, 0.06);
    root.add(boltKnob);

    // Optical ZF39 Sniper Scope
    const scopeTube = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 14)),
      darkIron
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.058, 0.0);
    root.add(scopeTube);

    const scopeBell = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.017, 0.05, 14)),
      darkIron
    );
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.058, -0.13);
    root.add(scopeBell);

    const rearLens = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.015, 14)),
      lensGlass
    );
    rearLens.position.set(0, 0.058, 0.121);
    root.add(rearLens);

    muzzleAnchor.position.set(0, 0.018, -0.59);
    adsOffset = new THREE.Vector3(0, -0.058, -0.26);
  } else if (weaponId === 'm1911') {
    // Colt M1911 Pistol
    hipOffset = new THREE.Vector3(0.22, -0.18, -0.42);
    const slide = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.026, 0.028, 0.2)),
      bluedSteel
    );
    slide.position.set(0, 0.015, -0.04);
    root.add(slide);

    const frame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.02, 0.16)),
      darkIron
    );
    frame.position.set(0, -0.006, -0.02);
    root.add(frame);

    const grip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, 0.088, 0.038)),
      walnutWood
    );
    grip.position.set(0, -0.048, 0.036);
    grip.rotation.x = 0.28;
    root.add(grip);

    const barrelTip = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.007, 0.007, 0.028, 10)),
      chromeBlade
    );
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.014, -0.145);
    root.add(barrelTip);

    const frontSight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.004, 0.008, 0.008)),
      darkIron
    );
    frontSight.position.set(0, 0.033, -0.125);
    root.add(frontSight);

    const rearSightL = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.006, 0.007, 0.01)),
      darkIron
    );
    rearSightL.position.set(-0.007, 0.032, 0.05);
    root.add(rearSightL);

    const rearSightR = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.006, 0.007, 0.01)),
      darkIron
    );
    rearSightR.position.set(0.007, 0.032, 0.05);
    root.add(rearSightR);

    muzzleAnchor.position.set(0, 0.014, -0.16);
    adsOffset = new THREE.Vector3(0, -0.042, -0.38);
  } else {
    // Combat Knife or Golden Knife
    const isGold = weaponId === 'golden_knife';
    const bladeMat = isGold ? brassGold : chromeBlade;
    hipOffset = new THREE.Vector3(0.22, -0.21, -0.38);
    adsOffset = new THREE.Vector3(0.14, -0.17, -0.35);

    const handle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.016, 0.018, 0.13, 10)),
      isGold ? walnutWood : bakelite
    );
    handle.rotation.x = Math.PI / 3;
    handle.position.set(0, -0.03, 0.02);
    root.add(handle);

    const guard = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.065, 0.012, 0.022)),
      isGold ? brassGold : darkIron
    );
    guard.rotation.x = -Math.PI / 6;
    guard.position.set(0, 0.01, -0.03);
    root.add(guard);

    // Tapered blade via ExtrudeGeometry
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.022, 0);
    bladeShape.lineTo(0.016, 0.16);
    bladeShape.lineTo(0.006, 0.21);
    bladeShape.lineTo(0, 0.16);
    bladeShape.closePath();
    const bladeGeo = trackGeo(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.005,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 2,
      })
    );
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = Math.PI / 2;
    blade.rotation.z = -Math.PI / 6;
    blade.position.set(0, 0.09, -0.11);
    root.add(blade);

    const pommel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.019, 0.014, 0.022, 10)),
      isGold ? brassGold : darkIron
    );
    pommel.rotation.x = Math.PI / 3;
    pommel.position.set(0, -0.075, 0.07);
    root.add(pommel);

    muzzleAnchor.position.set(0, 0.12, -0.2);
  }

  root.add(muzzleAnchor);

  return {
    root,
    muzzleAnchor,
    hipOffset,
    adsOffset,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
