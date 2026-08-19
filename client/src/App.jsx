import { Route, Routes } from "react-router";

import {
  AdminRoute,
  OnboardingRoute,
  ProtectedRoute,
  PublicHomeRoute,
  PublicOnlyRoute,
} from "./components/common/RouteGuards";

import AdminLayout from "./layouts/AdminLayout";
import AchievementsPage from "./pages/AchievementsPage";
import AITutorPage from "./pages/AITutorPage";
import DashboardPage from "./pages/DashboardPage";
import DailyChallengesPage from "./pages/DailyChallengesPage";
import EditProfilePage from "./pages/EditProfilePage";
import FluxGemsInfoPage from "./pages/FluxGemsInfoPage";
import GeneratePage from "./pages/GeneratePage";
import LandingPage from "./pages/LandingPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import NotesGeneratorPage from "./pages/NotesGeneratorPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import QuizGeneratorPage from "./pages/QuizGeneratorPage";
import RegisterPage from "./pages/RegisterPage";
import StudyLibraryPage from "./pages/StudyLibraryPage";
import StudyPlannerPage from "./pages/StudyPlannerPage";
import StudySessionPage from "./pages/StudySessionPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import WalletPage from "./pages/WalletPage";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminLeaderboardPage from "./pages/admin/AdminLeaderboardPage";
import AdminSoonPage from "./pages/admin/AdminSoonPage";
import AdminUserDetailsPage from "./pages/admin/AdminUserDetailsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminChallengeEditorPage from "./pages/admin/challenges/AdminChallengeEditorPage";
import AdminChallengesPage from "./pages/admin/challenges/AdminChallengesPage";
import AdminPollEditorPage from "./pages/admin/polls/AdminPollEditorPage";
import AdminPollsPage from "./pages/admin/polls/AdminPollsPage";

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
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="challenges" element={<AdminChallengesPage />} />
        <Route path="challenges/new" element={<AdminChallengeEditorPage />} />
        <Route path="challenges/:challengeId/edit" element={<AdminChallengeEditorPage />} />
        <Route path="polls" element={<AdminPollsPage />} />
        <Route path="polls/new" element={<AdminPollEditorPage />} />
        <Route path="polls/:pollId/edit" element={<AdminPollEditorPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:userId" element={<AdminUserDetailsPage />} />
        <Route path="leaderboard" element={<AdminLeaderboardPage />} />
        <Route path="announcements" element={<AdminSoonPage feature="announcements" />} />
        <Route path="settings" element={<AdminSoonPage feature="settings" />} />
      </Route>

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
        path="/planner"
        element={
          <ProtectedRoute>
            <StudyPlannerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/daily-challenges"
        element={
          <ProtectedRoute>
            <DailyChallengesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <LeaderboardPage />
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
