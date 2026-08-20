/**
 * Native Web Audio API ambient audio synthesizer for Focus Mode.
 *
 * Generates continuous soothing soundscapes (White Noise, Pink Rain,
 * Deep Binaural Alpha Waves, Gentle Stream, Zen Drone) without needing
 * any external MP3/audio files or network downloads.
 */

export type FocusSoundType =
  | 'none'
  | 'white-noise'
  | 'pink-rain'
  | 'binaural-alpha'
  | 'gentle-stream'
  | 'zen-drone';

export interface SoundOption {
  id: FocusSoundType;
  name: string;
  description: string;
  icon: string;
}

export const FOCUS_SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'none',
    name: 'Mute (Silent)',
    description: 'No ambient sound',
    icon: '🔇',
  },
  {
    id: 'pink-rain',
    name: 'Soft Rainfall',
    description: 'Deep soothing pink-noise rain',
    icon: '🌧️',
  },
  {
    id: 'binaural-alpha',
    name: 'Binaural Alpha (10Hz)',
    description: 'Alpha waves for deep cognitive flow',
    icon: '🎧',
  },
  {
    id: 'white-noise',
    name: 'White Noise',
    description: 'Masks background chatter & office noise',
    icon: '💨',
  },
  {
    id: 'gentle-stream',
    name: 'Gentle Brook',
    description: 'Flowing water frequencies',
    icon: '🌊',
  },
  {
    id: 'zen-drone',
    name: 'Cosmic Zen Drone',
    description: 'Harmonic meditative chords',
    icon: '🧘',
  },
];

class FocusAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private currentSound: FocusSoundType = 'none';
  private currentVolume = 0.5;

  public getCurrentSound(): FocusSoundType {
    return this.currentSound;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private stopCurrent() {
    for (const node of this.activeNodes) {
      if (typeof node === 'number') {
        window.clearInterval(node);
      } else {
        try {
          if (
            'stop' in node &&
            typeof (node as AudioScheduledSourceNode).stop === 'function'
          ) {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore disconnect errors
        }
      }
    }
    this.activeNodes = [];
  }

  public setSound(sound: FocusSoundType, volume = 0.5) {
    this.currentSound = sound;
    this.currentVolume = Math.max(0, Math.min(1, volume));

    if (sound === 'none') {
      this.stopCurrent();
      return;
    }

    this.initContext();
    if (!this.ctx) return;

    this.stopCurrent();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      this.currentVolume * 0.4,
      this.ctx.currentTime,
    );
    this.masterGain.connect(this.ctx.destination);
    this.activeNodes.push(this.masterGain);

    switch (sound) {
      case 'white-noise':
        this.playWhiteNoise();
        break;
      case 'pink-rain':
        this.playPinkRain();
        break;
      case 'binaural-alpha':
        this.playBinauralAlpha();
        break;
      case 'gentle-stream':
        this.playGentleStream();
        break;
      case 'zen-drone':
        this.playZenDrone();
        break;
    }
  }

  public play(sound: FocusSoundType, volume = 0.5) {
    this.setSound(sound, volume);
  }

  public stop() {
    this.setSound('none');
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.currentVolume * 0.4,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  public playChime() {
    this.initContext();
    if (!this.ctx) return;

    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + 2.5,
    );
    chimeGain.connect(this.ctx.destination);

    // Warm chord notes (C5, E5, G5, B5)
    const freqs = [523.25, 659.25, 783.99, 987.77];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + idx * 0.12);
      osc.connect(chimeGain);
      osc.start(this.ctx.currentTime + idx * 0.12);
      osc.stop(this.ctx.currentTime + 3.0);
    });
  }

  private playWhiteNoise() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to make white noise less harsh
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  private playPinkRain() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const pinkSource = this.ctx.createBufferSource();
    pinkSource.buffer = noiseBuffer;
    pinkSource.loop = true;

    // Rain lowpass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    pinkSource.connect(filter);
    filter.connect(this.masterGain);
    pinkSource.start();

    this.activeNodes.push(pinkSource, filter);
  }

  private playBinauralAlpha() {
    if (!this.ctx || !this.masterGain) return;
    // Left ear: 200 Hz base carrier
    // Right ear: 210 Hz (+10 Hz Alpha beat)
    const baseFreq = 200;
    const beatFreq = 10;

    const oscLeft = this.ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    const oscRight = this.ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(
      baseFreq + beatFreq,
      this.ctx.currentTime,
    );

    const merger = this.ctx.createChannelMerger(2);
    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);

    merger.connect(this.masterGain);
    oscLeft.start();
    oscRight.start();

    this.activeNodes.push(oscLeft, oscRight, merger);
  }

  private playGentleStream() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(650, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(1.5, this.ctx.currentTime);

    // LFO for wave modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.25, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(200, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    noise.connect(bandpass);
    bandpass.connect(this.masterGain);

    noise.start();
    lfo.start();

    this.activeNodes.push(noise, bandpass, lfo, lfoGain);
  }

  private playZenDrone() {
    if (!this.ctx || !this.masterGain) return;
    // Harmonic warm intervals (D3 146.83Hz, A3 220Hz, D4 293.66Hz, F#4 369.99Hz)
    const tones = [146.83, 220.0, 293.66, 369.99];

    tones.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);

      const toneGain = this.ctx.createGain();
      toneGain.gain.setValueAtTime(0.18 / tones.length, this.ctx.currentTime);

      // Gentle tremolo
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.1 + idx * 0.05, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(toneGain.gain);

      osc.connect(toneGain);
      toneGain.connect(this.masterGain);

      osc.start();
      lfo.start();

      this.activeNodes.push(osc, toneGain, lfo, lfoGain);
    });
  }
}

export const focusAudio = new FocusAudioEngine();
