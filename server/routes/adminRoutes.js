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
import { requireAdmin } from "../middleware/admin.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/community/overview", getCommunityOverview);

router.get("/community/challenges", getChallenges);
router.post("/community/challenges/ai-draft", generateChallengeDraft);
router.post("/community/challenges", createChallenge);
router.patch("/community/challenges/:challengeId", updateChallenge);
router.delete("/community/challenges/:challengeId", deleteChallenge);

router.get("/community/polls", getPolls);
router.post("/community/polls/ai-draft", generatePollDraft);
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
