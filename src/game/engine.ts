import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildDepotArena, type DepotArenaBuild } from './arena';
import { audioEngine } from './audio';
import {
  GRAVITY,
  GUN_GAME_LADDER,
  JUMP_VELOCITY,
  PLAYER_CROUCH_EYE_HEIGHT,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_SLIDE_EYE_HEIGHT,
  PLAYER_STAND_EYE_HEIGHT,
  TDM_KILL_TARGET,
  computeDamageAtDistance,
  computeEffectiveSpread,
  evaluateMatchOutcome,
  getGroundHeightAt,
  getGunGameWeaponForTier,
  getWeaponFireIntervalSec,
  resolveCircleAABB,
} from './rules';
import {
  createProceduralSoldier,
  type BotArchetype,
  type SoldierRig,
} from './soldiers';
import { createProceduralTextureSet, type ProceduralTextureSet } from './textures';
import type {
  GamePhase,
  HudSnapshot,
  KillFeedItem,
  MatchSummary,
  NetPacket,
  PeerPlayerInfo,
  PlayableMode,
  RemoteStatePacket,
  ScoreboardRow,
  StanceState,
  TeamId,
  WeaponId,
} from './types';
import { buildProceduralWeaponModel, type WeaponModelBuild } from './weapons';

interface BotAgent {
  id: string;
  name: string;
  team: TeamId;
  archetype: BotArchetype;
  rig: SoldierRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  koTimer: number;
  respawnTimer: number;
  hitFlashTimer: number;
  fireCooldown: number;
  burstRemain: number;
  strafeSign: number;
  strafeTimer: number;
  walkPhase: number;
  weaponId: WeaponId;
  gunGameTier: number;
  kills: number;
  deaths: number;
  waypointX: number;
  waypointZ: number;
}

interface RemotePlayerAgent {
  peerId: string;
  name: string;
  team: TeamId;
  rig: SoldierRig;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  yaw: number;
  health: number;
  kills: number;
  deaths: number;
  gunGameTier: number;
  walkPhase: number;
  hitFlashTimer: number;
}

interface PooledTracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onMatchEnd: (summary: MatchSummary) => void;
  onPauseRequest: () => void;
  onContextLost: () => void;
  onSendNetPacket?: (pkt: NetPacket) => void;
}

const SPARK_POOL_SIZE = 72;
const TRACER_POOL_SIZE = 24;
const REFLEX_BEST_KEY = 'legion_arena_reflex_best_sec';

