import {
  ArrowUpRight,
  Award,
  BookOpen,
  CreditCard,
  GraduationCap,
  History,
  Flame,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";

import useAuth from "../hooks/useAuth";
import UserAvatar from "../components/common/UserAvatar";
import LevelKite from "../components/progression/LevelKite";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  getFluxGemActivity,
  getFluxGemPurchases,
} from "../services/fluxGemService";
import {
  getLearningProfile,
} from "../services/learningProfileService";
import { getProgressOverview } from "../services/progressService";

const ACTIVITY_LABELS = {
  developer_grant: "Developer test grant",
  purchase: "FluxGem purchase",
  reward: "FluxGem reward",
  daily_challenge_reward: "Daily challenge reward",
  signup_bonus: "Welcome bonus",
  level_reward: "Level reward",
  ai_tutor: "AI Tutor question",
  ai_tutor_refund: "AI Tutor question refund",
  ai_tutor_quiz_conversion: "AI Tutor quiz conversion",
  smart_interview: "Smart Interview",
};

const getGenerationActivityLabel = (activity, refund = false) => {
  const generationType =
    activity?.metadata?.generationType ||
    activity?.studySession?.generationType ||
    "combined";

  const label =
    generationType === "notes"
      ? "AI Notes generation"
      : generationType === "quiz"
        ? "AI Quiz generation"
        : "AI Notes + Quiz generation";

  return refund ? `${label} refund` : label;
};

const getActivityLabel = (activity) => {
  if (activity.reason === "ai_generation") {
    return getGenerationActivityLabel(activity);
  }

  if (activity.reason === "ai_generation_refund") {
    return getGenerationActivityLabel(activity, true);
  }

  return (
    ACTIVITY_LABELS[activity.reason] ||
    activity.reason ||
    "FluxGem activity"
  );
};

const formatActivityDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));


const HISTORY_PAGE_SIZE = 20;

const formatCurrency = (metadata = {}) => {
  const paise = Number(
    metadata.amountInPaise ??
      metadata.amountPaise ??
      metadata.razorpayAmount ??
      metadata.amount_paise,
  );

  if (Number.isFinite(paise) && paise > 0) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    }).format(paise / 100);
  }

  const rupees = Number(
    metadata.amountInRupees ??
      metadata.amountRupees ??
      metadata.rupees,
  );

  if (Number.isFinite(rupees) && rupees > 0) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(rupees);
  }

  return null;
};

const getPaymentReference = (metadata = {}) =>
  metadata.razorpayPaymentId ||
  metadata.paymentId ||
  metadata.payment_id ||
  null;

const getOrderReference = (metadata = {}) =>
  metadata.razorpayOrderId ||
  metadata.orderId ||
  metadata.order_id ||
  null;

