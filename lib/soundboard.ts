'use client';

// GGL LIVE — COMPLETE PRODUCTION AUDIO ENGINE
// Full dual-engine architecture:
// 1. Primary: Real HTML5 Audio elements loaded from /audio/ggl_[name].wav
// 2. Secondary / Fallback: Web Audio API synthesis to guarantee zero silence even on network drop
// 3. Features: Master Volume, Mute All, Ducking, Infinite Loop Prevention, Autoplay Unlock, State Listeners

export type SoundType = 'THEME' | 'ENTRY' | 'LAUGH' | 'APPLAUSE' | 'SUSPENSE' | 'WINNER';
export type SoundState = 'READY' | 'LOADING' | 'PLAYING' | 'ERROR';

export interface SoundConfig {
  id: SoundType;
  label: string;
  filename: string;
  defaultVolume: number;
  loop?: boolean;
}

export const SOUND_CONFIGS: SoundConfig[] = [
  { id: 'THEME', label: 'Show Theme', filename: '/audio/ggl_theme.wav', defaultVolume: 0.85, loop: true },
  { id: 'ENTRY', label: 'Entrance Fanfare', filename: '/audio/ggl_entry.wav', defaultVolume: 0.95 },
  { id: 'LAUGH', label: 'Comedy Rimshot', filename: '/audio/ggl_laugh.wav', defaultVolume: 0.90 },
  { id: 'APPLAUSE', label: 'Audience Applause', filename: '/audio/ggl_applause.wav', defaultVolume: 0.90 },
  { id: 'SUSPENSE', label: 'Suspense Drum', filename: '/audio/ggl_suspense.wav', defaultVolume: 1.0 },
  { id: 'WINNER', label: 'Winner Celebration', filename: '/audio/ggl_winner.wav', defaultVolume: 1.0 },
];

