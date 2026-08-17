import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Gem,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  createFluxGemPurchaseOrder,
  verifyFluxGemPurchase,
} from "../services/fluxGemService";
import { loadRazorpayCheckout } from "../utils/razorpayCheckout";

const PACKAGES = [
  {
    id: "starter",
    gems: 100,
    price: "₹100",
    label: "Starter",
  },
  {
    id: "popular",
    gems: 250,
    price: "₹250",
    label: "Popular",
  },
  {
    id: "power-learner",
    gems: 500,
    price: "₹500",
    label: "Power Learner",
  },
];

function WalletPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [activePackageId, setActivePackageId] = useState(null);
  const fluxGems = Number(user?.fluxGems || 0);

  const handlePurchase = async (pack) => {
    if (activePackageId) {
      return;
    }

    try {
      setActivePackageId(pack.id);

      await loadRazorpayCheckout();
      const orderResponse = await createFluxGemPurchaseOrder(pack.id);
      const checkoutData = orderResponse?.data;

      if (!checkoutData?.order?.id || !checkoutData?.keyId || !window.Razorpay) {
        throw new Error("Razorpay checkout could not be prepared.");
      }

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
        theme: {
          color: "#6d5dfc",
        },
        modal: {
          ondismiss: () => {
            setActivePackageId(null);
          },
        },
        handler: async (paymentResponse) => {
          try {
            const verified = await verifyFluxGemPurchase(paymentResponse);
            const result = verified?.data;

            if (result?.pending) {
              toast.success(
                "Payment verified. Your FluxGems will appear as soon as Razorpay captures it.",
              );
              return;
            }

            if (Number.isFinite(Number(result?.balance))) {
              setUser((current) =>
                current
                  ? {
                      ...current,
                      fluxGems: Number(result.balance),
                    }
                  : current,
              );
            }

            toast.success(
              verified?.message || `${pack.gems} FluxGems added to your wallet.`,
            );
          } catch (error) {
            toast.error(
              error?.response?.data?.message ||
                error?.message ||
                "Payment succeeded, but wallet verification needs attention.",
            );
          } finally {
            setActivePackageId(null);
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        setActivePackageId(null);
        toast.error(
          response?.error?.description ||
            "The Razorpay payment did not complete.",
        );
      });

      razorpay.open();
    } catch (error) {
      setActivePackageId(null);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Razorpay checkout could not be opened.",
      );
    }
  };

  return (
    <DashboardLayout>
      <section className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </button>

        <div>
          <p className="text-sm font-bold text-emerald-600">Wallet</p>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading">
            FluxGems
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Earn FluxGems through StudyFluxAI activity or purchase more when
            you need additional AI usage.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="flex flex-col overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-violet-50 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <FluxGemMark size={54} />

            <div>
              <p className="text-sm font-bold text-emerald-700">
                Current balance
              </p>

              <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">
                {fluxGems}
              </p>

              <p className="text-sm text-slate-500">FluxGems</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/80 bg-white/70 p-4">
            <div className="flex items-start gap-3">
              <Sparkles
                size={18}
                className="mt-0.5 shrink-0 text-violet-600"
              />

              <p className="text-sm leading-6 text-slate-600">
                FluxGems power AI Notes, AI Quizzes, combined learning
                sessions and paid AI Tutor questions after the daily free
                allowance.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => navigate("/profile?section=razorpay-history")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-sm font-extrabold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <ReceiptText size={17} />
              Purchase history
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

              <h2 className="text-xl font-extrabold text-slate-900">
                Buy FluxGems
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PACKAGES.map((pack) => {
              const isActive = activePackageId === pack.id;
              const isBusy = Boolean(activePackageId);

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handlePurchase(pack)}
                  disabled={isBusy}
                  className="group rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/45 to-violet-50/45 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {pack.label}
                    </p>

                    {isActive && (
                      <LoaderCircle
                        size={16}
                        className="animate-spin text-violet-600"
                      />
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Gem size={18} className="text-emerald-600" />

                    <span className="text-xl font-extrabold text-slate-900">
                      {pack.gems}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-bold text-brand-600">
                    {isActive ? "Opening Razorpay…" : pack.price}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CreditCard
              size={18}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <p className="text-sm font-bold text-emerald-800">
                Razorpay secure checkout
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-700">
                The server creates the order and fixes the package price.
                FluxGems are credited only after the Razorpay payment is
                authenticated and confirmed as captured.
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
              <p className="text-sm font-bold text-emerald-600">
                Secure checkout
              </p>

              <h2 className="text-lg font-extrabold text-slate-900">
                Purchase protection
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <p className="flex gap-2 rounded-2xl bg-emerald-50/60 p-4 text-sm leading-6 text-slate-600">
              <CheckCircle2
                size={17}
                className="mt-1 shrink-0 text-emerald-500"
              />
              Checkout signatures are verified on the backend against the
              server-stored Razorpay order before any wallet credit occurs.
            </p>

            <p className="flex gap-2 rounded-2xl bg-emerald-50/60 p-4 text-sm leading-6 text-slate-600">
              <CheckCircle2
                size={17}
                className="mt-1 shrink-0 text-emerald-500"
              />
              Verified purchases create a permanent FluxGem transaction and
              a receipt entry in your profile, with webhook-safe duplicate
              protection.
            </p>
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}

export default WalletPage;
