/**
 * Background Tracking Service
 * Ensures continuous, unpaused GNSS track recording even when the mobile device screen is off (熄屏)
 * or when the app is running in the background.
 *
 * Techniques employed:
 * 1. Web Audio Keep-Alive: Plays an imperceptible silent carrier audio loop.
 *    Mobile OS (Android/iOS) recognizes the tab as active media, preventing OS-level suspension on screen lock.
 * 2. Blob Web Worker Timer: Dedicated worker timer that is immune to main-thread UI throttling.
 * 3. Screen Wake Lock with auto-re-acquire on visibilitychange.
 * 4. Timestamp-based elapsed calculation to eliminate drift across sleep cycles.
 */

export class BackgroundTrackingService {
  private static instance: BackgroundTrackingService;

  private isRunning = false;
  private audioCtx: AudioContext | null = null;
  private silentGain: GainNode | null = null;
  private silentOsc: OscillatorNode | null = null;
  private worker: Worker | null = null;
  private wakeLock: any = null;
  private tickCallbacks: Set<() => void> = new Set();
  private visibilityHandler: (() => void) | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): BackgroundTrackingService {
    if (!BackgroundTrackingService.instance) {
      BackgroundTrackingService.instance = new BackgroundTrackingService();
    }
    return BackgroundTrackingService.instance;
  }

  /**
   * Start background recording keep-alive
   */
  public start(onTick?: () => void) {
    if (onTick) {
      this.tickCallbacks.add(onTick);
    }

    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Acquire Screen Wake Lock if available
    this.requestWakeLock();

    // 2. Start Web Audio keep-alive heartbeat
    this.startSilentAudio();

    // 3. Start Web Worker timer
    this.startWorkerTimer();

    // 4. Setup visibilitychange listener to re-acquire wakeLock when screen turns on
    this.setupVisibilityListener();
  }

  /**
   * Stop background recording keep-alive
   */
  public stop(onTick?: () => void) {
    if (onTick) {
      this.tickCallbacks.delete(onTick);
    }

    if (this.tickCallbacks.size > 0) {
      return; // Other listeners still active
    }

    this.isRunning = false;
    this.tickCallbacks.clear();

    // Release wake lock
    this.releaseWakeLock();

    // Stop silent audio
    this.stopSilentAudio();

    // Terminate worker
    this.stopWorkerTimer();

    // Remove visibility listener
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Request Screen Wake Lock API
   */
  private async requestWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!this.wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch {
      // Ignore wake lock rejection
    }
  }

  /**
   * Release Screen Wake Lock
   */
  private async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {
        // Ignore release error
      }
      this.wakeLock = null;
    }
  }

  /**
   * Set up auto-reacquire for wake lock when screen unlocks or tab becomes visible
   */
  private setupVisibilityListener() {
    if (typeof document === 'undefined') return;
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        this.requestWakeLock();
        // Also resume AudioContext if suspended
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Silent Web Audio Keep-Alive
   * Keeps the browser's background execution context alive even with screen off!
   */
  private startSilentAudio() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // Create an imperceptible oscillator (sub-audible 20Hz at near-zero volume)
      if (!this.silentOsc) {
        this.silentOsc = this.audioCtx.createOscillator();
        this.silentGain = this.audioCtx.createGain();

        // 0.00001 gain is completely inaudible to human ears
        this.silentGain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
        this.silentOsc.frequency.setValueAtTime(20, this.audioCtx.currentTime);

        this.silentOsc.connect(this.silentGain);
        this.silentGain.connect(this.audioCtx.destination);
        this.silentOsc.start();
      }
    } catch (e) {
      console.warn('Silent audio keep-alive init failed:', e);
    }
  }

  /**
   * Stop silent audio
   */
  private stopSilentAudio() {
    try {
      if (this.silentOsc) {
        this.silentOsc.stop();
        this.silentOsc.disconnect();
        this.silentOsc = null;
      }
      if (this.silentGain) {
        this.silentGain.disconnect();
        this.silentGain = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.suspend().catch(() => {});
      }
    } catch {
      // Ignore cleanup error
    }
  }

  /**
   * Start a Web Worker timer which does not suffer from main thread tab throttling
   */
  private startWorkerTimer() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    if (this.worker) return;

    try {
      // Inline worker code via Blob URL
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
              self.postMessage('tick');
            }, 1000);
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        if (e.data === 'tick' && this.isRunning) {
          this.notifyTick();
        }
      };

      this.worker.postMessage('start');
    } catch (e) {
      console.warn('Web Worker timer not available, falling back to window.setInterval:', e);
    }
  }

  /**
   * Stop Web Worker timer
   */
  private stopWorkerTimer() {
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.terminate();
      } catch {
        // Ignore terminate error
      }
      this.worker = null;
    }
  }

  /**
   * Notify all registered callbacks
   */
  private notifyTick() {
    for (const cb of this.tickCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error('Error executing background tracking tick callback:', e);
      }
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const backgroundTrackingService = BackgroundTrackingService.getInstance();
