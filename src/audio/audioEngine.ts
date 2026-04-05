import type { MimiumProcessorNode } from "@mimium/mimium-webaudio";
import { loadMimiumWebAudioModule, mimiumProcessorUrl } from "./mimiumModule";

export type RuntimeSampleInfo = {
  contextSampleRate: number;
  compileSampleRate: number | null;
  compileBufferSize: number | null;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private mimiumNode: MimiumProcessorNode | null = null;
  private mainGain: GainNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private _isPlaying = false;
  private compileData: unknown = null;
  private runtimeSampleInfo: RuntimeSampleInfo | null = null;
  private mainVolume = 1.0;

  async play(src: string): Promise<void> {
    if (this.ctx || this.mimiumNode) {
      await this.stop();
    }

    const ctx = new AudioContext({ latencyHint: "interactive" });
    try {
      const mimiumWebAudio = await loadMimiumWebAudioModule();
      const node = await mimiumWebAudio.setupMimiumAudioWorklet(ctx, src, mimiumProcessorUrl);
      this.compileData = (node as unknown as { data?: unknown }).data ?? null;
      const compileData = this.compileData as { samplerate?: number; buffersize?: number } | null;

      const analyserL = ctx.createAnalyser();
      const analyserR = ctx.createAnalyser();
      analyserL.fftSize = 2048;
      analyserR.fftSize = 2048;

      const mainGain = ctx.createGain();
      mainGain.gain.value = this.mainVolume;
      node.connect(mainGain);
      mainGain.connect(ctx.destination);

      const splitter = ctx.createChannelSplitter(2);
      mainGain.connect(splitter);
      splitter.connect(analyserL, 0, 0);
      splitter.connect(analyserR, 1, 0);

      if (ctx.state !== "running") {
        await ctx.resume();
      }
      if (ctx.state !== "running") {
        throw new Error(`AudioContext is not running (state: ${ctx.state})`);
      }

      this.ctx = ctx;
      this.mimiumNode = node;
      this.mainGain = mainGain;
      this.analyserL = analyserL;
      this.analyserR = analyserR;
      this._isPlaying = true;
      this.runtimeSampleInfo = {
        contextSampleRate: ctx.sampleRate,
        compileSampleRate: compileData?.samplerate ?? null,
        compileBufferSize: compileData?.buffersize ?? null,
      };

      if (
        this.runtimeSampleInfo.compileSampleRate !== null
        && this.runtimeSampleInfo.compileSampleRate !== this.runtimeSampleInfo.contextSampleRate
      ) {
        console.warn("[mimium-editor] compile/context sample-rate mismatch", this.runtimeSampleInfo);
      }
    } catch (err) {
      void ctx.close().catch(() => undefined);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.mimiumNode) {
      this.mimiumNode.disconnect();
    }
    if (this.mainGain) {
      this.mainGain.disconnect();
    }

    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
    this.mimiumNode = null;
    this.mainGain = null;
    this.analyserL = null;
    this.analyserR = null;
    this._isPlaying = false;
    this.compileData = null;
    this.runtimeSampleInfo = null;
  }

  update(src: string): void {
    if (!this.mimiumNode || !this.compileData) {
      return;
    }
    this.mimiumNode.port.postMessage({
      type: "compile",
      data: {
        ...(this.compileData as object),
        src,
      },
    });
  }

  getLevels(): { left: number; right: number } {
    const measure = (analyser: AnalyserNode | null): number => {
      if (!analyser) {
        return 0;
      }
      const arr = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(arr);
      let sum = 0;
      for (let i = 0; i < arr.length; i += 1) {
        sum += arr[i] * arr[i];
      }
      return Math.sqrt(sum / arr.length);
    };

    return {
      left: measure(this.analyserL),
      right: measure(this.analyserR),
    };
  }

  getWaveforms(): { left: Float32Array; right: Float32Array } {
    const leftLen = this.analyserL?.fftSize ?? 2048;
    const rightLen = this.analyserR?.fftSize ?? 2048;
    const left = new Float32Array(leftLen);
    const right = new Float32Array(rightLen);
    this.analyserL?.getFloatTimeDomainData(left);
    this.analyserR?.getFloatTimeDomainData(right);
    return { left, right };
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  getSampleInfo(): RuntimeSampleInfo | null {
    return this.runtimeSampleInfo;
  }

  setMainVolume(volume: number): void {
    const normalized = Number.isFinite(volume) ? Math.max(0, Math.min(3.2, volume)) : this.mainVolume;
    this.mainVolume = normalized;
    if (this.mainGain) {
      this.mainGain.gain.value = normalized;
    }
  }
}
