export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type PlayableMode = 'tdm' | 'gungame' | 'reflex';

export type WeaponId =
  | 'mp40'
  | 'kar98k'
  | 'm1911'
  | 'knife'
  | 'tommy'
  | 'shotgun'
  | 'golden_knife';

export type TeamId = 'allies' | 'axis';

export type StanceState = 'standing' | 'crouching' | 'sliding' | 'airborne';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortLabel: string;
  role: string;
  slot: 1 | 2 | 3;
  isMelee: boolean;
  automatic: boolean;
  damage: number;
  headshotMultiplier: number;
  fireRateRpm: number;
  magSize: number;
  reserveMax: number;
  reloadDurationSec: number;
  hipSpreadRad: number;
  adsSpreadRad: number;
  adsFov: number;
  recoilPitch: number;
  recoilYaw: number;
  rangeMeters: number;
  pellets: number;
  moveSpeedMult: number;
}

export interface AABBBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  kind: 'wall' | 'crate' | 'train' | 'sandbag' | 'platform';
}

export interface RampSurface {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  startY: number;
  endY: number;
  axis: 'x' | 'z';
}

export interface KillFeedItem {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  killerTeam: TeamId;
  timestamp: number;
}

export interface ScoreboardRow {
  id: string;
  name: string;
  team: TeamId;
  kills: number;
  deaths: number;
  isLocal: boolean;
  isBot: boolean;
  gunGameTier?: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  stamina: number;
  stance: StanceState;
  weaponId: WeaponId;
  weaponName: string;
  weaponRole: string;
  ammoInMag: number;
  ammoReserve: number;
  magSize: number;
  reloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  isPointerLocked: boolean;
  alliesScore: number;
  axisScore: number;
  targetScore: number;
  matchElapsedSec: number;
  gunGameTier: number;
  gunGameTotalTiers: number;
  reflexTargetsHit: number;
  reflexTotalTargets: number;
  reflexBestTimeSec: number | null;
  playerKills: number;
  playerDeaths: number;
  shotsFired: number;
  shotsHit: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
  damageFlash: number;
  killFeed: KillFeedItem[];
  scoreboard: ScoreboardRow[];
  slotWeapons: Array<{
    slot: 1 | 2 | 3;
    id: WeaponId;
    name: string;
    active: boolean;
  }>;
  respawnTimerSec: number;
}

export interface MatchSummary {
  victory: boolean;
  mode: PlayableMode;
  headline: string;
  subline: string;
  kills: number;
  deaths: number;
  accuracyPct: number;
  elapsedSec: number;
  alliesScore: number;
  axisScore: number;
  gunGameTier: number;
  reflexTimeSec: number | null;
  isNewRecord: boolean;
}

export interface PeerPlayerInfo {
  peerId: string;
  callsign: string;
  team: TeamId;
  isHost: boolean;
  ready: boolean;
}

export type NetworkStatus =
  | 'offline'
  | 'connecting'
  | 'hosting'
  | 'joined'
  | 'error';

export interface RemoteStatePacket {
  type: 'state';
  peerId: string;
  callsign: string;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  weaponId: WeaponId;
  stance: StanceState;
  health: number;
  kills: number;
  deaths: number;
  gunGameTier: number;
}

export interface RemoteShotPacket {
  type: 'shot';
  peerId: string;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
  weaponId: WeaponId;
}

export interface RemoteHitPacket {
  type: 'hit';
  attackerId: string;
  attackerName: string;
  attackerTeam: TeamId;
  victimId: string;
  damage: number;
  headshot: boolean;
  weaponId: WeaponId;
}

export interface LobbyRosterPacket {
  type: 'roster';
  mode: PlayableMode;
  players: PeerPlayerInfo[];
}

export interface StartMatchPacket {
  type: 'start_match';
  mode: PlayableMode;
}

export type NetPacket =
  | { type: 'hello'; peerId: string; callsign: string }
  | LobbyRosterPacket
  | StartMatchPacket
  | RemoteStatePacket
  | RemoteShotPacket
  | RemoteHitPacket;
