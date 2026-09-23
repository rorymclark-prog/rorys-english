export type AwakeState = "idle" | "held" | "unavailable" | "released";
type Lock = Pick<WakeLockSentinel, "released" | "release" | "addEventListener">;
// A released sentinel cannot be reused. Also dispose requests that resolve
// after End/unmount, so cancelling never leaves the screen held awake.
export class ScreenAwake {
  private lock: Lock | null = null;
  private active = false;
  private epoch = 0;
  private pending: number | null = null;
  constructor(
    private request: (() => Promise<Lock>) | undefined,
    private visible: () => boolean,
    private changed: (state: AwakeState) => void,
  ) {}
  start() { this.active = true; return this.resume(); }
  async resume() {
    if (!this.active || !this.visible() || (this.lock && !this.lock.released) || this.pending === this.epoch) return;
    if (!this.request) { this.changed("unavailable"); return; }
    const epoch = this.epoch;
    this.pending = epoch;
    try {
      const lock = await this.request();
      if (!this.active || epoch !== this.epoch || !this.visible()) { await lock.release(); return; }
      this.lock = lock;
      lock.addEventListener("release", () => {
        if (this.lock !== lock) return;
        this.lock = null;
        if (this.active) this.changed("released");
      });
      if (lock.released) { this.lock = null; this.changed("released"); }
      else this.changed("held");
    } catch { if (this.active && epoch === this.epoch) this.changed("unavailable"); }
    finally { if (this.pending === epoch) this.pending = null; }
  }
  stop() {
    this.active = false;
    this.epoch++;
    this.pending = null;
    const lock = this.lock;
    this.lock = null;
    if (lock) void lock.release().catch(() => {});
    this.changed("idle");
  }
}
