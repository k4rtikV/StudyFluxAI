import path from "node:path";

import multer from "multer";

import { hasPdfSignature } from "../utils/fileSignatures.js";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

const allowedExtensions = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_SOURCE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      !allowedExtensions.has(extension) ||
      !allowedMimeTypes.has(file.mimetype)
    ) {
      callback(
        new Error(
          "Only PDF, TXT and Markdown study sources are supported.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

export const uploadStudySource = (req, res, next) => {
  upload.single("sourceFile")(req, res, (error) => {
    if (!error) {
      const extension = path.extname(req.file?.originalname || "").toLowerCase();
      if (extension === ".pdf" && !hasPdfSignature(req.file?.buffer)) {
        return res.status(415).json({
          success: false,
          code: "INVALID_SOURCE_FILE_SIGNATURE",
          message: "That file does not contain a valid PDF header.",
        });
      }
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          code: "SOURCE_FILE_TOO_LARGE",
          message: "Choose a source file smaller than 10 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        code: "SOURCE_UPLOAD_ERROR",
        message: "The study source could not be uploaded.",
      });
    }

    return res.status(400).json({
      success: false,
      code: "UNSUPPORTED_SOURCE_FILE",
      message:
        error.message ||
        "Only PDF, TXT and Markdown study sources are supported.",
    });
  });
};