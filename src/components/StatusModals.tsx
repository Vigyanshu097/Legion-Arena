import React from 'react';
import { Home, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { formatClockTime } from '../game/rules';
import type { MatchSummary } from '../game/types';

interface PauseModalProps {
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnToHub: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  sensitivity,
  onChangeSensitivity,
  muted,
  onToggleMute,
  onResume,
  onRestart,
  onReturnToHub,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      data-testid="pause-modal"
    >
      <div className="w-full max-w-[400px] rounded border border-[#4a4f44] bg-[#161814] p-6 shadow-2xl">
        <h2 className="font-display text-3xl font-extrabold tracking-wide text-[#ece8df]">
          OPERATION PAUSED
        </h2>
        <p className="mt-1 text-xs text-[#9fa396]">
          Adjust tactical sensitivity or resume deployment.
        </p>

        <div className="mt-5 space-y-4">
          <div className="rounded border border-[#2f332a] bg-[#1d201a] p-3.5">
            <label
              htmlFor="pause-sens"
              className="flex items-center justify-between text-xs text-[#cfc9bc] font-mono-num"
            >
              <span>MOUSE SENSITIVITY</span>
              <span>{(sensitivity * 1000).toFixed(1)}</span>
            </label>
            <input
              id="pause-sens"
              type="range"
              min={0.0008}
              max={0.005}
              step={0.0002}
              value={sensitivity}
              onChange={(e) => onChangeSensitivity(Number(e.target.value))}
              className="mt-2 w-full accent-[#c88d2c] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex w-full items-center justify-between rounded border border-[#2f332a] bg-[#1d201a] px-3.5 py-2.5 text-sm text-[#ece8df] hover:border-[#4a4f44] cursor-pointer"
          >
            <span>Procedural Combat Audio</span>
            {muted ? (
              <span className="flex items-center gap-1.5 text-xs text-[#d96c5b]">
                <VolumeX className="h-4 w-4" /> Muted
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[#7ca96b]">
                <Volume2 className="h-4 w-4" /> Active
              </span>
            )}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#c88d2c] px-4 py-2.5 font-display text-lg font-bold tracking-wide text-[#121310] hover:bg-[#dba03d] cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            Resume Match
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded border border-[#4a4f44] bg-[#22261e] px-4 py-2 text-sm font-semibold text-[#ece8df] hover:bg-[#2d3228] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Restart Match
          </button>
          <button
            type="button"
            onClick={onReturnToHub}
            className="inline-flex items-center justify-center gap-2 rounded border border-[#3a3f34] bg-[#191b16] px-4 py-2 text-sm font-medium text-[#c9c4b8] hover:bg-[#242720] cursor-pointer"
          >
            <Home className="h-4 w-4" />
            Return to Hub
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  summary: MatchSummary;
  onPlayAgain: () => void;
  onReturnToHub: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  onPlayAgain,
  onReturnToHub,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      data-testid="gameover-modal"
    >
      <div className="w-full max-w-[460px] rounded border border-[#4a4f44] bg-[#161814] p-6 shadow-2xl">
        <div
          className={`font-display text-4xl font-extrabold tracking-wide ${
            summary.victory ? 'text-[#d7a444]' : 'text-[#d96c5b]'
          }`}
        >
          {summary.headline}
        </div>
        <p className="mt-1 text-sm text-[#cfc9bc]">{summary.subline}</p>

        <div className="mt-5 grid grid-cols-3 gap-3 font-mono-num">
          <div className="rounded border border-[#2f332a] bg-[#1d201a] p-3 text-center">
            <div className="text-[10px] text-[#9fa396]">ELIMINATIONS</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#ece8df]">
              {summary.kills} / {summary.deaths}
            </div>
          </div>
          <div className="rounded border border-[#2f332a] bg-[#1d201a] p-3 text-center">
            <div className="text-[10px] text-[#9fa396]">ACCURACY</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#ece8df]">
              {summary.accuracyPct}%
            </div>
          </div>
          <div className="rounded border border-[#2f332a] bg-[#1d201a] p-3 text-center">
            <div className="text-[10px] text-[#9fa396]">
              {summary.mode === 'reflex' ? 'COURSE TIME' : 'DURATION'}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-[#ece8df]">
              {summary.mode === 'reflex'
                ? `${summary.elapsedSec.toFixed(1)}s`
                : formatClockTime(summary.elapsedSec)}
            </div>
          </div>
        </div>

        {summary.isNewRecord && (
          <div className="mt-3 rounded border border-[#c88d2c]/60 bg-[#252116] px-3 py-1.5 text-center text-xs font-semibold text-[#e7b55c]">
            NEW REFLEX COURSE RECORD
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-[#c88d2c] px-4 py-2.5 font-display text-lg font-bold tracking-wide text-[#121310] hover:bg-[#dba03d] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
          <button
            type="button"
            onClick={onReturnToHub}
            className="inline-flex items-center justify-center gap-2 rounded border border-[#4a4f44] bg-[#22261e] px-4 py-2.5 text-sm font-semibold text-[#ece8df] hover:bg-[#2d3228] cursor-pointer"
          >
            <Home className="h-4 w-4" />
            Hub
          </button>
        </div>
      </div>
    </div>
  );
};
