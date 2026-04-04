const METER_MIN_DB = -60;
const METER_DB_SPAN = 60;

function toDb(v: number): number {
  return v > 0 ? 20 * Math.log10(v) : -Infinity;
}

function normalizeDb(db: number): number {
  return Math.max(0, Math.min(1, (db - METER_MIN_DB) / METER_DB_SPAN));
}

export class SignalMeter {
  static readonly DECAY = 0.88;
  static readonly PEAK_HOLD = 80;
  static readonly PEAK_FALL = 0.94;

  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly logicalW: number;
  private readonly logicalH: number;

  private envL = 0;
  private envR = 0;
  private peakHoldL = 0;
  private peakHoldR = 0;
  private peakTimerL = 0;
  private peakTimerR = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot get 2D context from meter canvas");
    }
    this.ctx2d = ctx;

    const dpr = window.devicePixelRatio || 1;
    this.logicalW = canvas.clientWidth || 240;
    this.logicalH = canvas.clientHeight || 40;
    canvas.width = Math.round(this.logicalW * dpr);
    canvas.height = Math.round(this.logicalH * dpr);
    ctx.scale(dpr, dpr);

    this.draw();
  }

  update(left: number, right: number): void {
    this.envL = Math.max(left, this.envL * SignalMeter.DECAY);
    this.envR = Math.max(right, this.envR * SignalMeter.DECAY);

    if (this.envL >= this.peakHoldL) {
      this.peakHoldL = this.envL;
      this.peakTimerL = SignalMeter.PEAK_HOLD;
    } else if (--this.peakTimerL <= 0) {
      this.peakHoldL *= SignalMeter.PEAK_FALL;
    }

    if (this.envR >= this.peakHoldR) {
      this.peakHoldR = this.envR;
      this.peakTimerR = SignalMeter.PEAK_HOLD;
    } else if (--this.peakTimerR <= 0) {
      this.peakHoldR *= SignalMeter.PEAK_FALL;
    }

    this.draw();
  }

  reset(): void {
    this.envL = 0;
    this.envR = 0;
    this.peakHoldL = 0;
    this.peakHoldR = 0;
    this.peakTimerL = 0;
    this.peakTimerR = 0;
    this.draw();
  }

  private draw(): void {
    const w = this.logicalW;
    const h = this.logicalH;
    const ctx = this.ctx2d;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(0, 0, w, h);

    const labelW = 14;
    const padding = 5;
    const barX = labelW + 4;
    const barW = w - barX - padding;
    const gap = 4;
    const barH = Math.floor((h - gap - padding * 2) / 2);
    const yL = padding;
    const yR = padding + barH + gap;

    this.drawBar(ctx, "L", barX, barW, yL, barH, this.envL, this.peakHoldL);
    this.drawBar(ctx, "R", barX, barW, yR, barH, this.envR, this.peakHoldR);
    this.drawTicks(ctx, barX, barW, yL + barH + gap, barH);
  }

  private drawBar(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    width: number,
    y: number,
    height: number,
    rms: number,
    peak: number,
  ): void {
    const labelX = x - 4;
    ctx.font = `bold ${Math.max(9, height - 2)}px monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillStyle = "#777";
    ctx.fillText(label, labelX, y + height / 2);

    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x, y, width, height);

    const normalized = normalizeDb(toDb(rms));
    const filled = Math.floor(normalized * width);
    if (filled > 0) {
      const grad = ctx.createLinearGradient(x, 0, x + width, 0);
      grad.addColorStop(0, "#4EC9B0");
      grad.addColorStop(0.75, "#CCA700");
      grad.addColorStop(0.9, "#F44747");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, filled, height);
    }

    const peakNorm = normalizeDb(toDb(peak));
    if (peakNorm > 0.01) {
      const px = x + Math.floor(peakNorm * width) - 1;
      ctx.fillStyle = peakNorm > 0.9 ? "#F44747" : peakNorm > 0.75 ? "#CCA700" : "#4EC9B0";
      ctx.fillRect(px, y, 2, height);
    }
  }

  private drawTicks(
    ctx: CanvasRenderingContext2D,
    x: number,
    width: number,
    y: number,
    tickHeight: number,
  ): void {
    const marks = [-48, -36, -24, -12, -6, -3, 0];

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#444";

    for (const db of marks) {
      const tx = x + Math.floor(normalizeDb(db) * width);
      ctx.fillStyle = "#383848";
      ctx.fillRect(tx, y - tickHeight - 1, 1, tickHeight + 3);
      ctx.fillStyle = "#555";
      ctx.textAlign = db === 0 ? "right" : "center";
      ctx.fillText(db === 0 ? "0" : String(db), tx, y);
    }
  }
}
