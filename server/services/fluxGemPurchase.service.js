import { randomUUID } from "node:crypto";

import { safeErrorDetails } from "../utils/safeError.js";
import mongoose from "mongoose";

import FluxGemPurchase from "../models/FluxGemPurchase.js";
import FluxGemTransaction from "../models/FluxGemTransaction.js";
import User from "../models/User.js";
import {
  buildRazorpayOrderReceipt,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrdersByReceipt,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  getFluxGemPackage,
  getRazorpayPublicKey,
} from "./razorpay.service.js";
import { sendFluxGemPurchaseReceipt } from "./email.service.js";
import { createUserNotification } from "./notification.service.js";
import { waitForCondition } from "../utils/distributedLock.js";

const orderCreationFlights = new Map();
const RECEIPT_CLAIM_STALE_MS = 5 * 60 * 1000;
const ORDER_CREATION_LEASE_MS = 5 * 60 * 1000;

const hasProviderOrder = (purchase) =>
  Boolean(purchase?.razorpayOrderId && !String(purchase.razorpayOrderId).startsWith("pending:"));

const httpError = (message, statusCode = 400, code = "PURCHASE_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export const normalizePurchaseRequestId = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return randomUUID();
  if (
    normalized.length < 8 ||
    normalized.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(normalized)
  ) {
    throw httpError(
      "Purchase request identifier is invalid. Please retry checkout.",
      400,
      "INVALID_PURCHASE_REQUEST_ID",
    );
  }
  return normalized;
};

const singleFlight = (key, operation) => {
  if (orderCreationFlights.has(key)) return orderCreationFlights.get(key);
  const promise = Promise.resolve()
    .then(operation)
    .finally(() => orderCreationFlights.delete(key));
  orderCreationFlights.set(key, promise);
  return promise;
};

