import crypto from "crypto";

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
    throw error;
  }

  return { keyId, keySecret };
};

const razorpayRequest = async (path, options = {}) => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
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
};

export const getFluxGemPackage = (packageId) =>
  FLUXGEM_PACKAGES[String(packageId || "").trim()] || null;

export const createRazorpayOrder = async ({
  packageDetails,
  userId,
}) => {
  const receipt = `sfa_${String(userId).slice(-8)}_${Date.now()}`.slice(0, 40);

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
      },
    },
  });
};

export const fetchRazorpayPayment = async (paymentId) =>
  razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);

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
