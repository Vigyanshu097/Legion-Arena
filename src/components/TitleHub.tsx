import React, { useEffect, useState } from 'react';
import {
  Copy,
  Crosshair,
  Gamepad2,
  Play,
  Radio,
  Shield,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { sanitizeRoomCode } from '../game/rules';
import type {
  NetworkStatus,
  PeerPlayerInfo,
  PlayableMode,
} from '../game/types';

interface TitleHubProps {
  selectedMode: PlayableMode;
  onSelectMode: (mode: PlayableMode) => void;
  callsign: string;
  onChangeCallsign: (val: string) => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  netStatus: NetworkStatus;
  netMessage: string;
  roomCode: string;
  roster: PeerPlayerInfo[];
  isHost: boolean;
  onHostRoom: () => void;
  onJoinRoom: (code: string) => void;
  onDisconnectRoom: () => void;
  onDeploy: () => void;
  onOpenTankArcade: () => void;
}

const MODE_OPTIONS: Array<{
  id: PlayableMode;
  title: string;
  subtitle: string;
  meta: string;
}> = [
  {
    id: 'tdm',
    title: 'Team Deathmatch',
    subtitle: 'Depot trainyard shootout with bots or squad. First to 25 kills.',
    meta: '5v5 · MP-40 / M1911 / Knife',
  },
  {
    id: 'gungame',
    title: 'Gun Game · Arms Race',
    subtitle: 'Every elimination upgrades your weapon up to the Golden Blade.',
    meta: '5 Tiers · MP-40 → Tommy → Shotgun → Kar98k → Blade',
  },
  {
    id: 'reflex',
    title: 'Tactical Reflex Arena',
    subtitle: 'Clear all 18 pop-up targets across depot lanes against the clock.',
    meta: 'Solo Time Trial · Kar98k & MP-40',
  },
];

export const TitleHub: React.FC<TitleHubProps> = ({
  selectedMode,
  onSelectMode,
  callsign,
  onChangeCallsign,
  sensitivity,
  onChangeSensitivity,
  muted,
  onToggleMute,
  netStatus,
  netMessage,
  roomCode,
  roster,
  isHost,
  onHostRoom,
  onJoinRoom,
  onDisconnectRoom,
  onDeploy,
  onOpenTankArcade,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Enter / Space starts gameplay when not typing in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onDeploy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDeploy]);

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-8"
      style={{
        background:
          'linear-gradient(95deg, rgba(13,15,12,0.92) 0%, rgba(13,15,12,0.74) 44%, rgba(13,15,12,0.22) 100%)',
      }}
      data-testid="title-hub"
    >
      {/* Top Row: Custom Inline SVG WW2 Emblem & Utility Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <svg
            viewBox="0 0 64 64"
            className="h-14 w-14 shrink-0"
            aria-hidden="true"
          >
            <polygon
              points="32,4 58,18 58,46 32,60 6,46 6,18"
              fill="#1e221b"
              stroke="#c88d2c"
              strokeWidth="2.5"
            />
            <polygon
              points="32,12 50,22 50,42 32,52 14,42 14,22"
              fill="none"
              stroke="#6a705d"
              strokeWidth="1.5"
            />
            <path
              d="M32 16 L36 28 L48 28 L38 35 L42 47 L32 40 L22 47 L26 35 L16 28 L28 28 Z"
              fill="#d7a444"
            />
          </svg>
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-wide leading-none text-[#f2eee4]">
              LEGION ARENA
            </h1>
            <p className="mt-1 text-sm font-medium tracking-wider text-[#c88d2c]">
              WW2 TACTICAL COMBAT HUB · DEPOT SECTOR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTankArcade}
            className="inline-flex items-center gap-2 rounded border border-[#4a4f44] bg-[#1a1d17]/95 px-4 py-2 text-xs font-semibold text-[#ece8df] hover:border-[#c88d2c] hover:bg-[#23271e] cursor-pointer whitespace-nowrap"
          >
            <Gamepad2 className="h-4 w-4 text-[#c88d2c]" />
            Trench Tank Mini-Game
          </button>
          <button
            type="button"
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={onToggleMute}
            className="flex h-9 w-9 items-center justify-center rounded border border-[#4a4f44] bg-[#1a1d17]/95 text-[#ece8df] hover:border-[#c88d2c] cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-[#d96c5b]" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Left Command Column (Leaves 55%+ right viewport open to live 3D Depot flyover) */}
      <div className="my-auto grid w-full max-w-[680px] grid-cols-1 gap-5 md:grid-cols-12">
        {/* Game Mode Selector */}
        <div className="md:col-span-7 flex flex-col gap-2.5">
          <div className="text-xs font-semibold tracking-wider text-[#9fa396]">
            SELECT COMBAT OPERATION
          </div>
          {MODE_OPTIONS.map((opt) => {
            const active = selectedMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectMode(opt.id)}
                className={`rounded border px-4 py-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[#c88d2c] bg-[#22251d]/95 text-[#f4efe4]'
                    : 'border-[#353a30] bg-[#151813]/90 text-[#c9c4b8] hover:border-[#5b6152]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-bold tracking-wide">
                    {opt.title}
                  </span>
                  {active && (
                    <Crosshair className="h-4 w-4 text-[#c88d2c] shrink-0" />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#a5a99c]">{opt.subtitle}</p>
                <div className="mt-1.5 text-[11px] font-mono-num text-[#d7a444]">
                  {opt.meta}
                </div>
              </button>
            );
          })}

          {/* Primary Deploy CTA + Sensitivity */}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onDeploy}
              className="inline-flex items-center gap-2.5 rounded bg-[#c88d2c] px-6 py-3 font-display text-xl font-extrabold tracking-wider text-[#121310] hover:bg-[#dba03d] cursor-pointer whitespace-nowrap"
            >
              <Play className="h-5 w-5 fill-current" />
              {netStatus === 'joined' && !isHost
                ? 'DEPLOY SOLO / PRACTICE'
                : netStatus === 'hosting' && roster.length > 1
                  ? 'LAUNCH SQUAD MATCH'
                  : 'DEPLOY TO DEPOT'}
            </button>

            <div className="flex flex-col gap-1 rounded border border-[#353a30] bg-[#151813]/90 px-3.5 py-2">
              <label
                htmlFor="sens-slider"
                className="flex items-center justify-between gap-3 text-[11px] text-[#9fa396] font-mono-num"
              >
                <span>MOUSE SENS</span>
                <span>{(sensitivity * 1000).toFixed(1)}</span>
              </label>
              <input
                id="sens-slider"
                type="range"
                min={0.0008}
                max={0.005}
                step={0.0002}
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(Number(e.target.value))}
                className="h-1.5 w-32 accent-[#c88d2c] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* PeerJS Multiplayer Squad Lobby */}
        <div className="md:col-span-5 flex flex-col justify-between rounded border border-[#353a30] bg-[#151813]/92 p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[#ece8df]">
                <Radio className="h-3.5 w-3.5 text-[#c88d2c]" />
                ONLINE SQUAD (PEERJS)
              </span>
              <span className="text-[11px] font-mono-num text-[#9fa396]">
                {netStatus.toUpperCase()}
              </span>
            </div>

            <div className="mt-3">
              <label
                htmlFor="callsign-input"
                className="block text-[11px] text-[#9fa396]"
              >
                Callsign
              </label>
              <input
                id="callsign-input"
                type="text"
                maxLength={14}
                value={callsign}
                onChange={(e) => onChangeCallsign(e.target.value)}
                placeholder="Operative"
                className="mt-1 w-full rounded border border-[#3a3f34] bg-[#0f110e] px-3 py-1.5 text-sm text-[#ece8df] focus:border-[#c88d2c] focus:outline-none"
              />
            </div>

            {netStatus === 'offline' || netStatus === 'error' ? (
              <div className="mt-3 space-y-2.5">
                <button
                  type="button"
                  onClick={onHostRoom}
                  className="w-full rounded border border-[#c88d2c]/70 bg-[#272318] px-3 py-2 text-xs font-semibold text-[#f1cb7d] hover:bg-[#332d1f] cursor-pointer"
                >
                  Create 4-Char Room Code
                </button>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={4}
                    aria-label="Room Code"
                    value={joinInput}
                    onChange={(e) =>
                      setJoinInput(sanitizeRoomCode(e.target.value))
                    }
                    placeholder="CODE"
                    className="w-24 rounded border border-[#3a3f34] bg-[#0f110e] px-2.5 py-1.5 text-center font-mono-num text-sm uppercase tracking-widest text-[#ece8df] focus:border-[#c88d2c] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onJoinRoom(joinInput)}
                    className="flex-1 rounded border border-[#4a4f44] bg-[#22261e] px-3 py-1.5 text-xs font-semibold text-[#ece8df] hover:bg-[#2d3228] cursor-pointer"
                  >
                    Join Room
                  </button>
                </div>
                {netMessage && (
                  <p className="text-[11px] text-[#d96c5b]">{netMessage}</p>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between rounded border border-[#4a4f44] bg-[#1e221b] px-3 py-2">
                  <div>
                    <div className="text-[10px] text-[#9fa396]">ROOM CODE</div>
                    <div
                      className="font-mono-num text-xl font-bold tracking-widest text-[#e7b55c]"
                      data-testid="room-code-display"
                    >
                      {roomCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded border border-[#3a3f34] bg-[#141713] px-2.5 py-1 text-xs text-[#ece8df] hover:border-[#c88d2c] cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {netMessage && (
                  <p className="text-[11px] text-[#8db87d]">{netMessage}</p>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-[#9fa396]">
                    <Users className="h-3.5 w-3.5" />
                    Squad Roster ({roster.length})
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {roster.map((p) => (
                      <div
                        key={p.peerId}
                        className="flex items-center justify-between rounded bg-[#1d201a] px-2.5 py-1 text-xs"
                      >
                        <span className="truncate font-medium text-[#ece8df]">
                          {p.callsign}
                          {p.isHost ? ' (Host)' : ''}
                        </span>
                        <span
                          className={
                            p.team === 'allies'
                              ? 'text-[10px] font-mono-num text-[#7aa5c9]'
                              : 'text-[10px] font-mono-num text-[#d96c5b]'
                          }
                        >
                          {p.team.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDisconnectRoom}
                  className="w-full rounded border border-[#4a4f44] bg-[#241b1a] px-3 py-1.5 text-xs font-medium text-[#e09488] hover:bg-[#312220] cursor-pointer"
                >
                  Leave Room
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenTankArcade}
            className="mt-4 flex items-center justify-center gap-1.5 rounded border border-[#3a3f34] bg-[#1b1f18] px-3 py-2 text-xs text-[#cfc9bc] hover:border-[#c88d2c] cursor-pointer"
          >
            <Shield className="h-3.5 w-3.5 text-[#c88d2c]" />
            Play Trench Arcade While Waiting
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin Control Hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#a5a99c]">
        <span>
          WASD Move · Shift Sprint · C Crouch / Slide · Space Jump · Left-Click Shoot · Right-Click ADS · R Reload · 1/2/3 Weapons · Tab Scoreboard · Esc Pause
        </span>
        <span className="font-mono-num text-[#c88d2c]">
          Press Enter or Space to Deploy
        </span>
      </div>
    </div>
  );
};
