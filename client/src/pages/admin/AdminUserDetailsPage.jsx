import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Gem,
  Mail,
  MessageSquare,
  Trophy,
  UserCheck,
  UserX,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatCard from "../../components/admin/AdminStatCard";
import AdminStatusBadge from "../../components/admin/AdminStatusBadge";
import UserAvatar from "../../components/common/UserAvatar";
import {
  getAdminUser,
  setAdminUserActiveStatus,
} from "../../services/adminUserService";

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Never";

const prettify = (value) =>
  value
    ? String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not provided";

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-700 sm:text-right">{value}</span>
    </div>
  );
}

function AdminUserDetailsPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const response = await getAdminUser(userId);
      setData(response.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load learner details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const toggleStatus = async () => {
    if (!data?.user) return;
    const nextState = !data.user.isActive;
    const confirmed = window.confirm(
      nextState
        ? `Reactivate ${data.user.fullName}'s account?`
        : `Deactivate ${data.user.fullName}'s account? Their current authenticated session will stop working on the next protected request.`,
    );
    if (!confirmed) return;

    try {
      setUpdating(true);
      const response = await setAdminUserActiveStatus(data.user.id, nextState);
      toast.success(response.message);
      setData((current) => ({ ...current, user: response.data.user }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update account status.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold text-slate-800">Learner account could not be loaded.</p>
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          Back to users
        </button>
      </div>
    );
  }

  const { user, learningProfile, stats } = data;

  return (
    <>
      <AdminPageHeader
        eyebrow="Learner account"
        title={user.fullName}
        description="Inspect authentication, onboarding, activity and purchase signals for this learner account."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm"
            >
              <ArrowLeft size={16} /> Back to users
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={toggleStatus}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-60 ${
                user.isActive
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
              {user.isActive ? "Deactivate account" : "Reactivate account"}
            </button>
          </>
        }
      />

      <section className="mb-5 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            user={user}
            className="h-20 w-20 rounded-[22px]"
            initialsClassName="text-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900">{user.fullName}</h2>
              <AdminStatusBadge status={user.isActive ? "active" : "inactive"} />
              {user.isEmailVerified && <AdminStatusBadge status="verified">Verified</AdminStatusBadge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Mail size={14} /> {user.email}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> Joined {formatDateTime(user.createdAt)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.authProviders.map((provider) => (
                <span key={provider} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                  {provider}
                </span>
              ))}
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-cyan-700">
                {user.learningProfileCompleted ? "Profile complete" : "Profile pending"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard icon={BookOpen} label="Study sessions" value={stats.completedStudySessions} helper="Completed AI-generated sessions" tone="cyan" />
        <AdminStatCard icon={Trophy} label="Challenge attempts" value={stats.challengeAttempts} helper={`${stats.challengeAccuracy}% correct-answer rate`} tone="emerald" />
        <AdminStatCard icon={MessageSquare} label="Poll votes" value={stats.pollVotes} helper="Community poll participation" tone="violet" />
        <AdminStatCard icon={Zap} label="Activity XP" value={stats.rewardedActivityXp} helper="XP earned from rewarded activities" tone="amber" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <h3 className="text-lg font-black text-slate-900">Account state</h3>
          <div className="mt-3">
            <DetailRow label="Email verification" value={user.isEmailVerified ? "Verified" : "Not verified"} />
            <DetailRow label="Learner profile" value={user.learningProfileCompleted ? "Completed" : "Pending"} />
            <DetailRow label="Current FluxGems" value={user.fluxGems.toLocaleString()} />
            <DetailRow label="Last login" value={formatDateTime(user.lastLoginAt)} />
            <DetailRow label="Last account update" value={formatDateTime(user.updatedAt)} />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <h3 className="text-lg font-black text-slate-900">Learning profile</h3>
          {learningProfile ? (
            <div className="mt-3">
              <DetailRow label="Education level" value={prettify(learningProfile.educationLevel)} />
              <DetailRow label="Institution" value={learningProfile.institutionName || "Not provided"} />
              <DetailRow label="Program" value={learningProfile.program || "Not provided"} />
              <DetailRow label="Stream" value={learningProfile.stream || "Not provided"} />
              <DetailRow label="Profile updated" value={formatDateTime(learningProfile.updatedAt)} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              This learner has not completed onboarding yet.
            </div>
          )}
        </article>
      </section>

      <section className="mt-5 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-emerald-600" />
          <h3 className="text-lg font-black text-slate-900">FluxGem purchase summary</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/55 p-4">
            <p className="text-xs font-bold text-slate-500">Paid purchases</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{stats.paidFluxGemPurchases}</p>
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/55 p-4">
            <p className="text-xs font-bold text-slate-500">Purchased FluxGems</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900"><Gem size={19} className="text-cyan-600" /> {stats.purchasedFluxGems}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/55 p-4">
            <p className="text-xs font-bold text-slate-500">Total paid</p>
            <p className="mt-2 text-2xl font-black text-slate-900">₹{(stats.purchaseAmountPaise / 100).toLocaleString("en-IN")}</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default AdminUserDetailsPage;
