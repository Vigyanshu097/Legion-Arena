import type {
  AABBBox,
  PlayableMode,
  RampSurface,
  StanceState,
  WeaponId,
  WeaponSpec,
} from './types';

export const TDM_KILL_TARGET = 25;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_STAND_EYE_HEIGHT = 1.68;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.05;
export const PLAYER_SLIDE_EYE_HEIGHT = 0.78;
export const GRAVITY = 24;
export const JUMP_VELOCITY = 8.4;

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  mp40: {
    id: 'mp40',
    name: 'MP-40 Submachine',
    shortLabel: 'MP-40',
    role: 'Rapid CQB SMG',
    slot: 1,
    isMelee: false,
    automatic: true,
    damage: 24,
    headshotMultiplier: 1.75,
    fireRateRpm: 540,
    magSize: 32,
    reserveMax: 160,
    reloadDurationSec: 1.45,
    hipSpreadRad: 0.032,
    adsSpreadRad: 0.008,
    adsFov: 58,
    recoilPitch: 0.016,
    recoilYaw: 0.007,
    rangeMeters: 55,
    pellets: 1,
    moveSpeedMult: 1.0,
  },
  tommy: {
    id: 'tommy',
    name: 'M1A1 Thompson',
    shortLabel: 'Tommy Gun',
    role: 'Heavy Trench SMG',
    slot: 1,
    isMelee: false,
    automatic: true,
    damage: 27,
    headshotMultiplier: 1.8,
    fireRateRpm: 620,
    magSize: 30,
    reserveMax: 150,
    reloadDurationSec: 1.55,
    hipSpreadRad: 0.036,
    adsSpreadRad: 0.01,
    adsFov: 58,
    recoilPitch: 0.019,
    recoilYaw: 0.01,
    rangeMeters: 52,
    pellets: 1,
    moveSpeedMult: 0.98,
  },
  shotgun: {
    id: 'shotgun',
    name: 'M1897 Trench Gun',
    shortLabel: 'Shotgun',
    role: '8-Pellet Breacher',
    slot: 1,
    isMelee: false,
    automatic: false,
    damage: 16,
    headshotMultiplier: 1.5,
    fireRateRpm: 88,
    magSize: 6,
    reserveMax: 36,
    reloadDurationSec: 1.7,
    hipSpreadRad: 0.075,
    adsSpreadRad: 0.048,
    adsFov: 62,
    recoilPitch: 0.045,
    recoilYaw: 0.015,
    rangeMeters: 28,
    pellets: 8,
    moveSpeedMult: 0.96,
  },
  kar98k: {
    id: 'kar98k',
    name: 'Karabiner 98k',
    shortLabel: 'Kar98k',
    role: 'Bolt-Action Rifle',
    slot: 1,
    isMelee: false,
    automatic: false,
    damage: 85,
    headshotMultiplier: 2.0,
    fireRateRpm: 54,
    magSize: 5,
    reserveMax: 35,
    reloadDurationSec: 1.85,
    hipSpreadRad: 0.045,
    adsSpreadRad: 0.0012,
    adsFov: 34,
    recoilPitch: 0.055,
    recoilYaw: 0.012,
    rangeMeters: 140,
    pellets: 1,
    moveSpeedMult: 0.94,
  },
  m1911: {
    id: 'm1911',
    name: 'Colt M1911',
    shortLabel: 'M1911',
    role: '.45 ACP Sidearm',
    slot: 2,
    isMelee: false,
    automatic: false,
    damage: 34,
    headshotMultiplier: 1.8,
    fireRateRpm: 320,
    magSize: 8,
    reserveMax: 48,
    reloadDurationSec: 1.15,
    hipSpreadRad: 0.022,
    adsSpreadRad: 0.005,
    adsFov: 60,
    recoilPitch: 0.025,
    recoilYaw: 0.008,
    rangeMeters: 48,
    pellets: 1,
    moveSpeedMult: 1.05,
  },
  knife: {
    id: 'knife',
    name: 'M3 Combat Knife',
    shortLabel: 'Knife',
    role: 'Tactical Melee',
    slot: 3,
    isMelee: true,
    automatic: false,
    damage: 75,
    headshotMultiplier: 1.5,
    fireRateRpm: 110,
    magSize: 1,
    reserveMax: 0,
    reloadDurationSec: 0,
    hipSpreadRad: 0,
    adsSpreadRad: 0,
    adsFov: 70,
    recoilPitch: 0.01,
    recoilYaw: 0.01,
    rangeMeters: 2.9,
    pellets: 1,
    moveSpeedMult: 1.14,
  },
  golden_knife: {
    id: 'golden_knife',
    name: 'Golden Trench Blade',
    shortLabel: 'Golden Knife',
    role: 'Final Tier Finisher',
    slot: 3,
    isMelee: true,
    automatic: false,
    damage: 120,
    headshotMultiplier: 1.5,
    fireRateRpm: 130,
    magSize: 1,
    reserveMax: 0,
    reloadDurationSec: 0,
    hipSpreadRad: 0,
    adsSpreadRad: 0,
    adsFov: 70,
    recoilPitch: 0.01,
    recoilYaw: 0.01,
    rangeMeters: 3.3,
    pellets: 1,
    moveSpeedMult: 1.18,
  },
};

