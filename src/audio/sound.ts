export class Sound {
  private context: AudioContext | null = null;
  muted = false;
  constructor() {
    try { this.muted = localStorage.getItem('huilang:muted') === 'true'; } catch { /* Private browsing remains playable. */ }
  }
  async unlock() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
  }
  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('huilang:muted', String(this.muted)); } catch { /* Optional persistence. */ }
    return this.muted;
  }
  private tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(this.context.destination);
    osc.start(now); osc.stop(now + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  step() { this.tone(440, .11, .025); this.tone(660, .09, .012, .025); }
  mechanism(state: number) {
    const note = [261.63, 293.66, 329.63, 392, 440][state % 5];
    this.tone(note, .8, .055); this.tone(note * 2, .55, .025, .1);
  }
  fail() { this.tone(130.81, .35, .04, 0, 'triangle'); }
  win() { [261.63, 329.63, 392, 523.25].forEach((n, i) => this.tone(n, 1.5, .05, i * .12)); }
}
