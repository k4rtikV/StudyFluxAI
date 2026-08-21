import express from "express";

import {
  getSmartInterview,
  getSmartInterviewEligibility,
  getSmartInterviewReport,
  getSmartInterviewTutorAnalysisStatus,
  retrySmartInterviewReport,
  downloadSmartInterviewReportPdf,
  initializeSmartInterviewSession,
  listSmartInterviews,
  runSmartInterviewPreflight,
  startSmartInterview,
  streamSmartInterviewQuestionAudio,
  submitSmartInterviewAnswerController,
  exportSmartInterviewQuestionsToTutor,
} from "../controllers/interview.controller.js";
import { protect } from "../middleware/auth.js";
import { uploadInterviewAnswer } from "../middleware/interviewAnswerUpload.js";
import { interviewRateLimit } from "../middleware/interviewRateLimit.js";
import { uploadInterviewResume } from "../middleware/interviewResumeUpload.js";

const router = express.Router();
router.use(protect);

router.get("/eligibility", getSmartInterviewEligibility);
router.post("/preflight", runSmartInterviewPreflight);
router.get("/", listSmartInterviews);
router.post("/start", uploadInterviewResume, startSmartInterview);
router.get("/:interviewId", getSmartInterview);
router.post("/:interviewId/initialize", interviewRateLimit({ bucket: "initialize", limit: 6 }), initializeSmartInterviewSession);
router.get("/:interviewId/report", getSmartInterviewReport);
router.post("/:interviewId/report/retry", interviewRateLimit({ bucket: "report-retry", limit: 5 }), retrySmartInterviewReport);
router.get("/:interviewId/report/pdf", downloadSmartInterviewReportPdf);
router.get("/:interviewId/tutor-analysis", getSmartInterviewTutorAnalysisStatus);
router.post("/:interviewId/tutor-analysis", interviewRateLimit({ bucket: "tutor-analysis", limit: 4 }), exportSmartInterviewQuestionsToTutor);
router.get("/:interviewId/question-audio", interviewRateLimit({ bucket: "question-audio", limit: 16 }), streamSmartInterviewQuestionAudio);
router.post("/:interviewId/answer", interviewRateLimit({ bucket: "answer", limit: 20 }), uploadInterviewAnswer, submitSmartInterviewAnswerController);

export default router;