export const GUN_GAME_LADDER: WeaponId[] = [
  'mp40',
  'tommy',
  'shotgun',
  'kar98k',
  'golden_knife',
];

export function getGunGameWeaponForTier(tier: number): WeaponId {
  const clamped = Math.max(0, Math.min(GUN_GAME_LADDER.length - 1, tier));
  return GUN_GAME_LADDER[clamped];
}

export function getWeaponFireIntervalSec(weaponId: WeaponId): number {
  const spec = WEAPON_SPECS[weaponId];
  return 60 / Math.max(1, spec.fireRateRpm);
}

export function computeEffectiveSpread(
  weaponId: WeaponId,
  isAds: boolean,
  stance: StanceState,
  horizontalSpeed: number
): number {
  const spec = WEAPON_SPECS[weaponId];
  const base = isAds ? spec.adsSpreadRad : spec.hipSpreadRad;
  let stanceFactor = 1.0;
  if (stance === 'crouching') stanceFactor = 0.72;
  else if (stance === 'sliding') stanceFactor = 1.15;
  else if (stance === 'airborne') stanceFactor = 1.9;
  const movePenalty = Math.min(1.0, horizontalSpeed / 9.0) * (isAds ? 0.35 : 0.75);
  return base * stanceFactor * (1 + movePenalty);
}

export function computeDamageAtDistance(
  weaponId: WeaponId,
  distanceMeters: number,
  headshot: boolean
): number {
  const spec = WEAPON_SPECS[weaponId];
  if (distanceMeters > spec.rangeMeters) return 0;
  const falloffStart = spec.rangeMeters * 0.45;
  let distFactor = 1.0;
  if (distanceMeters > falloffStart && !spec.isMelee) {
    const t =
      (distanceMeters - falloffStart) /
      Math.max(1, spec.rangeMeters - falloffStart);
    distFactor = Math.max(0.45, 1.0 - t * 0.55);
  }
  const hsMult = headshot ? spec.headshotMultiplier : 1.0;
  return Math.round(spec.damage * distFactor * hsMult);
}

