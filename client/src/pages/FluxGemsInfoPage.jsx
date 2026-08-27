import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CircleDollarSign,
  CircleHelp,
  Coins,
  CreditCard,
  Flame,
  Gift,
  History,
  Info,
  LockKeyhole,
  Medal,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router";

import FluxGemMark from "../components/dashboard/FluxGemMark";

const EARNING_METHODS = [
  {
    icon: Trophy,
    title: "Daily Challenges",
    text: "Complete eligible Daily Challenges and earn FluxGems when that challenge includes a Gem reward.",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Target,
    title: "Quiz performance",
    text: "High quiz scores can earn FluxGems back on eligible study sessions, helping strong performance offset part of the cost.",
    accent: "bg-brand-50 text-brand-600",
  },
  {
    icon: Flame,
    title: "Learning streaks",
    text: "Keep your learning streak alive and selected streak milestones can award FluxGems alongside XP.",
    accent: "bg-orange-50 text-orange-600",
  },
  {
    icon: Medal,
    title: "Achievements",
    text: "Unlock selected achievements and milestone badges to earn one-time FluxGem rewards where applicable.",
    accent: "bg-violet-50 text-violet-600",
  },
  {
    icon: Gift,
    title: "Special rewards",
    text: "Community events, special milestones or limited challenges may occasionally include bonus FluxGem rewards.",
    accent: "bg-cyan-50 text-cyan-600",
  },
];

const USAGE_METHODS = [
  {
    icon: Sparkles,
    title: "AI Notes + Quiz generation",
    text: "Generate structured notes and a matching quiz from a topic or source using FluxGems.",
  },
  {
    icon: BrainCircuit,
    title: "AI Tutor",
    text: "Use your included free Tutor questions first. Additional questions can then be paid for with FluxGems.",
  },
  {
    icon: Zap,
    title: "Advanced AI actions",
    text: "Future higher-cost AI features can also use FluxGems, with the price shown before you continue.",
  },
];

const LEDGER_TYPES = [
  ["Purchased", "FluxGems added after a successful, backend-verified Razorpay payment."],
  ["Earned", "FluxGems earned from eligible challenges, quizzes, streaks, achievements and other rewards."],
  ["Spent", "FluxGems used for AI generation, Tutor usage or other paid learning actions."],
  ["Refunded", "FluxGems returned when an eligible charge is reversed, cancelled or corrected."],
];

function SectionHeading({
  eyebrow,
  title,
  text,
}) {
  return (
    <div>
      <p className="text-sm font-bold text-brand-600">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h2>

      {text && (
        <p className="mt-2 max-w-3xl leading-7 text-slate-600">
          {text}
        </p>
      )}
    </div>
  );
}

