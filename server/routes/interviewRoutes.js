import express from "express";

import {
  getSmartInterview,
  getSmartInterviewEligibility,
  getSmartInterviewReport,
  retrySmartInterviewReport,
  downloadSmartInterviewReportPdf,
  initializeSmartInterviewSession,
  listSmartInterviews,
  runSmartInterviewPreflight,
  startSmartInterview,
  streamSmartInterviewQuestionAudio,
  submitSmartInterviewAnswerController,
} from "../controllers/interview.controller.js";
import { protect } from "../middleware/auth.js";
import { uploadInterviewAnswer } from "../middleware/interviewAnswerUpload.js";
import { uploadInterviewResume } from "../middleware/interviewResumeUpload.js";

const router = express.Router();
router.use(protect);

router.get("/eligibility", getSmartInterviewEligibility);
router.post("/preflight", runSmartInterviewPreflight);
router.get("/", listSmartInterviews);
router.post("/start", uploadInterviewResume, startSmartInterview);
router.get("/:interviewId", getSmartInterview);
router.post("/:interviewId/initialize", initializeSmartInterviewSession);
router.get("/:interviewId/report", getSmartInterviewReport);
router.post("/:interviewId/report/retry", retrySmartInterviewReport);
router.get("/:interviewId/report/pdf", downloadSmartInterviewReportPdf);
router.get("/:interviewId/question-audio", streamSmartInterviewQuestionAudio);
router.post("/:interviewId/answer", uploadInterviewAnswer, submitSmartInterviewAnswerController);

export default router;
