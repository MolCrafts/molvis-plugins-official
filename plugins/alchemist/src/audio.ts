export class AlchemistAudio {
  private context: AudioContext | null = null;
  private lastCollisionAt = 0;

  constructor(private muted: boolean) {}

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (value && this.context?.state === "running") {
      void this.context.suspend();
    } else if (!value && this.context?.state === "suspended") {
      void this.context.resume();
    }
  }

  unlock(): void {
    if (this.muted) return;
    const AudioContextConstructor = globalThis.AudioContext;
    if (!AudioContextConstructor) return;
    this.context ??= new AudioContextConstructor();
    if (this.context.state === "suspended") void this.context.resume();
  }

  click(): void {
    this.tone(320, 0.045, "sine", 0.025);
  }

  drop(rank: number): void {
    this.tone(125 + rank * 7, 0.07, "triangle", 0.04);
  }

  collision(intensity: number): void {
    const now = performance.now();
    if (now - this.lastCollisionAt < 75 || intensity < 90) return;
    this.lastCollisionAt = now;
    this.tone(
      Math.min(260, 90 + intensity * 0.24),
      0.035,
      "sine",
      Math.min(0.028, intensity / 9000),
    );
  }

  merge(rank: number, combo: number): void {
    this.tone(250 + rank * 18, 0.12, "sine", 0.055);
    globalThis.setTimeout(() => {
      this.tone(360 + rank * 20 + combo * 14, 0.16, "triangle", 0.04);
    }, 45);
  }

  tool(): void {
    this.tone(520, 0.08, "square", 0.032);
    globalThis.setTimeout(() => this.tone(690, 0.09, "sine", 0.025), 35);
  }

  win(): void {
    [392, 494, 587, 784].forEach((frequency, index) => {
      globalThis.setTimeout(
        () => this.tone(frequency, 0.25, "triangle", 0.055),
        index * 110,
      );
    });
  }

  lose(): void {
    [220, 185, 147].forEach((frequency, index) => {
      globalThis.setTimeout(
        () => this.tone(frequency, 0.23, "sine", 0.045),
        index * 105,
      );
    });
  }

  destroy(): void {
    if (this.context) void this.context.close();
    this.context = null;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context || context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
