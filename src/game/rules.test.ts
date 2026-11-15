import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUN_GAME_LADDER,
  TDM_KILL_TARGET,
  computeDamageAtDistance,
  computeEffectiveSpread,
  evaluateMatchOutcome,
  formatClockTime,
  generateRoomCode,
  getGroundHeightAt,
  getGunGameWeaponForTier,
  resolveCircleAABB,
  sanitizeRoomCode,
} from './rules';
import type { AABBBox, RampSurface } from './types';

test('Gun Game ladder progresses cleanly and clamps out-of-range tiers', () => {
  assert.equal(GUN_GAME_LADDER[0], 'mp40');
  assert.equal(GUN_GAME_LADDER[GUN_GAME_LADDER.length - 1], 'golden_knife');
  assert.equal(getGunGameWeaponForTier(-1), 'mp40');
  assert.equal(getGunGameWeaponForTier(2), 'shotgun');
  assert.equal(getGunGameWeaponForTier(99), 'golden_knife');
});

test('ADS and crouching tighten spread while airborne increases spread', () => {
  const hipStand = computeEffectiveSpread('mp40', false, 'standing', 0);
  const adsStand = computeEffectiveSpread('mp40', true, 'standing', 0);
  const hipCrouch = computeEffectiveSpread('mp40', false, 'crouching', 0);
  const hipAir = computeEffectiveSpread('mp40', false, 'airborne', 0);

  assert.ok(adsStand < hipStand);
  assert.ok(hipCrouch < hipStand);
  assert.ok(hipAir > hipStand);
});

test('Distance damage falloff and headshot multipliers behave accurately', () => {
  const closeBody = computeDamageAtDistance('mp40', 5, false);
  const closeHead = computeDamageAtDistance('mp40', 5, true);
  const farBody = computeDamageAtDistance('mp40', 50, false);
  const outOfRange = computeDamageAtDistance('mp40', 80, false);

  assert.equal(closeBody, 24);
  assert.ok(closeHead > closeBody);
  assert.ok(farBody < closeBody && farBody > 0);
  assert.equal(outOfRange, 0);
});

test('Circle-AABB collision resolves wall overlap and arena boundary clamping', () => {
  const boxes: AABBBox[] = [
    {
      id: 'wall1',
      minX: 2,
      maxX: 4,
      minY: 0,
      maxY: 3,
      minZ: -2,
      maxZ: 2,
      kind: 'wall',
    },
  ];
  const resolved = resolveCircleAABB(1.85, 0, 0, 0.42, boxes, 25);
  assert.ok(resolved.x <= 2 - 0.42 + 0.001);

  const clamped = resolveCircleAABB(40, 0, -40, 0.42, boxes, 25);
  assert.ok(clamped.x <= 25 - 0.42 + 0.001);
  assert.ok(clamped.z >= -25 + 0.42 - 0.001);
});

test('Ramp surface interpolates ground height smoothly', () => {
  const ramps: RampSurface[] = [
    {
      id: 'r1',
      minX: 0,
      maxX: 4,
      minZ: 0,
      maxZ: 8,
      startY: 0,
      endY: 2,
      axis: 'z',
    },
  ];
  const midY = getGroundHeightAt(2, 4, 1.0, ramps, []);
  assert.ok(Math.abs(midY - 1.0) < 0.01);
});

test('Match outcome evaluator triggers TDM, Gun Game, and Reflex win/loss states', () => {
  assert.equal(
    evaluateMatchOutcome({
      mode: 'tdm',
      alliesScore: TDM_KILL_TARGET,
      axisScore: 10,
      gunGameTier: 0,
      reflexTargetsHit: 0,
      reflexTotalTargets: 0,
    }).victory,
    true
  );

  const axisWin = evaluateMatchOutcome({
    mode: 'tdm',
    alliesScore: 12,
    axisScore: TDM_KILL_TARGET,
    gunGameTier: 0,
    reflexTargetsHit: 0,
    reflexTotalTargets: 0,
  });
  assert.equal(axisWin.finished, true);
  assert.equal(axisWin.victory, false);

  const gunWin = evaluateMatchOutcome({
    mode: 'gungame',
    alliesScore: 0,
    axisScore: 0,
    gunGameTier: GUN_GAME_LADDER.length,
    reflexTargetsHit: 0,
    reflexTotalTargets: 0,
  });
  assert.equal(gunWin.finished, true);
  assert.equal(gunWin.victory, true);

  const reflexWin = evaluateMatchOutcome({
    mode: 'reflex',
    alliesScore: 0,
    axisScore: 0,
    gunGameTier: 0,
    reflexTargetsHit: 18,
    reflexTotalTargets: 18,
  });
  assert.equal(reflexWin.finished, true);
  assert.equal(reflexWin.victory, true);
});

test('Room code generator and sanitizer produce valid 4-char codes', () => {
  const code = generateRoomCode(() => 0.25);
  assert.equal(code.length, 4);
  assert.equal(sanitizeRoomCode(' ww-2x9 '), 'WW2X');
  assert.equal(formatClockTime(125), '02:05');
});
