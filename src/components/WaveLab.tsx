"use client";

import { useEffect, useRef, useState } from "react";
import type { WavePresetId } from "@/lib/wavePhysics";
import { PRESETS, cabsSq, findPreset } from "@/lib/wavePhysics";
import { EquationExplainer } from "./EquationExplainer";
import { MathBlock } from "./MathBlock";

const CANVAS_W = 900;
const CANVAS_H = 420;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 40;

function drawFrame(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  presetId: WavePresetId,
  t: number,
) {
  const preset = findPreset(presetId);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const plotW = CANVAS_W - PAD_L - PAD_R;
  const plotH = CANVAS_H - PAD_T - PAD_B;
  const midY = PAD_T + plotH / 2;
  const ampScale = plotH * 0.38;

  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const bg = isDark ? "#0a0a0a" : "#fafafa";
  const grid = isDark ? "#262626" : "#e5e5e5";
  const axis = isDark ? "#525252" : "#737373";
  const text = isDark ? "#a3a3a3" : "#525252";
  const colRe = isDark ? "#38bdf8" : "#0284c7";
  const colIm = isDark ? "#fb923c" : "#c2410c";
  const colProb = isDark ? "rgba(167, 139, 250, 0.35)" : "rgba(124, 58, 237, 0.25)";
  const colBarrier = isDark ? "rgba(250, 204, 21, 0.16)" : "rgba(202, 138, 4, 0.16)";
  const colBarrierEdge = isDark ? "rgba(250, 204, 21, 0.55)" : "rgba(161, 98, 7, 0.45)";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (preset.barriers?.length) {
    for (const barrier of preset.barriers) {
      const x0 = PAD_L + barrier.start * plotW;
      const w = (barrier.end - barrier.start) * plotW;
      ctx.fillStyle = colBarrier;
      ctx.fillRect(x0, PAD_T, w, plotH);
      ctx.strokeStyle = colBarrierEdge;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, PAD_T);
      ctx.lineTo(x0, PAD_T + plotH);
      ctx.moveTo(x0 + w, PAD_T);
      ctx.lineTo(x0 + w, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = text;
      ctx.font = "12px var(--font-geist-sans), system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(barrier.label, x0 + w / 2, PAD_T + 14);
    }
  }

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + plotW, y);
    ctx.stroke();
  }
  ctx.strokeStyle = axis;
  ctx.beginPath();
  ctx.moveTo(PAD_L, midY);
  ctx.lineTo(PAD_L + plotW, midY);
  ctx.stroke();

  ctx.fillStyle = text;
  ctx.font = "12px var(--font-geist-sans), system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("0", PAD_L, CANVAS_H - 12);
  ctx.fillText("1", PAD_L + plotW, CANVAS_H - 12);
  ctx.textAlign = "left";
  ctx.fillText("x (normalized)", PAD_L + plotW / 2 - 36, CANVAS_H - 12);

  const nSamples = Math.min(900, Math.floor(plotW));
  const prob = new Array<number>(nSamples);
  let maxProb = 1e-9;
  for (let i = 0; i < nSamples; i++) {
    const x = i / (nSamples - 1);
    prob[i] = cabsSq(preset.psi(x, t));
    if (prob[i] > maxProb) maxProb = prob[i];
  }
  const normInv = 1 / maxProb;

  ctx.beginPath();
  ctx.moveTo(PAD_L, midY);
  for (let i = 0; i < nSamples; i++) {
    const xPx = PAD_L + (i / (nSamples - 1)) * plotW;
    const x = i / (nSamples - 1);
    const p = cabsSq(preset.psi(x, t)) * normInv * ampScale;
    ctx.lineTo(xPx, midY - p);
  }
  ctx.lineTo(PAD_L + plotW, midY);
  ctx.closePath();
  ctx.fillStyle = colProb;
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = colRe;
  ctx.beginPath();
  for (let i = 0; i < nSamples; i++) {
    const xPx = PAD_L + (i / (nSamples - 1)) * plotW;
    const x = i / (nSamples - 1);
    const y = midY - preset.psi(x, t).re * ampScale;
    if (i === 0) ctx.moveTo(xPx, y);
    else ctx.lineTo(xPx, y);
  }
  ctx.stroke();

  ctx.strokeStyle = colIm;
  ctx.beginPath();
  for (let i = 0; i < nSamples; i++) {
    const xPx = PAD_L + (i / (nSamples - 1)) * plotW;
    const x = i / (nSamples - 1);
    const y = midY - preset.psi(x, t).im * ampScale;
    if (i === 0) ctx.moveTo(xPx, y);
    else ctx.lineTo(xPx, y);
  }
  ctx.stroke();
}

export function WaveLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presetId, setPresetId] = useState<WavePresetId>("superpose-12");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [explainSignal, setExplainSignal] = useState(0);
  const timeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const preset = findPreset(presetId);

  useEffect(() => {
    let frameId: number | null = null;

    function loop(now: number) {
      if (lastRef.current != null) {
        const dt = (now - lastRef.current) / 1000;
        if (playing) timeRef.current += dt * speed;
      }
      lastRef.current = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const ctx = canvas.getContext("2d");
        if (ctx) drawFrame(ctx, dpr, presetId, timeRef.current);
      }
      frameId = requestAnimationFrame(loop);
      rafRef.current = frameId;
    }

    frameId = requestAnimationFrame(loop);
    rafRef.current = frameId;

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      if (rafRef.current === frameId) rafRef.current = null;
    };
  }, [playing, speed, presetId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Animated wave functions
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Quantum-style examples on a normalized interval: real part (blue), imaginary part
          (orange), and filled |ψ|² (violet, scaled to peak each frame). Shaded gold regions
          mark potential barriers when a preset includes one. Time uses scaled units E₁ = ℏ = 1
          for the well examples.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Preset
          <select
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal outline-none ring-violet-500/40 focus-visible:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
            value={presetId}
            onChange={(e) => {
              setPresetId(e.target.value as WavePresetId);
              timeRef.current = 0;
              lastRef.current = null;
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{preset.blurb}</p>
        <MathBlock key={preset.latex} latex={preset.latex} />

        <div className="flex justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => setExplainSignal((n) => n + 1)}
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500"
          >
            Explain to me
          </button>
        </div>

        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Speed ×{speed.toFixed(2)}
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <canvas ref={canvasRef} className="mx-auto block max-w-full touch-pan-x" />
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-sky-500" /> Re ψ
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-orange-500" /> Im ψ
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm bg-violet-500/40" /> |ψ|² (area)
          </span>
          {preset.barriers?.length ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-sm bg-yellow-500/20 ring-1 ring-yellow-600/40" />
              potential barrier
            </span>
          ) : null}
        </div>
      </div>

      <EquationExplainer key={preset.id} preset={preset} explainSignal={explainSignal} />
    </div>
  );
}
