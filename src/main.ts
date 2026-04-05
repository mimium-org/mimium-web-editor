import * as monaco from "monaco-editor";
import { AudioEngine } from "./audio/audioEngine";
import { loadMimiumWebAudioModule } from "./audio/mimiumModule";
import { LANGUAGE_ID, registerMimiumLanguage } from "./editor/language";
import { registerThemes } from "./editor/themes";
import { ExampleSidebar } from "./ui/exampleSidebar";
import { SignalMeter } from "./ui/signalMeter";
import { WaveformScope } from "./ui/waveformScope";
import { encodeBase64Url, getSourceFromHash } from "./utils/hashSource";

const DEFAULT_SOURCE = `fn counter(){
  (self+440/samplerate)%1.0
}
fn dsp(){
    let phase = counter()
    sin(phase*6.2831853)
}`;

self.MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string) {
    return new Worker(
      new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    );
  },
};

registerMimiumLanguage();
registerThemes();

const editorContainer = document.getElementById("editorContainer") as HTMLDivElement;
const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const updateBtn = document.getElementById("updateBtn") as HTMLButtonElement;
const shareBtn = document.getElementById("shareBtn") as HTMLButtonElement;
const sidebarToggle = document.getElementById("sidebarToggle") as HTMLButtonElement;
const sidebarEl = document.getElementById("sidebar") as HTMLElement;
const sidebarBackdrop = document.getElementById("sidebarBackdrop") as HTMLElement | null;
const statusDot = document.getElementById("statusDot") as HTMLDivElement;
const statusText = document.getElementById("statusText") as HTMLSpanElement;
const meterCanvas = document.getElementById("meterCanvas") as HTMLCanvasElement;
const scopeCanvas = document.getElementById("scopeCanvas") as HTMLCanvasElement;
const mainVolSlider = document.getElementById("mainVolSlider") as HTMLInputElement;
const mainVolValue = document.getElementById("mainVolValue") as HTMLSpanElement;
const errorPanel = document.getElementById("errorPanel") as HTMLDivElement;
const errorMsg = document.getElementById("errorMsg") as HTMLPreElement;
const errorClose = document.getElementById("errorClose") as HTMLButtonElement;

function getInitialSource(): string {
  const sourceFromUrl = getSourceFromHash();
  if (sourceFromUrl !== null) {
    return sourceFromUrl;
  }
  return DEFAULT_SOURCE;
}

