import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateApiKey, hashApiKey } from "./api-keys";

describe("api key generation", () => {
  it("creates lse_ prefixed keys with stable hashes", () => {
    const { raw, prefix, hash } = generateApiKey();
    assert.match(raw, /^lse_[a-f0-9]{8}_/);
    assert.equal(prefix, raw.split("_").slice(0, 2).join("_"));
    assert.equal(hashApiKey(raw), hash);
    assert.notEqual(hashApiKey(raw + "x"), hash);
  });
});
