import { getInstitutionTypeForLevel } from "../data/learningCatalog.js";
import { validateLearningProfile } from "./learningProfileValidation.js";

const ALLOWED_GENERATION_TYPES = new Set([
  "combined",
  "notes",
  "quiz",
]);

const ALLOWED_DETAIL_LEVELS = new Set([
  "concise",
  "balanced",
  "deep",
]);

const ALLOWED_DIFFICULTIES = new Set([
  "profile",
  "easy",
  "medium",
  "hard",
]);

const ALLOWED_QUIZ_SIZES = new Set([5, 10, 15]);

const stringValue = (value) =>
  String(value ?? "").trim();

const contextErrorKeyMap = {
  educationLevel: "contextEducationLevel",
  institutionState: "contextInstitutionState",
  institutionChoice: "contextInstitutionChoice",
  customInstitutionName:
    "contextCustomInstitutionName",
  programChoice: "contextProgramChoice",
  customProgram: "contextCustomProgram",
  streamChoice: "contextStreamChoice",
  customStream: "contextCustomStream",
};

const parseAcademicContext = (body) => {
  const provided = [
    "contextEducationLevel",
    "contextInstitutionState",
    "contextInstitutionChoice",
    "contextCustomInstitutionName",
    "contextProgramChoice",
    "contextCustomProgram",
    "contextStreamChoice",
    "contextCustomStream",
  ].some((key) =>
    Object.prototype.hasOwnProperty.call(
      body,
      key,
    ),
  );

  if (!provided) {
    return {
      provided: false,
      value: null,
      errors: {},
    };
  }

  const educationLevel = stringValue(
    body.contextEducationLevel,
  );

  const validation =
    validateLearningProfile({
      educationLevel,
      institutionType:
        getInstitutionTypeForLevel(
          educationLevel,
        ),
      institutionState:
        stringValue(
          body.contextInstitutionState,
        ),
      institutionChoice:
        stringValue(
          body.contextInstitutionChoice,
        ),
      customInstitutionName:
        stringValue(
          body.contextCustomInstitutionName,
        ),
      programChoice:
        stringValue(
          body.contextProgramChoice,
        ),
      customProgram:
        stringValue(
          body.contextCustomProgram,
        ),
      streamChoice:
        stringValue(
          body.contextStreamChoice,
        ),
      customStream:
        stringValue(
          body.contextCustomStream,
        ),
    });

  const errors = {};

  Object.entries(
    validation.errors,
  ).forEach(([key, message]) => {
    const mappedKey =
      contextErrorKeyMap[key] ||
      `context${key
        .charAt(0)
        .toUpperCase()}${key.slice(1)}`;

    errors[mappedKey] = message;
  });

  return {
    provided: true,
    value: validation.valid
      ? validation.values
      : null,
    errors,
  };
};

const validateGenerationType = ({ generationType, errors }) => {
  if (!ALLOWED_GENERATION_TYPES.has(generationType)) {
    errors.generationType = "Choose a valid generation type.";
  }
};

const validateStudySource = ({ sourceMode, topic, file, errors }) => {
  if (!["topic", "source"].includes(sourceMode)) {
    errors.sourceMode = "Choose a valid study source.";
  }

  if (sourceMode === "topic") {
    if (topic.length < 3) {
      errors.topic = "Enter a topic with at least 3 characters.";
    } else if (topic.length > 180) {
      errors.topic = "Keep the topic under 180 characters.";
    }
  }

  if (sourceMode === "source" && !file) {
    errors.sourceFile = "Upload a PDF, TXT or Markdown source.";
  }
};

const validateGenerationOptions = ({
  generationType,
  detailLevel,
  difficulty,
  quizSize,
  errors,
}) => {
  const includesNotes = ["combined", "notes"].includes(generationType);
  const includesQuiz = ["combined", "quiz"].includes(generationType);

  if (includesNotes && !ALLOWED_DETAIL_LEVELS.has(detailLevel)) {
    errors.detailLevel = "Choose a valid notes detail level.";
  }

  if (includesQuiz && !ALLOWED_DIFFICULTIES.has(difficulty)) {
    errors.difficulty = "Choose a valid quiz difficulty.";
  }

  if (includesQuiz && !ALLOWED_QUIZ_SIZES.has(quizSize)) {
    errors.quizSize = "Quiz length must be 5, 10 or 15 questions.";
  }
};

export const validateStudyGenerationInput = ({
  body,
  file,
}) => {
  const generationType = stringValue(
    body.generationType || "combined",
  );
  const sourceMode = stringValue(body.sourceMode);
  const topic = stringValue(body.topic);
  const detailLevel = stringValue(
    body.detailLevel || "balanced",
  );
  const difficulty = stringValue(
    body.difficulty || "profile",
  );
  const quizSize = Number(body.quizSize || 10);
  const academicContext = parseAcademicContext(body);

  const errors = {
    ...academicContext.errors,
  };

  validateGenerationType({ generationType, errors });
  validateStudySource({ sourceMode, topic, file, errors });
  validateGenerationOptions({
    generationType,
    detailLevel,
    difficulty,
    quizSize,
    errors,
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: {
      generationType,
      sourceMode,
      topic: sourceMode === "topic" ? topic : "",
      detailLevel:
        generationType === "quiz" ? "balanced" : detailLevel,
      difficulty:
        generationType === "notes" ? "profile" : difficulty,
      quizSize:
        generationType === "notes" ? 0 : quizSize,
      academicContext: academicContext.provided
        ? academicContext.value
        : null,
    },
  };
};
