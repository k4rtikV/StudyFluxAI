import express from "express";

import {
  downloadNotesPdf,
  exportQuizToGoogleForms,
  getGoogleFormsExport,
} from "../controllers/studyExport.controller.js";
import { protect } from "../middleware/auth.js";
import { resourceRateLimit } from "../middleware/resourceRateLimit.js";

const router = express.Router();

router.get(
  "/:sessionId/notes/pdf",
  protect,
  resourceRateLimit({
    bucket: "notes-pdf",
    limit: 20,
    windowMs: 15 * 60 * 1000,
    message: "Too many PDF export requests. Please wait before exporting again.",
  }),
  downloadNotesPdf,
);

router.get(
  "/:sessionId/google-forms",
  protect,
  getGoogleFormsExport,
);

router.post(
  "/:sessionId/google-forms",
  protect,
  resourceRateLimit({
    bucket: "google-forms-export",
    limit: 8,
    windowMs: 15 * 60 * 1000,
    message: "Too many Google Forms export requests. Please wait before exporting again.",
  }),
  exportQuizToGoogleForms,
);

export default router;
