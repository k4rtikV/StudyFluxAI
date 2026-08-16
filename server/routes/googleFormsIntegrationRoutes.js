import express from "express";

import {
  connectGoogleForms,
  disconnectGoogleForms,
  getGoogleFormsStatus,
  googleFormsCallback,
} from "../controllers/studyExport.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/status",
  protect,
  getGoogleFormsStatus,
);

router.get(
  "/connect",
  protect,
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
