import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatusBadge from "../../components/admin/AdminStatusBadge";
import UserAvatar from "../../components/common/UserAvatar";
import {
  getAdminUsers,
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

function ProviderPill({ provider }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {provider}
    </span>
  );
}

function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getAdminUsers({
        query: submittedQuery,
        status,
        provider,
        page,
        limit: 12,
      });
      setUsers(response.data.users || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not load learner accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [submittedQuery, status, provider, page]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  };

  const handleStatusChange = async (user) => {
    const nextState = !user.isActive;
    const confirmed = window.confirm(
      nextState
        ? `Reactivate ${user.fullName}'s StudyFluxAI account?`
        : `Deactivate ${user.fullName}'s account? Their active session will stop working on the next protected request.`,
    );

    if (!confirmed) return;

    try {
      setActionUserId(user.id);
      const response = await setAdminUserActiveStatus(user.id, nextState);
      toast.success(response.message);
      await loadUsers();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update account status.");
    } finally {
      setActionUserId("");
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Account management"
        title="User Management"
        description="Search learner accounts, inspect onboarding and authentication state, and deactivate or reactivate access without affecting the dedicated admin account."
      />

      <section className="mb-5 rounded-[26px] border border-slate-200 bg-white/88 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_210px_210px]">
          <form onSubmit={handleSearch} className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by learner name or email"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-24 text-sm text-slate-700 outline-none transition focus:border-emerald-200 focus:bg-white focus:ring-4 focus:ring-emerald-100/45"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 h-9 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              Search
            </button>
          </form>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-100/45"
          >
            <option value="all">All account states</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="verified">Email verified</option>
            <option value="unverified">Email unverified</option>
            <option value="profile-ready">Profile ready</option>
            <option value="profile-pending">Profile pending</option>
          </select>

          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              setPage(1);
            }}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-100/45"
          >
            <option value="all">All auth providers</option>
            <option value="local">Email / password</option>
            <option value="google">Google</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_18px_44px_rgba(15,23,42,0.055)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-black text-slate-900">Learner accounts</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {pagination.total || 0} matching account{pagination.total === 1 ? "" : "s"}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
            <Users size={19} />
          </span>
        </div>

        {loading ? (
          <div className="grid min-h-[320px] place-items-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
              <p className="mt-3 text-sm text-slate-500">Loading learner accounts...</p>
            </div>
          </div>
        ) : users.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/65 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-6 py-3.5">Learner</th>
                    <th className="px-4 py-3.5">Access</th>
                    <th className="px-4 py-3.5">Provider</th>
                    <th className="px-4 py-3.5">Profile</th>
                    <th className="px-4 py-3.5">FluxGems</th>
                    <th className="px-4 py-3.5">Last login</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100/80 last:border-0 hover:bg-slate-50/45">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={user}
                            className="h-10 w-10 rounded-xl"
                            initialsClassName="text-sm"
                          />
                          <div className="min-w-0">
                            <p className="max-w-[230px] truncate text-sm font-bold text-slate-800">{user.fullName}</p>
                            <p className="max-w-[260px] truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminStatusBadge status={user.isActive ? "active" : "inactive"} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {user.authProviders.map((item) => (
                            <ProviderPill key={item} provider={item} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-700">
                            {user.learningProfileCompleted ? "Ready" : "Pending"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {user.isEmailVerified ? "Email verified" : "Email unverified"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-black text-slate-800">{user.fluxGems}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
                            aria-label={`View ${user.fullName}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={actionUserId === user.id}
                            onClick={() => handleStatusChange(user)}
                            className={`grid h-9 w-9 place-items-center rounded-xl border transition disabled:opacity-50 ${
                              user.isActive
                                ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            aria-label={user.isActive ? "Deactivate account" : "Reactivate account"}
                          >
                            {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      user={user}
                      className="h-11 w-11 rounded-xl"
                      initialsClassName="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <AdminStatusBadge status={user.isActive ? "active" : "inactive"} />
                        {user.authProviders.map((item) => <ProviderPill key={item} provider={item} />)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-slate-400">Profile</p>
                      <p className="mt-1 font-bold text-slate-700">{user.learningProfileCompleted ? "Ready" : "Pending"}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-slate-400">FluxGems</p>
                      <p className="mt-1 font-black text-slate-700">{user.fluxGems}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      disabled={actionUserId === user.id}
                      onClick={() => handleStatusChange(user)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                        user.isActive
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-[320px] place-items-center px-6 text-center">
            <div>
              <Users size={30} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">No matching learners</p>
              <p className="mt-1 text-xs text-slate-500">Try a different search term or filter.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-slate-500">
            Page {pagination.page || 1} of {pagination.pages || 1}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(pagination.page || 1) <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              disabled={(pagination.page || 1) >= (pagination.pages || 1)}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default AdminUsersPage;
