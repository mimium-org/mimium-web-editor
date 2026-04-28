import type { MimiumProcessorNode } from "@mimium/mimium-webaudio";

const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const mimiumProcessorUrl = `${baseUrl}assets/audioprocessor.mjs`;

type MimiumWebAudioModule = {
  setupMimiumAudioWorklet: (
    ctx: AudioContext,
    src: string,
    processorUrl: string,
    options?: { libBaseUrl?: string; moduleBaseUrl?: string },
  ) => Promise<MimiumProcessorNode>;
  preloadMimiumLibCache?: (options?: { libBaseUrl?: string }) => Promise<void>;
  transpileMimiumToRust: (source: string) => Promise<string>;
};

const nativeTextEncoder = globalThis.TextEncoder;
const nativeTextDecoder = globalThis.TextDecoder;
let mimiumWebAudioModulePromise: Promise<MimiumWebAudioModule> | null = null;

export { mimiumProcessorUrl };

export async function loadMimiumWebAudioModule(): Promise<MimiumWebAudioModule> {
  if (!mimiumWebAudioModulePromise) {
    mimiumWebAudioModulePromise = import("@mimium/mimium-webaudio").then((mod) => {
      // mimium-webaudio may polyfill TextEncoder/TextDecoder while initializing wasm.
      // Restore native constructors so Monaco's text rendering/token layout stays stable.
      if (nativeTextEncoder) {
        globalThis.TextEncoder = nativeTextEncoder;
      }
      if (nativeTextDecoder) {
        globalThis.TextDecoder = nativeTextDecoder;
      }
      return mod as MimiumWebAudioModule;
    });
  }
  return mimiumWebAudioModulePromise;
}

export async function convertMimiumSourceToRust(source: string): Promise<string> {
  const mimiumWebAudio = await loadMimiumWebAudioModule();
  const rustSource = await mimiumWebAudio.transpileMimiumToRust(source);

  if (nativeTextEncoder) {
    globalThis.TextEncoder = nativeTextEncoder;
  }
  if (nativeTextDecoder) {
    globalThis.TextDecoder = nativeTextDecoder;
  }

  return rustSource;
}
