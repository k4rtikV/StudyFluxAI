import {
  INDIA_STATES,
  findInstitutionById,
} from "../data/institutionCatalog.js";

import {
  BOARD_OPTIONS,
  OTHER_VALUE,
  getInstitutionTypeForLevel,
  getProgramOptions,
  getStreamOptions,
  levelUsesProgram,
  levelUsesStream,
} from "../data/learningCatalog.js";

const VALID_EDUCATION_LEVELS = new Set([
  "class_7",
  "class_8",
  "class_9",
  "class_10",
  "class_11",
  "class_12",
  "diploma",
  "bachelors",
  "masters",
  "mba",
  "phd",
  "other",
]);

const normalize = (value) =>
  String(value ?? "").trim();

const customValue = ({
  value,
  errorField,
  label,
  errors,
  maxLength = 180,
}) => {
  const normalized = normalize(value);

  if (normalized.length < 2) {
    errors[errorField] =
      `Enter your ${label}.`;

    return "";
  }

  if (normalized.length > maxLength) {
    errors[errorField] =
      `${label} cannot exceed ${maxLength} characters.`;

    return "";
  }

  return normalized;
};

const validateProgramOrStreamChoice = ({
  choice,
  custom,
  allowedOptions,
  choiceField,
  customField,
  label,
  errors,
  required,
}) => {
  const normalizedChoice =
    normalize(choice);

  if (!required && !normalizedChoice) {
    return {
      key: "",
      value: "",
    };
  }

  if (!normalizedChoice) {
    errors[choiceField] =
      `Select your ${label}.`;

    return {
      key: "",
      value: "",
    };
  }

  if (normalizedChoice === OTHER_VALUE) {
    return {
      key: OTHER_VALUE,
      value: customValue({
        value: custom,
        errorField: customField,
        label,
        errors,
        maxLength: 120,
      }),
    };
  }

  if (
    !allowedOptions.includes(
      normalizedChoice,
    )
  ) {
    errors[choiceField] =
      `Choose a valid ${label} from the available options.`;

    return {
      key: "",
      value: "",
    };
  }

  return {
    key: normalizedChoice,
    value: normalizedChoice,
  };
};

export const validateLearningProfile = (
  payload,
) => {
  const errors = {};

  const educationLevel = normalize(
    payload.educationLevel,
  );

  if (
    !VALID_EDUCATION_LEVELS.has(
      educationLevel,
    )
  ) {
    errors.educationLevel =
      "Select a valid education level.";
  }

  const expectedInstitutionType =
    getInstitutionTypeForLevel(
      educationLevel,
    );

  const suppliedInstitutionType =
    normalize(
      payload.institutionType,
    );

  if (
    expectedInstitutionType &&
    suppliedInstitutionType !==
      expectedInstitutionType
  ) {
    errors.institutionType =
      "Institution type does not match the selected education level.";
  }

  let institutionState = "";
  let institutionId = "";
  let institutionCategory = "";
  let institutionSector = "";
  let institutionKey = "";
  let institutionName = "";

  if (
    expectedInstitutionType === "board"
  ) {
    const choice = normalize(
      payload.institutionChoice,
    );

    if (!choice) {
      errors.institutionChoice =
        "Select your school board.";
    } else if (
      choice === OTHER_VALUE
    ) {
      institutionKey = OTHER_VALUE;
      institutionCategory = "other";
      institutionSector = "other";
      institutionName = customValue({
        value:
          payload.customInstitutionName,
        errorField:
          "customInstitutionName",
        label: "school board",
        errors,
      });
    } else if (
      !BOARD_OPTIONS.includes(choice)
    ) {
      errors.institutionChoice =
        "Choose a valid school board.";
    } else {
      institutionKey = choice;
      institutionName = choice;
      institutionCategory = "other";
    }
  } else {
    institutionState = normalize(
      payload.institutionState,
    );

    if (
      !INDIA_STATES.includes(
        institutionState,
      )
    ) {
      errors.institutionState =
        "Select a valid state or union territory.";
    }

    const choice = normalize(
      payload.institutionChoice,
    );

    if (!choice) {
      errors.institutionChoice =
        "Select your institution.";
    } else if (
      choice === OTHER_VALUE
    ) {
      institutionKey = OTHER_VALUE;
      institutionCategory = "other";
      institutionSector = "other";
      institutionName = customValue({
        value:
          payload.customInstitutionName,
        errorField:
          "customInstitutionName",
        label: "institution name",
        errors,
      });
    } else {
      const institution =
        findInstitutionById(choice);

      if (!institution) {
        errors.institutionChoice =
          "Choose a valid institution from the catalog.";
      } else if (
        institution.state !==
        institutionState
      ) {
        errors.institutionChoice =
          "The selected institution does not belong to the selected state.";
      } else if (
        educationLevel === "diploma" &&
        institution.category !==
          "diploma"
      ) {
        errors.institutionChoice =
          "Choose a diploma institution for the selected education level.";
      } else if (
        educationLevel !== "diploma" &&
        institution.category ===
          "diploma"
      ) {
        errors.institutionChoice =
          "Choose a college, university or institute for higher education.";
      } else {
        institutionId =
          institution.id;
        institutionKey =
          institution.id;
        institutionName =
          institution.name;
        institutionCategory =
          institution.category;
        institutionSector =
          institution.sector || "";
      }
    }
  }

  const usesProgram =
    levelUsesProgram(
      educationLevel,
    );

  const program =
    validateProgramOrStreamChoice({
      choice: payload.programChoice,
      custom: payload.customProgram,
      allowedOptions:
        getProgramOptions(
          educationLevel,
        ),
      choiceField: "programChoice",
      customField: "customProgram",
      label: "program or degree",
      errors,
      required: usesProgram,
    });

  const usesStream =
    levelUsesStream(
      educationLevel,
    );

  const stream =
    validateProgramOrStreamChoice({
      choice: payload.streamChoice,
      custom: payload.customStream,
      allowedOptions:
        getStreamOptions(
          educationLevel,
          program.key === OTHER_VALUE
            ? ""
            : program.value,
        ),
      choiceField: "streamChoice",
      customField: "customStream",
      label:
        "stream or specialization",
      errors,
      required: usesStream,
    });

  return {
    valid:
      Object.keys(errors).length === 0,

    errors,

    values: {
      educationLevel,
      institutionType:
        expectedInstitutionType,
      institutionState,
      institutionId,
      institutionCategory,
      institutionSector,
      institutionKey,
      institutionName,
      programKey: program.key,
      program: program.value,
      streamKey: stream.key,
      stream: stream.value,
    },
  };
};