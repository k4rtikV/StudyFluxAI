import {
  ArrowUpRight,
  BookOpen,
  CreditCard,
  GraduationCap,
  History,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import useAuth from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import { getFluxGemActivity } from "../services/fluxGemService";
import {
  getLearningProfile,
} from "../services/learningProfileService";

const ACTIVITY_LABELS = {
  developer_grant: "Developer test grant",
  purchase: "FluxGem purchase",
  reward: "FluxGem reward",
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
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gemActivity, setGemActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

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

    const loadActivity = async () => {
      try {
        const response = await getFluxGemActivity(8);

        if (active) {
          setGemActivity(response?.data?.transactions || []);
        }
      } catch (error) {
        if (active) {
          toast.error(
            error?.response?.data?.message ||
              "Your FluxGem activity could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setActivityLoading(false);
        }
      }
    };

    loadActivity();

    return () => {
      active = false;
    };
  }, []);

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

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-3xl border border-slate-200 object-cover shadow-sm"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-3xl bg-brand-100 text-3xl font-extrabold text-brand-700">
                {user?.fullName
                  ?.charAt(0)
                  ?.toUpperCase() || "S"}
              </div>
            )}

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
        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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
            Every FluxGem earned, spent, purchased or
            refunded will appear here as part of your
            account history.
          </p>

          {activityLoading ? (
            <div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <LoaderCircle size={17} className="animate-spin" />
                Loading Gem activity...
              </div>
            </div>
          ) : gemActivity.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <WalletCards
                size={22}
                className="mx-auto text-slate-400"
              />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                No FluxGem activity yet.
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Rewards, AI usage, purchases and refunds
                will be recorded here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-2.5">
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
                        {ACTIVITY_LABELS[activity.reason] ||
                          ACTIVITY_LABELS[activity.type] ||
                          activity.reason ||
                          "FluxGem activity"}
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
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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
            Verified FluxGem purchases made through
            Razorpay will be listed separately from
            normal Gem usage and rewards.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
            <CreditCard
              size={22}
              className="mx-auto text-slate-400"
            />

            <p className="mt-3 text-sm font-semibold text-slate-600">
              No Razorpay purchases yet.
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Payment ID, order ID, amount, FluxGems
              credited, status and purchase date will
              appear here after payments are enabled.
            </p>
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}

export default ProfilePage;