export function getGroundHeightAt(
  x: number,
  z: number,
  currentY: number,
  ramps: RampSurface[],
  boxes: AABBBox[]
): number {
  let highest = 0;

  for (const ramp of ramps) {
    if (x >= ramp.minX && x <= ramp.maxX && z >= ramp.minZ && z <= ramp.maxZ) {
      const t =
        ramp.axis === 'z'
          ? (z - ramp.minZ) / Math.max(0.001, ramp.maxZ - ramp.minZ)
          : (x - ramp.minX) / Math.max(0.001, ramp.maxX - ramp.minX);
      const y = ramp.startY + (ramp.endY - ramp.startY) * Math.max(0, Math.min(1, t));
      if (y <= currentY + 0.65 && y > highest) {
        highest = y;
      }
    }
  }

  for (const box of boxes) {
    if (
      x >= box.minX - 0.15 &&
      x <= box.maxX + 0.15 &&
      z >= box.minZ - 0.15 &&
      z <= box.maxZ + 0.15
    ) {
      if (box.maxY <= currentY + 0.45 && box.maxY > highest) {
        highest = box.maxY;
      }
    }
  }

  return highest;
}

export function resolveCircleAABB(
  x: number,
  y: number,
  z: number,
  radius: number,
  boxes: AABBBox[],
  arenaHalfExtent: number
): { x: number; z: number } {
  let rx = Math.max(-arenaHalfExtent + radius, Math.min(arenaHalfExtent - radius, x));
  let rz = Math.max(-arenaHalfExtent + radius, Math.min(arenaHalfExtent - radius, z));

  for (let pass = 0; pass < 2; pass++) {
    for (const box of boxes) {
      // Skip boxes whose top is safely stepped onto or below foot level
      if (y >= box.maxY - 0.18 || y + 1.75 <= box.minY) {
        continue;
      }
      const closestX = Math.max(box.minX, Math.min(rx, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(rz, box.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Center inside box: push out along nearest edge
          const leftPen = rx - box.minX;
          const rightPen = box.maxX - rx;
          const topPen = rz - box.minZ;
          const botPen = box.maxZ - rz;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) rx = box.minX - radius;
          else if (minPen === rightPen) rx = box.maxX + radius;
          else if (minPen === topPen) rz = box.minZ - radius;
          else rz = box.maxZ + radius;
        }
      }
    }
  }

  rx = Math.max(-arenaHalfExtent + radius, Math.min(arenaHalfExtent - radius, rx));
  rz = Math.max(-arenaHalfExtent + radius, Math.min(arenaHalfExtent - radius, rz));
  return { x: rx, z: rz };
}

export interface WinCheckInput {
  mode: PlayableMode;
  alliesScore: number;
  axisScore: number;
  gunGameTier: number;
  botMaxTier?: number;
  reflexTargetsHit: number;
  reflexTotalTargets: number;
}

export function evaluateMatchOutcome(
  input: WinCheckInput
): { finished: boolean; victory: boolean; reason: string } {
  if (input.mode === 'tdm') {
    if (input.alliesScore >= TDM_KILL_TARGET) {
      return { finished: true, victory: true, reason: 'Allied Squadron reached 25 eliminations' };
    }
    if (input.axisScore >= TDM_KILL_TARGET) {
      return { finished: true, victory: false, reason: 'Axis Regiment reached 25 eliminations' };
    }
    return { finished: false, victory: false, reason: '' };
  }

  if (input.mode === 'gungame') {
    if (input.gunGameTier >= GUN_GAME_LADDER.length) {
      return { finished: true, victory: true, reason: 'Completed all 5 Arms Race tiers' };
    }
    if ((input.botMaxTier ?? 0) >= GUN_GAME_LADDER.length) {
      return { finished: true, victory: false, reason: 'Rival operative completed the Arms Race' };
    }
    return { finished: false, victory: false, reason: '' };
  }

  // reflex mode
  if (input.reflexTotalTargets > 0 && input.reflexTargetsHit >= input.reflexTotalTargets) {
    return { finished: true, victory: true, reason: 'All tactical targets neutralized' };
  }
  return { finished: false, victory: false, reason: '' };
}

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(rng() * ROOM_CHARS.length) % ROOM_CHARS.length;
    out += ROOM_CHARS[idx];
  }
  return out;
}

export function sanitizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function formatClockTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
