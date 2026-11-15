import type { WeaponId } from './types';

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private getReadyContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  public playWeaponFire(weaponId: WeaponId): void {
    const ctx = this.getReadyContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    if (weaponId === 'knife' || weaponId === 'golden_knife') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 * jitter, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.12);
      filter.Q.value = 1.6;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.15);
      return;
    }

    // Gunfire noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq =
      weaponId === 'kar98k'
        ? 1100
        : weaponId === 'shotgun'
          ? 750
          : weaponId === 'm1911'
            ? 1450
            : 1300;
    filter.frequency.setValueAtTime(baseFreq * jitter, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    filter.Q.value = weaponId === 'shotgun' ? 0.6 : 0.9;

    const noiseGain = ctx.createGain();
    const peak =
      weaponId === 'kar98k'
        ? 0.45
        : weaponId === 'shotgun'
          ? 0.52
          : weaponId === 'm1911'
            ? 0.34
            : 0.28;
    const decay =
      weaponId === 'kar98k' ? 0.28 : weaponId === 'shotgun' ? 0.32 : 0.14;
    noiseGain.gain.setValueAtTime(peak, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + decay + 0.02);

    // Low mechanical punch oscillator
    const osc = ctx.createOscillator();
    osc.type = weaponId === 'kar98k' ? 'sawtooth' : 'triangle';
    const startHz =
      weaponId === 'kar98k'
        ? 185
        : weaponId === 'shotgun'
          ? 145
          : weaponId === 'm1911'
            ? 230
            : 210;
    osc.frequency.setValueAtTime(startHz * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(weaponId === 'shotgun' ? 0.42 : 0.28, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);

    // Bolt / pump follow-up click for Kar98k or Shotgun
    if (weaponId === 'kar98k' || weaponId === 'shotgun') {
      const clackTime = now + (weaponId === 'kar98k' ? 0.42 : 0.26);
      const clack = ctx.createOscillator();
      clack.type = 'square';
      clack.frequency.setValueAtTime(weaponId === 'kar98k' ? 1650 : 980, clackTime);
      clack.frequency.exponentialRampToValueAtTime(480, clackTime + 0.035);
      const clackGain = ctx.createGain();
      clackGain.gain.setValueAtTime(0.08, clackTime);
      clackGain.gain.exponentialRampToValueAtTime(0.001, clackTime + 0.04);
      clack.connect(clackGain);
      clackGain.connect(ctx.destination);
      clack.start(clackTime);
      clack.stop(clackTime + 0.045);
    }
  }

  public playReload(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const clicks = [0, 0.35, 0.85];
    const freqs = [920, 620, 1320];
    clicks.forEach((offset, idx) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freqs[idx], t);
      osc.frequency.exponentialRampToValueAtTime(freqs[idx] * 0.55, t + 0.04);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    });
  }

  public playHitmarker(headshot: boolean): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 2150 : 1280, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 1650 : 720, now + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(headshot ? 0.24 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playFootstep(sprinting: boolean): void {
    const ctx = this.getReadyContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = (sprinting ? 480 : 340) * (0.9 + Math.random() * 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sprinting ? 0.09 : 0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playSlide(): void {
    const ctx = this.getReadyContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.35);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.38);
  }

  public playHurt(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playKillChime(tierUp = false): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = tierUp ? [523.25, 659.25, 783.99] : [587.33, 880];
    notes.forEach((hz, idx) => {
      const t = now + idx * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playMatchEnd(victory: boolean): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = victory
      ? [392, 493.88, 587.33, 783.99]
      : [311.13, 277.18, 246.94, 196];
    notes.forEach((hz, idx) => {
      const t = now + idx * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, t);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playTankShot(): void {
    const ctx = this.getReadyContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playTankExplosion(): void {
    const ctx = this.getReadyContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(540, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.38);
  }
}

export const audioEngine = new ProceduralAudioEngine();
