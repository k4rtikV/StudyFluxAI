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
import useAuth from "../hooks/useAuth";
import { loginUser } from "../services/authService";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .email("Enter a valid email address."),

  password: z
    .string()
    .min(1, "Password is required."),
});

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] =
    useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const inputClass = (hasError) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
    }`;

  const onSubmit = async (values) => {
    try {
      const response = await loginUser({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      login(response.data.user);

      sessionStorage.removeItem(
        "studyflux_verification_email",
      );

      toast.success(response.message);

      navigate("/", {
        replace: true,
      });
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

        return;
      }

      if (
        response?.code === "INVALID_CREDENTIALS"
      ) {
        setError("password", {
          type: "server",
          message: "Invalid email or password.",
        });

        return;
      }

      if (
        response?.code ===
        "EMAIL_NOT_VERIFIED"
      ) {
        const verificationEmail =
          response.data?.email ||
          values.email.trim().toLowerCase();

        sessionStorage.setItem(
          "studyflux_verification_email",
          verificationEmail,
        );

        toast(
          "Verify your email before signing in.",
        );

        navigate("/verify-email");

        return;
      }

      if (
        response?.code ===
        "PASSWORD_LOGIN_UNAVAILABLE"
      ) {
        toast.error(
          "This account doesn't currently support password sign-in.",
        );

        return;
      }

      if (
        response?.code === "ACCOUNT_DISABLED"
      ) {
        toast.error(
          response.message ||
            "This account is currently unavailable.",
        );

        return;
      }

      toast.error(
        response?.message ||
          "Unable to sign in. Please try again.",
      );
    }
  };

  const handleForgotPassword = () => {
    toast(
      "Password recovery will be available shortly.",
    );
  };

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <img
              src="/studyfluxai-logo.png"
              alt="StudyFluxAI"
              className="w-64 rounded-xl bg-white p-3"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-100">
                Welcome back
              </p>

              <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight">
                Continue building your learning momentum.
              </h1>

              <p className="mt-4 max-w-md leading-7 text-indigo-100">
                Return to your quizzes, study material,
                challenges, streaks and progress with
                StudyFluxAI.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10 lg:min-h-[660px] lg:p-12">
            <div className="mb-8 lg:hidden">
              <img
                src="/studyfluxai-logo.png"
                alt="StudyFluxAI"
                className="w-52"
              />
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold text-brand-600">
                Sign in
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-heading">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted">
                Sign in to continue your StudyFluxAI
                learning journey.
              </p>
            </div>

            <GoogleSignInButton text="signin_with" />

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
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email
                      ? "login-email-error"
                      : undefined
                  }
                  className={inputClass(
                    errors.email,
                  )}
                  {...register("email")}
                />

                {errors.email && (
                  <p
                    id="login-email-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(
                      errors.password,
                    )}
                    aria-describedby={
                      errors.password
                        ? "login-password-error"
                        : undefined
                    }
                    className={`${inputClass(
                      errors.password,
                    )} pr-12`}
                    {...register("password")}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current,
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

                {errors.password && (
                  <p
                    id="login-password-error"
                    className="mt-1.5 text-sm text-rose-600"
                  >
                    {errors.password.message}
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
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-muted">
              New to StudyFluxAI?{" "}
              <Link
                to="/register"
                className="font-semibold text-brand-600 transition hover:text-brand-700"
              >
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;