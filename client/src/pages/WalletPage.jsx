import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Gem,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";
import DashboardLayout from "../layouts/DashboardLayout";

const PACKAGES = [
  {
    gems: 100,
    price: "₹100",
    label: "Starter",
  },
  {
    gems: 250,
    price: "₹250",
    label: "Popular",
  },
  {
    gems: 500,
    price: "₹500",
    label: "Power Learner",
  },
];

function WalletPage() {
  const navigate = useNavigate();

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
          <p className="text-sm font-bold text-emerald-600">
            Wallet
          </p>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading">
            FluxGems
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Earn FluxGems through StudyFluxAI activity
            or purchase more when you need additional
            AI usage.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-violet-50 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <FluxGemMark size={54} />

            <div>
              <p className="text-sm font-bold text-emerald-700">
                Current balance
              </p>

              <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">
                0
              </p>

              <p className="text-sm text-slate-500">
                FluxGems
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/80 bg-white/70 p-4">
            <div className="flex items-start gap-3">
              <Sparkles
                size={18}
                className="mt-0.5 shrink-0 text-violet-600"
              />

              <p className="text-sm leading-6 text-slate-600">
                FluxGems will be used for AI-generated
                notes, quizzes and paid AI Tutor usage
                once those systems are connected.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <WalletCards size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-brand-600">
                Purchase
              </p>

              <h2 className="text-xl font-extrabold text-slate-900">
                Buy FluxGems
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PACKAGES.map((pack) => (
              <button
                key={pack.gems}
                type="button"
                disabled
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left opacity-75"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {pack.label}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Gem
                    size={18}
                    className="text-emerald-600"
                  />

                  <span className="text-xl font-extrabold text-slate-900">
                    {pack.gems}
                  </span>
                </div>

                <p className="mt-2 text-sm font-bold text-brand-600">
                  {pack.price}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <CreditCard
              size={18}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div>
              <p className="text-sm font-bold text-amber-800">
                Razorpay checkout comes later
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                The wallet UI is ready, but purchases
                remain disabled until the secure
                server-side Razorpay order and signature
                verification flow is implemented.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck
              size={20}
              className="text-emerald-600"
            />

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
              FluxGems will only be credited after
              backend payment verification.
            </p>

            <p className="flex gap-2 rounded-2xl bg-emerald-50/60 p-4 text-sm leading-6 text-slate-600">
              <CheckCircle2
                size={17}
                className="mt-1 shrink-0 text-emerald-500"
              />
              Every verified purchase will create a
              permanent transaction record and receipt
              in your profile.
            </p>
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}

export default WalletPage;