class SoundEngine {
  private audioElements: Map<SoundType, HTMLAudioElement> = new Map();
  private trackStates: Map<SoundType, SoundState> = new Map();
  private masterVolume: number = 0.85;
  private previousVolume: number = 0.85;
  private isMuted: boolean = false;
  private isAudioUnlocked: boolean = false;
  private stateListeners: Set<(states: Record<SoundType, SoundState>, masterVol: number, muted: boolean, unlocked: boolean) => void> = new Set();
  private duckInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initEngine();
    }
  }

  private initEngine() {
    SOUND_CONFIGS.forEach(cfg => {
      this.trackStates.set(cfg.id, 'READY');
      try {
        const audio = new Audio(cfg.filename);
        audio.preload = 'auto';
        audio.loop = !!cfg.loop;

        audio.addEventListener('play', () => {
          this.trackStates.set(cfg.id, 'PLAYING');
          this.notifyListeners();
        });

        audio.addEventListener('ended', () => {
          this.trackStates.set(cfg.id, 'READY');
          this.restoreThemeVolume();
          this.notifyListeners();
        });

        audio.addEventListener('pause', () => {
          if (this.trackStates.get(cfg.id) !== 'ERROR') {
            this.trackStates.set(cfg.id, 'READY');
          }
          this.notifyListeners();
        });

        audio.addEventListener('error', () => {
          console.warn(`Audio asset failed to load: ${cfg.filename}. Will use dynamic synthesizer fallback.`);
          this.trackStates.set(cfg.id, 'READY'); // Keep operational with synth
          this.notifyListeners();
        });

        this.audioElements.set(cfg.id, audio);
      } catch (err) {
        console.error(`Error initializing audio for ${cfg.id}:`, err);
        this.trackStates.set(cfg.id, 'READY');
      }
    });
  }

  // Autoplay Unlock
  public unlockAudio(): boolean {
    try {
      this.isAudioUnlocked = true;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
      this.notifyListeners();
      return true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      return false;
    }
  }

  public isUnlocked(): boolean {
    return this.isAudioUnlocked;
  }

  // Master Volume (0.0 to 1.0)
  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterVolume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.applyVolumeToAll();
    this.notifyListeners();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  // Mute All / Unmute Toggle
  public toggleMute(): boolean {
    if (this.isMuted) {
      this.isMuted = false;
      this.masterVolume = this.previousVolume > 0 ? this.previousVolume : 0.85;
    } else {
      this.previousVolume = this.masterVolume;
      this.isMuted = true;
      this.masterVolume = 0;
    }
    this.applyVolumeToAll();
    this.notifyListeners();
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private applyVolumeToAll() {
    this.audioElements.forEach((audio, id) => {
      const cfg = SOUND_CONFIGS.find(c => c.id === id);
      const baseVol = cfg?.defaultVolume ?? 1.0;
      audio.volume = this.isMuted ? 0 : this.masterVolume * baseVol;
    });
  }

  // Ducking logic: Reduce THEME volume when foreground cues play
  private duckTheme() {
    const themeAudio = this.audioElements.get('THEME');
    if (!themeAudio || themeAudio.paused) return;

    const targetVol = this.isMuted ? 0 : this.masterVolume * 0.15;
    if (this.duckInterval) clearInterval(this.duckInterval);

    this.duckInterval = setInterval(() => {
      if (themeAudio.volume > targetVol + 0.05) {
        themeAudio.volume = Math.max(0, themeAudio.volume - 0.08);
      } else {
        themeAudio.volume = targetVol;
        clearInterval(this.duckInterval);
      }
    }, 40);
  }

  private restoreThemeVolume() {
    // Only restore if no other foreground sounds are playing
    const anyForegroundPlaying = ['ENTRY', 'SUSPENSE', 'WINNER'].some(id => {
      const a = this.audioElements.get(id as SoundType);
      return a && !a.paused;
    });

    if (anyForegroundPlaying) return;

    const themeAudio = this.audioElements.get('THEME');
    if (!themeAudio || themeAudio.paused) return;

    const cfg = SOUND_CONFIGS.find(c => c.id === 'THEME');
    const targetVol = this.isMuted ? 0 : this.masterVolume * (cfg?.defaultVolume ?? 0.85);

    if (this.duckInterval) clearInterval(this.duckInterval);
    this.duckInterval = setInterval(() => {
      if (themeAudio.volume < targetVol - 0.05) {
        themeAudio.volume = Math.min(1, themeAudio.volume + 0.08);
      } else {
        themeAudio.volume = targetVol;
        clearInterval(this.duckInterval);
      }
    }, 40);
  }

  // Play Sound
  public play(id: SoundType) {
    this.unlockAudio();

    // Prevent duplicate THEME instances: if already playing, toggling can stop it or do nothing
    if (id === 'THEME') {
      const themeAudio = this.audioElements.get('THEME');
      if (themeAudio && !themeAudio.paused) {
        this.stop('THEME');
        return;
      }
    }

    // Duck THEME for major announcements
    if (['ENTRY', 'SUSPENSE', 'WINNER'].includes(id)) {
      this.duckTheme();
    }

    const audio = this.audioElements.get(id);
    const cfg = SOUND_CONFIGS.find(c => c.id === id);

    if (audio) {
      try {
        audio.currentTime = 0;
        audio.volume = this.isMuted ? 0 : this.masterVolume * (cfg?.defaultVolume ?? 1.0);
        this.trackStates.set(id, 'LOADING');
        this.notifyListeners();

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.trackStates.set(id, 'PLAYING');
              this.notifyListeners();
            })
            .catch(err => {
              console.warn(`HTML5 audio playback error on ${id}, falling back to Web Audio synthesis:`, err);
              this.playSynthFallback(id);
            });
        }
      } catch (e) {
        this.playSynthFallback(id);
      }
    } else {
      this.playSynthFallback(id);
    }
  }

  // Stop Individual Sound
  public stop(id: SoundType) {
    const audio = this.audioElements.get(id);
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    }
    this.trackStates.set(id, 'READY');
    this.restoreThemeVolume();
    this.notifyListeners();
  }

  // EMERGENCY STOP ALL AUDIO
  public stopAll() {
    this.audioElements.forEach((audio, id) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
      this.trackStates.set(id, 'READY');
    });

    if (this.duckInterval) clearInterval(this.duckInterval);
    this.notifyListeners();
  }

  // State Listener Registration
  public subscribe(callback: (states: Record<SoundType, SoundState>, masterVol: number, muted: boolean, unlocked: boolean) => void) {
    this.stateListeners.add(callback);
    callback(this.getAllStates(), this.masterVolume, this.isMuted, this.isAudioUnlocked);
    return () => this.stateListeners.delete(callback);
  }

  private notifyListeners() {
    const states = this.getAllStates();
    this.stateListeners.forEach(cb => cb(states, this.masterVolume, this.isMuted, this.isAudioUnlocked));
  }

  public getAllStates(): Record<SoundType, SoundState> {
    const res: any = {};
    SOUND_CONFIGS.forEach(c => {
      res[c.id] = this.trackStates.get(c.id) || 'READY';
    });
    return res;
  }

  // Synthetic Audio Fallback to ensure sound NEVER fails even if files are missing
  private playSynthFallback(type: SoundType) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const vol = this.isMuted ? 0 : this.masterVolume * 0.4;
      this.trackStates.set(type, 'PLAYING');
      this.notifyListeners();

      if (type === 'THEME') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 8);
      } else if (type === 'ENTRY') {
        [261.63, 329.63, 392, 523.25].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(f, now + i * 0.25);
          gain.gain.setValueAtTime(vol, now + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.25);
          osc.stop(now + i * 0.25 + 0.8);
        });
      } else if (type === 'WINNER') {
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(f, now + i * 0.25);
          gain.gain.setValueAtTime(vol * 1.2, now + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 1.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.25);
          osc.stop(now + i * 0.25 + 1.5);
        });
      } else if (type === 'SUSPENSE') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.linearRampToValueAtTime(140, now + 4);
        gain.gain.setValueAtTime(vol * 0.5, now);
        gain.gain.linearRampToValueAtTime(vol, now + 3.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 4.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 4.2);
      } else if (type === 'APPLAUSE') {
        const bufferSize = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 2.5));
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === 'LAUGH') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }

      setTimeout(() => {
        this.trackStates.set(type, 'READY');
        this.notifyListeners();
      }, 3500);
    } catch (e) {
      console.error('Synth fallback error:', e);
      this.trackStates.set(type, 'ERROR');
      this.notifyListeners();
    }
  }
}

// Global Singleton Instance
let soundEngineInstance: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!soundEngineInstance) {
    soundEngineInstance = new SoundEngine();
  }
  return soundEngineInstance;
}

export function playSound(type: SoundType | 'STOP') {
  if (type === 'STOP') {
    getSoundEngine().stopAll();
    return;
  }
  getSoundEngine().play(type);
}

export function stopAllSounds() {
  getSoundEngine().stopAll();
}