// Pre-allocated scratch math objects (Zero-GC loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class TacticalFpsEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private arena: DepotArenaBuild | null = null;

  private phase: GamePhase = 'title';
  private mode: PlayableMode = 'tdm';
  private callsign = 'Operative';
  private localTeam: TeamId = 'allies';
  private localPeerId = 'local';

  // Loop & pacing
  private frameId = 0;
  private lastTimeMs = 0;
  private disposed = false;
  private hitstopTimer = 0;
  private hudSyncTimer = 0;
  private netSyncTimer = 0;

  // Player physics & state
  private px = 0;
  private py = 0;
  private pz = 21.5;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private yaw = 0;
  private pitch = 0;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private eyeHeight = PLAYER_STAND_EYE_HEIGHT;
  private stance: StanceState = 'standing';
  private crouchingToggle = false;
  private slideTimer = 0;
  private slideCooldown = 0;
  private slideDirX = 0;
  private slideDirZ = 0;
  private stamina = 100;
  private health = PLAYER_MAX_HEALTH;
  private respawnTimer = 0;
  private stepDistAccum = 0;

  // Camera feel
  private sensitivity = 0.0022;
  private trauma = 0;
  private recoilPitchOffset = 0;
  private recoilYawOffset = 0;
  private viewRoll = 0;
  private currentFov = 74;

  // Weapon state
  private viewModelAnchor = new THREE.Group();
  private weaponBuilds: Partial<Record<WeaponId, WeaponModelBuild>> = {};
  private activeWeaponId: WeaponId = 'mp40';
  private slotLoadout: Record<1 | 2 | 3, WeaponId> = {
    1: 'mp40',
    2: 'm1911',
    3: 'knife',
  };
  private ammoMag: Partial<Record<WeaponId, number>> = {};
  private ammoReserve: Partial<Record<WeaponId, number>> = {};
  private fireCooldown = 0;
  private reloading = false;
  private reloadTimer = 0;
  private isAds = false;
  private weaponBobPhase = 0;
  private weaponKickZ = 0;
  private knifeSlashTimer = 0;
  private muzzleLight: THREE.PointLight;
  private muzzleMesh: THREE.Mesh;
  private muzzleFlashTimer = 0;

  // Match stats
  private alliesScore = 0;
  private axisScore = 0;
  private matchElapsedSec = 0;
  private gunGameTier = 0;
  private playerKills = 0;
  private playerDeaths = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private hitmarkerTimer = 0;
  private hitmarkerHeadshot = false;
  private damageFlash = 0;
  private killFeed: KillFeedItem[] = [];
  private reflexBestTimeSec: number | null = null;

  // Actors & Pools
  private bots: BotAgent[] = [];
  private remotePlayers: Map<string, RemotePlayerAgent> = new Map();
  private tracers: PooledTracer[] = [];
  private tracerCursor = 0;
  private sparkInstanced: THREE.InstancedMesh;
  private sparks: SparkParticle[] = [];
  private sparkCursor = 0;
  private raycaster = new THREE.Raycaster();
  private arenaRayMeshes: THREE.Object3D[] = [];

  // Input tracking
  private heldKeys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private isPointerLocked = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.reflexBestTimeSec = this.loadReflexBest();

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight)
    );
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'fps-canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = 0x7b837d;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.0135);

    const aspect =
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(74, aspect, 0.08, 220);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Studio IBL Environment Map for metallic gunmetal & steel
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Lighting Rig
    const hemi = new THREE.HemisphereLight(0x9fb8cf, 0x3b3329, 0.9);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffe1ba, 2.2);
    keyLight.position.set(22, 34, 18);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    const d = 32;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa3c2e0, 0.65);
    rimLight.position.set(-20, 16, -24);
    this.scene.add(rimLight);

    // Procedural Textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextureSet(maxAniso);

    // First-person weapon viewmodel anchor attached to camera
    this.camera.add(this.viewModelAnchor);
    this.viewModelAnchor.visible = false;

    this.muzzleLight = new THREE.PointLight(0xffb54a, 0, 9, 2);
    this.camera.add(this.muzzleLight);

    const muzzleGeo = new THREE.OctahedronGeometry(0.055, 0);
    const muzzleMat = new THREE.MeshBasicMaterial({
      color: 0xffd275,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.muzzleMesh = new THREE.Mesh(muzzleGeo, muzzleMat);
    this.muzzleMesh.visible = false;
    this.camera.add(this.muzzleMesh);

    // Pooled Bullet Tracers
    const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 6);
    tracerGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < TRACER_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd888,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.08 });
    }

    // Pooled Instanced Spark Particles
    const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    this.sparkInstanced = new THREE.InstancedMesh(
      sparkGeo,
      sparkMat,
      SPARK_POOL_SIZE
    );
    this.sparkInstanced.frustumCulled = false;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.25,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.sparkInstanced.instanceMatrix.needsUpdate = true;
    this.scene.add(this.sparkInstanced);

    // Build initial Depot Arena for live Title Flyover
    this.rebuildArena(false);
    this.spawnBotsForMode('tdm');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.attachEvents();
    this.lastTimeMs = performance.now();
    this.scheduleNextFrame();
  }

  private loadReflexBest(): number | null {
    try {
      const raw = window.localStorage.getItem(REFLEX_BEST_KEY);
      if (!raw) return null;
      const val = Number(raw);
      return Number.isFinite(val) && val > 0 ? val : null;
    } catch {
      return null;
    }
  }

  private saveReflexBest(sec: number): boolean {
    const isNew = this.reflexBestTimeSec === null || sec < this.reflexBestTimeSec;
    if (isNew) {
      this.reflexBestTimeSec = sec;
      try {
        window.localStorage.setItem(REFLEX_BEST_KEY, sec.toFixed(2));
      } catch {
        // ignore storage restrictions
      }
    }
    return isNew;
  }

  private rebuildArena(includeReflexTargets: boolean): void {
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
    }
    this.arena = buildDepotArena(this.textures, includeReflexTargets);
    this.scene.add(this.arena.group);
    this.arenaRayMeshes = [];
    this.arena.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        this.arenaRayMeshes.push(obj);
      }
    });
  }

  private clearBots(): void {
    for (const bot of this.bots) {
      this.scene.remove(bot.rig.root);
      bot.rig.dispose();
    }
    this.bots = [];
  }

  private spawnBotsForMode(mode: PlayableMode): void {
    this.clearBots();
    if (!this.arena || mode === 'reflex') return;

    const archetypes: BotArchetype[] = ['rusher', 'marksman', 'flanker'];
    if (mode === 'tdm') {
      // 3 Allies bots + 4 Axis bots
      const alliedNames = ['Sgt. Miller', 'Cpl. Hayes', 'Pvt. Nowak'];
      const axisNames = ['K. Becker', 'H. Vogel', 'L. Brandt', 'F. Richter'];

      alliedNames.forEach((name, idx) => {
        const sp = this.arena!.alliesSpawns[(idx + 1) % this.arena!.alliesSpawns.length];
        const arch = archetypes[idx % archetypes.length];
        const wId: WeaponId = arch === 'marksman' ? 'kar98k' : 'mp40';
        const rig = createProceduralSoldier(`bot_allies_${idx}`, 'allies', arch, wId);
        rig.root.position.set(sp.x, sp.y, sp.z);
        this.scene.add(rig.root);
        this.bots.push({
          id: `bot_allies_${idx}`,
          name,
          team: 'allies',
          archetype: arch,
          rig,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          vx: 0,
          vz: 0,
          yaw: sp.yaw,
          health: 100,
          maxHealth: 100,
          alive: true,
          koTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          fireCooldown: 0.8 + idx * 0.3,
          burstRemain: 0,
          strafeSign: idx % 2 === 0 ? 1 : -1,
          strafeTimer: 1.5,
          walkPhase: 0,
          weaponId: wId,
          gunGameTier: 0,
          kills: 0,
          deaths: 0,
          waypointX: (idx - 1) * 8,
          waypointZ: -4,
        });
      });

      axisNames.forEach((name, idx) => {
        const sp = this.arena!.axisSpawns[idx % this.arena!.axisSpawns.length];
        const arch = archetypes[(idx + 1) % archetypes.length];
        const wId: WeaponId = arch === 'marksman' ? 'kar98k' : idx === 2 ? 'shotgun' : 'mp40';
        const rig = createProceduralSoldier(`bot_axis_${idx}`, 'axis', arch, wId);
        rig.root.position.set(sp.x, sp.y, sp.z);
        this.scene.add(rig.root);
        this.bots.push({
          id: `bot_axis_${idx}`,
          name,
          team: 'axis',
          archetype: arch,
          rig,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          vx: 0,
          vz: 0,
          yaw: sp.yaw,
          health: 100,
          maxHealth: 100,
          alive: true,
          koTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          fireCooldown: 1.0 + idx * 0.25,
          burstRemain: 0,
          strafeSign: idx % 2 === 0 ? 1 : -1,
          strafeTimer: 1.8,
          walkPhase: 0,
          weaponId: wId,
          gunGameTier: 0,
          kills: 0,
          deaths: 0,
          waypointX: (idx - 1.5) * 7,
          waypointZ: 4,
        });
      });
    } else if (mode === 'gungame') {
      const rivalNames = ['V. Steiner', 'R. Mercer', 'D. Lindqvist', 'T. Gallo', 'E. Weber'];
      rivalNames.forEach((name, idx) => {
        const sp =
          idx % 2 === 0
            ? this.arena!.axisSpawns[idx % this.arena!.axisSpawns.length]
            : this.arena!.alliesSpawns[(idx + 1) % this.arena!.alliesSpawns.length];
        const arch = archetypes[idx % archetypes.length];
        const rig = createProceduralSoldier(`bot_gg_${idx}`, 'axis', arch, 'mp40');
        rig.root.position.set(sp.x, sp.y, sp.z);
        this.scene.add(rig.root);
        this.bots.push({
          id: `bot_gg_${idx}`,
          name,
          team: 'axis',
          archetype: arch,
          rig,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          vx: 0,
          vz: 0,
          yaw: sp.yaw,
          health: 100,
          maxHealth: 100,
          alive: true,
          koTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          fireCooldown: 1.1 + idx * 0.2,
          burstRemain: 0,
          strafeSign: idx % 2 === 0 ? 1 : -1,
          strafeTimer: 1.4,
          walkPhase: 0,
          weaponId: 'mp40',
          gunGameTier: 0,
          kills: 0,
          deaths: 0,
          waypointX: 0,
          waypointZ: 0,
        });
      });
    }
  }

  private ensureWeaponModel(weaponId: WeaponId): WeaponModelBuild {
    let build = this.weaponBuilds[weaponId];
    if (!build) {
      build = buildProceduralWeaponModel(weaponId, this.isSoftwareGl);
      this.weaponBuilds[weaponId] = build;
    }
    return build;
  }

  private equipWeapon(weaponId: WeaponId): void {
    this.activeWeaponId = weaponId;
    this.reloading = false;
    this.reloadTimer = 0;

    while (this.viewModelAnchor.children.length > 0) {
      this.viewModelAnchor.remove(this.viewModelAnchor.children[0]);
    }
    const model = this.ensureWeaponModel(weaponId);
    this.viewModelAnchor.add(model.root);
    this.viewModelAnchor.position.copy(model.hipOffset);

    if (this.ammoMag[weaponId] === undefined) {
      const spec =
        weaponId === 'mp40' ||
        weaponId === 'tommy' ||
        weaponId === 'shotgun' ||
        weaponId === 'kar98k' ||
        weaponId === 'm1911'
          ? weaponId
          : null;
      if (spec) {
        const magCap = this.getMagSize(weaponId);
        this.ammoMag[weaponId] = magCap;
        this.ammoReserve[weaponId] = this.getReserveMax(weaponId);
      } else {
        this.ammoMag[weaponId] = 1;
        this.ammoReserve[weaponId] = 0;
      }
    }
  }

  private getMagSize(w: WeaponId): number {
    switch (w) {
      case 'mp40':
        return 32;
      case 'tommy':
        return 30;
      case 'shotgun':
        return 6;
      case 'kar98k':
        return 5;
      case 'm1911':
        return 8;
      default:
        return 1;
    }
  }

  private getReserveMax(w: WeaponId): number {
    switch (w) {
      case 'mp40':
        return 160;
      case 'tommy':
        return 150;
      case 'shotgun':
        return 36;
      case 'kar98k':
        return 35;
      case 'm1911':
        return 48;
      default:
        return 0;
    }
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.0006, Math.min(0.006, val));
  }

  public setIdentity(callsign: string, localPeerId: string, team: TeamId): void {
    this.callsign = callsign || 'Operative';
    this.localPeerId = localPeerId || 'local';
    this.localTeam = team;
  }

  public startMatch(mode: PlayableMode, roster: PeerPlayerInfo[] = []): void {
    audioEngine.unlock();
    this.mode = mode;
    this.phase = 'playing';
    this.heldKeys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.isAds = false;

    const myRoster = roster.find((p) => p.peerId === this.localPeerId);
    if (myRoster) {
      this.localTeam = myRoster.team;
      this.callsign = myRoster.callsign;
    } else {
      this.localTeam = 'allies';
    }

    this.rebuildArena(mode === 'reflex');
    this.spawnBotsForMode(mode);

    // Reset player stats & loadout
    this.alliesScore = 0;
    this.axisScore = 0;
    this.matchElapsedSec = 0;
    this.gunGameTier = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.killFeed = [];
    this.ammoMag = {};
    this.ammoReserve = {};
    this.health = PLAYER_MAX_HEALTH;
    this.stamina = 100;
    this.respawnTimer = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.recoilPitchOffset = 0;
    this.recoilYawOffset = 0;

    if (mode === 'gungame') {
      this.slotLoadout = { 1: 'mp40', 2: 'm1911', 3: 'knife' };
      this.equipWeapon('mp40');
    } else if (mode === 'reflex') {
      this.slotLoadout = { 1: 'mp40', 2: 'kar98k', 3: 'm1911' };
      this.equipWeapon('mp40');
    } else {
      this.slotLoadout = { 1: 'mp40', 2: 'm1911', 3: 'knife' };
      this.equipWeapon('mp40');
    }

    this.respawnLocalPlayer();
    this.viewModelAnchor.visible = true;
    this.pushHudSnapshot();
  }

  public setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    if (nextPhase !== 'playing') {
      this.heldKeys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      this.isAds = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
    if (nextPhase === 'title') {
      this.viewModelAnchor.visible = false;
      this.rebuildArena(false);
      this.spawnBotsForMode('tdm');
    } else if (nextPhase === 'playing') {
      this.viewModelAnchor.visible = true;
    }
  }

  public requestPointerLock(): void {
    if (this.phase === 'playing' && document.pointerLockElement !== this.renderer.domElement) {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Headless browsers may reject PointerLock without gesture; fallback look still works
      }
    }
  }

  public handleRemotePacket(packet: NetPacket): void {
    if (packet.type === 'state') {
      if (packet.peerId === this.localPeerId) return;
      let rp = this.remotePlayers.get(packet.peerId);
      if (!rp) {
        const rig = createProceduralSoldier(
          packet.peerId,
          packet.team,
          'rusher',
          packet.weaponId
        );
        this.scene.add(rig.root);
        rp = {
          peerId: packet.peerId,
          name: packet.callsign,
          team: packet.team,
          rig,
          x: packet.x,
          y: packet.y,
          z: packet.z,
          targetX: packet.x,
          targetY: packet.y,
          targetZ: packet.z,
          yaw: packet.yaw,
          health: packet.health,
          kills: packet.kills,
          deaths: packet.deaths,
          gunGameTier: packet.gunGameTier,
          walkPhase: 0,
          hitFlashTimer: 0,
        };
        this.remotePlayers.set(packet.peerId, rp);
      }
      rp.targetX = packet.x;
      rp.targetY = packet.y;
      rp.targetZ = packet.z;
      rp.yaw = packet.yaw;
      rp.health = packet.health;
      rp.kills = packet.kills;
      rp.deaths = packet.deaths;
      rp.gunGameTier = packet.gunGameTier;
      return;
    }

    if (packet.type === 'shot') {
      this.spawnTracer(
        new THREE.Vector3(packet.ox, packet.oy, packet.oz),
        new THREE.Vector3(
          packet.ox + packet.dx * 35,
          packet.oy + packet.dy * 35,
          packet.oz + packet.dz * 35
        )
      );
      return;
    }

    if (packet.type === 'hit') {
      if (packet.victimId === this.localPeerId && this.phase === 'playing') {
        this.applyDamageToLocalPlayer(
          packet.damage,
          packet.attackerName,
          packet.attackerTeam,
          packet.weaponId,
          packet.headshot
        );
      }
    }
  }

  private respawnLocalPlayer(): void {
    if (!this.arena) return;
    const pool =
      this.localTeam === 'allies'
        ? this.arena.alliesSpawns
        : this.arena.axisSpawns;
    const sp = pool[0];
    this.px = sp.x;
    this.py = sp.y;
    this.pz = sp.z;
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.yaw = sp.yaw;
    this.pitch = 0;
    this.health = PLAYER_MAX_HEALTH;
    this.respawnTimer = 0;
    this.grounded = true;
    this.stance = 'standing';
    this.crouchingToggle = false;
    this.slideTimer = 0;
  }

  private attachEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.onWebGlLost
    );
  }

  private onWebGlLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost();
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onWindowBlur = (): void => {
    this.heldKeys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.isAds = false;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onWindowBlur();
    }
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked =
      document.pointerLockElement === this.renderer.domElement;
    this.pushHudSnapshot();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (this.isPointerLocked || this.mouseRightDown || e.buttons === 1) {
      const adsScale = this.isAds ? 0.58 : 1.0;
      this.yaw -= e.movementX * this.sensitivity * adsScale;
      this.pitch = Math.max(
        -1.42,
        Math.min(1.42, this.pitch - e.movementY * this.sensitivity * adsScale)
      );
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    audioEngine.unlock();
    if (!this.isPointerLocked) {
      this.requestPointerLock();
    }
    if (e.button === 0) {
      this.mouseLeftDown = true;
      this.tryFireWeapon(true);
    } else if (e.button === 2) {
      this.mouseRightDown = true;
      this.isAds = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftDown = false;
    if (e.button === 2) {
      this.mouseRightDown = false;
      this.isAds = false;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.phase !== 'playing') return;
    const code = e.code;

    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      this.callbacks.onPauseRequest();
      return;
    }

    if (code === 'Space' && !this.heldKeys.has('Space')) {
      this.jumpBufferTimer = 0.12;
    }

    if (code === 'KeyC' && !this.heldKeys.has('KeyC')) {
      const sprinting =
        this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
      const speed = Math.hypot(this.pvx, this.pvz);
      if (sprinting && speed > 5.0 && this.grounded && this.slideCooldown <= 0) {
        this.slideTimer = 0.55;
        this.slideCooldown = 0.9;
        this.slideDirX = this.pvx / speed;
        this.slideDirZ = this.pvz / speed;
        this.crouchingToggle = false;
        audioEngine.playSlide();
      } else {
        this.crouchingToggle = !this.crouchingToggle;
      }
    }

    if (code === 'KeyR') {
      this.startReload();
    }

    if (code === 'KeyQ') {
      this.isAds = !this.isAds;
    }

    if (code === 'KeyF' && !this.heldKeys.has('KeyF')) {
      this.tryFireWeapon(true);
    }

    if (this.mode !== 'gungame') {
      if (code === 'Digit1') this.equipWeapon(this.slotLoadout[1]);
      if (code === 'Digit2') this.equipWeapon(this.slotLoadout[2]);
      if (code === 'Digit3') this.equipWeapon(this.slotLoadout[3]);
    }

    this.heldKeys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private startReload(): void {
    if (this.reloading) return;
    if (
      this.activeWeaponId === 'knife' ||
      this.activeWeaponId === 'golden_knife'
    ) {
      return;
    }
    const magCap = this.getMagSize(this.activeWeaponId);
    const curMag = this.ammoMag[this.activeWeaponId] ?? 0;
    const reserve = this.ammoReserve[this.activeWeaponId] ?? 0;
    if (curMag >= magCap || reserve <= 0) return;

    this.reloading = true;
    this.isAds = false;
    this.reloadTimer =
      this.activeWeaponId === 'kar98k'
        ? 1.85
        : this.activeWeaponId === 'shotgun'
          ? 1.7
          : this.activeWeaponId === 'm1911'
            ? 1.15
            : 1.45;
    audioEngine.playReload();
  }

  private tryFireWeapon(isEdge: boolean): void {
    if (this.phase !== 'playing' || this.respawnTimer > 0) return;
    if (this.fireCooldown > 0) return;

    const isAuto =
      this.activeWeaponId === 'mp40' || this.activeWeaponId === 'tommy';
    if (!isAuto && !isEdge) return;

    const isMelee =
      this.activeWeaponId === 'knife' || this.activeWeaponId === 'golden_knife';

    if (!isMelee) {
      if (this.reloading) return;
      const curMag = this.ammoMag[this.activeWeaponId] ?? 0;
      if (curMag <= 0) {
        this.startReload();
        return;
      }
      this.ammoMag[this.activeWeaponId] = curMag - 1;
      if (this.ammoMag[this.activeWeaponId] === 0) {
        // Trigger smooth auto-reload on empty after slight beat
        setTimeout(() => {
          if (this.phase === 'playing') this.startReload();
        }, 180);
      }
    } else {
      this.knifeSlashTimer = 0.22;
    }

    this.fireCooldown = getWeaponFireIntervalSec(this.activeWeaponId);
    audioEngine.playWeaponFire(this.activeWeaponId);

    // Recoil & weapon kick
    const kickPitch =
      this.activeWeaponId === 'kar98k'
        ? 0.055
        : this.activeWeaponId === 'shotgun'
          ? 0.045
          : this.activeWeaponId === 'm1911'
            ? 0.025
            : 0.016;
    this.recoilPitchOffset += kickPitch * (this.isAds ? 0.65 : 1.0);
    this.recoilYawOffset += (Math.random() - 0.5) * 0.012;
    this.weaponKickZ = isMelee ? -0.14 : 0.065;
    this.trauma = Math.min(1, this.trauma + (isMelee ? 0.14 : 0.22));

    if (!isMelee) {
      this.shotsFired++;
      this.muzzleFlashTimer = 0.05;
      const build = this.weaponBuilds[this.activeWeaponId];
      if (build) {
        build.muzzleAnchor.getWorldPosition(_v1);
        this.camera.worldToLocal(_v2.copy(_v1));
        this.muzzleMesh.position.copy(_v2);
        this.muzzleMesh.rotation.z = Math.random() * Math.PI;
        this.muzzleMesh.visible = true;
        this.muzzleLight.position.copy(_v2);
        this.muzzleLight.intensity = 4.5;
      }
    }

    // Raycast Pellets
    const pellets = this.activeWeaponId === 'shotgun' ? 8 : 1;
    const hSpeed = Math.hypot(this.pvx, this.pvz);
    const spread = computeEffectiveSpread(
      this.activeWeaponId,
      this.isAds,
      this.stance,
      hSpeed
    );
    const maxRange = isMelee
      ? this.activeWeaponId === 'golden_knife'
        ? 3.3
        : 2.9
      : this.activeWeaponId === 'kar98k'
        ? 140
        : this.activeWeaponId === 'shotgun'
          ? 28
          : 55;

    // Collect shootable targets
    const targets: THREE.Object3D[] = [...this.arenaRayMeshes];
    for (const bot of this.bots) {
      if (bot.alive && (this.mode === 'gungame' || bot.team !== this.localTeam)) {
        targets.push(...bot.rig.hitMeshes);
      }
    }
    this.remotePlayers.forEach((rp) => {
      if (rp.health > 0 && (this.mode === 'gungame' || rp.team !== this.localTeam)) {
        targets.push(...rp.rig.hitMeshes);
      }
    });

    let landedAny = false;
    let landedHeadshot = false;

    for (let p = 0; p < pellets; p++) {
      _dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      if (spread > 0) {
        _dir.x += (Math.random() - 0.5) * spread * 2;
        _dir.y += (Math.random() - 0.5) * spread * 2;
        _dir.z += (Math.random() - 0.5) * spread * 2;
        _dir.normalize();
      }

      this.raycaster.set(this.camera.position, _dir);
      this.raycaster.far = maxRange;
      const hits = this.raycaster.intersectObjects(targets, false);

      let endPoint = _v3
        .copy(this.camera.position)
        .addScaledVector(_dir, maxRange);

      if (hits.length > 0) {
        const hit = hits[0];
        endPoint.copy(hit.point);
        const ud = hit.object.userData as {
          entityId?: string;
          hitZone?: 'head' | 'body';
          reflexTargetId?: string;
        };

        if (ud.reflexTargetId && this.arena) {
          const tNode = this.arena.reflexTargets.find(
            (t) => t.id === ud.reflexTargetId && t.active
          );
          if (tNode) {
            tNode.active = false;
            tNode.hitAnim = 0.01;
            landedAny = true;
            landedHeadshot = true;
            this.shotsHit++;
            this.spawnSparks(hit.point, 12);
            this.checkReflexVictory();
          }
        } else if (ud.entityId) {
          const isHead = ud.hitZone === 'head';
          const dmg = computeDamageAtDistance(
            this.activeWeaponId,
            hit.distance,
            isHead
          );
          if (dmg > 0) {
            landedAny = true;
            if (isHead) landedHeadshot = true;
            this.shotsHit++;
            this.spawnSparks(hit.point, isHead ? 16 : 9);

            const bot = this.bots.find((b) => b.id === ud.entityId);
            if (bot) {
              this.damageBot(bot, dmg, isHead);
            } else {
              const rp = this.remotePlayers.get(ud.entityId);
              if (rp) {
                this.callbacks.onSendNetPacket?.({
                  type: 'hit',
                  attackerId: this.localPeerId,
                  attackerName: this.callsign,
                  attackerTeam: this.localTeam,
                  victimId: rp.peerId,
                  damage: dmg,
                  headshot: isHead,
                  weaponId: this.activeWeaponId,
                });
              }
            }
          }
        } else {
          // Wall / crate spark
          this.spawnSparks(hit.point, 5);
        }
      }

      if (!isMelee) {
        const startPos = _v1.copy(this.camera.position);
        const build = this.weaponBuilds[this.activeWeaponId];
        if (build) {
          build.muzzleAnchor.getWorldPosition(startPos);
        }
        this.spawnTracer(startPos, endPoint);
        if (p === 0) {
          this.callbacks.onSendNetPacket?.({
            type: 'shot',
            peerId: this.localPeerId,
            ox: startPos.x,
            oy: startPos.y,
            oz: startPos.z,
            dx: _dir.x,
            dy: _dir.y,
            dz: _dir.z,
            weaponId: this.activeWeaponId,
          });
        }
      }
    }

    if (landedAny) {
      this.hitmarkerTimer = 0.16;
      this.hitmarkerHeadshot = landedHeadshot;
      audioEngine.playHitmarker(landedHeadshot);
    }
    this.pushHudSnapshot();
  }

  private damageBot(bot: BotAgent, dmg: number, headshot: boolean): void {
    if (!bot.alive) return;
    bot.health -= dmg;
    bot.hitFlashTimer = 0.06;
    bot.rig.setHitFlash(true);

    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.koTimer = 0;
      bot.respawnTimer = 3.2;
      bot.deaths++;
      this.playerKills++;
      this.hitstopTimer = 0.045;
      audioEngine.playKillChime(this.mode === 'gungame');

      if (this.mode === 'tdm') {
        if (this.localTeam === 'allies') this.alliesScore++;
        else this.axisScore++;
      } else if (this.mode === 'gungame') {
        this.gunGameTier++;
        if (this.gunGameTier < GUN_GAME_LADDER.length) {
          const nextW = getGunGameWeaponForTier(this.gunGameTier);
          this.slotLoadout[1] = nextW;
          this.equipWeapon(nextW);
        }
      }

      this.pushKillFeed(
        this.callsign,
        bot.name,
        this.activeWeaponId,
        headshot,
        this.localTeam
      );
      this.checkMatchEnd();
    }
  }

  private checkReflexVictory(): void {
    if (!this.arena || this.mode !== 'reflex') return;
    const hitCount = this.arena.reflexTargets.filter((t) => !t.active).length;
    const outcome = evaluateMatchOutcome({
      mode: 'reflex',
      alliesScore: 0,
      axisScore: 0,
      gunGameTier: 0,
      reflexTargetsHit: hitCount,
      reflexTotalTargets: this.arena.reflexTargets.length,
    });
    if (outcome.finished) {
      const isNewRecord = this.saveReflexBest(this.matchElapsedSec);
      this.finishMatch(true, outcome.reason, isNewRecord);
    }
  }

  private checkMatchEnd(): void {
    const botMaxTier = this.bots.reduce(
      (max, b) => Math.max(max, b.gunGameTier),
      0
    );
    const outcome = evaluateMatchOutcome({
      mode: this.mode,
      alliesScore: this.alliesScore,
      axisScore: this.axisScore,
      gunGameTier: this.gunGameTier,
      botMaxTier,
      reflexTargetsHit: 0,
      reflexTotalTargets: 0,
    });
    if (outcome.finished) {
      const won =
        this.mode === 'tdm'
          ? this.localTeam === 'allies'
            ? outcome.victory
            : !outcome.victory
          : outcome.victory;
      this.finishMatch(won, outcome.reason, false);
    }
  }

  private finishMatch(
    victory: boolean,
    reason: string,
    isNewRecord: boolean
  ): void {
    this.phase = 'gameover';
    this.heldKeys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    audioEngine.playMatchEnd(victory);

    const acc =
      this.shotsFired > 0
        ? Math.round((this.shotsHit / this.shotsFired) * 100)
        : 0;
    this.callbacks.onMatchEnd({
      victory,
      mode: this.mode,
      headline: victory ? 'VICTORY ACHIEVED' : 'SQUAD OVERRUN',
      subline: reason,
      kills: this.playerKills,
      deaths: this.playerDeaths,
      accuracyPct: acc,
      elapsedSec: this.matchElapsedSec,
      alliesScore: this.alliesScore,
      axisScore: this.axisScore,
      gunGameTier: this.gunGameTier,
      reflexTimeSec: this.mode === 'reflex' ? this.matchElapsedSec : null,
      isNewRecord,
    });
  }

  private pushKillFeed(
    killer: string,
    victim: string,
    weaponId: WeaponId,
    headshot: boolean,
    killerTeam: TeamId
  ): void {
    const labelMap: Record<WeaponId, string> = {
      mp40: 'MP-40',
      tommy: 'Tommy Gun',
      shotgun: 'Trench Gun',
      kar98k: 'Kar98k',
      m1911: 'M1911',
      knife: 'Combat Knife',
      golden_knife: 'Golden Blade',
    };
    this.killFeed.unshift({
      id: `${Date.now()}_${Math.random()}`,
      killer,
      victim,
      weapon: labelMap[weaponId],
      headshot,
      killerTeam,
      timestamp: performance.now(),
    });
    if (this.killFeed.length > 5) {
      this.killFeed.length = 5;
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const tracer = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % TRACER_POOL_SIZE;

    const dist = start.distanceTo(end);
    if (dist < 0.2) return;
    tracer.mesh.position.copy(start).lerp(end, 0.5);
    tracer.mesh.scale.set(1, 1, Math.min(dist, 42));
    tracer.mesh.lookAt(end);
    tracer.mesh.visible = true;
    tracer.life = tracer.maxLife;
  }

  private spawnSparks(pos: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const s = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL_SIZE;
      s.active = true;
      s.x = pos.x;
      s.y = pos.y;
      s.z = pos.z;
      s.vx = (Math.random() - 0.5) * 6;
      s.vy = Math.random() * 4.5 + 1;
      s.vz = (Math.random() - 0.5) * 6;
      s.life = 0.22 + Math.random() * 0.14;
      s.maxLife = s.life;
    }
  }

  private applyDamageToLocalPlayer(
    dmg: number,
    attackerName: string,
    attackerTeam: TeamId,
    weaponId: WeaponId,
    headshot: boolean
  ): void {
    if (this.respawnTimer > 0 || this.phase !== 'playing') return;
    this.health -= dmg;
    this.damageFlash = 1.0;
    this.trauma = Math.min(1, this.trauma + 0.35);
    audioEngine.playHurt();

    if (this.health <= 0) {
      this.health = 0;
      this.playerDeaths++;
      this.respawnTimer = 2.6;
      this.isAds = false;
      this.pushKillFeed(
        attackerName,
        this.callsign,
        weaponId,
        headshot,
        attackerTeam
      );
      if (this.mode === 'tdm') {
        if (attackerTeam === 'allies') this.alliesScore++;
        else this.axisScore++;
        this.checkMatchEnd();
      }
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.phase === 'title') {
      this.updateTitleFlyover(dt, now * 0.001);
    } else if (this.phase === 'playing') {
      // Visual FX always advance smoothly
      this.updateVisualFx(dt);

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.matchElapsedSec += dt;
        this.updateLocalPlayer(dt);
        this.updateBots(dt);
        this.updateRemotePlayers(dt);
        this.updateReflexTargets(dt, now * 0.001);
      }

      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.pushHudSnapshot();
      }

      this.netSyncTimer += dt;
      if (this.netSyncTimer >= 0.065) {
        this.netSyncTimer = 0;
        this.callbacks.onSendNetPacket?.({
          type: 'state',
          peerId: this.localPeerId,
          callsign: this.callsign,
          team: this.localTeam,
          x: this.px,
          y: this.py,
          z: this.pz,
          yaw: this.yaw,
          pitch: this.pitch,
          weaponId: this.activeWeaponId,
          stance: this.stance,
          health: this.health,
          kills: this.playerKills,
          deaths: this.playerDeaths,
          gunGameTier: this.gunGameTier,
        } satisfies RemoteStatePacket);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private updateTitleFlyover(dt: number, elapsed: number): void {
    const angle = elapsed * 0.14;
    const radius = 21;
    this.camera.position.set(
      Math.cos(angle) * radius,
      9.2 + Math.sin(elapsed * 0.35) * 1.1,
      Math.sin(angle) * radius
    );
    this.camera.lookAt(0, 1.8, 0);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();

    // Gentle idle patrol animation in the background Depot
    for (const bot of this.bots) {
      bot.walkPhase += dt * 4.5;
      bot.rig.setWalkCycle(bot.walkPhase, 0.35, false);
    }
  }

  private updateVisualFx(dt: number): void {
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    }
    this.trauma = Math.max(0, this.trauma - dt * 2.8);

    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.mesh.visible = false;
      }
    }

    let sparksUpdated = false;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      sparksUpdated = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.vy -= 14 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const scale = (s.life / s.maxLife) * 1.1;
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
    }
    if (sparksUpdated) {
      this.sparkInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  private updateLocalPlayer(dt: number): void {
    if (!this.arena) return;

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnLocalPlayer();
      }
      return;
    }

    // Cooldowns & Reload
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.slideCooldown > 0) this.slideCooldown -= dt;
    if (this.knifeSlashTimer > 0) this.knifeSlashTimer -= dt;

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const magCap = this.getMagSize(this.activeWeaponId);
        const curMag = this.ammoMag[this.activeWeaponId] ?? 0;
        const reserve = this.ammoReserve[this.activeWeaponId] ?? 0;
        const needed = Math.min(magCap - curMag, reserve);
        this.ammoMag[this.activeWeaponId] = curMag + needed;
        this.ammoReserve[this.activeWeaponId] = reserve - needed;
      }
    }

    if (this.mouseLeftDown) {
      this.tryFireWeapon(false);
    }

    // Arrow key fallback rotation (helpful without PointerLock)
    const turnSpeed = 2.1;
    if (this.heldKeys.has('ArrowLeft')) this.yaw += turnSpeed * dt;
    if (this.heldKeys.has('ArrowRight')) this.yaw -= turnSpeed * dt;
    if (this.heldKeys.has('ArrowUp'))
      this.pitch = Math.min(1.4, this.pitch + 1.4 * dt);
    if (this.heldKeys.has('ArrowDown'))
      this.pitch = Math.max(-1.4, this.pitch - 1.4 * dt);

    // Movement intent
    let moveFwd = 0;
    let moveRight = 0;
    if (this.heldKeys.has('KeyW')) moveFwd += 1;
    if (this.heldKeys.has('KeyS')) moveFwd -= 1;
    if (this.heldKeys.has('KeyD')) moveRight += 1;
    if (this.heldKeys.has('KeyA')) moveRight -= 1;

    const hasInput = moveFwd !== 0 || moveRight !== 0;
    const len = hasInput ? Math.hypot(moveFwd, moveRight) : 1;
    moveFwd /= len;
    moveRight /= len;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const wishX = -sinY * moveFwd + cosY * moveRight;
    const wishZ = -cosY * moveFwd - sinY * moveRight;

    const wantsSprint =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) &&
      moveFwd > 0 &&
      !this.isAds &&
      !this.crouchingToggle &&
      this.stamina > 4;

    if (wantsSprint && this.slideTimer <= 0) {
      this.stamina = Math.max(0, this.stamina - 22 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 18 * dt);
    }

    const weaponSpeedMult =
      this.activeWeaponId === 'knife' || this.activeWeaponId === 'golden_knife'
        ? 1.14
        : this.activeWeaponId === 'm1911'
          ? 1.05
          : 1.0;

    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      const slideSpeed = 12.6 * (0.55 + 0.45 * (this.slideTimer / 0.55));
      this.pvx = this.slideDirX * slideSpeed;
      this.pvz = this.slideDirZ * slideSpeed;
      this.stance = 'sliding';
    } else {
      const targetSpeed =
        (this.crouchingToggle
          ? 3.8
          : this.isAds
            ? 4.4
            : wantsSprint
              ? 9.6
              : 6.8) * weaponSpeedMult;
      const accel = this.grounded ? 14 : 5;
      const alpha = 1 - Math.exp(-accel * dt);
      this.pvx += (wishX * targetSpeed - this.pvx) * alpha;
      this.pvz += (wishZ * targetSpeed - this.pvz) * alpha;
      this.stance = !this.grounded
        ? 'airborne'
        : this.crouchingToggle
          ? 'crouching'
          : 'standing';
    }

    // Coyote time & Jump buffer
    if (this.grounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.pvy = JUMP_VELOCITY;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.slideTimer = 0;
        this.crouchingToggle = false;
        audioEngine.playFootstep(true);
      }
    }

    // Gravity & Integration
    this.pvy -= GRAVITY * dt;
    this.px += this.pvx * dt;
    this.pz += this.pvz * dt;
    this.py += this.pvy * dt;

    // Horizontal AABB collision
    const resolved = resolveCircleAABB(
      this.px,
      this.py,
      this.pz,
      PLAYER_RADIUS,
      this.arena.colliders,
      this.arena.arenaHalfExtent
    );
    this.px = resolved.x;
    this.pz = resolved.z;

    // Ground & Ramp support
    const floorY = getGroundHeightAt(
      this.px,
      this.pz,
      this.py,
      this.arena.ramps,
      this.arena.colliders
    );
    if (this.py <= floorY) {
      if (!this.grounded && this.pvy < -5) {
        audioEngine.playFootstep(false);
      }
      this.py = floorY;
      this.pvy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Footstep cadence synced to distance traveled
    const hSpeed = Math.hypot(this.pvx, this.pvz);
    if (this.grounded && hSpeed > 1.5 && this.slideTimer <= 0) {
      this.stepDistAccum += hSpeed * dt;
      const stepStride = wantsSprint ? 2.4 : 2.1;
      if (this.stepDistAccum >= stepStride) {
        this.stepDistAccum = 0;
        audioEngine.playFootstep(wantsSprint);
      }
    }

    // Smooth eye height & camera roll
    const targetEye =
      this.stance === 'sliding'
        ? PLAYER_SLIDE_EYE_HEIGHT
        : this.stance === 'crouching'
          ? PLAYER_CROUCH_EYE_HEIGHT
          : PLAYER_STAND_EYE_HEIGHT;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);

    const targetRoll =
      this.stance === 'sliding' ? -0.055 : -moveRight * 0.015;
    this.viewRoll = THREE.MathUtils.damp(this.viewRoll, targetRoll, 12, dt);

    // Recoil spring recovery
    this.recoilPitchOffset = THREE.MathUtils.damp(
      this.recoilPitchOffset,
      0,
      10,
      dt
    );
    this.recoilYawOffset = THREE.MathUtils.damp(this.recoilYawOffset, 0, 10, dt);
    this.weaponKickZ = THREE.MathUtils.damp(this.weaponKickZ, 0, 14, dt);

    // Camera Shake (trauma * trauma)
    const shake = this.trauma * this.trauma;
    const shakeX = (Math.random() - 0.5) * 0.06 * shake;
    const shakeY = (Math.random() - 0.5) * 0.06 * shake;

    this.camera.position.set(
      this.px,
      this.py + this.eyeHeight + shakeY * 0.35,
      this.pz
    );
    this.camera.rotation.set(
      this.pitch + this.recoilPitchOffset + shakeX,
      this.yaw + this.recoilYawOffset + shakeY,
      this.viewRoll
    );

    // FOV ADS Damping
    const targetFov = this.isAds
      ? this.activeWeaponId === 'kar98k'
        ? 34
        : this.activeWeaponId === 'shotgun'
          ? 62
          : 58
      : wantsSprint
        ? 79
        : 74;
    if (Math.abs(this.currentFov - targetFov) > 0.05) {
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 14, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Viewmodel sway, ADS interpolation & reload tilt
    this.viewModelAnchor.visible =
      this.phase === 'playing' &&
      !(this.isAds && this.activeWeaponId === 'kar98k');
    const build = this.weaponBuilds[this.activeWeaponId];
    if (build) {
      const targetOffset = this.isAds ? build.adsOffset : build.hipOffset;
      if (this.grounded && hSpeed > 0.6) {
        this.weaponBobPhase += dt * hSpeed * 1.45;
      }
      const bobScale = this.isAds ? 0.0025 : 0.011;
      const bobX = Math.cos(this.weaponBobPhase * 0.5) * bobScale;
      const bobY = Math.abs(Math.sin(this.weaponBobPhase)) * bobScale;

      this.viewModelAnchor.position.x = THREE.MathUtils.damp(
        this.viewModelAnchor.position.x,
        targetOffset.x + bobX,
        16,
        dt
      );
      this.viewModelAnchor.position.y = THREE.MathUtils.damp(
        this.viewModelAnchor.position.y,
        targetOffset.y - bobY - (this.reloading ? 0.09 : 0),
        16,
        dt
      );
      this.viewModelAnchor.position.z = THREE.MathUtils.damp(
        this.viewModelAnchor.position.z,
        targetOffset.z + this.weaponKickZ,
        18,
        dt
      );

      const reloadRotX = this.reloading ? -0.45 : 0;
      const slashRotX =
        this.knifeSlashTimer > 0
          ? -Math.sin((this.knifeSlashTimer / 0.22) * Math.PI) * 0.9
          : 0;
      this.viewModelAnchor.rotation.x = THREE.MathUtils.damp(
        this.viewModelAnchor.rotation.x,
        reloadRotX + slashRotX + this.recoilPitchOffset * 0.6,
        14,
        dt
      );
    }
  }

  private updateBots(dt: number): void {
    if (!this.arena) return;

    for (const bot of this.bots) {
      if (bot.hitFlashTimer > 0) {
        bot.hitFlashTimer -= dt;
        if (bot.hitFlashTimer <= 0) {
          bot.rig.setHitFlash(false);
        }
      }

      if (!bot.alive) {
        bot.koTimer = Math.min(1, bot.koTimer + dt * 2.8);
        bot.rig.setDeadPose(bot.koTimer);
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          const pool =
            bot.team === 'allies'
              ? this.arena.alliesSpawns
              : this.arena.axisSpawns;
          const sp = pool[Math.floor(Math.random() * pool.length)];
          bot.x = sp.x;
          bot.y = sp.y;
          bot.z = sp.z;
          bot.health = bot.maxHealth;
          bot.alive = true;
          bot.koTimer = 0;
          bot.rig.setDeadPose(0);
        }
        continue;
      }

      // Acquire nearest hostile target (local player or opposing bot)
      let targetX = this.px;
      let targetY = this.py;
      let targetZ = this.pz;
      let targetId = this.localPeerId;
      let targetDistSq = Infinity;
      let targetIsPlayer = false;

      const hostileToPlayer =
        this.mode === 'gungame' || bot.team !== this.localTeam;
      if (hostileToPlayer && this.respawnTimer <= 0) {
        const dx = this.px - bot.x;
        const dz = this.pz - bot.z;
        targetDistSq = dx * dx + dz * dz;
        targetIsPlayer = true;
      }

      for (const other of this.bots) {
        if (!other.alive || other.id === bot.id) continue;
        if (this.mode !== 'gungame' && other.team === bot.team) continue;
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < targetDistSq) {
          targetDistSq = d2;
          targetX = other.x;
          targetY = other.y;
          targetZ = other.z;
          targetId = other.id;
          targetIsPlayer = false;
        }
      }

      const dist = Math.sqrt(targetDistSq);
      const toTargetX = dist > 0.01 ? (targetX - bot.x) / dist : 0;
      const toTargetZ = dist > 0.01 ? (targetZ - bot.z) / dist : 1;

      // Distinct Movement Policies per Archetype
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeTimer = 1.2 + Math.random() * 1.4;
        bot.strafeSign *= -1;
      }

      let moveX = 0;
      let moveZ = 0;
      let moveSpeed = 4.4;
      let crouching = false;

      if (bot.archetype === 'rusher') {
        moveSpeed = 5.4;
        if (dist > 8) {
          moveX = toTargetX;
          moveZ = toTargetZ;
        } else {
          // Strafe & press forward
          moveX = -toTargetZ * bot.strafeSign * 0.8 + toTargetX * 0.25;
          moveZ = toTargetX * bot.strafeSign * 0.8 + toTargetZ * 0.25;
        }
      } else if (bot.archetype === 'marksman') {
        moveSpeed = 3.8;
        if (dist < 14) {
          // Backpedal & crouch for tighter grouping
          moveX = -toTargetX * 0.65 - toTargetZ * bot.strafeSign * 0.45;
          moveZ = -toTargetZ * 0.65 + toTargetX * bot.strafeSign * 0.45;
          crouching = true;
        } else if (dist > 22) {
          moveX = toTargetX * 0.7;
          moveZ = toTargetZ * 0.7;
        } else {
          crouching = true;
          moveX = -toTargetZ * bot.strafeSign * 0.3;
          moveZ = toTargetX * bot.strafeSign * 0.3;
        }
      } else {
        // Flanker: wide lateral arcs
        moveSpeed = 5.1;
        const flankX = -toTargetZ * bot.strafeSign;
        const flankZ = toTargetX * bot.strafeSign;
        moveX = flankX * 0.75 + toTargetX * (dist > 11 ? 0.55 : -0.2);
        moveZ = flankZ * 0.75 + toTargetZ * (dist > 11 ? 0.55 : -0.2);
      }

      const mLen = Math.hypot(moveX, moveZ);
      if (mLen > 0.01) {
        moveX /= mLen;
        moveZ /= mLen;
      }

      bot.x += moveX * moveSpeed * dt;
      bot.z += moveZ * moveSpeed * dt;
      const res = resolveCircleAABB(
        bot.x,
        bot.y,
        bot.z,
        PLAYER_RADIUS,
        this.arena.colliders,
        this.arena.arenaHalfExtent
      );
      bot.x = res.x;
      bot.z = res.z;
      bot.y = getGroundHeightAt(
        bot.x,
        bot.z,
        bot.y,
        this.arena.ramps,
        this.arena.colliders
      );

      bot.yaw = Math.atan2(toTargetX, toTargetZ);
      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;

      if (mLen > 0.1) {
        bot.walkPhase += dt * moveSpeed * 1.9;
      }
      bot.rig.setWalkCycle(bot.walkPhase, mLen > 0.1 ? 0.85 : 0, crouching);

      // Line of Sight & Fair Combat Fire
      bot.fireCooldown -= dt;
      if (bot.fireCooldown <= 0 && dist < 34) {
        bot.fireCooldown =
          bot.weaponId === 'kar98k'
            ? 1.85 + Math.random() * 0.6
            : bot.weaponId === 'shotgun'
              ? 1.15 + Math.random() * 0.4
              : 0.42 + Math.random() * 0.35;

        // Check unobstructed raycast to target chest
        _v1.set(bot.x, bot.y + 1.42, bot.z);
        _v2.set(targetX, targetY + 1.25, targetZ);
        _dir.copy(_v2).sub(_v1).normalize();
        this.raycaster.set(_v1, _dir);
        this.raycaster.far = dist - 0.3;
        const blocked = this.raycaster.intersectObjects(this.arenaRayMeshes, false);

        if (blocked.length === 0) {
          // Slight natural dispersion
          const missOffset = bot.archetype === 'marksman' ? 0.04 : 0.085;
          _dir.x += (Math.random() - 0.5) * missOffset;
          _dir.y += (Math.random() - 0.5) * missOffset * 0.6;
          _dir.z += (Math.random() - 0.5) * missOffset;
          _dir.normalize();

          const tracerEnd = _v3.copy(_v1).addScaledVector(_dir, Math.min(dist + 2, 36));
          this.spawnTracer(_v1, tracerEnd);

          const hitChance =
            bot.archetype === 'marksman'
              ? 0.48
              : dist < 10
                ? 0.52
                : 0.32;
          if (Math.random() < hitChance) {
            const dmg = bot.weaponId === 'kar98k' ? 24 : 11;
            if (targetIsPlayer) {
              this.applyDamageToLocalPlayer(
                dmg,
                bot.name,
                bot.team,
                bot.weaponId,
                false
              );
            } else {
              const victimBot = this.bots.find((b) => b.id === targetId);
              if (victimBot && victimBot.alive) {
                victimBot.health -= dmg;
                victimBot.hitFlashTimer = 0.05;
                victimBot.rig.setHitFlash(true);
                if (victimBot.health <= 0) {
                  victimBot.health = 0;
                  victimBot.alive = false;
                  victimBot.koTimer = 0;
                  victimBot.respawnTimer = 3.2;
                  victimBot.deaths++;
                  bot.kills++;
                  this.pushKillFeed(
                    bot.name,
                    victimBot.name,
                    bot.weaponId,
                    false,
                    bot.team
                  );
                  if (this.mode === 'tdm') {
                    if (bot.team === 'allies') this.alliesScore++;
                    else this.axisScore++;
                  } else if (this.mode === 'gungame') {
                    bot.gunGameTier++;
                    bot.weaponId = getGunGameWeaponForTier(bot.gunGameTier);
                  }
                  this.checkMatchEnd();
                }
              }
            }
          }
        }
      }
    }
  }

  private updateRemotePlayers(dt: number): void {
    this.remotePlayers.forEach((rp) => {
      const dx = rp.targetX - rp.x;
      const dz = rp.targetZ - rp.z;
      const speed = Math.hypot(dx, dz);
      const alpha = 1 - Math.exp(-16 * dt);
      rp.x += dx * alpha;
      rp.y += (rp.targetY - rp.y) * alpha;
      rp.z += dz * alpha;
      rp.rig.root.position.set(rp.x, rp.y, rp.z);
      rp.rig.root.rotation.y = rp.yaw + Math.PI;
      if (speed > 0.02) {
        rp.walkPhase += dt * 9;
      }
      rp.rig.setWalkCycle(rp.walkPhase, speed > 0.02 ? 0.85 : 0, false);
      rp.rig.root.visible = rp.health > 0;
    });
  }

  private updateReflexTargets(dt: number, elapsed: number): void {
    if (!this.arena || this.mode !== 'reflex') return;
    for (const t of this.arena.reflexTargets) {
      if (t.active) {
        if (t.patrolAmp > 0) {
          t.pivot.position.x =
            t.basePos.x +
            Math.sin(elapsed * t.patrolSpeed + t.phase) * t.patrolAmp;
        }
      } else if (t.hitAnim > 0 && t.hitAnim < 1) {
        t.hitAnim = Math.min(1, t.hitAnim + dt * 5.5);
        t.pivot.rotation.x = t.hitAnim * (Math.PI / 2);
      }
    }
  }

  private pushHudSnapshot(): void {
    const scoreboard: ScoreboardRow[] = [
      {
        id: this.localPeerId,
        name: this.callsign,
        team: this.localTeam,
        kills: this.playerKills,
        deaths: this.playerDeaths,
        isLocal: true,
        isBot: false,
        gunGameTier: this.gunGameTier,
      },
      ...Array.from(this.remotePlayers.values()).map((rp) => ({
        id: rp.peerId,
        name: rp.name,
        team: rp.team,
        kills: rp.kills,
        deaths: rp.deaths,
        isLocal: false,
        isBot: false,
        gunGameTier: rp.gunGameTier,
      })),
      ...this.bots.map((b) => ({
        id: b.id,
        name: b.name,
        team: b.team,
        kills: b.kills,
        deaths: b.deaths,
        isLocal: false,
        isBot: true,
        gunGameTier: b.gunGameTier,
      })),
    ].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    const wNames: Record<WeaponId, [string, string]> = {
      mp40: ['MP-40 Submachine', 'Rapid CQB SMG'],
      tommy: ['M1A1 Thompson', 'Heavy Trench SMG'],
      shotgun: ['M1897 Trench Gun', '8-Pellet Breacher'],
      kar98k: ['Karabiner 98k', 'Bolt-Action Rifle'],
      m1911: ['Colt M1911', '.45 ACP Sidearm'],
      knife: ['M3 Combat Knife', 'Tactical Melee'],
      golden_knife: ['Golden Trench Blade', 'Final Tier Finisher'],
    };

    const shortMap: Record<WeaponId, string> = {
      mp40: 'MP-40',
      tommy: 'Tommy',
      shotgun: 'Shotgun',
      kar98k: 'Kar98k',
      m1911: 'M1911',
      knife: 'Knife',
      golden_knife: 'Gold Blade',
    };

    const reflexHit = this.arena
      ? this.arena.reflexTargets.filter((t) => !t.active).length
      : 0;
    const reflexTotal = this.arena ? this.arena.reflexTargets.length : 0;

    const reloadDur =
      this.activeWeaponId === 'kar98k'
        ? 1.85
        : this.activeWeaponId === 'shotgun'
          ? 1.7
          : this.activeWeaponId === 'm1911'
            ? 1.15
            : 1.45;

    this.callbacks.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: PLAYER_MAX_HEALTH,
      stamina: Math.round(this.stamina),
      stance: this.stance,
      weaponId: this.activeWeaponId,
      weaponName: wNames[this.activeWeaponId][0],
      weaponRole: wNames[this.activeWeaponId][1],
      ammoInMag: this.ammoMag[this.activeWeaponId] ?? 0,
      ammoReserve: this.ammoReserve[this.activeWeaponId] ?? 0,
      magSize: this.getMagSize(this.activeWeaponId),
      reloading: this.reloading,
      reloadProgress: this.reloading
        ? Math.max(0, Math.min(1, 1 - this.reloadTimer / reloadDur))
        : 0,
      isAds: this.isAds,
      isPointerLocked: this.isPointerLocked,
      alliesScore: this.alliesScore,
      axisScore: this.axisScore,
      targetScore: TDM_KILL_TARGET,
      matchElapsedSec: this.matchElapsedSec,
      gunGameTier: this.gunGameTier,
      gunGameTotalTiers: GUN_GAME_LADDER.length,
      reflexTargetsHit: reflexHit,
      reflexTotalTargets: reflexTotal,
      reflexBestTimeSec: this.reflexBestTimeSec,
      playerKills: this.playerKills,
      playerDeaths: this.playerDeaths,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      hitmarkerActive: this.hitmarkerTimer > 0,
      hitmarkerHeadshot: this.hitmarkerHeadshot,
      damageFlash: this.damageFlash,
      killFeed: [...this.killFeed],
      scoreboard,
      slotWeapons: ([1, 2, 3] as const).map((slot) => ({
        slot,
        id: this.slotLoadout[slot],
        name: shortMap[this.slotLoadout[slot]],
        active: this.activeWeaponId === this.slotLoadout[slot],
      })),
      respawnTimerSec: Math.max(0, this.respawnTimer),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener(
      'pointerlockchange',
      this.onPointerLockChange
    );
    window.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener(
      'contextmenu',
      this.onContextMenu
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.onWebGlLost
    );

    this.clearBots();
    this.remotePlayers.forEach((rp) => {
      this.scene.remove(rp.rig.root);
      rp.rig.dispose();
    });
    this.remotePlayers.clear();

    Object.values(this.weaponBuilds).forEach((b) => b?.dispose());
    this.arena?.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
