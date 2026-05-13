import { Howl } from 'howler';

/**
 * Audio system. We don't ship binary audio assets in this scaffold so all
 * sounds are generated procedurally with the WebAudio API. This keeps the
 * project self-contained while still giving the engine the rumble it needs.
 *
 * Howler is used as a thin wrapper for ambient music tracks the user can drop
 * into /public/audio/ later.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineNoise: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private music: Howl | null = null;
  /** Master volume 0–1. */
  volume = 0.6;
  initialized = false;

  init(): void {
    if (this.initialized) return;
    try {
      const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      this.ctx = ctx;
      const masterGain = ctx.createGain();
      this.masterGain = masterGain;
      masterGain.gain.value = this.volume;
      masterGain.connect(ctx.destination);

      const engineGain = ctx.createGain();
      this.engineGain = engineGain;
      engineGain.gain.value = 0;
      engineGain.connect(masterGain);

      const engineOsc = ctx.createOscillator();
      this.engineOsc = engineOsc;
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 38;
      engineOsc.connect(engineGain);
      engineOsc.start();

      const engineNoise = this.createNoiseSource();
      this.engineNoise = engineNoise;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 600;
      engineNoise.connect(noiseFilter).connect(engineGain);
      engineNoise.start();

      const ambientGain = ctx.createGain();
      this.ambientGain = ambientGain;
      ambientGain.gain.value = 0;
      ambientGain.connect(masterGain);

      const ambientNoise = this.createNoiseSource();
      this.ambientNoise = ambientNoise;
      const ambientFilter = ctx.createBiquadFilter();
      ambientFilter.type = 'lowpass';
      ambientFilter.frequency.value = 320;
      ambientNoise.connect(ambientFilter).connect(ambientGain);
      ambientNoise.start();

      this.initialized = true;
    } catch (err) {
      console.warn('Audio init failed:', err);
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  /** Update engine sound from current throttle and atmospheric density. */
  setEngineState(throttle: number, density: number): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return;
    const target = Math.min(0.45, throttle * 0.45);
    this.engineGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    this.engineOsc.frequency.linearRampToValueAtTime(34 + throttle * 80, this.ctx.currentTime + 0.05);
    void density;
  }

  /** Update ambient (wind/rumble) sound from atmospheric density. */
  setAmbientState(density: number, speed: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const intensity = Math.min(0.35, density * speed * 0.0001);
    this.ambientGain.gain.linearRampToValueAtTime(intensity, this.ctx.currentTime + 0.1);
  }

  /** Single-shot UI click. */
  click(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.0;
    gain.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.06);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.07);
  }

  /** Single-shot staging "thunk". */
  staging(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  /** Big crash boom. */
  explosion(): void {
    if (!this.ctx || !this.masterGain) return;
    const noise = this.createNoiseSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    noise.connect(filter).connect(gain).connect(this.masterGain);
    noise.start();
    noise.stop(this.ctx.currentTime + 1.6);
  }

  loadMusic(url: string): void {
    if (this.music) {
      this.music.stop();
      this.music.unload();
    }
    this.music = new Howl({ src: [url], loop: true, volume: 0.25 });
    this.music.play();
  }

  private createNoiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
    const node = ctx.createBufferSource();
    node.buffer = noiseBuffer;
    node.loop = true;
    return node;
  }
}
