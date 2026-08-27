import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  FLUXGEM_PACKAGES,
  buildRazorpayOrderReceipt,
  getFluxGemPackage,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../services/razorpay.service.js";

const ORIGINAL = {
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
};

process.env.RAZORPAY_KEY_ID = "rzp_test_phase3";
process.env.RAZORPAY_KEY_SECRET = "phase3_checkout_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "phase3_webhook_secret";

process.on("exit", () => {
  process.env.RAZORPAY_KEY_ID = ORIGINAL.keyId;
  process.env.RAZORPAY_KEY_SECRET = ORIGINAL.keySecret;
  process.env.RAZORPAY_WEBHOOK_SECRET = ORIGINAL.webhookSecret;
});

test("FluxGem packages are server-owned immutable values", () => {
  assert.equal(getFluxGemPackage("starter")?.amountPaise, 10000);
  assert.equal(getFluxGemPackage("popular")?.gems, 250);
  assert.equal(getFluxGemPackage("power-learner")?.currency, "INR");
  assert.equal(getFluxGemPackage("starter?amount=1"), null);
  assert.ok(Object.isFrozen(FLUXGEM_PACKAGES));
  assert.ok(Object.isFrozen(FLUXGEM_PACKAGES.starter));
});


test("Razorpay order receipts are deterministic per durable purchase id", () => {
  const purchaseId = "507f1f77bcf86cd799439011";
  const first = buildRazorpayOrderReceipt(purchaseId);
  const retry = buildRazorpayOrderReceipt(purchaseId);

  assert.equal(first, retry);
  assert.equal(first, `sfa_${purchaseId}`);
  assert.ok(first.length <= 40);
  assert.notEqual(first, buildRazorpayOrderReceipt("507f1f77bcf86cd799439012"));
});

test("checkout signature accepts only the exact order/payment pair", () => {
  const orderId = "order_phase3";
  const paymentId = "pay_phase3";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    verifyRazorpayCheckoutSignature({ orderId, paymentId, signature }),
    true,
  );
  assert.equal(
    verifyRazorpayCheckoutSignature({
      orderId,
      paymentId: "pay_tampered",
      signature,
    }),
    false,
  );
});

test("webhook signature is bound to the exact raw request body", () => {
  const rawBody = Buffer.from('{"event":"payment.captured","id":"evt_1"}');
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  assert.equal(
    verifyRazorpayWebhookSignature({ rawBody, signature }),
    true,
  );
  assert.equal(
    verifyRazorpayWebhookSignature({
      rawBody: Buffer.from('{"event":"payment.failed","id":"evt_1"}'),
      signature,
    }),
    false,
  );
});
