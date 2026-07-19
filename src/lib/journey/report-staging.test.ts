import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reportsHrefForStaging } from "@/lib/journey/report-staging";

describe("report-staging", () => {
  it("builds a reports deep-link for staged sources", () => {
    const href = reportsHrefForStaging("abc", { type: "monthly", source: "ai_visibility" });
    assert.ok(href.startsWith("/businesses/abc/reports?"));
    assert.ok(href.includes("type=monthly"));
    assert.ok(href.includes("staged=ai_visibility"));
    assert.ok(href.includes("from=journey"));
  });
});
