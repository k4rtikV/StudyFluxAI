import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { requestPasswordReset, resetPassword } from "../services/authService";

const schema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit reset code."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password cannot exceed 72 characters.").regex(/[a-z]/, "Include at least one lowercase letter.").regex(/[A-Z]/, "Include at least one uppercase letter.").regex(/\d/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedEmail = sessionStorage.getItem("studyflux_password_reset_email") || "";
  const initialEmail = String(location.state?.email || storedEmail).trim().toLowerCase();
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: initialEmail, otp: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values) => {
    try {
      const response = await resetPassword({
        email: values.email.trim().toLowerCase(),
        otp: values.otp.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      sessionStorage.removeItem("studyflux_password_reset_email");
      toast.success(response.message);
      navigate("/login", { replace: true });
    } catch (error) {
      const response = error.response?.data;
      if (response?.errors) {
        Object.entries(response.errors).forEach(([field, message]) => setError(field, { type: "server", message }));
        return;
      }
      if (["OTP_INCORRECT", "OTP_EXPIRED", "OTP_INVALID_OR_EXPIRED", "OTP_ATTEMPTS_EXCEEDED", "OTP_ALREADY_USED", "RESET_INVALID_OR_EXPIRED"].includes(response?.code)) {
        setError("otp", { type: "server", message: response.message || "The reset code is invalid or expired." });
        return;
      }
      toast.error(response?.message || "Unable to reset your password. Please try again.");
    }
  };

  const handleResend = async () => {
    const email = getValues("email")?.trim().toLowerCase();
    if (!email || resending) return;
    try {
      setResending(true);
      const response = await requestPasswordReset(email);
      sessionStorage.setItem("studyflux_password_reset_email", email);
      toast.success(response.message);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to request another reset code.");
    } finally {
      setResending(false);
    }
  };

  const inputClass = (hasError) => `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${hasError ? "border-rose-400 focus:ring-4 focus:ring-rose-100" : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"}`;

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <Link to="/login" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft size={17} /> Back to sign in</Link>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><KeyRound size={27} /></div>
          <p className="mt-6 text-sm font-semibold text-brand-600">Password recovery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-heading">Choose a new password</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Use the 6-digit code from your branded StudyFluxAI security email. A successful reset revokes every existing sign-in session.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
              <input type="email" autoComplete="email" className={inputClass(errors.email)} {...register("email")} />
              {errors.email && <p className="mt-1.5 text-sm text-rose-600">{errors.email.message}</p>}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-slate-700">Reset code</label>
                <button type="button" onClick={handleResend} disabled={resending} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 disabled:opacity-50"><RefreshCcw size={13} className={resending ? "animate-spin" : ""} /> Send another code</button>
              </div>
              <input inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="6-digit code" className={inputClass(errors.otp)} {...register("otp")} />
              {errors.otp && <p className="mt-1.5 text-sm text-rose-600">{errors.otp.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">New password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} autoComplete="new-password" className={`${inputClass(errors.password)} pr-12`} {...register("password")} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {errors.password && <p className="mt-1.5 text-sm text-rose-600">{errors.password.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm new password</label>
              <input type={showPassword ? "text" : "password"} autoComplete="new-password" className={inputClass(errors.confirmPassword)} {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="mt-1.5 text-sm text-rose-600">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:-translate-y-0.5 disabled:opacity-60">
              {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {isSubmitting ? "Resetting password..." : "Reset password & revoke sessions"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ResetPasswordPage;
