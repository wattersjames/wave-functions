import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRESETS, cabsSq, cadd, cmExpNegI, cmul, cscale, findPreset } from "../src/lib/wavePhysics.ts";

describe("wavePhysics", () => {
  it("performs basic complex arithmetic", () => {
    assert.deepEqual(cadd({ re: 1, im: 2 }, { re: 3, im: -4 }), { re: 4, im: -2 });
    assert.deepEqual(cscale(2, { re: -1, im: 3 }), { re: -2, im: 6 });
    assert.deepEqual(cmul({ re: 1, im: 2 }, { re: 3, im: 4 }), { re: -5, im: 10 });
    assert.equal(cabsSq({ re: 3, im: 4 }), 25);
  });

  it("uses exp(-iθ) convention", () => {
    const z = cmExpNegI(Math.PI / 2);
    assert.ok(Math.abs(z.re) < 1e-12);
    assert.ok(Math.abs(z.im + 1) < 1e-12);
  });

  it("keeps infinite-well presets at zero on the boundaries", () => {
    for (const id of ["box-n1", "box-n2", "superpose-12"] as const) {
      const preset = findPreset(id);
      assert.equal(cabsSq(preset.psi(0, 1.23)), 0);
      assert.equal(cabsSq(preset.psi(1, 1.23)), 0);
    }
  });

  it("defines unique preset ids", () => {
    assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  });
});
