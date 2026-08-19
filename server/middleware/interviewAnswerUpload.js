import multer from "multer";

const MAX_ANSWER_BYTES = 6 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ANSWER_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_AUDIO_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
      const error = new Error("Use a supported interview audio format.");
      error.code = "UNSUPPORTED_INTERVIEW_AUDIO";
      return callback(error);
    }
    return callback(null, true);
  },
});

export const uploadInterviewAnswer = (req, res, next) => {
  upload.single("answerAudio")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        code: "INTERVIEW_AUDIO_TOO_LARGE",
        message: "That answer recording is too large. Keep each answer under 2 minutes.",
      });
    }

    if (error?.code === "UNSUPPORTED_INTERVIEW_AUDIO") {
      return res.status(415).json({ success: false, code: error.code, message: error.message });
    }

    return next(error);
  });
};
