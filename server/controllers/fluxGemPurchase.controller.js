import FluxGemPurchase from "../models/FluxGemPurchase.js";
import {
  createFluxGemPurchase,
  creditCapturedPurchase,
  getCapturedRazorpayPayment,
  getPurchaseByOrder,
  getPurchaseForUserByOrder,
  markPurchaseFailed,
} from "../services/fluxGemPurchase.service.js";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../services/razorpay.service.js";

const serializePurchase = (purchase) => ({
  id: purchase._id,
  packageId: purchase.packageId,
  gems: purchase.gems,
  amountPaise: purchase.amountPaise,
  currency: purchase.currency,
  razorpayOrderId: purchase.razorpayOrderId,
  razorpayPaymentId: purchase.razorpayPaymentId,
  status: purchase.status,
  creditedAt: purchase.creditedAt,
  createdAt: purchase.createdAt,
});

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const result = await createFluxGemPurchase({
      userId: req.user._id,
      packageId: req.body?.packageId,
    });

    return res.status(201).json({
      success: true,
      data: {
        purchaseId: result.purchase._id,
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
    const purchase = await FluxGemPurchase.findOne({
      _id: req.params.purchaseId,
      user: req.user._id,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
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

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("x-razorpay-signature");
    const eventId = req.get("x-razorpay-event-id") || "";
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");

    if (
      !signature ||
      !verifyRazorpayWebhookSignature({ rawBody, signature })
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay webhook signature.",
      });
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const payment = event?.payload?.payment?.entity;

    if (!payment?.order_id) {
      return res.status(200).json({ success: true });
    }

    const purchase = await getPurchaseByOrder(payment.order_id);

    if (!purchase) {
      return res.status(200).json({ success: true });
    }

    if (
      event.event === "payment.captured" ||
      (event.event === "order.paid" && payment.status === "captured")
    ) {
      await creditCapturedPurchase({
        purchaseId: purchase._id,
        payment,
        webhookEventId: eventId,
      });
    } else if (event.event === "payment.failed") {
      await markPurchaseFailed({
        orderId: payment.order_id,
        paymentId: payment.id,
        failureReason:
          payment.error_description ||
          payment.error_reason ||
          "Payment failed.",
        webhookEventId: eventId,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);
    return res.status(500).json({
      success: false,
      message: "Razorpay webhook processing failed.",
    });
  }
};
