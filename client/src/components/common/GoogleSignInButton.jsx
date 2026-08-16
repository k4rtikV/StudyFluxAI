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
}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const buttonContainerRef = useRef(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback(
    async (googleResponse) => {
      const credential =
        googleResponse?.credential;

      if (!credential) {
        toast.error(
          "Google sign-in did not return a valid credential.",
        );

        return;
      }

      try {
        setIsSubmitting(true);

        const response =
          await googleAuthUser(credential);

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

        if (
          response?.code ===
          "GOOGLE_LINK_REQUIRES_PASSWORD"
        ) {
          toast.error(
            "This email already has a StudyFluxAI account. Sign in with your password first before linking Google.",
          );

          return;
        }

        if (
          response?.code ===
          "GOOGLE_ACCOUNT_MISMATCH"
        ) {
          toast.error(
            response.message ||
              "This account is linked to a different Google account.",
          );

          return;
        }

        if (
          response?.code ===
          "ACCOUNT_DISABLED"
        ) {
          toast.error(
            response.message ||
              "This account is currently unavailable.",
          );

          return;
        }

        toast.error(
          response?.message ||
            "Unable to sign in with Google. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, navigate],
  );

  useEffect(() => {
    let cancelled = false;
    let resizeTimer;

    const drawButton = () => {
      const element =
        buttonContainerRef.current;

      if (!element) {
        return;
      }

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

        if (cancelled) {
          return;
        }

        drawButton();
      } catch (error) {
        console.error(
          "Google Sign-In initialization failed:",
          error.message,
        );

        if (!cancelled) {
          toast.error(
            "Google Sign-In could not be loaded.",
          );
        }
      }
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimer);

      resizeTimer = window.setTimeout(() => {
        drawButton();
      }, 150);
    };

    setupGoogleButton();

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "resize",
        handleResize,
      );

      window.clearTimeout(resizeTimer);

      clearGoogleCredentialHandler(
        handleCredential,
      );
    };
  }, [clientId, handleCredential, text]);

  return (
    <div className="relative flex min-h-11 w-full justify-center">
      <div
        ref={buttonContainerRef}
        className={`w-full max-w-[400px] transition ${
          isSubmitting
            ? "pointer-events-none opacity-40"
            : ""
        }`}
        aria-hidden={isSubmitting}
      />

      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/90 text-sm font-semibold text-slate-700">
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
          Signing in with Google...
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;