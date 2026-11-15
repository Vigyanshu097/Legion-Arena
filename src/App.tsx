import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { TitleHub } from './components/TitleHub';
import { TrenchTankGame } from './components/TrenchTankGame';
import { audioEngine } from './game/audio';
import { TacticalFpsEngine } from './game/engine';
import { TDM_KILL_TARGET } from './game/rules';
import type {
  GamePhase,
  HudSnapshot,
  MatchSummary,
  NetworkStatus,
  PeerPlayerInfo,
  PlayableMode,
} from './game/types';
import { PeerMultiplayerManager } from './network/peerManager';

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  stamina: 100,
  stance: 'standing',
  weaponId: 'mp40',
  weaponName: 'MP-40 Submachine',
  weaponRole: 'Rapid CQB SMG',
  ammoInMag: 32,
  ammoReserve: 160,
  magSize: 32,
  reloading: false,
  reloadProgress: 0,
  isAds: false,
  isPointerLocked: false,
  alliesScore: 0,
  axisScore: 0,
  targetScore: TDM_KILL_TARGET,
  matchElapsedSec: 0,
  gunGameTier: 0,
  gunGameTotalTiers: 5,
  reflexTargetsHit: 0,
  reflexTotalTargets: 18,
  reflexBestTimeSec: null,
  playerKills: 0,
  playerDeaths: 0,
  shotsFired: 0,
  shotsHit: 0,
  hitmarkerActive: false,
  hitmarkerHeadshot: false,
  damageFlash: 0,
  killFeed: [],
  scoreboard: [],
  slotWeapons: [
    { slot: 1, id: 'mp40', name: 'MP-40', active: true },
    { slot: 2, id: 'm1911', name: 'M1911', active: false },
    { slot: 3, id: 'knife', name: 'Knife', active: false },
  ],
  respawnTimerSec: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TacticalFpsEngine | null>(null);
  const peerRef = useRef<PeerMultiplayerManager | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [selectedMode, setSelectedMode] = useState<PlayableMode>('tdm');
  const [callsign, setCallsign] = useState('Operative');
  const [sensitivity, setSensitivity] = useState(0.0022);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [showTankArcade, setShowTankArcade] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  // PeerJS multiplayer state
  const [netStatus, setNetStatus] = useState<NetworkStatus>('offline');
  const [netMessage, setNetMessage] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roster, setRoster] = useState<PeerPlayerInfo[]>([]);
  const [isHost, setIsHost] = useState(false);

  const selectedModeRef = useRef(selectedMode);
  selectedModeRef.current = selectedMode;
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const callsignRef = useRef(callsign);
  callsignRef.current = callsign;

  // Mirror state machine onto document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Mount Three.js FPS Engine & PeerJS Manager once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const peerMgr = new PeerMultiplayerManager({
      onStatusChange: (status, msg) => {
        setNetStatus(status);
        setNetMessage(msg ?? '');
        setIsHost(peerMgr.getIsHost());
        setRoomCode(peerMgr.getRoomCode());
      },
      onRosterChange: (players, modeFromHost) => {
        setRoster(players);
        setSelectedMode(modeFromHost);
      },
      onStartMatch: (modeToLaunch) => {
        setSelectedMode(modeToLaunch);
        setShowTankArcade(false);
        setSummary(null);
        setPhase('playing');
        document.body.dataset.state = 'playing';
        const eng = engineRef.current;
        if (eng) {
          const myId = peerMgr.getLocalPeerId();
          const me = peerMgr.getRoster().find((p) => p.peerId === myId);
          eng.setIdentity(
            callsignRef.current,
            myId,
            me?.team ?? 'allies'
          );
          eng.startMatch(modeToLaunch, peerMgr.getRoster());
        }
      },
      onPacket: (pkt) => {
        engineRef.current?.handleRemotePacket(pkt);
      },
    });
    peerRef.current = peerMgr;

    const engine = new TacticalFpsEngine(mountEl, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onMatchEnd: (matchSummary) => {
        setSummary(matchSummary);
        setPhase('gameover');
        document.body.dataset.state = 'gameover';
      },
      onPauseRequest: () => {
        setPhase((prev) => {
          if (prev === 'playing') {
            engineRef.current?.setPhase('paused');
            document.body.dataset.state = 'paused';
            return 'paused';
          }
          return prev;
        });
      },
      onContextLost: () => setWebglLost(true),
      onSendNetPacket: (pkt) => {
        peerRef.current?.broadcastPacket(pkt);
      },
    });
    engineRef.current = engine;

    // Support ?autostart=1 query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const modeParam = params.get('mode');
      const m: PlayableMode =
        modeParam === 'gungame' || modeParam === 'reflex' ? modeParam : 'tdm';
      setSelectedMode(m);
      setPhase('playing');
      document.body.dataset.state = 'playing';
      engine.startMatch(m, []);
    }

    return () => {
      engine.dispose();
      peerMgr.disconnect();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = audioEngine.toggleMute();
    setMuted(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyM') {
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleToggleMute]);

  const handleDeploy = useCallback(() => {
    const eng = engineRef.current;
    const peerMgr = peerRef.current;
    if (!eng) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowTankArcade(false);
    setSummary(null);
    setPhase('playing');
    document.body.dataset.state = 'playing';

    const myId = peerMgr?.getLocalPeerId() ?? 'local';
    const currentRoster = rosterRef.current;
    const me = currentRoster.find((p) => p.peerId === myId);
    eng.setIdentity(callsignRef.current, myId, me?.team ?? 'allies');

    if (peerMgr?.getIsHost() && currentRoster.length > 1) {
      peerMgr.broadcastStartMatch(selectedModeRef.current);
    }
    eng.startMatch(selectedModeRef.current, currentRoster);
  }, []);

  const handleResume = useCallback(() => {
    if (!engineRef.current) return;
    setPhase('playing');
    document.body.dataset.state = 'playing';
    engineRef.current.setPhase('playing');
    engineRef.current.requestPointerLock();
  }, []);

  const handleRestart = useCallback(() => {
    handleDeploy();
  }, [handleDeploy]);

  const handleReturnToHub = useCallback(() => {
    setSummary(null);
    setPhase('title');
    document.body.dataset.state = 'title';
    engineRef.current?.setPhase('title');
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleSelectMode = useCallback((m: PlayableMode) => {
    setSelectedMode(m);
    peerRef.current?.setMode(m);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0f110f]">
      {/* Isolated 3D WebGL Viewport Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f110f] p-6 text-center">
          <div className="max-w-md rounded border border-[#4a4f44] bg-[#161814] p-6">
            <h2 className="font-display text-2xl font-bold text-[#ece8df]">
              GRAPHICS CONTEXT INTERRUPTED
            </h2>
            <p className="mt-2 text-sm text-[#9fa396]">
              Your browser suspended the WebGL context. Reload to reinitialize
              the 3D arena.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-[#c88d2c] px-5 py-2 text-sm font-semibold text-[#121310] cursor-pointer"
            >
              Reload Arena
            </button>
          </div>
        </div>
      )}

      {/* Title & Multiplayer Lobby Shell */}
      {phase === 'title' && (
        <TitleHub
          selectedMode={selectedMode}
          onSelectMode={handleSelectMode}
          callsign={callsign}
          onChangeCallsign={setCallsign}
          sensitivity={sensitivity}
          onChangeSensitivity={handleSensitivityChange}
          muted={muted}
          onToggleMute={handleToggleMute}
          netStatus={netStatus}
          netMessage={netMessage}
          roomCode={roomCode}
          roster={roster}
          isHost={isHost}
          onHostRoom={() =>
            peerRef.current?.hostRoom(callsign, selectedMode)
          }
          onJoinRoom={(code) => peerRef.current?.joinRoom(code, callsign)}
          onDisconnectRoom={() => peerRef.current?.disconnect()}
          onDeploy={handleDeploy}
          onOpenTankArcade={() => setShowTankArcade(true)}
        />
      )}

      {/* Mode 4: Lobby Trench Tank Mini-Game */}
      {phase === 'title' && showTankArcade && (
        <TrenchTankGame
          roomCode={roomCode}
          playerCount={roster.length || 1}
          onClose={() => setShowTankArcade(false)}
        />
      )}

      {/* Playing Tactical HUD */}
      {phase === 'playing' && (
        <HudOverlay
          hud={hud}
          mode={selectedMode}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={() => {
            setPhase('paused');
            document.body.dataset.state = 'paused';
            engineRef.current?.setPhase('paused');
          }}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <PauseModal
          sensitivity={sensitivity}
          onChangeSensitivity={handleSensitivityChange}
          muted={muted}
          onToggleMute={handleToggleMute}
          onResume={handleResume}
          onRestart={handleRestart}
          onReturnToHub={handleReturnToHub}
        />
      )}

      {/* Victory / Defeat Modal */}
      {phase === 'gameover' && summary && (
        <GameOverModal
          summary={summary}
          onPlayAgain={handleRestart}
          onReturnToHub={handleReturnToHub}
        />
      )}
    </main>
  );
}
