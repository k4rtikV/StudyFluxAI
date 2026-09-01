import assert from "node:assert/strict";
import test from "node:test";

import {
  INDIA_INSTITUTIONS,
  INDIA_STATES,
} from "../data/institutionCatalog.js";
import {
  BOARD_OPTIONS,
  OTHER_VALUE,
  getProgramOptions,
  getStreamOptions,
} from "../data/learningCatalog.js";
import { validateLearningProfile } from "../utils/learningProfileValidation.js";
import { validateStudyGenerationInput } from "../utils/studySessionValidation.js";

const college =
  INDIA_INSTITUTIONS.find(
    (institution) =>
      institution.state === "Maharashtra" &&
      institution.category !== "diploma",
  ) || INDIA_INSTITUTIONS.find((institution) => institution.category !== "diploma");

const diploma =
  INDIA_INSTITUTIONS.find(
    (institution) =>
      institution.state === "Maharashtra" &&
      institution.category === "diploma",
  ) || INDIA_INSTITUTIONS.find((institution) => institution.category === "diploma");

const program = getProgramOptions("bachelors")[0];
const stream = getStreamOptions("bachelors", program)[0];
const board = BOARD_OPTIONS[0];

const baseProfile = {
  educationLevel: "bachelors",
  institutionType: "university",
  institutionState: college.state,
  institutionChoice: college.id,
  customInstitutionName: "",
  programChoice: program,
  customProgram: "",
  streamChoice: stream,
  customStream: "",
};

test("CCRA: learning-profile validation preserves board and catalog resolution", () => {
  assert.deepEqual(
    validateLearningProfile({
      educationLevel: "class_10",
      institutionType: "board",
      institutionState: "",
      institutionChoice: board,
      customInstitutionName: "",
      programChoice: "",
      customProgram: "",
      streamChoice: "",
      customStream: "",
    }),
    {
      valid: true,
      errors: {},
      values: {
        educationLevel: "class_10",
        institutionType: "board",
        institutionState: "",
        institutionId: "",
        institutionCategory: "other",
        institutionSector: "",
        institutionKey: board,
        institutionName: board,
        programKey: "",
        program: "",
        streamKey: "",
        stream: "",
      },
    },
  );

  assert.equal(validateLearningProfile(baseProfile).valid, true);

  assert.equal(
    validateLearningProfile({
      ...baseProfile,
      institutionState: INDIA_STATES.find((state) => state !== college.state),
    }).errors.institutionChoice,
    "The selected institution does not belong to the selected state.",
  );

  assert.equal(
    validateLearningProfile({
      ...baseProfile,
      educationLevel: "diploma",
      institutionType: "institution",
      programChoice: getProgramOptions("diploma")[0],
      streamChoice: getStreamOptions("diploma", getProgramOptions("diploma")[0])[0],
    }).errors.institutionChoice,
    "Choose a diploma institution for the selected education level.",
  );

  assert.equal(
    validateLearningProfile({
      ...baseProfile,
      institutionState: diploma.state,
      institutionChoice: diploma.id,
    }).errors.institutionChoice,
    "Choose a college, university or institute for higher education.",
  );
});

test("CCRA: learning-profile custom-choice errors and normalized values are unchanged", () => {
  const result = validateLearningProfile({
    ...baseProfile,
    programChoice: OTHER_VALUE,
    customProgram: "x",
    streamChoice: OTHER_VALUE,
    customStream: "Custom AI",
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, {
    customProgram: "Enter your program or degree.",
  });
  assert.equal(result.values.programKey, OTHER_VALUE);
  assert.equal(result.values.program, "");
  assert.equal(result.values.streamKey, OTHER_VALUE);
  assert.equal(result.values.stream, "Custom AI");
});

test("CCRA: study-generation validation preserves selector, source, and academic-context semantics", () => {
  assert.deepEqual(
    validateStudyGenerationInput({
      body: {
        generationType: "combined",
        sourceMode: "topic",
        topic: "ab",
        detailLevel: "balanced",
        difficulty: "profile",
        quizSize: 10,
      },
      file: null,
    }).errors,
    { topic: "Enter a topic with at least 3 characters." },
  );

  assert.deepEqual(
    validateStudyGenerationInput({
      body: {
        generationType: "quiz",
        sourceMode: "source",
        topic: "",
        detailLevel: "balanced",
        difficulty: "hard",
        quizSize: 5,
      },
      file: null,
    }).errors,
    { sourceFile: "Upload a PDF, TXT or Markdown source." },
  );

  assert.deepEqual(
    validateStudyGenerationInput({
      body: {
        generationType: "bad",
        sourceMode: "bad",
        topic: "topic",
        detailLevel: "bad",
        difficulty: "bad",
        quizSize: 7,
      },
      file: null,
    }).errors,
    {
      generationType: "Choose a valid generation type.",
      sourceMode: "Choose a valid study source.",
    },
  );

  const valid = validateStudyGenerationInput({
    body: {
      generationType: "combined",
      sourceMode: "topic",
      topic: "Algebra",
      detailLevel: "balanced",
      difficulty: "medium",
      quizSize: 10,
      contextEducationLevel: "class_10",
      contextInstitutionState: "",
      contextInstitutionChoice: board,
      contextCustomInstitutionName: "",
      contextProgramChoice: "",
      contextCustomProgram: "",
      contextStreamChoice: "",
      contextCustomStream: "",
    },
    file: null,
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.values.academicContext.institutionKey, board);
});
