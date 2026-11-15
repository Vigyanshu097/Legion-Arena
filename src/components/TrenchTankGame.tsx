import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, RotateCcw, Shield, Trophy, X } from 'lucide-react';
import { audioEngine } from '../game/audio';

interface TrenchTankGameProps {
  roomCode?: string;
  playerCount?: number;
  onClose: () => void;
}

interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  life: number;
}

interface EnemyUnit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: 'scout' | 'panzer';
  fireTimer: number;
  angle: number;
}

interface BlastParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

const CANVAS_W = 760;
const CANVAS_H = 440;

export const TrenchTankGame: React.FC<TrenchTankGameProps> = ({
  roomCode,
  playerCount,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState({
    score: 0,
    wave: 1,
    hp: 100,
    best: 0,
    gameOver: false,
  });
  const resetFlagRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bestScore = 0;
    try {
      bestScore = Number(localStorage.getItem('legion_tank_best') || '0') || 0;
    } catch {
      bestScore = 0;
    }

    const keys = new Set<string>();
    let mouseX = CANVAS_W * 0.7;
    let mouseY = CANVAS_H * 0.5;
    let mouseDown = false;

    const state = {
      px: 130,
      py: CANVAS_H / 2,
      bodyAngle: 0,
      turretAngle: 0,
      hp: 100,
      score: 0,
      wave: 1,
      fireCd: 0,
      spawnCd: 0.6,
      enemiesLeftInWave: 5,
      gameOver: false,
      treadOffset: 0,
      shells: [] as Shell[],
      enemies: [] as EnemyUnit[],
      particles: [] as BlastParticle[],
    };

    const resetGame = () => {
      state.px = 130;
      state.py = CANVAS_H / 2;
      state.bodyAngle = 0;
      state.hp = 100;
      state.score = 0;
      state.wave = 1;
      state.fireCd = 0;
      state.spawnCd = 0.5;
      state.enemiesLeftInWave = 5;
      state.gameOver = false;
      state.shells = [];
      state.enemies = [];
      state.particles = [];
      setHud({ score: 0, wave: 1, hp: 100, best: bestScore, gameOver: false });
    };

    let lastResetToken = resetFlagRef.current;

    const spawnBurst = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 45 + Math.random() * 140;
        state.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.5,
          color,
        });
      }
    };

    const firePlayerShell = () => {
      if (state.gameOver || state.fireCd > 0) return;
      state.fireCd = 0.28;
      const tipX = state.px + Math.cos(state.turretAngle) * 24;
      const tipY = state.py + Math.sin(state.turretAngle) * 24;
      state.shells.push({
        x: tipX,
        y: tipY,
        vx: Math.cos(state.turretAngle) * 440,
        vy: Math.sin(state.turretAngle) * 440,
        fromPlayer: true,
        life: 1.8,
      });
      spawnBurst(tipX, tipY, '#f6c453', 5);
      audioEngine.unlock();
      audioEngine.playTankShot();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
      if (e.code === 'Space') {
        firePlayerShell();
      }
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => {
      keys.clear();
      mouseDown = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      mouseY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDown = true;
        firePlayerShell();
      }
    };
    const onMouseUp = () => {
      mouseDown = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    let rafId = 0;
    let prevTime = performance.now();
    let hudTimer = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      if (resetFlagRef.current !== lastResetToken) {
        lastResetToken = resetFlagRef.current;
        resetGame();
      }

      if (!state.gameOver) {
        if (state.fireCd > 0) state.fireCd -= dt;
        if (mouseDown) firePlayerShell();

        let mx = 0;
        let my = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;

        if (mx !== 0 || my !== 0) {
          const len = Math.hypot(mx, my);
          mx /= len;
          my /= len;
          state.px = Math.max(36, Math.min(CANVAS_W - 36, state.px + mx * 165 * dt));
          state.py = Math.max(36, Math.min(CANVAS_H - 36, state.py + my * 165 * dt));
          state.bodyAngle = Math.atan2(my, mx);
          state.treadOffset = (state.treadOffset + dt * 28) % 10;
        }
        state.turretAngle = Math.atan2(mouseY - state.py, mouseX - state.px);

        // Spawn enemy wave
        state.spawnCd -= dt;
        if (state.enemiesLeftInWave > 0 && state.spawnCd <= 0) {
          state.enemiesLeftInWave--;
          state.spawnCd = Math.max(0.55, 1.5 - state.wave * 0.12);
          const isPanzer = state.wave >= 2 && Math.random() < 0.35;
          const ey = 48 + Math.random() * (CANVAS_H - 96);
          state.enemies.push({
            x: CANVAS_W + 24,
            y: ey,
            vx: -(isPanzer ? 48 : 78 + state.wave * 6),
            vy: (Math.random() - 0.5) * 32,
            hp: isPanzer ? 3 : 1,
            maxHp: isPanzer ? 3 : 1,
            kind: isPanzer ? 'panzer' : 'scout',
            fireTimer: 1.0 + Math.random() * 1.2,
            angle: Math.PI,
          });
        } else if (state.enemiesLeftInWave === 0 && state.enemies.length === 0) {
          state.wave++;
          state.enemiesLeftInWave = 4 + state.wave * 2;
          state.hp = Math.min(100, state.hp + 15);
        }

        // Update shells
        for (let i = state.shells.length - 1; i >= 0; i--) {
          const s = state.shells[i];
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.life -= dt;
          if (
            s.life <= 0 ||
            s.x < -20 ||
            s.x > CANVAS_W + 20 ||
            s.y < -20 ||
            s.y > CANVAS_H + 20
          ) {
            state.shells.splice(i, 1);
            continue;
          }

          if (s.fromPlayer) {
            let hit = false;
            for (let j = state.enemies.length - 1; j >= 0; j--) {
              const e = state.enemies[j];
              const rad = e.kind === 'panzer' ? 20 : 15;
              if (Math.hypot(s.x - e.x, s.y - e.y) < rad) {
                e.hp--;
                hit = true;
                spawnBurst(s.x, s.y, '#f59e0b', 8);
                if (e.hp <= 0) {
                  state.score += e.kind === 'panzer' ? 250 : 100;
                  if (state.score > bestScore) {
                    bestScore = state.score;
                    try {
                      localStorage.setItem('legion_tank_best', String(bestScore));
                    } catch {
                      // ignore
                    }
                  }
                  spawnBurst(e.x, e.y, '#ef4444', 18);
                  audioEngine.playTankExplosion();
                  state.enemies.splice(j, 1);
                } else {
                  audioEngine.playHitmarker(false);
                }
                break;
              }
            }
            if (hit) state.shells.splice(i, 1);
          } else {
            if (Math.hypot(s.x - state.px, s.y - state.py) < 20) {
              state.hp = Math.max(0, state.hp - 18);
              spawnBurst(s.x, s.y, '#ef4444', 10);
              audioEngine.playHurt();
              state.shells.splice(i, 1);
              if (state.hp <= 0) {
                state.gameOver = true;
                setHud({
                  score: state.score,
                  wave: state.wave,
                  hp: 0,
                  best: bestScore,
                  gameOver: true,
                });
              }
            }
          }
        }

        // Update enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const e = state.enemies[i];
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.y < 36 || e.y > CANVAS_H - 36) e.vy *= -1;
          e.angle = Math.atan2(state.py - e.y, state.px - e.x);

          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && e.x < CANVAS_W - 20) {
            e.fireTimer = e.kind === 'panzer' ? 1.5 : 2.1;
            state.shells.push({
              x: e.x + Math.cos(e.angle) * 18,
              y: e.y + Math.sin(e.angle) * 18,
              vx: Math.cos(e.angle) * 240,
              vy: Math.sin(e.angle) * 240,
              fromPlayer: false,
              life: 2.5,
            });
          }

          if (Math.hypot(e.x - state.px, e.y - state.py) < 30) {
            state.hp = Math.max(0, state.hp - 25);
            spawnBurst(e.x, e.y, '#ef4444', 16);
            audioEngine.playTankExplosion();
            state.enemies.splice(i, 1);
            if (state.hp <= 0) {
              state.gameOver = true;
              setHud({
                score: state.score,
                wave: state.wave,
                hp: 0,
                best: bestScore,
                gameOver: true,
              });
            }
            continue;
          }

          if (e.x < -30) {
            // Enemy breached trench line
            state.hp = Math.max(0, state.hp - 15);
            state.enemies.splice(i, 1);
            if (state.hp <= 0) {
              state.gameOver = true;
              setHud({
                score: state.score,
                wave: state.wave,
                hp: 0,
                best: bestScore,
                gameOver: true,
              });
            }
          }
        }
      }

      // Update particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Render 2D Retro Trench Battlefield
      ctx.fillStyle = '#25261e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Mud trench grid & defensive earthworks
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }

      // Defensive Trench Line on Left
      ctx.fillStyle = '#181913';
      ctx.fillRect(58, 0, 26, CANVAS_H);
      ctx.fillStyle = '#6c5c41';
      for (let y = 12; y < CANVAS_H; y += 28) {
        ctx.fillRect(84, y, 10, 20);
      }

      // Draw Enemies
      for (const e of state.enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.fillStyle = e.kind === 'panzer' ? '#4e5559' : '#635347';
        ctx.fillRect(-16, -12, 32, 24);
        ctx.fillStyle = '#26292b';
        ctx.fillRect(-16, -15, 32, 4);
        ctx.fillRect(-16, 11, 32, 4);
        ctx.fillStyle = '#993b30';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillRect(4, -2, 18, 4);
        ctx.restore();
      }

      // Draw Player Tank
      if (!state.gameOver) {
        ctx.save();
        ctx.translate(state.px, state.py);
        ctx.rotate(state.bodyAngle);
        // Tracks
        ctx.fillStyle = '#171916';
        ctx.fillRect(-19, -16, 38, 6);
        ctx.fillRect(-19, 10, 38, 6);
        // Hull
        ctx.fillStyle = '#5a6b40';
        ctx.fillRect(-17, -12, 34, 24);
        ctx.strokeStyle = '#384426';
        ctx.lineWidth = 2;
        ctx.strokeRect(-17, -12, 34, 24);
        ctx.restore();

        // Rotating Turret
        ctx.save();
        ctx.translate(state.px, state.py);
        ctx.rotate(state.turretAngle);
        ctx.fillStyle = '#404e2d';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2d3620';
        ctx.fillRect(6, -2.5, 20, 5);
        ctx.restore();
      }

      // Draw Shells
      for (const s of state.shells) {
        ctx.fillStyle = s.fromPlayer ? '#f6c453' : '#ef5b4b';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Particles
      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
      ctx.globalAlpha = 1;

      hudTimer += dt;
      if (hudTimer >= 0.1) {
        hudTimer = 0;
        setHud({
          score: state.score,
          wave: state.wave,
          hp: state.hp,
          best: bestScore,
          gameOver: state.gameOver,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      data-testid="trench-tank-arcade"
    >
      <div className="w-full max-w-[820px] rounded-lg border border-[#4a4f44] bg-[#161814] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2e3229] bg-[#1d201a] px-5 py-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-[#ece8df]">
              TRENCH TANK DEFENSE
            </h2>
            <p className="text-xs text-[#9fa396]">
              Lobby Wait Arcade
              {roomCode ? ` · Room ${roomCode} (${playerCount ?? 1} in squad)` : ' · Hold the western trench line'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs font-mono-num">
              <span className="flex items-center gap-1.5 text-[#d7a444]">
                <Trophy className="h-3.5 w-3.5" />
                SCORE {hud.score}
              </span>
              <span className="text-[#9fa396]">WAVE {hud.wave}</span>
              <span className="flex items-center gap-1.5 text-[#7ca96b]">
                <Shield className="h-3.5 w-3.5" />
                ARMOR {hud.hp}%
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Trench Tank Arcade"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#3a3f34] bg-[#242820] text-[#d8d4ca] hover:bg-[#31362b] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative bg-[#111310] p-4 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full max-w-[760px] rounded border border-[#32372c] cursor-crosshair"
          />

          {hud.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/75">
              <div className="rounded-lg border border-[#4f5448] bg-[#191c17] px-8 py-6 text-center">
                <div className="font-display text-3xl font-bold text-[#e35c48]">
                  TANK DESTROYED
                </div>
                <div className="mt-2 font-mono-num text-sm text-[#cfc9bc]">
                  Final Score {hud.score} · Wave {hud.wave} · Best {hud.best}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetFlagRef.current++;
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded bg-[#c88d2c] px-5 py-2.5 text-sm font-semibold text-[#121310] hover:bg-[#dba03d] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex w-full max-w-[760px] items-center justify-between text-xs text-[#9fa396]">
            <span className="flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5 text-[#c88d2c]" />
              WASD / Arrows Move · Mouse Aim · Click or Space Fire
            </span>
            <span className="font-mono-num">Best Score: {hud.best}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
