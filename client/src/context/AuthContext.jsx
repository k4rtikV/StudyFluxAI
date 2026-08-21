import {
  createContext,
  useEffect,
  useState,
} from "react";

import {
  getCurrentUser,
  syncUserTimezone,
} from "../services/authService";
import { subscribeToProgressionChanges } from "../utils/progressionEvents";

export const AuthContext = createContext(null);

const SESSION_RETRY_DELAYS_MS = [350, 750, 1250, 1800, 2400];

const wait = (delay) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });

const shouldRetrySessionRequest = (error) => {
  const status = error?.response?.status;

  // A 401/403 is a real logged-out/invalid-session response. Network failures
  // and temporary server errors can happen when Vite becomes ready before the
  // API during local startup, so only those cases receive a short retry window.
  return !status || status >= 500;
};

const loadCurrentUserWithStartupRetry = async (isCancelled) => {
  let lastError;

  for (let attempt = 0; attempt <= SESSION_RETRY_DELAYS_MS.length; attempt += 1) {
    if (isCancelled()) {
      return null;
    }

    try {
      return await getCurrentUser();
    } catch (error) {
      lastError = error;

      if (
        !shouldRetrySessionRequest(error) ||
        attempt === SESSION_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      await wait(SESSION_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const response = await loadCurrentUserWithStartupRetry(
          () => cancelled,
        );

        if (!response || cancelled) {
          return;
        }

        let currentUser = response.data.user;

        if (
          currentUser?.role === "student" &&
          currentUser.timezoneConfigured !== true
        ) {
          try {
            const timezoneResponse = await syncUserTimezone();
            currentUser = timezoneResponse.data.user;
          } catch {
            // Timezone sync should never block an otherwise valid session.
          }
        }

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToProgressionChanges(async () => {
      try {
        const response = await getCurrentUser();
        if (!cancelled) setUser(response.data.user);
      } catch {
        // Progress refresh should not sign a valid user out if the network blips.
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAuthLoading,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}