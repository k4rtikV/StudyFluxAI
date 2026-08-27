import crypto from "crypto";

import { getNumberEnv } from "../config/env.js";

export const FLUXGEM_PACKAGES = Object.freeze({
  starter: Object.freeze({
    id: "starter",
    label: "Starter",
    gems: 100,
    amountPaise: 10000,
    currency: "INR",
  }),
  popular: Object.freeze({
    id: "popular",
    label: "Popular",
    gems: 250,
    amountPaise: 25000,
    currency: "INR",
  }),
  "power-learner": Object.freeze({
    id: "power-learner",
    label: "Power Learner",
    gems: 500,
    amountPaise: 50000,
    currency: "INR",
  }),
});

const getRazorpayCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const error = new Error(
      "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
    error.statusCode = 503;
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }

  return { keyId, keySecret };
};

const getRequestTimeoutMs = () =>
  getNumberEnv("RAZORPAY_REQUEST_TIMEOUT_MS", 15000, {
    min: 3000,
    max: 45000,
  });

const razorpayRequest = async (path, options = {}) => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(
        payload?.error?.description ||
          payload?.error?.reason ||
          "Razorpay request failed.",
      );
      error.statusCode = response.status >= 500 ? 502 : 400;
      error.code = payload?.error?.code || "RAZORPAY_REQUEST_FAILED";
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        "Razorpay took too long to respond. Please retry in a moment.",
      );
      timeoutError.statusCode = 504;
      timeoutError.code = "RAZORPAY_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const getFluxGemPackage = (packageId) =>
  FLUXGEM_PACKAGES[String(packageId || "").trim()] || null;

export const buildRazorpayOrderReceipt = (purchaseId) => {
  const normalized = String(purchaseId || "").trim();
  if (!normalized) {
    const error = new Error("A purchase identifier is required to create a Razorpay order.");
    error.statusCode = 500;
    error.code = "PURCHASE_ID_REQUIRED";
    throw error;
  }

  // Razorpay receipts are unique and limited to 40 characters. A deterministic
  // receipt lets a retry recover an order that the provider accepted before a
  // process crash/network timeout prevented us from persisting its order id.
  return `sfa_${normalized}`.slice(0, 40);
};

export const createRazorpayOrder = async ({
  packageDetails,
  userId,
  purchaseId,
}) => {
  const receipt = buildRazorpayOrderReceipt(purchaseId);

  return razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount: packageDetails.amountPaise,
      currency: packageDetails.currency,
      receipt,
      notes: {
        product: "StudyFluxAI FluxGems",
        packageId: packageDetails.id,
        gems: String(packageDetails.gems),
        userId: String(userId),
        ...(purchaseId ? { purchaseId: String(purchaseId) } : {}),
      },
    },
  });
};

export const fetchRazorpayOrdersByReceipt = async (receipt) =>
  razorpayRequest(`/orders?receipt=${encodeURIComponent(String(receipt || ""))}&count=10`);

export const fetchRazorpayPayment = async (paymentId) =>
  razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);

export const fetchRazorpayOrder = async (orderId) =>
  razorpayRequest(`/orders/${encodeURIComponent(orderId)}`);

export const fetchRazorpayOrderPayments = async (orderId) =>
  razorpayRequest(`/orders/${encodeURIComponent(orderId)}/payments`);

export const verifyRazorpayCheckoutSignature = ({
  orderId,
  paymentId,
  signature,
}) => {
  const { keySecret } = getRazorpayCredentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(String(signature || ""), "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

export const verifyRazorpayWebhookSignature = ({
  rawBody,
  signature,
}) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    const error = new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured.",
    );
    error.statusCode = 503;
    error.code = "RAZORPAY_WEBHOOK_NOT_CONFIGURED";
    throw error;
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(String(signature || ""), "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

export const getRazorpayPublicKey = () =>
  getRazorpayCredentials().keyId;