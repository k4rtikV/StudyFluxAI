import {
  createContext,
  useEffect,
  useState,
} from "react";

import {
  getCurrentUser,
  syncUserTimezone,
} from "../services/authService";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await getCurrentUser();
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

        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadUser();
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