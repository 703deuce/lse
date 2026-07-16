import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectFieldMapping } from "./webhook-mapping";

describe("webhook contact match helpers", () => {
  it("detectFieldMapping ignores empty / non-object samples", () => {
    assert.deepEqual(detectFieldMapping(null), {});
    assert.deepEqual(detectFieldMapping([]), {});
    assert.deepEqual(detectFieldMapping("x"), {});
  });
});
