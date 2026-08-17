import { Route, Routes } from "react-router";

import {
  OnboardingRoute,
  ProtectedRoute,
  PublicHomeRoute,
  PublicOnlyRoute,
} from "./components/common/RouteGuards";

import AchievementsPage from "./pages/AchievementsPage";
import AITutorPage from "./pages/AITutorPage";
import DashboardPage from "./pages/DashboardPage";
import EditProfilePage from "./pages/EditProfilePage";
import FluxGemsInfoPage from "./pages/FluxGemsInfoPage";
import GeneratePage from "./pages/GeneratePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import NotesGeneratorPage from "./pages/NotesGeneratorPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import QuizGeneratorPage from "./pages/QuizGeneratorPage";
import RegisterPage from "./pages/RegisterPage";
import StudyLibraryPage from "./pages/StudyLibraryPage";
import StudySessionPage from "./pages/StudySessionPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import WalletPage from "./pages/WalletPage";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicHomeRoute>
            <LandingPage />
          </PublicHomeRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/verify-email"
        element={
          <PublicOnlyRoute>
            <VerifyEmailPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <OnboardingPage />
          </OnboardingRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/generate"
        element={
          <ProtectedRoute>
            <GeneratePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/generate/notes"
        element={
          <ProtectedRoute>
            <NotesGeneratorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/generate/quiz"
        element={
          <ProtectedRoute>
            <QuizGeneratorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-tutor"
        element={
          <ProtectedRoute>
            <AITutorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <StudyLibraryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/study/:sessionId"
        element={
          <ProtectedRoute>
            <StudySessionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fluxgems"
        element={
          <ProtectedRoute>
            <FluxGemsInfoPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            <AchievementsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <EditProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}

export default App;