function FluxGemsInfoPage() {
  const navigate = useNavigate();

  return (
    <>
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
            Currency guide
          </p>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            FluxGems guide
          </h1>

          <p className="mt-2 max-w-3xl leading-7 text-muted">
            Understand how FluxGems work, how to add more,
            how to earn them through learning, where they are
            spent, and how your balance history is tracked.
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-violet-50 p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="flex items-center gap-4">
              <FluxGemMark size={58} />

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
                  Learning currency
                </p>

                <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                  FluxGems
                </h2>
              </div>
            </div>

            <p className="mt-5 max-w-2xl leading-7 text-slate-700">
              FluxGems are StudyFluxAI's spendable learning
              currency. You can earn them through selected
              learning activities or top up your balance when
              you want additional AI usage.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/wallet")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <WalletCards size={17} />
                Open FluxGems wallet
              </button>

              <button
                type="button"
                onClick={() => navigate("/profile?section=gem-activity")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-white"
              >
                <History size={17} />
                View Gem activity
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <Info
                size={20}
                className="mt-0.5 shrink-0 text-brand-600"
              />

              <div>
                <p className="font-extrabold text-slate-900">
                  FluxGems are not XP
                </p>

                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  XP measures progression and leaderboard standing.
                  FluxGems are the spendable currency used for
                  eligible AI-powered learning actions. XP cannot
                  be purchased.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Top up"
          title="How to top up your balance"
          text="Top-ups are handled through your Wallet using a secure Razorpay checkout flow."
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {[
            {
              icon: WalletCards,
              step: "01",
              title: "Open your Wallet",
              text: "Use the Buy button beside your balance or open the Wallet from anywhere in StudyFluxAI.",
            },
            {
              icon: Coins,
              step: "02",
              title: "Choose a FluxGem pack",
              text: "Pick the amount that suits you. The INR price and FluxGem amount are shown clearly before checkout.",
            },
            {
              icon: CreditCard,
              step: "03",
              title: "Complete checkout",
              text: "Pay securely through Razorpay using any payment method available to you at checkout.",
            },
            {
              icon: BadgeCheck,
              step: "04",
              title: "Balance is credited",
              text: "StudyFluxAI verifies the payment on the backend before the FluxGems are added to your balance.",
            },
          ].map(
            ({
              icon: Icon,
              step,
              title,
              text,
            }) => (
              <article
                key={step}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon size={19} />
                  </div>

                  <span className="text-xs font-extrabold tracking-[0.12em] text-slate-300">
                    {step}
                  </span>
                </div>

                <h3 className="mt-4 font-extrabold text-slate-900">
                  {title}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {text}
                </p>
              </article>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate("/wallet")}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
        >
          Go to Wallet
          <ArrowRight size={16} />
        </button>
      </section>

      <section className="mt-9">
        <SectionHeading
          eyebrow="Earn"
          title="Ways to earn FluxGems"
          text="FluxGems are not purchase-only. Selected learning milestones and activities can reward you with more."
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {EARNING_METHODS.map(
            ({
              icon: Icon,
              title,
              text,
              accent,
            }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <div
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${accent}`}
                >
                  <Icon size={20} />
                </div>

                <h3 className="mt-4 font-extrabold text-slate-900">
                  {title}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {text}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mt-9">
        <SectionHeading
          eyebrow="Spend"
          title="What FluxGems are used for"
          text="Whenever an action costs FluxGems, StudyFluxAI should show the price before you confirm it. Your balance is updated only after the backend records the transaction."
        />

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {USAGE_METHODS.map(
            ({
              icon: Icon,
              title,
              text,
            }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon size={20} />
                </div>

                <h3 className="mt-4 font-extrabold text-slate-900">
                  {title}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {text}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mt-9 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <SectionHeading
            eyebrow="Account history"
            title="Your FluxGem history is fully tracked"
            text="Gem Activity in your Profile shows how your balance changed over time and why."
          />

          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
            {LEDGER_TYPES.map(
              ([title, text]) => (
                <div
                  key={title}
                  className="flex gap-3 bg-slate-50/60 p-4"
                >
                  <RefreshCw
                    size={17}
                    className="mt-0.5 shrink-0 text-violet-600"
                  />

                  <div>
                    <p className="text-sm font-extrabold text-slate-800">
                      {title}
                    </p>

                    <p className="mt-0.5 text-sm leading-6 text-slate-500">
                      {text}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-700"
          >
            View account history
            <ArrowRight size={16} />
          </button>
        </article>

        <article className="rounded-3xl border border-emerald-200/80 bg-emerald-50/60 p-6 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-white">
            <ShieldCheck size={21} />
          </div>

          <h2 className="mt-5 text-2xl font-extrabold text-slate-900">
            How your balance is protected
          </h2>

          <div className="mt-5 space-y-4">
            {[
              {
                icon: LockKeyhole,
                text: "A browser-side payment success message is never enough to credit FluxGems.",
              },
              {
                icon: ReceiptText,
                text: "Every verified Razorpay purchase creates a separate payment record and receipt history.",
              },
              {
                icon: History,
                text: "Every FluxGem balance change is backed by a transaction record for traceability.",
              },
              {
                icon: CircleDollarSign,
                text: "The INR price and FluxGem amount are shown before you confirm a purchase.",
              },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/70 p-4"
              >
                <Icon
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />

                <p className="text-sm leading-6 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-9 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            [
              "Can I use StudyFluxAI without purchasing FluxGems?",
              "Yes. FluxGems can also be earned through eligible StudyFluxAI activities. Some features may additionally include free usage before Gems are required.",
            ],
            [
              "Can XP be converted into FluxGems?",
              "XP and FluxGems serve different purposes. XP represents progression and leaderboard reputation, while FluxGems are the spendable learning currency.",
            ],
            [
              "What happens if I do not have enough FluxGems?",
              "StudyFluxAI should block the paid action before generation begins and show the required balance, with an option to earn or purchase more.",
            ],
            [
              "Where can I see what happened to my balance?",
              "Open your Profile and check Gem Activity. Purchases through Razorpay are also shown separately in Razorpay Transaction History.",
            ],
            [
              "Are purchases credited immediately?",
              "They are credited after StudyFluxAI's backend verifies the payment. The wallet UI will update after that verified transaction completes.",
            ],
            [
              "Can reward amounts or AI costs change?",
              "Reward values and AI costs can evolve as features are finalized. StudyFluxAI should always show the current cost or reward before the relevant action.",
            ],
          ].map(([question, answer]) => (
            <article
              key={question}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5"
            >
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={18}
                  className="mt-0.5 shrink-0 text-brand-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    {question}
                  </h3>

                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {answer}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default FluxGemsInfoPage;