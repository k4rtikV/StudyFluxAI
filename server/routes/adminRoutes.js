import express from "express";

import {
  createChallenge,
  createPoll,
  deleteChallenge,
  deletePoll,
  getChallenges,
  generateChallengeDraft,
  generatePollDraft,
  getCommunityOverview,
  getPolls,
  updateChallenge,
  updatePoll,
} from "../controllers/adminCommunity.controller.js";
import {
  getUser,
  getUserOverview,
  getUsers,
  updateUserStatus,
} from "../controllers/adminUser.controller.js";
import {
  getAdminLeaderboard,
  rebuildAdminLeaderboard,
} from "../controllers/adminLeaderboard.controller.js";
import {
  archiveAnnouncementHandler,
  createAnnouncementHandler,
  deleteAnnouncementHandler,
  getAnnouncements,
  publishAnnouncementHandler,
  updateAnnouncementHandler,
} from "../controllers/adminAnnouncement.controller.js";
import { getAdminSettings, updateAdminSettings } from "../controllers/adminSettings.controller.js";
import { requireAdmin } from "../middleware/admin.js";
import { protect } from "../middleware/auth.js";
import { resourceRateLimit } from "../middleware/resourceRateLimit.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncementHandler);
router.patch("/announcements/:announcementId", updateAnnouncementHandler);
router.post("/announcements/:announcementId/publish", publishAnnouncementHandler);
router.post("/announcements/:announcementId/archive", archiveAnnouncementHandler);
router.delete("/announcements/:announcementId", deleteAnnouncementHandler);

router.get("/settings", getAdminSettings);
router.patch("/settings", updateAdminSettings);

router.get("/community/overview", getCommunityOverview);

router.get("/community/challenges", getChallenges);
router.post(
  "/community/challenges/ai-draft",
  resourceRateLimit({
    bucket: "admin-ai-draft",
    limit: 30,
    windowMs: 60 * 60 * 1000,
    message: "Admin AI draft generation is being requested too frequently. Please wait and try again.",
  }),
  generateChallengeDraft,
);
router.post("/community/challenges", createChallenge);
router.patch("/community/challenges/:challengeId", updateChallenge);
router.delete("/community/challenges/:challengeId", deleteChallenge);

router.get("/community/polls", getPolls);
router.post(
  "/community/polls/ai-draft",
  resourceRateLimit({
    bucket: "admin-ai-draft",
    limit: 30,
    windowMs: 60 * 60 * 1000,
    message: "Admin AI draft generation is being requested too frequently. Please wait and try again.",
  }),
  generatePollDraft,
);
router.post("/community/polls", createPoll);
router.patch("/community/polls/:pollId", updatePoll);
router.delete("/community/polls/:pollId", deletePoll);

router.get("/leaderboard", getAdminLeaderboard);
router.post("/leaderboard/rebuild", rebuildAdminLeaderboard);

router.get("/users/overview", getUserOverview);
router.get("/users", getUsers);
router.get("/users/:userId", getUser);
router.patch("/users/:userId/status", updateUserStatus);

export default router;
