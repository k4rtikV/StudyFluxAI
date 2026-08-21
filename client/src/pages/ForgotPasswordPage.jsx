import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { requestPasswordReset } from "../services/authService";

const schema = z.object({
  email: z.string().trim().min(1, "Email address is required.").email("Enter a valid email address."),
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = String(location.state?.email || "").trim().toLowerCase();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: initialEmail },
  });

  const onSubmit = async ({ email }) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const response = await requestPasswordReset(normalizedEmail);
      sessionStorage.setItem("studyflux_password_reset_email", normalizedEmail);
      toast.success(response.message);
      navigate("/reset-password", { state: { email: normalizedEmail } });
    } catch (error) {
      const response = error.response?.data;
      if (response?.errors?.email) {
        setError("email", { type: "server", message: response.errors.email });
        return;
      }
      toast.error(response?.message || "Unable to start password recovery. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <img src="/studyfluxai-logo-light.png" alt="StudyFluxAI" className="w-64 drop-shadow-[0_8px_24px_rgba(15,23,42,0.18)]" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-100">Account recovery</p>
              <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight">Recover access without weakening account security.</h1>
              <p className="mt-4 max-w-md leading-7 text-indigo-100">Reset codes are single-use, expire quickly, and revoke existing sessions when your password changes.</p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10 lg:min-h-[620px] lg:p-12">
            <Link to="/login" className="mb-7 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              <ArrowLeft size={17} /> Back to sign in
            </Link>

            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
              <Mail size={27} />
            </div>
            <p className="mt-6 text-sm font-semibold text-brand-600">Forgot password</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-heading">Request a reset code</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Enter the email used for password sign-in. For privacy, StudyFluxAI gives the same response whether or not an eligible account exists.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.email ? "border-rose-400 focus:ring-4 focus:ring-rose-100" : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"}`}
                  {...register("email")}
                />
                {errors.email && <p className="mt-1.5 text-sm text-rose-600">{errors.email.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:-translate-y-0.5 disabled:opacity-60">
                {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Mail size={18} />}
                {isSubmitting ? "Requesting code..." : "Email reset code"}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-800">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              StudyFluxAI will never ask you to send a password or reset code through support, chat, or email replies.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
