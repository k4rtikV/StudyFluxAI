import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Gem,
  LoaderCircle,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import useAuth from "../hooks/useAuth";
import {
  createFluxGemPurchaseOrder,
  reconcileFluxGemPurchase,
  verifyFluxGemPurchase,
} from "../services/fluxGemService";
import { loadRazorpayCheckout } from "../utils/razorpayCheckout";
import { emitProgressionChanged } from "../utils/progressionEvents";

const PACKAGES = [
  { id: "starter", gems: 100, price: "₹100", label: "Starter" },
  { id: "popular", gems: 250, price: "₹250", label: "Popular" },
  { id: "power-learner", gems: 500, price: "₹500", label: "Power Learner" },
];

const makeRequestId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

function WalletPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [activePackageId, setActivePackageId] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const fluxGems = Number(user?.fluxGems || 0);

  const storageKey = useMemo(
    () => (user?.id || user?._id ? `studyflux:pending-purchase:${user.id || user._id}` : ""),
    [user?.id, user?._id],
  );

  const persistPending = useCallback(
    (value) => {
      setPendingPurchase(value);
      if (!storageKey) return;
      if (value) {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  const syncBalance = useCallback(
    (balance) => {
      if (!Number.isFinite(Number(balance))) return;
      setUser((current) =>
        current ? { ...current, fluxGems: Number(balance) } : current,
      );
    },
    [setUser],
  );

  const reconcilePending = useCallback(
    async ({ quiet = false, purchaseSnapshot = null } = {}) => {
      const currentPending = purchaseSnapshot || pendingPurchase;
      const purchaseId = currentPending?.purchaseId;
      if (!purchaseId || reconciling) return null;

      try {
        setReconciling(true);
        const response = await reconcileFluxGemPurchase(purchaseId);
        const result = response?.data || {};

        if (result.credited) {
          syncBalance(result.balance);
          emitProgressionChanged();
          persistPending(null);
          if (!quiet) toast.success("Payment confirmed — your FluxGems are ready.");
          return result;
        }

        const purchase = result.purchase || {};

        if (result.canStartNewCheckout && purchase.status === "created") {
          persistPending(null);
          if (!quiet) {
            toast("No completed payment was found. You can safely start a new checkout.");
          }
          return result;
        }

        if (purchase.status === "failed" && !result.pending) {
          persistPending({
            ...currentPending,
            status: "failed",
            failureReason: purchase.failureReason || "The latest payment attempt did not complete.",
          });
          return result;
        }

        persistPending({
          ...currentPending,
          status: "pending",
          providerStatus: result.paymentStatus || purchase.providerPaymentStatus || "pending",
        });
        return result;
      } catch (error) {
        if (!quiet) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Payment status could not be checked right now.",
          );
        }
        return null;
      } finally {
        setReconciling(false);
      }
    }, [pendingPurchase, persistPending, reconciling, syncBalance]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.purchaseId) setPendingPurchase(parsed);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!pendingPurchase?.purchaseId || pendingPurchase.status === "failed") return;
    const timer = window.setTimeout(() => {
      reconcilePending({ quiet: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pendingPurchase?.purchaseId]); // intentionally run when a persisted purchase is restored

  const handlePurchase = async (pack) => {
    if (activePackageId) return;
    if (pendingPurchase?.purchaseId && pendingPurchase.status !== "failed") {
      toast("Check the existing purchase status before starting another checkout.");
      return;
    }

    const clientRequestId = makeRequestId();
    let preparedPurchase = null;

    try {
      setActivePackageId(pack.id);
      await loadRazorpayCheckout();
      const orderResponse = await createFluxGemPurchaseOrder(pack.id, clientRequestId);
      const checkoutData = orderResponse?.data;

      if (!checkoutData?.order?.id || !checkoutData?.keyId || !window.Razorpay) {
        throw new Error("Razorpay checkout could not be prepared.");
      }

      preparedPurchase = {
        purchaseId: String(checkoutData.purchaseId || ""),
        packageId: pack.id,
        gems: pack.gems,
        clientRequestId: checkoutData.clientRequestId || clientRequestId,
        status: "created",
        createdAt: new Date().toISOString(),
      };
      persistPending(preparedPurchase);

      const razorpay = new window.Razorpay({
        key: checkoutData.keyId,
        amount: checkoutData.order.amount,
        currency: checkoutData.order.currency,
        name: "StudyFluxAI",
        description: `${checkoutData.package.gems} FluxGems`,
        order_id: checkoutData.order.id,
        prefill: {
          name: user?.fullName || "",
          email: user?.email || "",
        },
        notes: {
          purchaseId: String(checkoutData.purchaseId || ""),
        },
        theme: { color: "#6d5dfc" },
        modal: {
          ondismiss: () => {
            setActivePackageId(null);
            if (!preparedPurchase?.purchaseId) return;

            const dismissedPurchase = { ...preparedPurchase, status: "pending" };
            persistPending(dismissedPurchase);
            window.setTimeout(() => {
              reconcilePending({ quiet: true, purchaseSnapshot: dismissedPurchase });
            }, 500);
          },
        },
        handler: async (paymentResponse) => {
          try {
            const verified = await verifyFluxGemPurchase(paymentResponse);
            const result = verified?.data;

            if (result?.pending) {
              persistPending({ ...preparedPurchase, status: "pending" });
              toast.success(
                "Payment verified. We’ll credit the FluxGems as soon as Razorpay captures it.",
              );
              return;
            }

            syncBalance(result?.balance);
            emitProgressionChanged();
            persistPending(null);
            toast.success(
              verified?.message || `${pack.gems} FluxGems added to your wallet.`,
            );
          } catch (error) {
            persistPending({ ...preparedPurchase, status: "pending" });
            toast.error(
              error?.response?.data?.message ||
                error?.message ||
                "Payment may have succeeded, but wallet verification needs attention. Use Check status below.",
            );
          } finally {
            setActivePackageId(null);
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        setActivePackageId(null);
        persistPending({
          ...preparedPurchase,
          status: "failed",
          failureReason:
            response?.error?.description || "The Razorpay payment did not complete.",
        });
        toast.error(
          response?.error?.description || "The Razorpay payment did not complete.",
        );
      });

      razorpay.open();
    } catch (error) {
      setActivePackageId(null);
      if (!preparedPurchase?.purchaseId) persistPending(null);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Razorpay checkout could not be opened.",
      );
    }
  };

  const pendingFailed = pendingPurchase?.status === "failed";
  const unresolvedPurchase = Boolean(
    pendingPurchase?.purchaseId && pendingPurchase.status !== "failed",
  );

  return (
    <>
      <section className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <p className="text-sm font-bold text-emerald-600">Wallet</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading">FluxGems</h1>
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Earn FluxGems through StudyFluxAI activity or purchase more when you need additional AI usage.
          </p>
        </div>
      </section>

      {pendingPurchase?.purchaseId && (
        <section
          className={`mt-5 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            pendingFailed
              ? "border-rose-200 bg-rose-50/80"
              : "border-amber-200 bg-amber-50/80"
          }`}
          aria-live="polite"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ${pendingFailed ? "text-rose-600" : "text-amber-600"}`}>
              {pendingFailed ? <AlertCircle size={19} /> : <LoaderCircle size={19} className={reconciling ? "animate-spin" : ""} />}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-extrabold ${pendingFailed ? "text-rose-900" : "text-amber-900"}`}>
                {pendingFailed ? "Latest payment attempt needs attention" : "Purchase awaiting confirmation"}
              </p>
              <p id="pending-purchase-guidance" className={`mt-1 text-xs leading-5 ${pendingFailed ? "text-rose-700" : "text-amber-700"}`}>
                {pendingFailed
                  ? pendingPurchase.failureReason || "The latest Razorpay attempt did not complete. You can safely start a new checkout."
                  : "If the browser closed or verification timed out after payment, StudyFluxAI can reconcile this order directly with Razorpay."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => reconcilePending()}
              disabled={reconciling}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-current/10 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} className={reconciling ? "animate-spin" : ""} />
              {reconciling ? "Checking…" : "Check status"}
            </button>
            {pendingFailed && (
              <button
                type="button"
                onClick={() => persistPending(null)}
                className="rounded-xl px-3 py-2.5 text-xs font-extrabold text-rose-700 transition hover:bg-white/70"
              >
                Dismiss
              </button>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="flex flex-col overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-violet-50 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <FluxGemMark size={54} />
            <div>
              <p className="text-sm font-bold text-emerald-700">Current balance</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">{fluxGems}</p>
              <p className="text-sm text-slate-500">FluxGems</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/80 bg-white/70 p-4">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-violet-600" />
              <p className="text-sm leading-6 text-slate-600">
                FluxGems power AI Notes, AI Quizzes, combined learning sessions and paid AI Tutor questions after the daily free allowance.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => navigate("/profile?section=razorpay-history")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm font-extrabold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <ReceiptText size={17} /> Purchase history
            </button>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <WalletCards size={21} />
            </div>
            <div>
              <p className="text-sm font-bold text-brand-600">Purchase</p>
              <h2 className="text-xl font-extrabold text-slate-900">Buy FluxGems</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PACKAGES.map((pack) => {
              const isActive = activePackageId === pack.id;
              const isBusy = Boolean(activePackageId) || unresolvedPurchase;

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handlePurchase(pack)}
                  disabled={isBusy}
                  aria-describedby={unresolvedPurchase ? "pending-purchase-guidance" : undefined}
                  className="group flex min-h-[142px] flex-col rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/45 to-violet-50/45 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{pack.label}</p>
                    {isActive && <LoaderCircle size={16} className="animate-spin text-violet-600" />}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Gem size={18} className="text-emerald-600" />
                    <span className="text-xl font-extrabold text-slate-900">{pack.gems}</span>
                  </div>
                  <p className="mt-auto pt-3 text-sm font-bold text-brand-600">
                    {isActive ? "Preparing checkout…" : pack.price}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Razorpay secure checkout</p>
              <p className="mt-1 text-sm leading-6 text-emerald-700">
                Package price and FluxGem quantity are fixed on the server. A wallet credit occurs exactly once after Razorpay confirms a captured payment.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-600">Secure checkout</p>
              <h2 className="text-lg font-extrabold text-slate-900">Purchase protection</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <p className="flex gap-2 rounded-2xl bg-emerald-50/60 p-4 text-sm leading-6 text-slate-600">
              <CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-500" />
              Checkout signatures, provider order ownership, amount and currency are verified on the backend before any wallet credit occurs.
            </p>
            <p className="flex gap-2 rounded-2xl bg-emerald-50/60 p-4 text-sm leading-6 text-slate-600">
              <CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-500" />
              Webhook deduplication and purchase reconciliation protect against retries, refreshes, duplicate callbacks and browser closure after payment.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}

export default WalletPage;
