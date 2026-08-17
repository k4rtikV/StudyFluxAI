import express from "express";

import {
  answerDailyChallenge,
  getCommunityPolls,
  getDailyChallenge,
  voteCommunityPoll,
} from "../controllers/community.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/daily-challenge", getDailyChallenge);
router.post("/daily-challenge/:challengeId/answer", answerDailyChallenge);
router.get("/polls", getCommunityPolls);
router.post("/polls/:pollId/vote", voteCommunityPoll);

export default router;
