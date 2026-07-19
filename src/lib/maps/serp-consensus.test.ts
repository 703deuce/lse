import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import {
  appendSparseObservation,
  decideSerpAccept,
  findConsensusGroup,
  fingerprintSerp,
  listingOverlap,
  loadSparseHistory,
  observationsAreConsistent,
  pickConsensusItems,
  rankOrderSimilarity,
  serializeSparseHistory,
} from "@/lib/maps/serp-consensus";

function itemsFromIds(ids: string[]): MapsLiveResult[] {
  return ids.map((place_id, i) => ({
    place_id,
    title: `Biz ${place_id}`,
    rank_absolute: i + 1,
    rank_group: i + 1,
  }));
}

describe("SERP consensus", () => {
  it("accepts 20+ immediately and 10–19 as soft packs", () => {
    assert.equal(decideSerpAccept(itemsFromIds(Array.from({ length: 20 }, (_, i) => `p${i}`))).action, "accept");
    assert.equal(decideSerpAccept(itemsFromIds(Array.from({ length: 20 }, (_, i) => `p${i}`))).reason, "full_pack");
    assert.equal(decideSerpAccept(itemsFromIds(Array.from({ length: 15 }, (_, i) => `p${i}`))).reason, "soft_pack");
    assert.equal(decideSerpAccept(itemsFromIds(Array.from({ length: 9 }, (_, i) => `p${i}`))).action, "retry");
    assert.equal(decideSerpAccept([]).reason, "empty");
    assert.equal(decideSerpAccept(itemsFromIds(["only"])).reason, "target_only");
  });

  it("measures place_id overlap and rank-order similarity", () => {
    const a = fingerprintSerp(itemsFromIds(["a", "b", "c", "d", "e", "f", "g", "h", "i"]));
    const b = fingerprintSerp(itemsFromIds(["a", "b", "c", "d", "e", "f", "g", "h", "i"]));
    const c = fingerprintSerp(itemsFromIds(["z", "y", "x", "w", "v", "u", "t", "s", "r"]));
    assert.equal(listingOverlap(a, b), 1);
    assert.ok(rankOrderSimilarity(a, b) >= 0.99);
    assert.equal(listingOverlap(a, c), 0);
    assert.equal(observationsAreConsistent(a, b), true);
    assert.equal(observationsAreConsistent(a, c), false);
  });

  it("requires three matching sparse observations before consensus", () => {
    const nine = itemsFromIds(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    const obs = [fingerprintSerp(nine), fingerprintSerp(nine)];
    assert.equal(findConsensusGroup(obs, 3), null);
    obs.push(fingerprintSerp(nine));
    const hit = findConsensusGroup(obs, 3);
    assert.ok(hit);
    assert.equal(hit!.representative.count, 9);
  });

  it("does not treat same count + different businesses as consensus", () => {
    const obs = [
      fingerprintSerp(itemsFromIds(["a", "b", "c", "d", "e", "f", "g", "h", "i"])),
      fingerprintSerp(itemsFromIds(["1", "2", "3", "4", "5", "6", "7", "8", "9"])),
      fingerprintSerp(itemsFromIds(["x", "y", "z", "q", "w", "e", "r", "t", "u"])),
    ];
    assert.equal(findConsensusGroup(obs, 3), null);
  });

  it("persists fingerprints across generations and can still reach consensus", () => {
    const nine = itemsFromIds(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    const history = new Map<string, ReturnType<typeof fingerprintSerp>[]>();
    appendSparseObservation(history, "p1:k1", fingerprintSerp(nine));
    appendSparseObservation(history, "p1:k1", fingerprintSerp(nine));
    appendSparseObservation(history, "p1:k1", fingerprintSerp(nine));
    const stored = serializeSparseHistory(history);
    const reloaded = loadSparseHistory(stored);
    assert.equal(reloaded.get("p1:k1")?.length, 3);
    // Reloaded fingerprints have no items — need a live matching fetch to save.
    assert.equal(reloaded.get("p1:k1")?.[0]?.items.length, 0);

    const hit = findConsensusGroup(reloaded.get("p1:k1")!, 3);
    assert.ok(hit);
    assert.equal(pickConsensusItems(hit!.group, itemsFromIds(["z"])).length, 0);
    assert.equal(pickConsensusItems(hit!.group, nine).length, 9);
  });
});
