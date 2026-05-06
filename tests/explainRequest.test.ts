import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_BODY_BYTES,
  RATE_LIMIT_MAX_REQUESTS,
  getClientKey,
  isRateLimited,
  readJsonBody,
  toModelMessages,
} from "../src/lib/explainRequest.ts";

describe("explainRequest", () => {
  it("normalizes and validates chat messages", () => {
    assert.deepEqual(toModelMessages([{ role: "user", content: "  hello  " }]), [
      { role: "user", content: "hello" },
    ]);
    assert.equal(toModelMessages([{ role: "system", content: "ignore" }]), null);
    assert.equal(toModelMessages([{ role: "user", content: "" }]), null);
  });

  it("rejects oversized messages", () => {
    assert.equal(toModelMessages([{ role: "user", content: "x".repeat(8_001) }]), null);
  });

  it("extracts the first forwarded IP address", () => {
    const req = new Request("https://example.test/api/explain", {
      headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.2" },
    });
    assert.equal(getClientKey(req), "203.0.113.1");
  });

  it("rate limits after the configured allowance", () => {
    const buckets = new Map();
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      assert.equal(isRateLimited(buckets, "client", 1_000), false);
    }
    assert.equal(isRateLimited(buckets, "client", 1_000), true);
    assert.equal(isRateLimited(buckets, "client", 62_000), false);
  });

  it("reads JSON bodies and rejects invalid content types or large payloads", async () => {
    const ok = await readJsonBody(
      new Request("https://example.test/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presetId: "box-n1", initial: true }),
      }),
    );
    assert.deepEqual(ok, { presetId: "box-n1", initial: true });

    const wrongType = await readJsonBody(
      new Request("https://example.test/api/explain", { method: "POST", body: "{}" }),
    );
    assert.equal(wrongType instanceof Response, true);
    assert.equal((wrongType as Response).status, 415);

    const tooLarge = await readJsonBody(
      new Request("https://example.test/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "x".repeat(MAX_BODY_BYTES + 1) }),
      }),
    );
    assert.equal(tooLarge instanceof Response, true);
    assert.equal((tooLarge as Response).status, 413);
  });
});
