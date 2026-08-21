import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import {
  Link,
  useNavigate,
} from "react-router";

import useAuth from "../hooks/useAuth";
import {
  resendVerificationCode,
  verifyEmail,
} from "../services/authService";

const OTP_LENGTH = 6;
const INITIAL_RESEND_SECONDS = 60;
const INITIAL_EXPIRY_SECONDS = 10 * 60;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const inputRefs = useRef([]);

  const [digits, setDigits] = useState(
    Array(OTP_LENGTH).fill(""),
  );

  const [otpError, setOtpError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isResending, setIsResending] =
    useState(false);

  const [resendSeconds, setResendSeconds] =
    useState(INITIAL_RESEND_SECONDS);

  const [expirySeconds, setExpirySeconds] =
    useState(INITIAL_EXPIRY_SECONDS);

  const email = sessionStorage.getItem(
    "studyflux_verification_email",
  );

  const registrationToken = sessionStorage.getItem(
    "studyflux_registration_token",
  );

  useEffect(() => {
    if (!email || !registrationToken) {
      toast.error(
        "Start registration before verifying your email.",
      );

      navigate("/register", {
        replace: true,
      });
    }
  }, [email, registrationToken, navigate]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendSeconds((seconds) =>
        Math.max(seconds - 1, 0),
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendSeconds]);

  useEffect(() => {
    if (expirySeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setExpirySeconds((seconds) =>
        Math.max(seconds - 1, 0),
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [expirySeconds]);

  const otp = digits.join("");

  const clearOtp = () => {
    setDigits(Array(OTP_LENGTH).fill(""));

    window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 0);
  };

  const handleChange = (index, value) => {
    const sanitizedValue = value.replace(/\D/g, "");

    if (!sanitizedValue) {
      const nextDigits = [...digits];
      nextDigits[index] = "";

      setDigits(nextDigits);
      setOtpError("");

      return;
    }

    const digit = sanitizedValue.slice(-1);

    const nextDigits = [...digits];
    nextDigits[index] = digit;

    setDigits(nextDigits);
    setOtpError("");

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (
      event.key === "Backspace" &&
      !digits[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowLeft" &&
      index > 0
    ) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < OTP_LENGTH - 1
    ) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const pastedValue = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pastedValue) {
      return;
    }

    const nextDigits = Array(OTP_LENGTH).fill("");

    pastedValue.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setDigits(nextDigits);
    setOtpError("");

    const focusIndex = Math.min(
      pastedValue.length,
      OTP_LENGTH - 1,
    );

    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (otp.length !== OTP_LENGTH) {
      setOtpError(
        "Enter the complete 6-digit verification code.",
      );

      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setOtpError(
        "The verification code must contain only numbers.",
      );

      return;
    }

    try {
      setIsSubmitting(true);
      setOtpError("");

      const response = await verifyEmail({
        email,
        otp,
        registrationToken,
      });

      login(response.data.user);

      sessionStorage.removeItem(
        "studyflux_verification_email",
      );
      sessionStorage.removeItem(
        "studyflux_registration_token",
      );

      toast.success(response.message);

      /*
       * The backend has now issued the HttpOnly JWT cookie.
       * Once mandatory learning-profile onboarding is built,
       * this will redirect there instead.
       */
      navigate("/", {
        replace: true,
      });
    } catch (error) {
      const response = error.response?.data;

      if (
        response?.data?.attemptsRemaining !==
        undefined
      ) {
        setAttemptsRemaining(
          response.data.attemptsRemaining,
        );
      }

      if (
        response?.code === "OTP_INCORRECT"
      ) {
        setOtpError(
          "That code is incorrect. Check the email and try again.",
        );

        clearOtp();
        return;
      }

      if (
        response?.code ===
        "OTP_ATTEMPTS_EXCEEDED"
      ) {
        setOtpError(
          "Too many incorrect attempts. Request a new code.",
        );

        setAttemptsRemaining(0);
        clearOtp();
        return;
      }

      if (
        response?.code === "OTP_EXPIRED" ||
        response?.code ===
          "OTP_INVALID_OR_EXPIRED"
      ) {
        setOtpError(
          "This code has expired. Request a new verification code.",
        );

        setExpirySeconds(0);
        clearOtp();
        return;
      }

      if (
        response?.code ===
        "EMAIL_ALREADY_VERIFIED"
      ) {
        toast(
          "Your email is already verified. Please sign in.",
        );

        sessionStorage.removeItem(
          "studyflux_verification_email",
        );
        sessionStorage.removeItem(
          "studyflux_registration_token",
        );

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (response?.code === "REGISTRATION_RESTART_REQUIRED") {
        sessionStorage.removeItem("studyflux_verification_email");
        sessionStorage.removeItem("studyflux_registration_token");
        toast.error(response.message || "Registration expired. Please start again.");
        navigate("/register", { replace: true });
        return;
      }

      setOtpError(
        response?.errors?.otp ||
          response?.message ||
          "Unable to verify the code. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (
      resendSeconds > 0 ||
      isResending ||
      !email
    ) {
      return;
    }

    try {
      setIsResending(true);
      setOtpError("");

      const response =
        await resendVerificationCode(email, registrationToken);

      const cooldown =
        response.data?.resendAvailableIn ??
        INITIAL_RESEND_SECONDS;

      setResendSeconds(cooldown);
      setExpirySeconds(INITIAL_EXPIRY_SECONDS);
      setAttemptsRemaining(null);

      clearOtp();

      toast.success(response.message);
    } catch (error) {
      const response = error.response?.data;

      if (
        response?.code === "OTP_RESEND_COOLDOWN"
      ) {
        setResendSeconds(
          response.data?.retryAfter ??
            INITIAL_RESEND_SECONDS,
        );

        toast(
          response.message ||
            "Please wait before requesting another code.",
        );

        return;
      }

      if (
        response?.code ===
        "EMAIL_ALREADY_VERIFIED"
      ) {
        sessionStorage.removeItem(
          "studyflux_verification_email",
        );

        toast(
          "Your email is already verified. Please sign in.",
        );

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (response?.code === "REGISTRATION_RESTART_REQUIRED") {
        sessionStorage.removeItem("studyflux_verification_email");
        sessionStorage.removeItem("studyflux_registration_token");
        toast.error(response.message || "Registration expired. Please start again.");
        navigate("/register", { replace: true });
        return;
      }

      toast.error(
        response?.message ||
          "Unable to resend the verification code.",
      );
    } finally {
      setIsResending(false);
    }
  };

  if (!email || !registrationToken) {
    return null;
  }

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <Link
            to="/register"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back
          </Link>

          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <MailCheck size={28} />
          </div>

          <p className="text-sm font-semibold text-brand-600">
            Verify your email
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-heading">
            Check your inbox
          </h1>

          <p className="mt-3 leading-7 text-muted">
            We sent a 6-digit verification code to{" "}
            <span className="font-semibold text-slate-800">
              {email}
            </span>
            .
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8"
          >
            <fieldset disabled={isSubmitting}>
              <legend className="sr-only">
                Six digit verification code
              </legend>

              <div
                className="grid grid-cols-6 gap-2 sm:gap-3"
                onPaste={handlePaste}
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] =
                        element;
                    }}
                    type="text"
                    value={digit}
                    maxLength={1}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={
                      index === 0
                        ? "one-time-code"
                        : "off"
                    }
                    autoFocus={index === 0}
                    aria-label={`Verification digit ${
                      index + 1
                    }`}
                    aria-invalid={Boolean(
                      otpError,
                    )}
                    onChange={(event) =>
                      handleChange(
                        index,
                        event.target.value,
                      )
                    }
                    onKeyDown={(event) =>
                      handleKeyDown(
                        index,
                        event,
                      )
                    }
                    className={`aspect-square min-w-0 rounded-xl border text-center text-xl font-bold text-slate-900 outline-none transition sm:text-2xl ${
                      otpError
                        ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                        : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                    }`}
                  />
                ))}
              </div>
            </fieldset>

            <div
              className="mt-3 min-h-6"
              aria-live="polite"
            >
              {otpError ? (
                <p className="text-sm text-rose-600">
                  {otpError}
                </p>
              ) : attemptsRemaining !== null ? (
                <p className="text-sm text-amber-600">
                  {attemptsRemaining} verification{" "}
                  {attemptsRemaining === 1
                    ? "attempt"
                    : "attempts"}{" "}
                  remaining.
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                otp.length !== OTP_LENGTH ||
                expirySeconds === 0
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Verify email
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {expirySeconds > 0
                    ? "Code expires in"
                    : "Code expired"}
                </p>

                <p className="mt-1 text-sm text-muted">
                  {expirySeconds > 0
                    ? formatTime(expirySeconds)
                    : "Request a new code to continue."}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  resendSeconds > 0 ||
                  isResending
                }
                onClick={handleResend}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isResending ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCw size={16} />
                )}

                {isResending
                  ? "Sending..."
                  : resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : "Resend code"}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Didn't request this account? You can
            safely close this page.
          </p>
        </section>
      </div>
    </main>
  );
}

export default VerifyEmailPage;