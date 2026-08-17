import { LoaderCircle } from "lucide-react";
import { Navigate } from "react-router";

import useAuth from "../../hooks/useAuth";

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="text-center">
        <img
          src="/sfai-logo.png"
          alt=""
          className="mx-auto h-14 w-14 object-contain"
        />

        <LoaderCircle
          size={24}
          className="mx-auto mt-5 animate-spin text-brand-500"
        />

        <p className="mt-3 text-sm font-medium text-muted">
          Loading StudyFluxAI...
        </p>
      </div>
    </main>
  );
}

const getAuthenticatedDestination = (user) =>
  user?.role === "admin"
    ? "/admin"
    : user?.learningProfileCompleted === true
      ? "/dashboard"
      : "/onboarding";

export function PublicHomeRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isAuthLoading,
  } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={getAuthenticatedDestination(user)}
        replace
      />
    );
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isAuthLoading,
  } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={getAuthenticatedDestination(user)}
        replace
      />
    );
  }

  return children;
}

export function OnboardingRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isAuthLoading,
  } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (user?.learningProfileCompleted === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function ProtectedRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isAuthLoading,
  } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (user?.learningProfileCompleted !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export function AdminRoute({ children }) {
  const { user, isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
