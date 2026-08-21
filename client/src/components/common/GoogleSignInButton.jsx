import { LoaderCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

import useAuth from "../../hooks/useAuth";
import { googleAuthUser } from "../../services/authService";
import {
  clearGoogleCredentialHandler,
  initializeGoogleIdentity,
  renderGoogleButton,
} from "../../utils/googleIdentity";

function GoogleSignInButton({
  text = "continue_with",
  onCredential,
  loadingLabel = "Signing in with Google...",
}) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const buttonContainerRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback(
    async (googleResponse) => {
      const credential = googleResponse?.credential;

      if (!credential) {
        toast.error("Google sign-in did not return a valid credential.");
        return;
      }

      try {
        setIsSubmitting(true);

        if (onCredential) {
          await onCredential(credential);
          return;
        }

        const response = await googleAuthUser(credential);
        login(response.data.user);
        sessionStorage.removeItem("studyflux_verification_email");
        sessionStorage.removeItem("studyflux_registration_token");
        toast.success(response.message);

        const destination =
          response.data.user.role === "admin"
            ? "/admin"
            : response.data.user.learningProfileCompleted === true
              ? "/dashboard"
              : "/onboarding";

        navigate(destination, { replace: true });
      } catch (error) {
        if (onCredential) {
          toast.error(error?.response?.data?.message || "Google verification could not be completed.");
          return;
        }

        const response = error.response?.data;

        if (response?.code === "ADMIN_PASSWORD_REQUIRED") {
          toast.error(response.message || "Admin accounts must sign in with their StudyFluxAI admin password.");
          return;
        }

        if (response?.code === "GOOGLE_LINK_REQUIRES_REAUTH") {
          toast.error(response.message || "Sign in with your StudyFluxAI password first, then link Google from Settings & preferences.");
          return;
        }

        if (["GOOGLE_ACCOUNT_MISMATCH", "GOOGLE_ACCOUNT_CONFLICT", "GOOGLE_EMAIL_CLAIM_REQUIRES_VERIFICATION"].includes(response?.code)) {
          toast.error(response.message || "This Google identity cannot be used with this account.");
          return;
        }

        if (response?.code === "ACCOUNT_DISABLED") {
          toast.error(response.message || "This account is currently unavailable.");
          return;
        }

        toast.error(response?.message || "Unable to sign in with Google. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, navigate, onCredential],
  );

  useEffect(() => {
    let cancelled = false;
    let resizeTimer;

    const drawButton = () => {
      const element = buttonContainerRef.current;
      if (!element) return;

      renderGoogleButton({
        element,
        text,
        width: element.clientWidth || 400,
      });
    };

    const setupGoogleButton = async () => {
      try {
        await initializeGoogleIdentity({
          clientId,
          onCredential: handleCredential,
        });

        if (cancelled) return;
        drawButton();
      } catch (error) {
        console.error("Google Sign-In initialization failed:", error.message);
        if (!cancelled) toast.error("Google Sign-In could not be loaded.");
      }
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(drawButton, 150);
    };

    setupGoogleButton();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
      clearGoogleCredentialHandler(handleCredential);
    };
  }, [clientId, handleCredential, text]);

  return (
    <div className="relative flex min-h-11 w-full justify-center">
      <div
        ref={buttonContainerRef}
        className={`w-full max-w-[400px] transition ${isSubmitting ? "pointer-events-none opacity-40" : ""}`}
        aria-hidden={isSubmitting}
      />

      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/90 text-sm font-semibold text-slate-700">
          <LoaderCircle size={18} className="animate-spin" />
          {loadingLabel}
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
