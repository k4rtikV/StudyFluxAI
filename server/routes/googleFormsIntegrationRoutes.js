import express from "express";

import {
  connectGoogleForms,
  disconnectGoogleForms,
  getGoogleFormsStatus,
  googleFormsCallback,
} from "../controllers/studyExport.controller.js";
import { protect } from "../middleware/auth.js";
import { resourceRateLimit } from "../middleware/resourceRateLimit.js";

const router = express.Router();

router.get(
  "/status",
  protect,
  getGoogleFormsStatus,
);

router.get(
  "/connect",
  protect,
  resourceRateLimit({
    bucket: "google-forms-connect",
    limit: 12,
    windowMs: 15 * 60 * 1000,
    message: "Too many Google Forms connection attempts. Please wait before trying again.",
  }),
  connectGoogleForms,
);

router.get(
  "/callback",
  googleFormsCallback,
);

router.delete(
  "/disconnect",
  protect,
  disconnectGoogleForms,
);

export default router;