const editor = monaco.editor.create(editorContainer, {
  value: getInitialSource(),
  language: LANGUAGE_ID,
  theme: "mimium-dark",
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontLigatures: false,
  disableMonospaceOptimizations: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 16,
  lineNumbers: "on",
  renderLineHighlight: "line",
  tabSize: 4,
  insertSpaces: true,
  automaticLayout: true,
  padding: { top: 8, bottom: 8 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
});

const meter = new SignalMeter(meterCanvas);
const scope = new WaveformScope(scopeCanvas);
let engine: AudioEngine | null = null;
let meterRaf: number | null = null;
let playingStatusBase = "Playing";
let mainVolumeDb = Number.parseFloat(mainVolSlider.value) || 0;
let shareLabelResetTimer: number | null = null;

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

async function getEngine(): Promise<AudioEngine> {
  if (!engine) {
    engine = new AudioEngine();
    engine.setMainVolume(dbToGain(mainVolumeDb));
  }
  return engine;
}

function renderMainVolumeValue(db: number): void {
  const sign = db >= 0 ? "+" : "";
  mainVolValue.textContent = `${sign}${db.toFixed(1)}dB`;
}

renderMainVolumeValue(mainVolumeDb);

mainVolSlider.addEventListener("input", () => {
  const nextDb = Number.parseFloat(mainVolSlider.value);
  if (!Number.isFinite(nextDb)) {
    return;
  }
  mainVolumeDb = nextDb;
  renderMainVolumeValue(mainVolumeDb);
  engine?.setMainVolume(dbToGain(mainVolumeDb));
});

requestAnimationFrame(() => {
  loadMimiumWebAudioModule()
    .then((mimiumWebAudio) => mimiumWebAudio.preloadMimiumLibCache?.())
    .catch((err) => {
      console.warn("[mimium-editor] lib preload failed (will retry on Play):", err);
    });
});

const sidebar = new ExampleSidebar(
  sidebarEl,
  (source) => {
    editor.setValue(source);
  },
  window.innerWidth >= 768,
  sidebarBackdrop,
);

sidebarToggle.addEventListener("click", () => {
  sidebar.toggle();
  sidebarEl.addEventListener(
    "transitionend",
    () => {
      editor.layout();
    },
    { once: true },
  );
  sidebarToggle.classList.toggle("btn-sidebar--active", sidebar.isOpen);
});
sidebarToggle.classList.toggle("btn-sidebar--active", sidebar.isOpen);

function showError(message: string): void {
  errorMsg.textContent = message;
  errorPanel.classList.add("error-panel--visible");
}

function clearError(): void {
  errorPanel.classList.remove("error-panel--visible");
  errorMsg.textContent = "";
}

errorClose.addEventListener("click", clearError);

function setStatus(text: string, playing: boolean): void {
  statusText.textContent = text;
  statusDot.className = playing ? "status-dot status-dot--playing" : "status-dot";
}

function startMeterLoop(): void {
  if (meterRaf !== null) {
    return;
  }

  const tick = (): void => {
    if (!(engine?.isPlaying)) {
      meterRaf = null;
      meter.reset();
      return;
    }

    const { left, right } = engine.getLevels();
    meter.update(left, right);
    const wave = engine.getWaveforms();
    scope.update(wave.left, wave.right);

    meterRaf = requestAnimationFrame(tick);
  };

  meterRaf = requestAnimationFrame(tick);
}

function stopMeterLoop(): void {
  if (meterRaf !== null) {
    cancelAnimationFrame(meterRaf);
    meterRaf = null;
  }
  meter.reset();
  scope.reset();
}

playBtn.addEventListener("click", async () => {
  const source = editor.getValue();
  if (!source.trim()) {
    setStatus("No source code", false);
    return;
  }

  playBtn.disabled = true;
  clearError();
  setStatus("Compiling…", false);

  try {
    const audioEngine = await getEngine();
    await audioEngine.play(source);
    updateBtn.disabled = false;
    playingStatusBase = "Playing";
    setStatus(playingStatusBase, true);
    startMeterLoop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus("Error", false);
    showError(message);
    console.error("[mimium-editor] Play error:", err);
  } finally {
    playBtn.disabled = false;
  }
});

stopBtn.addEventListener("click", async () => {
  if (engine) {
    await engine.stop();
  }
  stopMeterLoop();
  updateBtn.disabled = true;
  playingStatusBase = "Playing";
  setStatus("Stopped", false);
});

updateBtn.addEventListener("click", () => {
  if (engine) {
    engine.update(editor.getValue());
    playingStatusBase = "Playing";
    setStatus("Code updated", true);
  }
});

shareBtn.addEventListener("click", async () => {
  const source = editor.getValue();
  const encoded = encodeBase64Url(source);
  const url = `${window.location.origin}${window.location.pathname}#src=${encoded}`;
  const defaultShareLabelHtml = "&#128279; Share URL";
  const copiedShareLabelHtml = "&#128279; URL copied";

  window.history.replaceState(null, "", `#src=${encoded}`);
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is not available");
    }
    await navigator.clipboard.writeText(url);
    shareBtn.innerHTML = copiedShareLabelHtml;
    shareBtn.title = "URL copied";
    if (shareLabelResetTimer !== null) {
      window.clearTimeout(shareLabelResetTimer);
    }
    shareLabelResetTimer = window.setTimeout(() => {
      shareBtn.innerHTML = defaultShareLabelHtml;
      shareBtn.title = "Share URL";
      shareLabelResetTimer = null;
    }, 1200);
  } catch {
    prompt("Copy this URL to share:", url);
    shareBtn.innerHTML = defaultShareLabelHtml;
    shareBtn.title = "Share URL";
  }
});

function applySourceFromHash(): void {
  const sourceFromHash = getSourceFromHash();
  if (sourceFromHash !== null) {
    if (editor.getValue() === sourceFromHash) {
      return;
    }
    editor.setValue(sourceFromHash);
  }
}

const originalPushState = history.pushState.bind(history);
history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
  originalPushState(data, unused, url);
  window.dispatchEvent(new Event("locationchange"));
}) as History["pushState"];

const originalReplaceState = history.replaceState.bind(history);
history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
  originalReplaceState(data, unused, url);
  window.dispatchEvent(new Event("locationchange"));
}) as History["replaceState"];

window.addEventListener("hashchange", applySourceFromHash);
window.addEventListener("popstate", applySourceFromHash);
window.addEventListener("locationchange", applySourceFromHash);

window.addEventListener("resize", () => {
  editor.layout();
});
