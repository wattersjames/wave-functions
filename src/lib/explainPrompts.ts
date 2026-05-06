import type { WavePreset } from "@/lib/wavePhysics";

/** System instructions: fixed “tutor” behavior for all model calls. */
export const WAVE_EXPLAIN_SYSTEM = `You are a patient physics tutor helping a student who is looking at an interactive animation of wave functions ψ(x, t) on a normalized position axis x ∈ [0, 1].

Your job when asked:
1. Explain the displayed equation (symbols, domains, quantum vs classical demos where relevant).
2. Relate the math to the plot: sky = Re ψ, orange = Im ψ, violet fill = |ψ|² (probability density — here peak-normalized per frame so the shape matters more than vertical scale).
3. For stationary states vs superpositions: clarify when |ψ|² moves in time versus when only the phase spins.
4. Use plain language first, then tighter math if helpful. Prefer short paragraphs and bullet-friendly structure without being overly verbose.
5. Never claim the app performs measurements or solves the time-dependent Schrödinger equation numerically unless asked — these are analytic preset formulas scaled for visualization.
6. If the student asks a follow-up, stay focused on the current preset unless they ask to compare to others.`;

export function buildInitialExplainerUserContent(preset: WavePreset): string {
  return `The student clicked "Explain to me" for this preset.

Preset title: ${preset.label}

Short description from the UI: ${preset.blurb}

LaTeX shown on screen (KaTeX):
${preset.latex}

Context for the animation:
- Position x is normalized on [0, 1]. For infinite-well examples, boundary conditions ψ(0)=ψ(1)=0 apply; the traveling/standing demos are classical-style real waves on the same segment for comparison.
- For the square-well presets, use scaled units where the ground-state energy is E₁ = 1 and ℏ = 1, so time evolution uses exp(−i E_n t) with E_n = n² for mode n.

Write a clear explanation the student can read while watching the animation.`;
}

export const INITIAL_USER_FACING_PROMPT = (label: string) =>
  `Explain “${label}” and how to read the plot (Re ψ, Im ψ, and |ψ|²).`;
