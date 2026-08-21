import mongoose from "mongoose";

import FluxGemPurchase from "../models/FluxGemPurchase.js";
import FluxGemTransaction from "../models/FluxGemTransaction.js";
import User from "../models/User.js";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getFluxGemPackage,
  getRazorpayPublicKey,
} from "./razorpay.service.js";
import { sendFluxGemPurchaseReceipt } from "./email.service.js";
import { createUserNotification } from "./notification.service.js";

const ensureMatchingPayment = ({ purchase, payment }) => {
  if (!payment) {
    const error = new Error("Razorpay payment details are unavailable.");
    error.statusCode = 400;
    throw error;
  }

  if (payment.order_id !== purchase.razorpayOrderId) {
    const error = new Error("Payment does not belong to this FluxGem order.");
    error.statusCode = 400;
    throw error;
  }

  if (
    Number(payment.amount) !== Number(purchase.amountPaise) ||
    payment.currency !== purchase.currency
  ) {
    const error = new Error("Payment amount or currency does not match the FluxGem order.");
    error.statusCode = 400;
    throw error;
  }
};

export const createFluxGemPurchase = async ({ userId, packageId }) => {
  const packageDetails = getFluxGemPackage(packageId);

  if (!packageDetails) {
    const error = new Error("Choose a valid FluxGem package.");
    error.statusCode = 400;
    throw error;
  }

  const order = await createRazorpayOrder({
    packageDetails,
    userId,
  });

  const purchase = await FluxGemPurchase.create({
    user: userId,
    packageId: packageDetails.id,
    gems: packageDetails.gems,
    amountPaise: packageDetails.amountPaise,
    currency: packageDetails.currency,
    razorpayOrderId: order.id,
  });

  return {
    purchase,
    packageDetails,
    order,
    keyId: getRazorpayPublicKey(),
  };
};

export const getPurchaseForUserByOrder = async ({ userId, orderId }) =>
  FluxGemPurchase.findOne({
    user: userId,
    razorpayOrderId: orderId,
  });

export const getPurchaseByOrder = async (orderId) =>
  FluxGemPurchase.findOne({ razorpayOrderId: orderId });

export const getCapturedRazorpayPayment = async ({
  purchase,
  paymentId,
}) => {
  const payment = await fetchRazorpayPayment(paymentId);
  ensureMatchingPayment({ purchase, payment });
  return payment;
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
      const currentPurchase = await FluxGemPurchase.findById(purchaseId).session(
        mongoSession,
      );

      if (!currentPurchase) {
        const error = new Error("FluxGem purchase was not found.");
        error.statusCode = 404;
        throw error;
      }

      ensureMatchingPayment({
        purchase: currentPurchase,
        payment,
      });

      if (payment.status !== "captured") {
        result = {
          credited: false,
          pending: true,
          status: payment.status || "unknown",
          purchase: currentPurchase,
        };
        return;
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
            capturedAt: now,
            creditedAt: now,
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
        const latestPurchase = await FluxGemPurchase.findById(
          currentPurchase._id,
        ).session(mongoSession);
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
        throw new Error("Unable to credit FluxGems to this account.");
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

  if (result?.credited && result.user?.email) {
    createUserNotification({
      userId: result.purchase.user,
      type: "reward",
      title: `${Number(result.purchase.gems || 0)} FluxGems added`,
      body: "Your Razorpay payment was verified and your StudyFluxAI wallet balance has been updated.",
      actionUrl: "/wallet",
      actionLabel: "View wallet",
      priority: "normal",
      dedupeKey: `purchase:${String(result.purchase._id)}:credited`,
      emailRequested: false,
      metadata: { purchaseId: String(result.purchase._id), gems: Number(result.purchase.gems || 0) },
    }).catch((error) => console.warn("Purchase notification failed:", error.message));

    sendFluxGemPurchaseReceipt({
      email: result.user.email,
      fullName: result.user.fullName,
      gems: result.purchase.gems,
      amountPaise: result.purchase.amountPaise,
      currency: result.purchase.currency,
      razorpayOrderId: result.purchase.razorpayOrderId,
      razorpayPaymentId: payment.id,
    }).catch((error) => {
      console.error("FluxGem purchase receipt email failed:", error.message);
    });
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
        ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
        failedAt: new Date(),
        failureReason: String(failureReason || "Payment failed.").slice(0, 500),
        ...(webhookEventId ? { lastWebhookEventId: webhookEventId } : {}),
      },
    },
    { returnDocument: "after" },
  );
