import path from "node:path";

import multer from "multer";

import { hasPdfSignature } from "../utils/fileSignatures.js";

const MAX_RESUME_BYTES = 2 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);
const allowedExtensions = new Set([".pdf", ".txt", ".md", ".markdown"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_RESUME_BYTES },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PDF, TXT and Markdown resumes are supported."));
      return;
    }
    callback(null, true);
  },
});

export const uploadInterviewResume = (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (!error) {
      const extension = path.extname(req.file?.originalname || "").toLowerCase();
      if (extension === ".pdf" && !hasPdfSignature(req.file?.buffer)) {
        return res.status(415).json({
          success: false,
          code: "INVALID_INTERVIEW_RESUME_SIGNATURE",
          message: "That file does not contain a valid PDF header.",
        });
      }
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          code: "INTERVIEW_RESUME_TOO_LARGE",
          message: "Choose a resume smaller than 2 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        code: "INTERVIEW_RESUME_UPLOAD_ERROR",
        message: "The resume could not be uploaded.",
      });
    }

    return res.status(400).json({
      success: false,
      code: "UNSUPPORTED_INTERVIEW_RESUME",
      message: error.message || "Only PDF, TXT and Markdown resumes are supported.",
    });
  });
};