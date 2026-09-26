/**
 * Web Audio API synthesizer for realistic car engine, tire skids, brakes, and rain.
 * Works completely offline without external audio files.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  // Engine sound nodes
  private engineGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Skid sound nodes
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidNoiseNode: AudioBufferSourceNode | null = null;

  // Rain sound nodes
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;

  // Master
  private masterGain: GainNode | null = null;

  constructor() {
    // Audio context will be activated on first user interaction
  }

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- Engine Synthesizer ---
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'triangle';
      this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.setValueAtTime(22.5, this.ctx.currentTime);

      this.osc1.connect(this.engineFilter);
      this.osc2.connect(this.engineFilter);
      this.subOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.osc1.start();
      this.osc2.start();
      this.subOsc.start();

      // --- Tire Skid Synthesizer (White noise + bandpass filter) ---
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.skidNoiseNode = this.ctx.createBufferSource();
      this.skidNoiseNode.buffer = noiseBuffer;
      this.skidNoiseNode.loop = true;

      this.skidFilter = this.ctx.createBiquadFilter();
      this.skidFilter.type = 'bandpass';
      this.skidFilter.frequency.setValueAtTime(900, this.ctx.currentTime);
      this.skidFilter.Q.setValueAtTime(4.5, this.ctx.currentTime);

      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.skidNoiseNode.connect(this.skidFilter);
      this.skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);

      this.skidNoiseNode.start();

      // --- Rain Ambient Synthesizer ---
      const rainNoise = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const rainData = rainNoise.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        rainData[i] = Math.random() * 2 - 1;
      }
      const rainSource = this.ctx.createBufferSource();
      rainSource.buffer = rainNoise;
      rainSource.loop = true;

      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'lowpass';
      this.rainFilter.frequency.setValueAtTime(750, this.ctx.currentTime);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      rainSource.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      rainSource.start();

      this.initialized = true;
    } catch {
      // AudioContext policy or unsupported
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public updateEngine(speedKmh: number, rpmNorm: number, throttle: number) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const baseFreq = 38 + rpmNorm * 110 + (throttle > 0 ? 15 : 0);
    const time = this.ctx.currentTime;

    if (this.osc1) this.osc1.frequency.setTargetAtTime(baseFreq, time, 0.05);
    if (this.osc2) this.osc2.frequency.setTargetAtTime(baseFreq * 1.85, time, 0.05);
    if (this.subOsc) this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, time, 0.05);

    if (this.engineFilter) {
      const cutoff = 320 + rpmNorm * 800 + throttle * 400;
      this.engineFilter.frequency.setTargetAtTime(cutoff, time, 0.05);
    }

    if (this.engineGain) {
      const vol = 0.12 + Math.min(0.28, (speedKmh / 200) * 0.2 + throttle * 0.12);
      this.engineGain.gain.setTargetAtTime(vol, time, 0.08);
    }
  }

  public updateSkid(intensity: number) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    if (this.skidGain) {
      const targetVol = Math.min(0.35, intensity * 0.4);
      this.skidGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.04);
    }
    if (this.skidFilter && intensity > 0) {
      const freq = 800 + intensity * 600;
      this.skidFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
    }
  }

  public updateRain(rainIntensity: number) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    if (this.rainGain) {
      const targetVol = rainIntensity * 0.18;
      this.rainGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.2);
    }
  }

  public playCrash() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.masterGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  }

  public playShutter() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // High-pitched mechanical shutter click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);

      // Secondary shutter release click
      setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const now2 = this.ctx.currentTime;
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(900, now2);
        osc2.frequency.exponentialRampToValueAtTime(200, now2 + 0.06);

        gain2.gain.setValueAtTime(0.3, now2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.07);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start(now2);
        osc2.stop(now2 + 0.07);
      }, 70);
    } catch {
      // ignore
    }
  }
}
