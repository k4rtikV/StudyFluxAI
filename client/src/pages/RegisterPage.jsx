import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Link,
  useNavigate,
} from "react-router";
import { z } from "zod";

import GoogleSignInButton from "../components/common/GoogleSignInButton";
import { registerUser } from "../services/authService";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(60, "Full name cannot exceed 60 characters."),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address."),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password cannot exceed 72 characters.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/\d/, "Include at least one number."),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

function RegisterPage() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values) => {
    try {
      const response =
        await registerUser(values);

      sessionStorage.setItem(
        "studyflux_verification_email",
        response.data.email,
      );

      toast.success(response.message);

      navigate("/verify-email");
    } catch (error) {
      const response = error.response?.data;

      if (response?.errors) {
        Object.entries(response.errors).forEach(
          ([field, message]) => {
            setError(field, {
              type: "server",
              message,
            });
          },
        );
      }

      if (
        response?.code ===
        "EMAIL_ALREADY_REGISTERED"
      ) {
        setError("email", {
          type: "server",
          message:
            "An account with this email already exists.",
        });
      }

      if (
        response?.code ===
        "EMAIL_PENDING_VERIFICATION"
      ) {
        sessionStorage.setItem(
          "studyflux_verification_email",
          values.email.trim().toLowerCase(),
        );

        toast(
          "This email is already awaiting verification.",
        );

        navigate("/verify-email");
        return;
      }

      if (
        response?.code ===
        "VERIFICATION_EMAIL_FAILED"
      ) {
        sessionStorage.setItem(
          "studyflux_verification_email",
          values.email.trim().toLowerCase(),
        );

        toast.error(response.message);

        navigate("/verify-email");
        return;
      }

      if (
        !response?.errors &&
        !response?.code
      ) {
        toast.error(
          response?.message ||
            "Unable to create your account. Please try again.",
        );
      }
    }
  };

  const inputClass = (hasError) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
    }`;

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <img
              src="/studyfluxai-logo-light.png"
              alt="StudyFluxAI"
              className="w-64 drop-shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-100">
                Learn. Challenge. Progress.
              </p>

              <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight">
                Turn your study time into measurable progress.
              </h1>

              <p className="mt-4 max-w-md leading-7 text-indigo-100">
                Generate learning material, take intelligent quizzes, build
                streaks and compete through StudyFluxAI.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8 lg:hidden">
              <img
                src="/studyfluxai-logo.png"
                alt="StudyFluxAI"
                className="w-52"
              />
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold text-brand-600">
                Create your account
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-heading">
                Start learning smarter
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted">
                Create your StudyFluxAI account and verify your email to
                continue.
              </p>
            </div>

            <GoogleSignInButton text="signup_with" />

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Or continue with email
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  aria-invalid={Boolean(errors.fullName)}
                  className={inputClass(errors.fullName)}
                  {...register("fullName")}
                />

                {errors.fullName && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  className={inputClass(errors.email)}
                  {...register("email")}
                />

                {errors.email && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    aria-invalid={Boolean(errors.password)}
                    className={`${inputClass(
                      errors.password,
                    )} pr-12`}
                    {...register("password")}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value,
                      )
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.password ? (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {errors.password.message}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Use 8–72 characters with uppercase, lowercase and a number.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Confirm password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    placeholder="Enter your password again"
                    aria-invalid={Boolean(
                      errors.confirmPassword,
                    )}
                    className={`${inputClass(
                      errors.confirmPassword,
                    )} pr-12`}
                    {...register("confirmPassword")}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) => !value,
                      )
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-rose-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                )}

                {isSubmitting
                  ? "Creating account..."
                  : "Create account"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-muted">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand-600 transition hover:text-brand-700"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default RegisterPage;