import { safeErrorDetails } from "../utils/safeError.js";
import crypto from "node:crypto";
import mongoose from "mongoose";

import FluxGemPurchase from "../models/FluxGemPurchase.js";
import RazorpayWebhookEvent from "../models/RazorpayWebhookEvent.js";
import {
  createFluxGemPurchase,
  creditCapturedPurchase,
  getCapturedRazorpayPayment,
  getPurchaseByOrder,
  getPurchaseForUserByOrder,
  markPurchaseFailed,
  reconcileFluxGemPurchase,
} from "../services/fluxGemPurchase.service.js";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../services/razorpay.service.js";

const WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000;

const serializePurchase = (purchase) => ({
  id: purchase._id,
  packageId: purchase.packageId,
  gems: purchase.gems,
  amountPaise: purchase.amountPaise,
  currency: purchase.currency,
  razorpayOrderId: purchase.razorpayOrderId,
  razorpayPaymentId: purchase.razorpayPaymentId,
  status: purchase.status,
  providerOrderStatus: purchase.providerOrderStatus || "",
  providerPaymentStatus: purchase.providerPaymentStatus || "",
  creditedAt: purchase.creditedAt,
  failedAt: purchase.failedAt,
  failureReason: purchase.failureReason || "",
  lastReconciledAt: purchase.lastReconciledAt || null,
  createdAt: purchase.createdAt,
});

