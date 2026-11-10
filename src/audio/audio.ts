// Fully synthesized audio: every sound effect and the lounge soundtrack are generated with the Web Audio API,
// so the game ships no third-party audio assets.

type Sfx =
  | 'select' | 'deselect' | 'deal' | 'play' | 'chips' | 'mult' | 'xmult' | 'money' | 'buy' | 'sell' | 'shatter'
  | 'error' | 'roundWin' | 'victory' | 'defeat' | 'reroll' | 'pack' | 'use' | 'skip' | 'hover' | 'final' | 'boss' | 'unlock';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  volumes = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };
  private musicTimer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  intensity = 0; // 0 calm, 1 boss
  private noiseBuf: AudioBuffer | null = null;
  musicWanted = true;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch {
      return false;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.music = c.createGain();
    this.sfx = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(comp).connect(c.destination);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.musicWanted) this.startMusic();
    return true;
  }

  setVolumes(v: Partial<AudioEngine['volumes']>) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.volumes.muted ? 0 : this.volumes.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.music * 0.35, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest?: AudioNode, glideTo?: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterType: BiquadFilterType, freq: number, when = 0, dest?: AudioNode, q = 1) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  play(name: Sfx, step = 0) {
    if (!this.ensure() || this.volumes.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.06;
    const n = (semi: number) => 440 * Math.pow(2, semi / 12);
    switch (name) {
      case 'hover': this.tone(1800 * r, 0.03, 'sine', 0.03); break;
      case 'select': this.tone(n(7) * r, 0.07, 'triangle', 0.18); this.noise(0.04, 0.08, 'highpass', 4000); break;
      case 'deselect': this.tone(n(0) * r, 0.07, 'triangle', 0.14); break;
      case 'deal': this.noise(0.09, 0.22, 'bandpass', 2500 * r, 0, undefined, 0.8); this.tone(200, 0.05, 'sine', 0.05); break;
      case 'play': this.noise(0.12, 0.3, 'lowpass', 900); this.tone(110, 0.15, 'sine', 0.3, 0, undefined, 60); break;
      case 'chips': this.tone(n(PENTA[Math.min(step, PENTA.length - 1)] - 5) * r, 0.12, 'triangle', 0.16); break;
      case 'mult': this.tone(n(PENTA[Math.min(step, PENTA.length - 1)] + 2) * r, 0.12, 'square', 0.07); this.tone(n(PENTA[Math.min(step, PENTA.length - 1)] + 14), 0.1, 'sine', 0.05); break;
      case 'xmult': [0, 4, 7, 12].forEach((s, i) => this.tone(n(s + 3), 0.3, 'sawtooth', 0.04, i * 0.02)); this.tone(n(-21), 0.3, 'sine', 0.25); break;
      case 'money': this.tone(1318 * r, 0.08, 'triangle', 0.15); this.tone(1760 * r, 0.25, 'triangle', 0.15, 0.06); break;
      case 'buy': this.tone(988, 0.08, 'triangle', 0.15); this.tone(1318, 0.08, 'triangle', 0.15, 0.06); this.tone(1976, 0.3, 'sine', 0.1, 0.12); break;
      case 'sell': this.tone(1318, 0.08, 'triangle', 0.15); this.tone(988, 0.2, 'triangle', 0.13, 0.07); break;
      case 'shatter':
        this.noise(0.4, 0.35, 'highpass', 3000);
        for (let i = 0; i < 6; i++) this.tone(2000 + Math.random() * 3000, 0.15, 'sine', 0.05, Math.random() * 0.2);
        break;
      case 'error': this.tone(140, 0.18, 'sawtooth', 0.12); this.tone(110, 0.2, 'sawtooth', 0.1, 0.08); break;
      case 'roundWin': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(n(s), 0.35, 'triangle', 0.14, i * 0.08)); break;
      case 'victory':
        [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(n(s), 0.5, 'triangle', 0.14, i * 0.11));
        [0, 7, 12].forEach((s) => this.tone(n(s - 12), 1.6, 'sawtooth', 0.04, 0.9));
        break;
      case 'defeat': [7, 3, 0, -5, -12].forEach((s, i) => this.tone(n(s - 5), 0.45, 'sawtooth', 0.06, i * 0.18)); break;
      case 'reroll': this.noise(0.25, 0.15, 'bandpass', 1200, 0, undefined, 2); this.tone(300, 0.25, 'sine', 0.08, 0, undefined, 900); break;
      case 'pack': this.tone(200, 0.5, 'sawtooth', 0.05, 0, undefined, 1600); this.noise(0.5, 0.12, 'highpass', 2000); break;
      case 'use': [0, 7, 12, 19].forEach((s, i) => this.tone(n(s + 5), 0.25, 'sine', 0.1, i * 0.05)); break;
      case 'skip': this.tone(600, 0.15, 'triangle', 0.1, 0, undefined, 1200); break;
      case 'final': this.tone(n(-12), 0.5, 'sine', 0.3); [0, 4, 7].forEach((s) => this.tone(n(s), 0.5, 'triangle', 0.08)); break;
      case 'boss': this.tone(n(-24), 1.2, 'sawtooth', 0.12, 0, undefined, n(-26)); this.noise(1, 0.08, 'lowpass', 300); break;
      case 'unlock': [12, 16, 19, 24].forEach((s, i) => this.tone(n(s), 0.3, 'sine', 0.12, i * 0.07)); break;
    }
  }

  // ───────── Generative lounge soundtrack ─────────
  startMusic() {
    this.musicWanted = true;
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beat = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    const bpm = 88 + this.intensity * 16;
    const spb = 60 / bpm / 2; // eighth notes
    // Dm9 – G13 – Cmaj9 – A7(b9) in semitones from A4
    const prog = [
      { root: -7, chord: [5, 8, 12, 15] },
      { root: -2, chord: [5, 9, 12, 16] },
      { root: -9, chord: [3, 7, 10, 14] },
      { root: -12, chord: [4, 7, 10, 13] },
    ];
    while (this.nextBeat < c.currentTime + 0.3) {
      const t = this.nextBeat - c.currentTime;
      const bar = Math.floor(this.beat / 8) % prog.length;
      const step = this.beat % 8;
      const ch = prog[bar];
      const f = (s: number) => 440 * Math.pow(2, s / 12);
      // Electric-piano chord on beats 1 and the "and" of 2
      if (step === 0 || step === 3) for (const s of ch.chord) this.tone(f(ch.root + s), 0.9, 'sine', 0.05, t, this.music);
      // Walking bass
      const walk = [0, 7, 12, 10, 7, 5, 3, 2];
      if (step % 2 === 0) this.tone(f(ch.root - 12 + walk[step]), spb * 1.8, 'triangle', 0.12, t, this.music);
      // Brushed hats
      this.noise(0.05, step % 2 ? 0.02 : 0.035, 'highpass', 7000, t, this.music);
      if (this.intensity > 0.5 && (step === 2 || step === 6)) this.noise(0.12, 0.05, 'bandpass', 1800, t, this.music, 1.5);
      // Occasional melody sparkle
      if (step === 6 && Math.random() < 0.45) this.tone(f(ch.root + 24 + ch.chord[Math.floor(Math.random() * 4)]), 0.5, 'sine', 0.025, t, this.music);
      this.nextBeat += spb;
      this.beat++;
    }
  }
}

export const audio = new AudioEngine();
export type { Sfx };
