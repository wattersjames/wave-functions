/** Complex number as separate components (no external deps). */
export type C = { re: number; im: number };

export const cadd = (a: C, b: C): C => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

export const cscale = (s: number, a: C): C => ({
  re: s * a.re,
  im: s * a.im,
});

export const cmul = (a: C, b: C): C => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

/** exp(-i θ) = cos θ − i sin θ */
export const cmExpNegI = (theta: number): C => ({
  re: Math.cos(theta),
  im: -Math.sin(theta),
});

export const cabsSq = (a: C): number => a.re * a.re + a.im * a.im;

export const creal = (a: C): C => ({ re: a.re, im: 0 });

/** Infinite square well on 0 < x < 1 (L = 1); eigenfunctions √(2) sin(nπx). */
function boxSpatial(n: number, x: number): C {
  if (x <= 0 || x >= 1) return { re: 0, im: 0 };
  const s = Math.sqrt(2) * Math.sin(n * Math.PI * x);
  return { re: s, im: 0 };
}

export type WavePresetId =
  | "box-n1"
  | "box-n2"
  | "superpose-12"
  | "traveling"
  | "standing";

export type WavePreset = {
  id: WavePresetId;
  label: string;
  blurb: string;
  /** KaTeX math (display mode) */
  latex: string;
  /** x in [0,1] on the well / domain; t is dimensionless evolution time */
  psi: (x: number, t: number) => C;
};

/**
 * Energy units: E_n = n² (so E₁ = 1). Time t multiplies E/ℏ in the phase exp(−i E t / ℏ).
 */
export const PRESETS: WavePreset[] = [
  {
    id: "box-n1",
    label: "Infinite well, n = 1",
    blurb:
      "Lowest stationary state: probability density |ψ|² is static; real and imaginary parts oscillate out of phase.",
    latex: String.raw`\psi(x,t)=\sqrt{2}\,\sin(\pi x)\,e^{-i t}\qquad 0<x<1`,
    psi: (x, t) => cmul(boxSpatial(1, x), cmExpNegI(t)),
  },
  {
    id: "box-n2",
    label: "Infinite well, n = 2",
    blurb: "Second mode: one interior node, higher energy (phase oscillates four times faster than n = 1).",
    latex: String.raw`\psi(x,t)=\sqrt{2}\,\sin(2\pi x)\,e^{-4 i t}\qquad 0<x<1`,
    psi: (x, t) => cmul(boxSpatial(2, x), cmExpNegI(4 * t)),
  },
  {
    id: "superpose-12",
    label: "Superposition n = 1 + 2",
    blurb:
      "Equal-weight superposition: |ψ|² ‘sloshes’ as relative phase evolves (beat between E₂ − E₁ = 3).",
    latex: String.raw`\psi(x,t)=\frac{1}{\sqrt{2}}\Big(\psi_1(x)e^{-it}+\psi_2(x)e^{-4it}\Big)`,
    psi: (x, t) => {
      const p1 = cmul(boxSpatial(1, x), cmExpNegI(t));
      const p2 = cmul(boxSpatial(2, x), cmExpNegI(4 * t));
      const inv = 1 / Math.sqrt(2);
      return cadd(cscale(inv, p1), cscale(inv, p2));
    },
  },
  {
    id: "traveling",
    label: "Traveling plane wave (real)",
    blurb: "Classical-style propagating disturbance cos(kx − ωt) with k = 6π, ω = 2π on the segment.",
    latex: String.raw`\psi(x,t)=\cos(6\pi x-2\pi t)\qquad 0\le x\le 1`,
    psi: (x, t) => {
      const v = Math.cos(6 * Math.PI * x - 2 * Math.PI * t);
      return { re: v, im: 0 };
    },
  },
  {
    id: "standing",
    label: "Standing wave (real)",
    blurb: "Superposition of left- and right-moving waves: fixed nodes, synchronous amplitude oscillation.",
    latex: String.raw`\psi(x,t)=\sin(4\pi x)\cos(3\pi t)\qquad 0\le x\le 1`,
    psi: (x, t) => ({
      re: Math.sin(4 * Math.PI * x) * Math.cos(3 * Math.PI * t),
      im: 0,
    }),
  },
];

export function findPreset(id: WavePresetId): WavePreset {
  const p = PRESETS.find((q) => q.id === id);
  if (!p) return PRESETS[0];
  return p;
}
