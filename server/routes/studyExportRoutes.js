import express from "express";

import {
  downloadNotesPdf,
  exportQuizToGoogleForms,
  getGoogleFormsExport,
} from "../controllers/studyExport.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/:sessionId/notes/pdf",
  protect,
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
  exportQuizToGoogleForms,
);

export default router;
