import React, { useEffect, useState } from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { formatClockTime } from '../game/rules';
import type { HudSnapshot, PlayableMode } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  mode: PlayableMode;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestLock: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  mode,
  muted,
  onToggleMute,
  onPause,
  onRequestLock,
}) => {
  const [tabHeld, setTabHeld] = useState(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setTabHeld(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setTabHeld(false);
      }
    };
    const onBlur = () => setTabHeld(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const isMelee =
    hud.weaponId === 'knife' || hud.weaponId === 'golden_knife';
  const showSniperScope = hud.isAds && hud.weaponId === 'kar98k';
  const hpPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      data-testid="hud-overlay"
    >
      {/* Low-HP & Damage Vignette */}
      {(hud.damageFlash > 0.02 || hud.health <= 30) && (
        <div
          className="fixed inset-0"
          style={{
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(165, 24, 18, 0.58) 100%)',
            opacity: Math.max(
              hud.damageFlash,
              hud.health <= 30 ? 0.45 : 0
            ),
          }}
        />
      )}

      {/* Kar98k Optical Scope Overlay during ADS */}
      {showSniperScope && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div
            className="h-[78vh] w-[78vh] rounded-full border-[3px] border-[#111310]"
            style={{
              boxShadow: '0 0 0 100vmax rgba(8, 10, 8, 0.92)',
            }}
          >
            <div className="relative h-full w-full">
              <div className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 bg-[#141614]/85" />
              <div className="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 bg-[#141614]/85" />
            </div>
          </div>
        </div>
      )}

      {/* Exact Center Crosshair & Hitmarker */}
      {!showSniperScope && (
        <div
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          {!hud.isAds && (
            <div className="relative h-7 w-7">
              <span className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-[#f3efe6]/90 shadow" />
              <span className="absolute left-1/2 bottom-0 h-2 w-[2px] -translate-x-1/2 bg-[#f3efe6]/90 shadow" />
              <span className="absolute top-1/2 left-0 h-[2px] w-2 -translate-y-1/2 bg-[#f3efe6]/90 shadow" />
              <span className="absolute top-1/2 right-0 h-[2px] w-2 -translate-y-1/2 bg-[#f3efe6]/90 shadow" />
              <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e3a334]" />
            </div>
          )}
          {hud.isAds && (
            <span className="block h-1.5 w-1.5 rounded-full bg-[#e3a334] shadow" />
          )}
        </div>
      )}

      {/* Hitmarker X Tick */}
      {hud.hitmarkerActive && (
        <svg
          viewBox="0 0 36 36"
          className="fixed left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <path
            d="M7 7 L14 14 M29 7 L22 14 M7 29 L14 22 M29 29 L22 22"
            stroke={hud.hitmarkerHeadshot ? '#e64935' : '#f5f1e6'}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Top-Center Match Score & Clock Cluster */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded border border-[#3a3f34] bg-[#141713]/85 px-5 py-2">
        {mode === 'tdm' && (
          <div className="flex items-center gap-4 font-mono-num">
            <div className="text-right">
              <div className="text-[10px] tracking-wider text-[#7aa5c9]">
                ALLIES
              </div>
              <div
                className="font-display text-2xl font-extrabold leading-none text-[#ece8df]"
                data-testid="allies-score"
              >
                {hud.alliesScore}
              </div>
            </div>
            <div className="border-x border-[#353a30] px-3 text-center">
              <div className="text-[10px] text-[#9fa396]">
                TARGET {hud.targetScore}
              </div>
              <div className="text-sm font-bold text-[#d7a444]">
                {formatClockTime(hud.matchElapsedSec)}
              </div>
            </div>
            <div className="text-left">
              <div className="text-[10px] tracking-wider text-[#d96c5b]">
                AXIS
              </div>
              <div
                className="font-display text-2xl font-extrabold leading-none text-[#ece8df]"
                data-testid="axis-score"
              >
                {hud.axisScore}
              </div>
            </div>
          </div>
        )}

        {mode === 'gungame' && (
          <div className="flex items-center gap-5 font-mono-num">
            <div>
              <div className="text-[10px] text-[#d7a444]">ARMS RACE TIER</div>
              <div className="font-display text-2xl font-extrabold leading-none text-[#ece8df]">
                {hud.gunGameTier + 1} / {hud.gunGameTotalTiers}
              </div>
            </div>
            <div className="border-l border-[#353a30] pl-4 text-sm font-bold text-[#cfc9bc]">
              {formatClockTime(hud.matchElapsedSec)}
            </div>
          </div>
        )}

        {mode === 'reflex' && (
          <div className="flex items-center gap-5 font-mono-num">
            <div>
              <div className="text-[10px] text-[#d7a444]">TARGETS CLEARED</div>
              <div className="font-display text-2xl font-extrabold leading-none text-[#ece8df]">
                {hud.reflexTargetsHit} / {hud.reflexTotalTargets}
              </div>
            </div>
            <div className="border-l border-[#353a30] pl-4">
              <div className="text-[10px] text-[#9fa396]">COURSE CLOCK</div>
              <div className="text-sm font-bold text-[#ece8df]">
                {hud.matchElapsedSec.toFixed(1)}s
              </div>
            </div>
            {hud.reflexBestTimeSec !== null && (
              <div className="border-l border-[#353a30] pl-4">
                <div className="text-[10px] text-[#9fa396]">BEST</div>
                <div className="text-sm font-bold text-[#7ca96b]">
                  {hud.reflexBestTimeSec.toFixed(1)}s
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top-Left Compact Mode & Click-to-Lock Hint */}
      <div className="fixed top-4 left-4 flex flex-col gap-1.5">
        <div className="rounded border border-[#3a3f34] bg-[#141713]/85 px-3 py-1.5 text-xs text-[#cfc9bc] font-mono-num">
          K {hud.playerKills} · D {hud.playerDeaths} · TAB Scoreboard
        </div>
        {!hud.isPointerLocked && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRequestLock();
            }}
            className="pointer-events-auto rounded border border-[#c88d2c]/60 bg-[#1c1f19]/90 px-3 py-1 text-left text-xs text-[#e7b55c] hover:bg-[#272b22] cursor-pointer"
          >
            Click arena to lock mouse aim · F to fire · Q to ADS
          </button>
        )}
      </div>

      {/* Top-Right Utility Controls & Kill Feed */}
      <div className="fixed top-4 right-4 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="flex h-9 w-9 items-center justify-center rounded border border-[#3a3f34] bg-[#141713]/85 text-[#ece8df] hover:bg-[#252922] cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-[#d96c5b]" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Match"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="flex h-9 w-9 items-center justify-center rounded border border-[#3a3f34] bg-[#141713]/85 text-[#ece8df] hover:bg-[#252922] cursor-pointer"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>

        {/* Kill Feed */}
        <div className="flex flex-col items-end gap-1">
          {hud.killFeed.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded border border-[#353a30] bg-[#141713]/85 px-2.5 py-1 text-xs"
            >
              <span
                className={
                  item.killerTeam === 'allies'
                    ? 'font-semibold text-[#7aa5c9]'
                    : 'font-semibold text-[#d96c5b]'
                }
              >
                {item.killer}
              </span>
              <span className="text-[#9fa396]">
                [{item.weapon}
                {item.headshot ? ' · HS' : ''}]
              </span>
              <span className="font-medium text-[#ece8df]">{item.victim}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom-Left Health, Stamina & Tactical Stance */}
      <div className="fixed bottom-5 left-5 rounded border border-[#3a3f34] bg-[#141713]/85 px-4 py-3 min-w-[240px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-[#9fa396]">
            HEALTH · {hud.stance.toUpperCase()}
          </span>
          <span
            className="font-display text-3xl font-extrabold leading-none font-mono-num text-[#ece8df]"
            data-testid="hud-health"
          >
            {hud.health}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-sm bg-[#252822]">
          <div
            className="h-full transition-transform duration-100"
            style={{
              width: `${hpPct}%`,
              backgroundColor:
                hpPct > 55 ? '#6d9b5d' : hpPct > 28 ? '#d7a444' : '#d64838',
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#9fa396] font-mono-num">
          <span>STAMINA</span>
          <span>{hud.stamina}%</span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-[#252822]">
          <div
            className="h-full bg-[#c88d2c]"
            style={{ width: `${hud.stamina}%` }}
          />
        </div>
      </div>

      {/* Bottom-Right Weapon, Ammo & Slot Selector */}
      <div className="fixed bottom-5 right-5 flex flex-col items-end gap-2">
        {hud.reloading && (
          <div className="rounded border border-[#c88d2c]/60 bg-[#141713]/90 px-3 py-1 text-xs font-mono-num text-[#e7b55c]">
            RELOADING {Math.round(hud.reloadProgress * 100)}%
          </div>
        )}

        <div className="rounded border border-[#3a3f34] bg-[#141713]/85 px-4 py-3 text-right min-w-[235px]">
          <div className="text-xs font-semibold text-[#d7a444]">
            {hud.weaponName}
          </div>
          <div className="text-[11px] text-[#9fa396]">{hud.weaponRole}</div>
          <div
            className="mt-1 font-display text-4xl font-extrabold leading-none font-mono-num text-[#ece8df]"
            data-testid="hud-ammo"
          >
            {isMelee ? 'MELEE' : `${hud.ammoInMag} / ${hud.ammoReserve}`}
          </div>
        </div>

        {mode !== 'gungame' && (
          <div className="flex items-center gap-1.5">
            {hud.slotWeapons.map((sw) => (
              <div
                key={sw.slot}
                className={`rounded border px-2.5 py-1 text-xs font-mono-num ${
                  sw.active
                    ? 'border-[#c88d2c] bg-[#2a271d] text-[#f4efe4]'
                    : 'border-[#353a30] bg-[#141713]/80 text-[#8c9184]'
                }`}
              >
                [{sw.slot}] {sw.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Respawn Banner */}
      {hud.respawnTimerSec > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/55">
          <div className="rounded border border-[#4f5448] bg-[#161814] px-7 py-4 text-center">
            <div className="font-display text-2xl font-bold text-[#d96c5b]">
              KIA — REDEPLOYING
            </div>
            <div className="mt-1 font-mono-num text-sm text-[#ece8df]">
              Deployment in {hud.respawnTimerSec.toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* Live Tab Scoreboard */}
      {tabHeld && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/65">
          <div className="w-full max-w-[640px] rounded border border-[#4a4f44] bg-[#161814] p-5">
            <div className="flex items-center justify-between border-b border-[#2e3229] pb-3">
              <h3 className="font-display text-2xl font-bold tracking-wide text-[#ece8df]">
                TACTICAL SCOREBOARD
              </h3>
              <span className="font-mono-num text-xs text-[#9fa396]">
                {mode.toUpperCase()} · {formatClockTime(hud.matchElapsedSec)}
              </span>
            </div>
            <table className="mt-3 w-full text-left text-sm font-mono-num">
              <thead>
                <tr className="border-b border-[#2a2d25] text-xs text-[#9fa396]">
                  <th className="py-2">OPERATIVE</th>
                  <th className="py-2">SQUAD</th>
                  <th className="py-2 text-right">KILLS</th>
                  <th className="py-2 text-right">DEATHS</th>
                </tr>
              </thead>
              <tbody>
                {hud.scoreboard.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[#23261f] ${
                      row.isLocal ? 'bg-[#25281f] text-[#f3e1b7]' : 'text-[#dcd7cc]'
                    }`}
                  >
                    <td className="py-2 font-sans font-medium">
                      {row.name}
                      {row.isLocal ? ' (You)' : row.isBot ? ' · Bot' : ''}
                    </td>
                    <td
                      className={`py-2 text-xs ${
                        row.team === 'allies' ? 'text-[#7aa5c9]' : 'text-[#d96c5b]'
                      }`}
                    >
                      {row.team.toUpperCase()}
                    </td>
                    <td className="py-2 text-right">{row.kills}</td>
                    <td className="py-2 text-right">{row.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
