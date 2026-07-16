import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encryptSecret,
  decryptSecret,
  generateEndpointToken,
  hashToken,
  signWebhookBody,
  verifyWebhookSignature,
} from "./webhook-crypto";

describe("webhook crypto", () => {
  it("generates high-entropy tokens and stable hashes", () => {
    const a = generateEndpointToken();
    assert.match(a.raw, /^lsewh_/);
    assert.equal(a.lastFour.length, 4);
    assert.equal(hashToken(a.raw), a.hash);
    assert.notEqual(generateEndpointToken().hash, a.hash);
  });

  it("round-trips encrypted signing secrets", () => {
    const secret = "whsig_test_secret_value";
    const blob = encryptSecret(secret);
    assert.equal(decryptSecret(blob), secret);
    assert.equal(decryptSecret("garbage"), null);
  });

  it("verifies HMAC signatures within tolerance", () => {
    const secret = "whsig_abc";
    const body = '{"event_id":"1"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signWebhookBody(secret, ts, body);
    assert.equal(
      verifyWebhookSignature({
        secrets: [secret],
        timestamp: ts,
        rawBody: body,
        signatureHeader: sig,
      }),
      true
    );
    assert.equal(
      verifyWebhookSignature({
        secrets: [secret],
        timestamp: String(Math.floor(Date.now() / 1000) - 10_000),
        rawBody: body,
        signatureHeader: sig,
      }),
      false
    );
  });
});