const ensureMatchingOrder = ({ purchase, order }) => {
  if (!order || order.id !== purchase.razorpayOrderId) {
    throw httpError(
      "Razorpay order details do not match this FluxGem purchase.",
      409,
      "PAYMENT_ORDER_MISMATCH",
    );
  }

  if (
    Number(order.amount) !== Number(purchase.amountPaise) ||
    String(order.currency || "").toUpperCase() !== String(purchase.currency || "").toUpperCase()
  ) {
    throw httpError(
      "Razorpay order amount or currency does not match this FluxGem purchase.",
      409,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }
};

const ensureMatchingPayment = ({ purchase, payment }) => {
  if (!payment) {
    throw httpError(
      "Razorpay payment details are unavailable.",
      400,
      "PAYMENT_DETAILS_UNAVAILABLE",
    );
  }

  if (payment.order_id !== purchase.razorpayOrderId) {
    throw httpError(
      "Payment does not belong to this FluxGem order.",
      400,
      "PAYMENT_ORDER_MISMATCH",
    );
  }

  if (
    Number(payment.amount) !== Number(purchase.amountPaise) ||
    String(payment.currency || "").toUpperCase() !== String(purchase.currency || "").toUpperCase()
  ) {
    throw httpError(
      "Payment amount or currency does not match the FluxGem order.",
      400,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }
};

const buildLocalOrder = (purchase) => ({
  id: purchase.razorpayOrderId,
  amount: Number(purchase.amountPaise),
  currency: purchase.currency,
  status: purchase.providerOrderStatus || purchase.status,
});

const recoverProviderOrderByReceipt = async ({ purchase, packageDetails }) => {
  const receipt = buildRazorpayOrderReceipt(purchase._id);
  const response = await fetchRazorpayOrdersByReceipt(receipt);
  const matches = Array.isArray(response?.items)
    ? response.items.filter((order) => String(order?.receipt || "") === receipt)
    : [];

  if (matches.length === 0) return null;

  const order = matches[0];
  const notes = order?.notes && !Array.isArray(order.notes) ? order.notes : {};
  const expectedPurchaseId = String(purchase._id);

  if (
    Number(order.amount) !== Number(packageDetails.amountPaise) ||
    String(order.currency || "").toUpperCase() !== String(packageDetails.currency || "").toUpperCase() ||
    String(notes.purchaseId || "") !== expectedPurchaseId
  ) {
    throw httpError(
      "An existing Razorpay receipt does not match this FluxGem purchase.",
      409,
      "PURCHASE_PROVIDER_RECEIPT_CONFLICT",
    );
  }

  return order;
};

const reservePurchase = async ({ userId, packageDetails, clientRequestId }) => {
  try {
    const purchase = await FluxGemPurchase.findOneAndUpdate(
      { user: userId, clientRequestId },
      {
        $setOnInsert: {
          user: userId,
          packageId: packageDetails.id,
          gems: packageDetails.gems,
          amountPaise: packageDetails.amountPaise,
          currency: packageDetails.currency,
          clientRequestId,
          razorpayOrderId: `pending:${randomUUID()}`,
          status: "creating",
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    if (
      purchase.packageId !== packageDetails.id ||
      Number(purchase.gems) !== Number(packageDetails.gems) ||
      Number(purchase.amountPaise) !== Number(packageDetails.amountPaise)
    ) {
      throw httpError(
        "This checkout request was already used for a different FluxGem package.",
        409,
        "PURCHASE_REQUEST_CONFLICT",
      );
    }

    return purchase;
  } catch (error) {
    if (error?.code === 11000) {
      const purchase = await FluxGemPurchase.findOne({ user: userId, clientRequestId });
      if (purchase) return purchase;
    }
    throw error;
  }
};

const claimPurchaseOrderCreation = async (purchase) => {
  const now = new Date();
  const leaseToken = randomUUID();
  const claimed = await FluxGemPurchase.findOneAndUpdate(
    {
      _id: purchase._id,
      creditedAt: null,
      razorpayOrderId: purchase.razorpayOrderId,
      $or: [
        { orderCreationLeaseExpiresAt: null },
        { orderCreationLeaseExpiresAt: { $exists: false } },
        { orderCreationLeaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "creating",
        failureReason: "",
        failedAt: null,
        orderCreationLeaseToken: leaseToken,
        orderCreationLeaseExpiresAt: new Date(now.getTime() + ORDER_CREATION_LEASE_MS),
      },
    },
    { returnDocument: "after" },
  ).select("+orderCreationLeaseToken +orderCreationLeaseExpiresAt");

  return claimed ? { purchase: claimed, leaseToken } : null;
};

export const createFluxGemPurchase = async ({ userId, packageId, clientRequestId }) => {
  const packageDetails = getFluxGemPackage(packageId);

  if (!packageDetails) {
    throw httpError("Choose a valid FluxGem package.", 400, "INVALID_FLUXGEM_PACKAGE");
  }

  const requestId = normalizePurchaseRequestId(clientRequestId);
  const flightKey = `${String(userId)}:${requestId}`;

  return singleFlight(flightKey, async () => {
    let purchase = await reservePurchase({
      userId,
      packageDetails,
      clientRequestId: requestId,
    });

    if (hasProviderOrder(purchase)) {
      return {
        purchase,
        packageDetails,
        order: buildLocalOrder(purchase),
        keyId: getRazorpayPublicKey(),
        reused: true,
      };
    }

    const purchaseAgeMs = Date.now() - new Date(purchase.createdAt || 0).getTime();
    const shouldAttemptProviderRecovery =
      purchase.status === "failed" || purchaseAgeMs >= ORDER_CREATION_LEASE_MS;

    const claim = await claimPurchaseOrderCreation(purchase);
    if (!claim) {
      const ready = await waitForCondition(
        async () => {
          const candidate = await FluxGemPurchase.findById(purchase._id).lean();
          return hasProviderOrder(candidate) ? candidate : null;
        },
        { timeoutMs: 10000, intervalMs: 250 },
      );

      if (!ready) {
        throw httpError(
          "This checkout is already being prepared. Please wait a moment and retry.",
          409,
          "PURCHASE_ORDER_IN_PROGRESS",
        );
      }

      purchase = await FluxGemPurchase.findById(purchase._id);
      return {
        purchase,
        packageDetails,
        order: buildLocalOrder(purchase),
        keyId: getRazorpayPublicKey(),
        reused: true,
      };
    }

    purchase = claim.purchase;

    let order;
    try {
      if (shouldAttemptProviderRecovery) {
        order = await recoverProviderOrderByReceipt({ purchase, packageDetails });
      }

      if (!order) {
        try {
          order = await createRazorpayOrder({
            packageDetails,
            userId,
            purchaseId: purchase._id,
          });
        } catch (creationError) {
          // The provider may have committed the order even when the response was
          // lost (timeout/reset/crash window). Reconcile the deterministic
          // receipt before treating creation as failed or attempting another POST.
          try {
            order = await recoverProviderOrderByReceipt({ purchase, packageDetails });
          } catch (recoveryError) {
            if (recoveryError?.code === "PURCHASE_PROVIDER_RECEIPT_CONFLICT") {
              throw recoveryError;
            }
            throw creationError;
          }
          if (!order) throw creationError;
        }
      }
    } catch (error) {
      await FluxGemPurchase.updateOne(
        {
          _id: purchase._id,
          orderCreationLeaseToken: claim.leaseToken,
          creditedAt: null,
        },
        {
          $set: {
            status: "failed",
            failedAt: new Date(),
            failureReason: String(error?.message || "Razorpay order creation failed.").slice(0, 500),
          },
          $unset: { orderCreationLeaseToken: "", orderCreationLeaseExpiresAt: "" },
        },
      );
      throw error;
    }

    purchase = await FluxGemPurchase.findOneAndUpdate(
      {
        _id: purchase._id,
        razorpayOrderId: purchase.razorpayOrderId,
        orderCreationLeaseToken: claim.leaseToken,
      },
      {
        $set: {
          razorpayOrderId: order.id,
          status: "created",
          providerOrderStatus: String(order.status || "created"),
          failureReason: "",
          failedAt: null,
        },
        $unset: { orderCreationLeaseToken: "", orderCreationLeaseExpiresAt: "" },
      },
      { returnDocument: "after" },
    );

    if (!purchase) {
      purchase = await FluxGemPurchase.findOne({ user: userId, clientRequestId: requestId });
    }

    if (!hasProviderOrder(purchase)) {
      throw httpError(
        "FluxGem checkout could not be finalized safely. Please retry.",
        409,
        "PURCHASE_ORDER_FINALIZE_FAILED",
      );
    }

    return {
      purchase,
      packageDetails,
      order: purchase.razorpayOrderId === order.id ? order : buildLocalOrder(purchase),
      keyId: getRazorpayPublicKey(),
      reused: purchase.razorpayOrderId !== order.id,
    };
  });
};

export const getPurchaseForUserByOrder = async ({ userId, orderId }) =>
  FluxGemPurchase.findOne({
    user: userId,
    razorpayOrderId: orderId,
  });

export const getPurchaseForUserById = async ({ userId, purchaseId }) =>
  FluxGemPurchase.findOne({ _id: purchaseId, user: userId });

export const getPurchaseByOrder = async (orderId) =>
  FluxGemPurchase.findOne({ razorpayOrderId: orderId });

export const getCapturedRazorpayPayment = async ({ purchase, paymentId }) => {
  const payment = await fetchRazorpayPayment(paymentId);
  ensureMatchingPayment({ purchase, payment });
  return payment;
};

const triggerPurchaseSideEffects = (purchaseId, paymentId) => {
  Promise.resolve()
    .then(async () => {
      const purchase = await FluxGemPurchase.findById(purchaseId).lean();
      if (!purchase?.creditedAt) return;

      const user = await User.findById(purchase.user)
        .select("fullName email fluxGems isActive")
        .lean();
      if (!user?.isActive) return;

      await createUserNotification({
        userId: purchase.user,
        type: "reward",
        title: `${Number(purchase.gems || 0)} FluxGems added`,
        body: "Your Razorpay payment was verified and your StudyFluxAI wallet balance has been updated.",
        actionUrl: "/wallet",
        actionLabel: "View wallet",
        priority: "normal",
        dedupeKey: `purchase:${String(purchase._id)}:credited`,
        emailRequested: false,
        metadata: {
          purchaseId: String(purchase._id),
          gems: Number(purchase.gems || 0),
        },
      }).catch((error) => {
        console.warn("FluxGem purchase notification delivery failed:", safeErrorDetails(error));
      });

      if (!user.email || purchase.receiptEmailSentAt) return;

      const staleBefore = new Date(Date.now() - RECEIPT_CLAIM_STALE_MS);
      const claimed = await FluxGemPurchase.findOneAndUpdate(
        {
          _id: purchase._id,
          receiptEmailSentAt: null,
          $or: [
            { receiptEmailClaimedAt: null },
            { receiptEmailClaimedAt: { $lt: staleBefore } },
          ],
        },
        {
          $set: { receiptEmailClaimedAt: new Date() },
        },
        { returnDocument: "after" },
      );

      if (!claimed) return;

      try {
        await sendFluxGemPurchaseReceipt({
          email: user.email,
          fullName: user.fullName,
          gems: claimed.gems,
          amountPaise: claimed.amountPaise,
          currency: claimed.currency,
          razorpayOrderId: claimed.razorpayOrderId,
          razorpayPaymentId: paymentId || claimed.razorpayPaymentId,
        });
        await FluxGemPurchase.updateOne(
          { _id: claimed._id, receiptEmailSentAt: null },
          {
            $set: {
              receiptEmailSentAt: new Date(),
              receiptEmailClaimedAt: null,
              receiptEmailFailedAt: null,
            },
          },
        );
      } catch (error) {
        await FluxGemPurchase.updateOne(
          { _id: claimed._id, receiptEmailSentAt: null },
          {
            $set: {
              receiptEmailClaimedAt: null,
              receiptEmailFailedAt: new Date(),
            },
          },
        );
        throw error;
      }
    })
    .catch((error) => {
      console.warn("FluxGem purchase post-credit delivery failed:", safeErrorDetails(error));
    });
};

export const creditCapturedPurchase = async ({
  purchaseId,
  payment,
  signatureVerified = false,
  webhookEventId = "",
}) => {
  const mongoSession = await mongoose.startSession();
  let result = null;

  try {
    await mongoSession.withTransaction(async () => {
      const currentPurchase = await FluxGemPurchase.findById(purchaseId).session(mongoSession);

      if (!currentPurchase) {
        throw httpError("FluxGem purchase was not found.", 404, "PURCHASE_NOT_FOUND");
      }

      ensureMatchingPayment({ purchase: currentPurchase, payment });

      if (payment.status !== "captured") {
        const pendingPurchase = await FluxGemPurchase.findOneAndUpdate(
          { _id: currentPurchase._id, creditedAt: null },
          {
            $set: {
              status: "pending",
              providerPaymentStatus: String(payment.status || "unknown"),
              ...(payment.id ? { razorpayPaymentId: payment.id } : {}),
              lastReconciledAt: new Date(),
              ...(signatureVerified ? { signatureVerifiedAt: new Date() } : {}),
            },
          },
          { returnDocument: "after", session: mongoSession },
        );
        result = {
          credited: false,
          pending: true,
          status: payment.status || "unknown",
          purchase: pendingPurchase || currentPurchase,
        };
        return;
      }

      const paymentOwner = await FluxGemPurchase.findOne({
        razorpayPaymentId: payment.id,
        _id: { $ne: currentPurchase._id },
      })
        .select("_id user razorpayOrderId")
        .session(mongoSession)
        .lean();

      if (paymentOwner) {
        throw httpError(
          "This Razorpay payment is already associated with another purchase.",
          409,
          "PAYMENT_ALREADY_USED",
        );
      }

      if (currentPurchase.creditedAt) {
        const existingUser = await User.findById(currentPurchase.user)
          .select("fluxGems fullName email")
          .session(mongoSession);

        result = {
          credited: false,
          alreadyCredited: true,
          balance: existingUser?.fluxGems,
          purchase: currentPurchase,
        };
        return;
      }

      const now = new Date();
      const updatedPurchase = await FluxGemPurchase.findOneAndUpdate(
        {
          _id: currentPurchase._id,
          creditedAt: null,
        },
        {
          $set: {
            status: "paid",
            razorpayPaymentId: payment.id,
            providerPaymentStatus: "captured",
            capturedAt: now,
            creditedAt: now,
            failedAt: null,
            failureReason: "",
            lastReconciledAt: now,
            ...(signatureVerified ? { signatureVerifiedAt: now } : {}),
            ...(webhookEventId ? { lastWebhookEventId: webhookEventId } : {}),
          },
        },
        {
          returnDocument: "after",
          session: mongoSession,
        },
      );

      if (!updatedPurchase) {
        const latestPurchase = await FluxGemPurchase.findById(currentPurchase._id).session(mongoSession);
        const latestUser = await User.findById(currentPurchase.user)
          .select("fluxGems fullName email")
          .session(mongoSession);

        result = {
          credited: false,
          alreadyCredited: true,
          balance: latestUser?.fluxGems,
          purchase: latestPurchase,
        };
        return;
      }

      const updatedUser = await User.findOneAndUpdate(
        {
          _id: updatedPurchase.user,
          isActive: true,
        },
        {
          $inc: {
            fluxGems: updatedPurchase.gems,
          },
        },
        {
          returnDocument: "after",
          session: mongoSession,
        },
      ).select("fluxGems fullName email");

      if (!updatedUser) {
        throw httpError(
          "Unable to credit FluxGems to this account.",
          409,
          "WALLET_CREDIT_FAILED",
        );
      }

      await FluxGemTransaction.create(
        [
          {
            user: updatedPurchase.user,
            type: "purchase",
            amount: updatedPurchase.gems,
            balanceAfter: updatedUser.fluxGems,
            reason: "purchase",
            metadata: {
              provider: "razorpay",
              purchaseId: String(updatedPurchase._id),
              packageId: updatedPurchase.packageId,
              amountInPaise: updatedPurchase.amountPaise,
              currency: updatedPurchase.currency,
              razorpayOrderId: updatedPurchase.razorpayOrderId,
              razorpayPaymentId: payment.id,
              status: "Captured",
            },
          },
        ],
        {
          session: mongoSession,
          ordered: true,
        },
      );

      result = {
        credited: true,
        balance: updatedUser.fluxGems,
        purchase: updatedPurchase,
        user: updatedUser,
      };
    });
  } finally {
    await mongoSession.endSession();
  }

  if ((result?.credited || result?.alreadyCredited) && result.purchase?._id) {
    triggerPurchaseSideEffects(result.purchase._id, payment?.id);
  }

  return result;
};

export const markPurchaseFailed = async ({
  orderId,
  paymentId = null,
  failureReason = "Payment failed.",
  webhookEventId = "",
}) =>
  FluxGemPurchase.findOneAndUpdate(
    {
      razorpayOrderId: orderId,
      creditedAt: null,
    },
    {
      $set: {
        status: "failed",
        providerPaymentStatus: "failed",
        ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
        failedAt: new Date(),
        lastReconciledAt: new Date(),
        failureReason: String(failureReason || "Payment failed.").slice(0, 500),
        ...(webhookEventId ? { lastWebhookEventId: webhookEventId } : {}),
      },
    },
    { returnDocument: "after" },
  );

export const reconcileFluxGemPurchase = async ({
  purchaseId,
  userId = null,
  webhookEventId = "",
}) => {
  const filter = { _id: purchaseId };
  if (userId) filter.user = userId;

  let purchase = await FluxGemPurchase.findOne(filter);
  if (!purchase) {
    throw httpError("FluxGem purchase was not found.", 404, "PURCHASE_NOT_FOUND");
  }

  if (purchase.creditedAt) {
    const user = await User.findById(purchase.user).select("fluxGems").lean();
    triggerPurchaseSideEffects(purchase._id, purchase.razorpayPaymentId);
    return {
      credited: true,
      alreadyCredited: true,
      balance: Number(user?.fluxGems || 0),
      purchase,
    };
  }

  if (!hasProviderOrder(purchase)) {
    return {
      credited: false,
      pending: purchase.status === "creating",
      status: purchase.status,
      purchase,
    };
  }

  const [order, paymentsPayload] = await Promise.all([
    fetchRazorpayOrder(purchase.razorpayOrderId),
    fetchRazorpayOrderPayments(purchase.razorpayOrderId),
  ]);

  ensureMatchingOrder({ purchase, order });

  const payments = Array.isArray(paymentsPayload?.items) ? paymentsPayload.items : [];
  const matchingPayments = payments.filter((payment) => {
    try {
      ensureMatchingPayment({ purchase, payment });
      return true;
    } catch {
      return false;
    }
  });

  const captured = matchingPayments
    .filter((payment) => payment.status === "captured")
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))[0];

  if (captured) {
    await FluxGemPurchase.updateOne(
      { _id: purchase._id, creditedAt: null },
      {
        $set: {
          providerOrderStatus: String(order.status || "paid"),
          lastReconciledAt: new Date(),
        },
      },
    );
    return creditCapturedPurchase({
      purchaseId: purchase._id,
      payment: captured,
      webhookEventId,
    });
  }

  const latestPayment = matchingPayments
    .slice()
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))[0];

  const providerOrderStatus = String(order.status || "");
  const noPaymentAttempt = !latestPayment && providerOrderStatus === "created";

  const nextStatus =
    latestPayment?.status === "failed"
      ? "failed"
      : noPaymentAttempt
        ? "created"
        : providerOrderStatus === "paid"
          ? "pending"
          : purchase.status === "creating"
            ? "creating"
            : "pending";

  purchase = await FluxGemPurchase.findOneAndUpdate(
    { _id: purchase._id, creditedAt: null },
    {
      $set: {
        status: nextStatus,
        providerOrderStatus: String(order.status || ""),
        providerPaymentStatus: String(latestPayment?.status || ""),
        ...(latestPayment?.id ? { razorpayPaymentId: latestPayment.id } : {}),
        ...(latestPayment?.status === "failed"
          ? {
              failedAt: new Date(),
              failureReason: String(
                latestPayment.error_description ||
                  latestPayment.error_reason ||
                  "The latest Razorpay payment attempt failed.",
              ).slice(0, 500),
            }
          : {}),
        lastReconciledAt: new Date(),
        ...(webhookEventId ? { lastWebhookEventId: webhookEventId } : {}),
      },
    },
    { returnDocument: "after" },
  );

  return {
    credited: false,
    pending: !["failed", "created"].includes(nextStatus),
    canStartNewCheckout: nextStatus === "created" || nextStatus === "failed",
    status: latestPayment?.status || order.status || nextStatus,
    purchase,
  };
};