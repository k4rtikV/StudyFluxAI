import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  MessageSquare,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatCard from "../../components/admin/AdminStatCard";
import AdminStatusBadge from "../../components/admin/AdminStatusBadge";
import UserAvatar from "../../components/common/UserAvatar";
import { getAdminCommunityOverview } from "../../services/adminCommunityService";
import { getAdminUserOverview } from "../../services/adminUserService";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Never";

function AdminOverviewPage() {
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [communityResponse, userResponse] = await Promise.all([
          getAdminCommunityOverview(),
          getAdminUserOverview(),
        ]);
        setCommunity(communityResponse.data);
        setUsers(userResponse.data);
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            "Could not load the admin overview.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const liveContent =
    Number(community?.challenges?.live || 0) + Number(community?.polls?.live || 0);

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading admin workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="mb-7 overflow-hidden rounded-[32px] border border-slate-800 bg-[linear-gradient(120deg,#071225_0%,#0a1b2b_54%,#063a30_100%)] px-6 py-7 text-white shadow-[0_26px_70px_rgba(15,23,42,0.16)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck size={16} />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.15em]">
                Administrator workspace
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              StudyFluxAI Admin Console
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Manage learners and community content from one dedicated workspace while keeping student-facing flows isolated.
            </p>
          </div>

          <div className="grid min-w-[250px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Live content
              </p>
              <p className="mt-1 text-3xl font-black">{liveContent}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Learners
              </p>
              <p className="mt-1 text-3xl font-black">{users?.total || 0}</p>
            </div>
          </div>
        </div>
      </section>

      <AdminPageHeader
        eyebrow="Workspace overview"
        title="Control center"
        description="A quick view of learner access, live community content, participation and recent registrations."
      />

      {error && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={Users}
          label="Total learners"
          value={users?.total || 0}
          helper={`${users?.active || 0} active · ${users?.inactive || 0} inactive`}
          tone="cyan"
        />
        <AdminStatCard
          icon={UserCheck}
          label="Profile-ready learners"
          value={users?.profileReady || 0}
          helper={`${users?.verified || 0} verified email accounts`}
          tone="emerald"
        />
        <AdminStatCard
          icon={Trophy}
          label="Challenge attempts"
          value={community?.challenges?.totalAttempts || 0}
          helper={`${community?.challenges?.accuracy || 0}% correct-answer rate`}
          tone="amber"
        />
        <AdminStatCard
          icon={MessageSquare}
          label="Community poll votes"
          value={community?.polls?.totalVotes || 0}
          helper={`${community?.polls?.live || 0} live poll${community?.polls?.live === 1 ? "" : "s"}`}
          tone="violet"
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
                Learner accounts
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Recent registrations</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
            >
              Manage users <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {users?.recentUsers?.length ? (
              users.recentUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/65 px-3.5 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/35"
                >
                  <UserAvatar
                    user={user}
                    className="h-10 w-10 rounded-xl"
                    initialsClassName="text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{user.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <AdminStatusBadge status={user.isActive ? "active" : "inactive"} />
                    <p className="mt-1 text-[10px] text-slate-400">Joined {formatDate(user.createdAt)}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No learner accounts yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-600">
              Content status
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Community publishing</h2>
          </div>

          <div className="mt-5 space-y-3">
            {[
              {
                label: "Daily Challenges",
                icon: Trophy,
                data: community?.challenges,
                path: "/admin/challenges",
                tone: "text-emerald-700 bg-emerald-50",
              },
              {
                label: "Community Polls",
                icon: MessageSquare,
                data: community?.polls,
                path: "/admin/polls",
                tone: "text-violet-700 bg-violet-50",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${item.tone}`}>
                      <Icon size={18} />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-800">{item.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.data?.live || 0} live · {item.data?.scheduled || 0} scheduled · {item.data?.draft || 0} draft · {item.data?.ended || 0} ended
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="flex items-center gap-2 text-cyan-700">
                <Activity size={16} />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">New users</span>
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">{users?.newLast7Days || 0}</p>
              <p className="text-[11px] text-slate-500">last 7 days</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <CalendarClock size={16} />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Google users</span>
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">{users?.googleUsers || 0}</p>
              <p className="text-[11px] text-slate-500">linked accounts</p>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

export default AdminOverviewPage;
