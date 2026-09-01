import assert from "node:assert/strict";
import test from "node:test";

import { INDIA_STATES } from "../src/data/institutionCatalog.js";
import {
  BOARD_OPTIONS,
  OTHER_VALUE,
  getProgramOptions,
  getStreamOptions,
} from "../src/data/learningCatalog.js";
import { getStandaloneGenerationValidationError } from "../src/utils/generationValidation.js";
import { addProgramAndStreamIssues } from "../src/utils/learningProfileRefinement.js";
import { parseTutorMarkdown } from "../src/utils/tutorMarkdown.js";

const collectIssues = (data) => {
  const issues = [];
  addProgramAndStreamIssues(data, {
    addIssue: (issue) => issues.push(issue),
  });
  return issues;
};

const bachelorsProgram = getProgramOptions("bachelors")[0];
const bachelorsStream = getStreamOptions("bachelors", bachelorsProgram)[0];

const refinementBase = {
  educationLevel: "bachelors",
  programChoice: bachelorsProgram,
  customProgram: "",
  streamChoice: bachelorsStream,
  customStream: "",
};

test("CCRA: shared learning-profile refinement preserves program/stream issue order and wording", () => {
  assert.deepEqual(collectIssues(refinementBase), []);

  assert.deepEqual(
    collectIssues({ ...refinementBase, programChoice: "" }),
    [
      {
        code: "custom",
        path: ["programChoice"],
        message: "Select your program or degree.",
      },
      {
        code: "custom",
        path: ["streamChoice"],
        message: "Choose a valid stream or specialization.",
      },
    ],
  );

  assert.deepEqual(
    collectIssues({ ...refinementBase, programChoice: "bogus" }),
    [
      {
        code: "custom",
        path: ["programChoice"],
        message: "Choose a valid program.",
      },
      {
        code: "custom",
        path: ["streamChoice"],
        message: "Choose a valid stream or specialization.",
      },
    ],
  );

  assert.deepEqual(
    collectIssues({
      ...refinementBase,
      programChoice: OTHER_VALUE,
      customProgram: "x",
      streamChoice: OTHER_VALUE,
      customStream: "Custom",
    }),
    [
      {
        code: "custom",
        path: ["customProgram"],
        message: "Enter your program or degree.",
      },
    ],
  );

  assert.deepEqual(
    collectIssues({ ...refinementBase, streamChoice: "" }),
    [
      {
        code: "custom",
        path: ["streamChoice"],
        message: "Select your stream or specialization.",
      },
    ],
  );

  assert.deepEqual(
    collectIssues({ ...refinementBase, streamChoice: "bogus" }),
    [
      {
        code: "custom",
        path: ["streamChoice"],
        message: "Choose a valid stream or specialization.",
      },
    ],
  );

  assert.deepEqual(
    collectIssues({
      ...refinementBase,
      streamChoice: OTHER_VALUE,
      customStream: "x",
    }),
    [
      {
        code: "custom",
        path: ["customStream"],
        message: "Enter your stream or specialization.",
      },
    ],
  );
});

test("CCRA: Tutor markdown parser preserves block grammar and ordering", () => {
  assert.deepEqual(parseTutorMarkdown("Hello world\ncontinued line"), [
    { type: "paragraph", text: "Hello world continued line" },
  ]);

  assert.deepEqual(
    parseTutorMarkdown("# Heading\n\nParagraph **bold**\n\n---\n\n> quote one\n> quote two"),
    [
      { type: "heading", level: 1, text: "Heading" },
      { type: "paragraph", text: "Paragraph **bold**" },
      { type: "rule" },
      { type: "quote", text: "quote one quote two" },
    ],
  );

  assert.deepEqual(parseTutorMarkdown("```js\nconst x = 1;\n```\nafter"), [
    { type: "code", language: "js", code: "const x = 1;" },
    { type: "paragraph", text: "after" },
  ]);

  assert.deepEqual(parseTutorMarkdown("```python\nprint(1)"), [
    { type: "code", language: "python", code: "print(1)" },
  ]);

  assert.deepEqual(
    parseTutorMarkdown("| A | B |\n| --- | :---: |\n| 1 | 2 |\n| 3 | 4 |"),
    [
      {
        type: "table",
        header: ["A", "B"],
        rows: [
          ["1", "2"],
          ["3", "4"],
        ],
      },
    ],
  );

  assert.deepEqual(parseTutorMarkdown("- one\n* two\n\n1. first\n2) second"), [
    { type: "unordered", items: ["one", "two"] },
    { type: "ordered", items: ["first", "second"] },
  ]);
});

const generatorBase = {
  sourceMode: "topic",
  topic: "Algebra",
  sourceFile: null,
  educationLevel: "bachelors",
  boardFlow: false,
  institutionState: "Maharashtra",
  institutionChoice: "some",
  customInstitutionName: "",
  usesProgram: true,
  programChoice: bachelorsProgram,
  programOptions: [bachelorsProgram],
  customProgram: "",
  usesStream: true,
  streamChoice: bachelorsStream,
  streamOptions: [bachelorsStream],
  customStream: "",
  hasEnoughFluxGems: true,
  generationCost: 25,
};

const generatorError = (overrides = {}) =>
  getStandaloneGenerationValidationError({ ...generatorBase, ...overrides });

test("CCRA: standalone generator validation preserves first-error precedence and messages", () => {
  assert.equal(generatorError(), "");
  assert.equal(generatorError({ topic: "ab" }), "Enter a topic with at least 3 characters.");
  assert.equal(
    generatorError({ sourceMode: "source", sourceFile: null }),
    "Upload a source before continuing.",
  );
  assert.equal(
    generatorError({ educationLevel: "" }),
    "Choose the education level for this generation.",
  );
  assert.equal(
    generatorError({ institutionState: "Atlantis" }),
    "Choose the state / union territory for this generation.",
  );
  assert.equal(
    generatorError({ institutionChoice: "" }),
    "Choose the institution used for this generation.",
  );
  assert.equal(
    generatorError({
      educationLevel: "class_10",
      boardFlow: true,
      institutionState: "",
      institutionChoice: "Bogus board",
      usesProgram: false,
      usesStream: false,
    }),
    "Choose a valid school board for this generation.",
  );
  assert.equal(
    generatorError({
      educationLevel: "class_10",
      boardFlow: true,
      institutionState: "",
      institutionChoice: OTHER_VALUE,
      customInstitutionName: "x",
      usesProgram: false,
      usesStream: false,
    }),
    "Enter the school board name.",
  );
  assert.equal(
    generatorError({ programChoice: "" }),
    "Choose the program / degree for this generation.",
  );
  assert.equal(generatorError({ programChoice: "bogus" }), "Choose a valid program / degree.");
  assert.equal(
    generatorError({ programChoice: OTHER_VALUE, customProgram: "x" }),
    "Enter the program / degree.",
  );
  assert.equal(
    generatorError({ streamChoice: "" }),
    "Choose the stream / specialization for this generation.",
  );
  assert.equal(
    generatorError({ streamChoice: "bogus" }),
    "Choose a valid stream / specialization.",
  );
  assert.equal(
    generatorError({ streamChoice: OTHER_VALUE, customStream: "x" }),
    "Enter the stream / specialization.",
  );
  assert.equal(
    generatorError({ hasEnoughFluxGems: false }),
    "You need 25 FluxGems for this generation.",
  );
});

test("CCRA: generator validation keeps catalog constants wired to current data", () => {
  assert.ok(INDIA_STATES.includes("Maharashtra"));
  assert.ok(BOARD_OPTIONS.length > 0);
});