const LEVEL_LABELS = {
  class_7: "Class 7",
  class_8: "Class 8",
  class_9: "Class 9",
  class_10: "Class 10",
  class_11: "Class 11",
  class_12: "Class 12",
  diploma: "Diploma",
  bachelors: "Bachelor's / Undergraduate",
  masters: "Master's / Postgraduate",
  mba: "MBA",
  phd: "PhD / Doctorate",
  other: "Other",
};

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-semibold text-slate-800">
        {value || "Not set"}
      </p>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sectionScrollKeyRef = useRef(null);
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressOverview, setProgressOverview] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [gemActivity, setGemActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);

  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(true);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseHasMore, setPurchaseHasMore] = useState(false);
  const [purchaseLoadingMore, setPurchaseLoadingMore] = useState(false);

  useEffect(() => {
    const requestedSection = new URLSearchParams(location.search).get(
      "section",
    );

    const targetId =
      requestedSection === "gem-activity"
        ? "gem-activity"
        : requestedSection === "razorpay-history"
          ? "razorpay-history"
          : null;

    if (!targetId) {
      sectionScrollKeyRef.current = null;
      return undefined;
    }

    const targetIsLoading =
      targetId === "gem-activity" ? activityLoading : purchaseLoading;
    const scrollKey = `${location.pathname}${location.search}`;

    if (targetIsLoading || sectionScrollKeyRef.current === scrollKey) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        sectionScrollKeyRef.current = scrollKey;
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [
    activityLoading,
    location.pathname,
    location.search,
    purchaseLoading,
  ]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response =
          await getLearningProfile();

        if (active) {
          setProfile(
            response.data?.profile || null,
          );
        }
      } catch {
        toast.error(
          "We couldn't load your learning profile.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      try {
        const response = await getProgressOverview();
        if (active) {
          const nextOverview = response?.data || null;
          setProgressOverview(nextOverview);
          setProgressError("");
          const nextBalance = Number(nextOverview?.progression?.fluxGemsBalance);
          if (Number.isFinite(nextBalance)) {
            setUser((current) =>
              current ? { ...current, fluxGems: nextBalance } : current,
            );
          }
        }
      } catch (error) {
        if (active) {
          const message =
            error?.response?.data?.message ||
            "Your progression could not be loaded.";
          setProgressError(message);
          toast.error(message);
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    };

    loadProgress();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        const [activityResponse, purchaseResponse] = await Promise.all([
          getFluxGemActivity({
            limit: HISTORY_PAGE_SIZE,
            page: 1,
          }),
          getFluxGemPurchases({
            limit: HISTORY_PAGE_SIZE,
            page: 1,
          }),
        ]);

        if (!active) {
          return;
        }

        setGemActivity(activityResponse?.data?.transactions || []);
        setActivityPage(1);
        setActivityHasMore(
          Boolean(activityResponse?.data?.pagination?.hasMore),
        );

        setPurchaseHistory(purchaseResponse?.data?.transactions || []);
        setPurchasePage(1);
        setPurchaseHasMore(
          Boolean(purchaseResponse?.data?.pagination?.hasMore),
        );
      } catch (error) {
        if (active) {
          toast.error(
            error?.response?.data?.message ||
              "Your FluxGem history could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setActivityLoading(false);
          setPurchaseLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const loadOlderActivity = async () => {
    if (!activityHasMore || activityLoadingMore) {
      return;
    }

    try {
      setActivityLoadingMore(true);
      const nextPage = activityPage + 1;
      const response = await getFluxGemActivity({
        limit: HISTORY_PAGE_SIZE,
        page: nextPage,
      });

      setGemActivity((current) => [
        ...current,
        ...(response?.data?.transactions || []),
      ]);
      setActivityPage(nextPage);
      setActivityHasMore(Boolean(response?.data?.pagination?.hasMore));
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Older FluxGem activity could not be loaded.",
      );
    } finally {
      setActivityLoadingMore(false);
    }
  };

  const loadOlderPurchases = async () => {
    if (!purchaseHasMore || purchaseLoadingMore) {
      return;
    }

    try {
      setPurchaseLoadingMore(true);
      const nextPage = purchasePage + 1;
      const response = await getFluxGemPurchases({
        limit: HISTORY_PAGE_SIZE,
        page: nextPage,
      });

      setPurchaseHistory((current) => [
        ...current,
        ...(response?.data?.transactions || []),
      ]);
      setPurchasePage(nextPage);
      setPurchaseHasMore(Boolean(response?.data?.pagination?.hasMore));
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Older Razorpay purchases could not be loaded.",
      );
    } finally {
      setPurchaseLoadingMore(false);
    }
  };

  const progressStats = progressOverview?.stats || {};
  const progression = progressOverview?.progression || {};
  const level = Number(progression.level || progressStats.level || 1);
  const totalXp = Number(progressStats.totalXp || 0);
  const xpIntoLevel = Number(progression.xpIntoLevel || 0);
  const xpForLevel = Number(progression.xpForLevel || 0);
  const progressPercent = Number(progression.progressPercent || 0);
  const xpToNextLevel = Number(progression.xpToNextLevel || 0);
  const levels = Array.isArray(progression.levels) ? progression.levels : [];

  return (
    <DashboardLayout>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-600">
            Account
          </p>

          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-heading">
            Your profile
          </h1>

          <p className="mt-2 max-w-2xl leading-7 text-muted">
            View your StudyFluxAI account and the
            academic context used to personalize
            learning experiences.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/profile/edit")
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
        >
          <Pencil size={17} />
          Edit profile
        </button>
      </section>

      <section className="mt-6 overflow-hidden rounded-[30px] border border-violet-200/80 bg-gradient-to-br from-violet-50/95 via-white to-emerald-50/80 shadow-[0_20px_50px_rgba(91,33,182,0.08)]">
        {progressLoading ? (
          <div className="flex min-h-[240px] items-center justify-center p-6">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
              <LoaderCircle size={18} className="animate-spin text-violet-600" />
              Loading progression...
            </div>
          </div>
        ) : progressError && !progressOverview ? (
          <div className="flex min-h-[240px] items-center justify-center p-6 text-center">
            <div>
              <Trophy className="mx-auto text-amber-500" size={30} />
              <h2 className="mt-3 text-lg font-black text-slate-950">Progression temporarily unavailable</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{progressError}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  <LevelKite level={level} size={88} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                    StudyFluxAI progression
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Level {level}
                    </h2>
                    <span className="text-sm font-bold text-slate-500">
                      {totalXp.toLocaleString()} lifetime XP
                    </span>
                  </div>

                  <div className="mt-4 max-w-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <span className="text-slate-600">
                        {progression.isMaxLevel
                          ? "Current level cap reached"
                          : `Progress to Level ${Number(progression.nextLevel || level + 1)}`}
                      </span>
                      <span className="text-violet-700">
                        {progression.isMaxLevel
                          ? "MAX LEVEL"
                          : `${xpIntoLevel.toLocaleString()} / ${xpForLevel.toLocaleString()} XP`}
                      </span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-white ring-1 ring-violet-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-600 transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {progression.isMaxLevel
                        ? `You have reached Level ${Number(progression.maxLevel || 12)}, the current StudyFluxAI progression cap.`
                        : `${xpToNextLevel.toLocaleString()} XP remaining. Lifetime XP never resets when you level up.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white bg-white/78 p-3 shadow-sm">
                  <Trophy size={16} className="text-amber-600" />
                  <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Quiz XP</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{Number(progressStats.quizXp || 0)}</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/78 p-3 shadow-sm">
                  <Flame size={16} className="text-emerald-600" />
                  <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Streak</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{Number(progressStats.currentStreak || 0)}d</p>
                </div>
                <div className="rounded-2xl border border-white bg-white/78 p-3 shadow-sm">
                  <Award size={16} className="text-violet-600" />
                  <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Awards</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{Number(progressStats.unlockedCount || 0)}</p>
                </div>
              </div>
            </div>

            {levels.length > 0 ? (
              <div className="mt-6 border-t border-violet-100/80 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-slate-500">Level journey</p>
                    <p className="mt-1 text-xs text-slate-500">Thresholds are lifetime XP totals.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/achievements")}
                    className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-extrabold text-violet-700 transition hover:bg-violet-50"
                  >
                    XP rules & achievements
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
                  {levels.map((item) => {
                    const reached = totalXp >= Number(item.threshold || 0);
                    const current = Number(item.level) === level;
                    return (
                      <div
                        key={item.level}
                        className={`rounded-xl border px-2 py-2.5 text-center transition ${
                          current
                            ? "border-violet-300 bg-violet-100/80 ring-2 ring-violet-100"
                            : reached
                              ? "border-emerald-200 bg-emerald-50/75"
                              : "border-slate-200 bg-white/70"
                        }`}
                      >
                        <p className={`text-xs font-black ${current ? "text-violet-700" : reached ? "text-emerald-700" : "text-slate-500"}`}>
                          L{item.level}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          {Number(item.threshold || 0).toLocaleString()} XP
                        </p>
                        <p className={`mt-1 text-[9px] font-extrabold ${reached ? "text-emerald-600" : "text-violet-500"}`}>
                          +{Number(item.fluxGemReward || 0)} FG
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              XP is earned progression and cannot be purchased. Reaching each level grants its one-time FluxGem reward; FluxGems remain your separate spendable AI currency.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <UserAvatar
              user={user}
              className="h-24 w-24 rounded-3xl border border-slate-200 shadow-sm"
              initialsClassName="text-3xl"
            />

            <h2 className="mt-5 text-2xl font-extrabold text-slate-900">
              {user?.fullName || "Student"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {user?.email}
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <ShieldCheck size={14} />
                Verified account
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                <GraduationCap size={14} />
                Learning profile ready
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <InfoRow
              label="Full name"
              value={user?.fullName}
            />

            <InfoRow
              label="Email"
              value={user?.email}
            />

            <InfoRow
              label="Sign-in methods"
              value={
                user?.authProviders?.length
                  ? user.authProviders
                      .map((provider) =>
                        provider === "google"
                          ? "Google"
                          : "Email & password",
                      )
                      .join(" · ")
                  : "StudyFluxAI account"
              }
            />
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 via-violet-50 to-emerald-50 text-brand-600">
              <BookOpen size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-brand-600">
                Personalization
              </p>

              <h2 className="text-xl font-extrabold text-slate-900">
                Learning profile
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">
              Loading learning profile...
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InfoRow
                label="Education level"
                value={
                  LEVEL_LABELS[
                    profile?.educationLevel
                  ] ||
                  profile?.educationLevel
                }
              />

              <InfoRow
                label="State / UT"
                value={
                  profile?.institutionState ||
                  "Not applicable"
                }
              />

              <InfoRow
                label="Institution"
                value={
                  profile?.institutionName
                }
              />

              <InfoRow
                label="Institution type"
                value={
                  profile?.institutionCategory
                    ? profile.institutionCategory
                        .charAt(0)
                        .toUpperCase() +
                      profile.institutionCategory.slice(
                        1,
                      )
                    : profile?.institutionType
                }
              />

              <InfoRow
                label="Program / degree"
                value={
                  profile?.program ||
                  "Not applicable"
                }
              />

              <InfoRow
                label="Stream / specialization"
                value={
                  profile?.stream ||
                  "Not applicable"
                }
              />
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-sm font-bold text-emerald-800">
              How this is used
            </p>

            <p className="mt-1.5 text-sm leading-6 text-emerald-800/80">
              StudyFluxAI uses these details as the
              default academic context for notes,
              quizzes, AI tutor explanations and
              personalized recommendations.
            </p>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <article id="gem-activity" className="flex min-h-[620px] scroll-mt-24 flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:h-[700px] xl:min-h-0">
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                <History size={20} />
              </div>

              <div>
                <p className="text-sm font-bold text-violet-600">
                  FluxGems
                </p>

                <h2 className="text-xl font-extrabold text-slate-900">
                  Gem activity
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Every FluxGem earned, spent, purchased or refunded will appear
              here as part of your account history.
            </p>
          </div>

          {activityLoading ? (
            <div className="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <LoaderCircle size={17} className="animate-spin" />
                Loading Gem activity...
              </div>
            </div>
          ) : gemActivity.length === 0 ? (
            <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <WalletCards size={22} className="text-slate-400" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                No FluxGem activity yet.
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Rewards, AI usage, purchases and refunds will be recorded here.
              </p>
            </div>
          ) : (
            <div className="sf-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-2.5">
                {gemActivity.map((activity) => {
                  const amount = Number(activity.amount || 0);
                  const positive = amount > 0;

                  return (
                    <div
                      key={activity.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/65 p-4 sm:flex-row sm:items-center"
                    >
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          positive
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-violet-50 text-violet-600"
                        }`}
                      >
                        <WalletCards size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-800">
                          {getActivityLabel(activity)}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {formatActivityDate(activity.createdAt)}
                          {Number.isFinite(Number(activity.balanceAfter))
                            ? ` · Balance ${Number(activity.balanceAfter)}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {activity.studySession?.id && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/study/${activity.studySession.id}`)
                            }
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 transition hover:text-indigo-800"
                          >
                            Session
                            <ArrowUpRight size={13} />
                          </button>
                        )}

                        {activity.tutorConversation?.id && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/ai-tutor?conversation=${activity.tutorConversation.id}`,
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-700 transition hover:text-cyan-900"
                          >
                            Tutor
                            <ArrowUpRight size={13} />
                          </button>
                        )}

                        <span
                          className={`text-sm font-extrabold ${
                            positive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {amount}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {activityHasMore && (
                  <button
                    type="button"
                    onClick={loadOlderActivity}
                    disabled={activityLoadingMore}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/55 px-4 py-3 text-sm font-extrabold text-violet-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {activityLoadingMore && (
                      <LoaderCircle size={15} className="animate-spin" />
                    )}
                    {activityLoadingMore ? "Loading older activity..." : "Load older activity"}
                  </button>
                )}
              </div>
            </div>
          )}
        </article>

        <article id="razorpay-history" className="flex min-h-[620px] scroll-mt-24 flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:h-[700px] xl:min-h-0">
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CreditCard size={20} />
              </div>

              <div>
                <p className="text-sm font-bold text-emerald-600">
                  Payments
                </p>

                <h2 className="text-xl font-extrabold text-slate-900">
                  Razorpay transaction history
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Verified FluxGem purchases made through Razorpay are listed
              separately from normal Gem usage and rewards.
            </p>
          </div>

          {purchaseLoading ? (
            <div className="mt-5 flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <LoaderCircle size={17} className="animate-spin" />
                Loading purchase history...
              </div>
            </div>
          ) : purchaseHistory.length === 0 ? (
            <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <CreditCard size={22} className="text-slate-400" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                No Razorpay purchases yet.
              </p>

              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                Payment ID, order ID, amount, FluxGems credited, status and
                purchase date will appear here once verified purchases exist.
              </p>
            </div>
          ) : (
            <div className="sf-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-2.5">
                {purchaseHistory.map((purchase) => {
                  const metadata = purchase.metadata || {};
                  const paymentId = getPaymentReference(metadata);
                  const orderId = getOrderReference(metadata);
                  const currency = formatCurrency(metadata);
                  const status = metadata.status || "Verified";

                  return (
                    <div
                      key={purchase.id}
                      className="rounded-2xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/55 via-white to-cyan-50/45 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100/70 text-emerald-700">
                            <CreditCard size={18} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-slate-800">
                              FluxGem purchase
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {formatActivityDate(purchase.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-sm font-extrabold text-emerald-700">
                            +{Number(purchase.amount || 0)} FluxGems
                          </p>
                          {currency && (
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {currency}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
                          <p className="font-bold uppercase tracking-[0.1em] text-slate-400">
                            Payment ID
                          </p>
                          <p className="mt-1 truncate font-semibold text-slate-700" title={paymentId || "Not recorded"}>
                            {paymentId || "Not recorded"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
                          <p className="font-bold uppercase tracking-[0.1em] text-slate-400">
                            Order ID
                          </p>
                          <p className="mt-1 truncate font-semibold text-slate-700" title={orderId || "Not recorded"}>
                            {orderId || "Not recorded"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span className="rounded-full bg-emerald-100/80 px-2.5 py-1 font-extrabold text-emerald-700">
                          {status}
                        </span>
                        <span className="font-semibold text-slate-500">
                          Balance {Number(purchase.balanceAfter || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {purchaseHasMore && (
                  <button
                    type="button"
                    onClick={loadOlderPurchases}
                    disabled={purchaseLoadingMore}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm font-extrabold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {purchaseLoadingMore && (
                      <LoaderCircle size={15} className="animate-spin" />
                    )}
                    {purchaseLoadingMore ? "Loading older purchases..." : "Load older purchases"}
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}

export default ProfilePage;