const webhookEventKey = ({ rawBody, eventId }) =>
  String(eventId || "").trim() ||
  `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;

const claimWebhookEvent = async ({ eventKey, eventId, eventType, rawBody }) => {
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  try {
    const created = await RazorpayWebhookEvent.create({
      eventKey,
      providerEventId: String(eventId || ""),
      eventType,
      payloadHash,
      status: "processing",
      attempts: 1,
    });
    return { event: created, claimed: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const existing = await RazorpayWebhookEvent.findOne({ eventKey });
  if (!existing) {
    return { event: null, claimed: false };
  }

  if (["processed", "ignored"].includes(existing.status)) {
    return { event: existing, claimed: false, duplicate: true };
  }

  const staleBefore = new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS);
  const reclaimed = await RazorpayWebhookEvent.findOneAndUpdate(
    {
      _id: existing._id,
      $or: [
        { status: "failed" },
        { status: "processing", updatedAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: {
        status: "processing",
        eventType,
        providerEventId: String(eventId || existing.providerEventId || ""),
        payloadHash,
        lastError: "",
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );

  return {
    event: reclaimed || existing,
    claimed: Boolean(reclaimed),
    duplicate: !reclaimed,
  };
};

const completeWebhookEvent = async ({ eventDoc, status, purchaseId = null, error = null }) => {
  if (!eventDoc?._id) return;
  await RazorpayWebhookEvent.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status,
        ...(purchaseId ? { purchase: purchaseId } : {}),
        processedAt: ["processed", "ignored"].includes(status) ? new Date() : null,
        lastError: error ? String(error?.message || error).slice(0, 800) : "",
      },
    },
  );
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    if (req.user?.role !== "student") {
      return res.status(403).json({
        success: false,
        code: "PURCHASE_NOT_AVAILABLE",
        message: "FluxGem purchases are available to learner accounts only.",
      });
    }

    const result = await createFluxGemPurchase({
      userId: req.user._id,
      packageId: req.body?.packageId,
      clientRequestId: req.body?.clientRequestId,
    });

    return res.status(result.reused ? 200 : 201).json({
      success: true,
      data: {
        purchaseId: result.purchase._id,
        clientRequestId: result.purchase.clientRequestId,
        reused: Boolean(result.reused),
        keyId: result.keyId,
        order: {
          id: result.order.id,
          amount: result.order.amount,
          currency: result.order.currency,
        },
        package: result.packageDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPurchasePayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        code: "INCOMPLETE_PAYMENT_VERIFICATION",
        message: "Razorpay payment verification details are incomplete.",
      });
    }

    const purchase = await getPurchaseForUserByOrder({
      userId: req.user._id,
      orderId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        code: "PURCHASE_NOT_FOUND",
        message: "This FluxGem purchase order was not found.",
      });
    }

    const signatureValid = verifyRazorpayCheckoutSignature({
      orderId: purchase.razorpayOrderId,
      paymentId,
      signature,
    });

    if (!signatureValid) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_SIGNATURE",
        message: "Razorpay payment signature verification failed.",
      });
    }

    const payment = await getCapturedRazorpayPayment({
      purchase,
      paymentId,
    });

    const result = await creditCapturedPurchase({
      purchaseId: purchase._id,
      payment,
      signatureVerified: true,
    });

    if (result?.pending) {
      return res.status(202).json({
        success: true,
        data: {
          pending: true,
          paymentStatus: result.status,
          purchase: serializePurchase(result.purchase),
        },
        message: "Payment is authentic and is waiting to be captured.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        credited: Boolean(result?.credited || result?.alreadyCredited),
        alreadyCredited: Boolean(result?.alreadyCredited),
        balance: result?.balance,
        purchase: serializePurchase(result.purchase),
      },
      message: result?.alreadyCredited
        ? "This FluxGem purchase was already credited."
        : `${purchase.gems} FluxGems added successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.purchaseId)) {
      return res.status(404).json({
        success: false,
        code: "PURCHASE_NOT_FOUND",
        message: "FluxGem purchase was not found.",
      });
    }

    const purchase = await FluxGemPurchase.findOne({
      _id: req.params.purchaseId,
      user: req.user._id,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        code: "PURCHASE_NOT_FOUND",
        message: "FluxGem purchase was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        purchase: serializePurchase(purchase),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const reconcilePurchaseStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.purchaseId)) {
      return res.status(404).json({
        success: false,
        code: "PURCHASE_NOT_FOUND",
        message: "FluxGem purchase was not found.",
      });
    }

    const result = await reconcileFluxGemPurchase({
      purchaseId: req.params.purchaseId,
      userId: req.user._id,
    });

    return res.status(result?.pending ? 202 : 200).json({
      success: true,
      data: {
        credited: Boolean(result?.credited || result?.alreadyCredited),
        alreadyCredited: Boolean(result?.alreadyCredited),
        pending: Boolean(result?.pending),
        canStartNewCheckout: Boolean(result?.canStartNewCheckout),
        paymentStatus: result?.status || result?.purchase?.providerPaymentStatus || "",
        balance: result?.balance,
        purchase: serializePurchase(result.purchase),
      },
      message: result?.credited || result?.alreadyCredited
        ? "FluxGem purchase is credited."
        : result?.canStartNewCheckout && result?.purchase?.status === "created"
          ? "No payment attempt was found for this Razorpay order. You can safely start a new checkout."
          : result?.pending
            ? "Razorpay has not completed this purchase yet."
            : "The latest Razorpay payment attempt was not successful.",
    });
  } catch (error) {
    next(error);
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  let eventDoc = null;

  try {
    const signature = req.get("x-razorpay-signature");
    const eventId = req.get("x-razorpay-event-id") || "";
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");

    if (!signature || !verifyRazorpayWebhookSignature({ rawBody, signature })) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay webhook signature.",
      });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({
        success: false,
        message: "Razorpay webhook payload is invalid JSON.",
      });
    }

    const eventType = String(event?.event || "unknown");
    const key = webhookEventKey({ rawBody, eventId });
    const claim = await claimWebhookEvent({
      eventKey: key,
      eventId,
      eventType,
      rawBody,
    });
    eventDoc = claim.event;

    if (!claim.claimed) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    const payment = event?.payload?.payment?.entity || null;
    const order = event?.payload?.order?.entity || null;
    const orderId = payment?.order_id || order?.id || "";

    if (!orderId) {
      await completeWebhookEvent({ eventDoc, status: "ignored" });
      return res.status(200).json({ success: true });
    }

    const purchase = await getPurchaseByOrder(orderId);

    if (!purchase) {
      await completeWebhookEvent({ eventDoc, status: "ignored" });
      return res.status(200).json({ success: true });
    }

    if (eventType === "payment.captured" && payment?.status === "captured") {
      await creditCapturedPurchase({
        purchaseId: purchase._id,
        payment,
        webhookEventId: eventId || key,
      });
    } else if (eventType === "order.paid") {
      if (payment?.status === "captured") {
        await creditCapturedPurchase({
          purchaseId: purchase._id,
          payment,
          webhookEventId: eventId || key,
        });
      } else {
        await reconcileFluxGemPurchase({
          purchaseId: purchase._id,
          webhookEventId: eventId || key,
        });
      }
    } else if (eventType === "payment.failed" && payment) {
      await markPurchaseFailed({
        orderId,
        paymentId: payment.id,
        failureReason:
          payment.error_description ||
          payment.error_reason ||
          "Payment failed.",
        webhookEventId: eventId || key,
      });
    } else {
      await completeWebhookEvent({
        eventDoc,
        status: "ignored",
        purchaseId: purchase._id,
      });
      return res.status(200).json({ success: true });
    }

    await completeWebhookEvent({
      eventDoc,
      status: "processed",
      purchaseId: purchase._id,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (eventDoc?._id) {
      await completeWebhookEvent({ eventDoc, status: "failed", error }).catch(() => {});
    }
    console.error("Razorpay webhook processing failed:", safeErrorDetails(error));
    return res.status(500).json({
      success: false,
      message: "Razorpay webhook processing failed.",
    });
  }
};
