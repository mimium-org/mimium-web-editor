export class WaveformScope {
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly logicalW: number;
  private readonly logicalH: number;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get 2D context from waveform canvas");
    }
    this.ctx2d = ctx;

    const dpr = window.devicePixelRatio || 1;
    this.logicalW = canvas.clientWidth || 300;
    this.logicalH = canvas.clientHeight || 52;
    canvas.width = Math.round(this.logicalW * dpr);
    canvas.height = Math.round(this.logicalH * dpr);
    ctx.scale(dpr, dpr);

    this.drawEmpty();
  }

  update(left: Float32Array, right: Float32Array): void {
    const ctx = this.ctx2d;
    const w = this.logicalW;
    const h = this.logicalH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#121824";
    ctx.fillRect(0, 0, w, h);

    const mid = h / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    this.drawWave(left, "#4EC9B0", 0.85);
    this.drawWave(right, "#569CD6", 0.85);
  }

  reset(): void {
    this.drawEmpty();
  }

  private drawWave(data: Float32Array, color: string, gain: number): void {
    const ctx = this.ctx2d;
    const w = this.logicalW;
    const h = this.logicalH;
    const mid = h / 2;
    const amp = (h * 0.42) * gain;

    if (data.length === 0) {
      return;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();

    for (let x = 0; x < w; x += 1) {
      const i = Math.floor((x / (w - 1)) * (data.length - 1));
      const y = mid - (data[i] * amp);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  private drawEmpty(): void {
    const ctx = this.ctx2d;
    const w = this.logicalW;
    const h = this.logicalH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#121824";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }
}
