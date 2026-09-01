import { INDIA_STATES } from "../data/institutionCatalog.js";
import { BOARD_OPTIONS, OTHER_VALUE } from "../data/learningCatalog.js";

const getSourceError = ({ sourceMode, topic, sourceFile }) => {
  if (sourceMode === "topic" && topic.trim().length < 3) {
    return "Enter a topic with at least 3 characters.";
  }

  if (sourceMode === "source" && !sourceFile) {
    return "Upload a source before continuing.";
  }

  return "";
};

const getInstitutionError = ({
  educationLevel,
  boardFlow,
  institutionState,
  institutionChoice,
  customInstitutionName,
}) => {
  if (!educationLevel) {
    return "Choose the education level for this generation.";
  }

  if (!boardFlow && !INDIA_STATES.includes(institutionState)) {
    return "Choose the state / union territory for this generation.";
  }

  if (!institutionChoice) {
    return boardFlow
      ? "Choose the school board used for this generation."
      : "Choose the institution used for this generation.";
  }

  if (
    boardFlow &&
    institutionChoice !== OTHER_VALUE &&
    !BOARD_OPTIONS.includes(institutionChoice)
  ) {
    return "Choose a valid school board for this generation.";
  }

  if (
    institutionChoice === OTHER_VALUE &&
    customInstitutionName.trim().length < 2
  ) {
    return boardFlow
      ? "Enter the school board name."
      : "Enter the institution name.";
  }

  return "";
};

const getProgramError = ({
  usesProgram,
  programChoice,
  programOptions,
  customProgram,
}) => {
  if (!usesProgram) {
    return "";
  }

  if (!programChoice) {
    return "Choose the program / degree for this generation.";
  }

  if (
    programChoice !== OTHER_VALUE &&
    !programOptions.includes(programChoice)
  ) {
    return "Choose a valid program / degree.";
  }

  if (
    programChoice === OTHER_VALUE &&
    customProgram.trim().length < 2
  ) {
    return "Enter the program / degree.";
  }

  return "";
};

const getStreamError = ({
  usesStream,
  usesProgram,
  programChoice,
  streamChoice,
  streamOptions,
  customStream,
}) => {
  if (!usesStream || (usesProgram && !programChoice)) {
    return "";
  }

  if (!streamChoice) {
    return "Choose the stream / specialization for this generation.";
  }

  if (
    streamChoice !== OTHER_VALUE &&
    !streamOptions.includes(streamChoice)
  ) {
    return "Choose a valid stream / specialization.";
  }

  if (
    streamChoice === OTHER_VALUE &&
    customStream.trim().length < 2
  ) {
    return "Enter the stream / specialization.";
  }

  return "";
};

export const getStandaloneGenerationValidationError = ({
  sourceMode,
  topic,
  sourceFile,
  educationLevel,
  boardFlow,
  institutionState,
  institutionChoice,
  customInstitutionName,
  usesProgram,
  programChoice,
  programOptions,
  customProgram,
  usesStream,
  streamChoice,
  streamOptions,
  customStream,
  hasEnoughFluxGems,
  generationCost,
}) => {
  const sourceError = getSourceError({ sourceMode, topic, sourceFile });
  if (sourceError) return sourceError;

  const institutionError = getInstitutionError({
    educationLevel,
    boardFlow,
    institutionState,
    institutionChoice,
    customInstitutionName,
  });
  if (institutionError) return institutionError;

  const programError = getProgramError({
    usesProgram,
    programChoice,
    programOptions,
    customProgram,
  });
  if (programError) return programError;

  const streamError = getStreamError({
    usesStream,
    usesProgram,
    programChoice,
    streamChoice,
    streamOptions,
    customStream,
  });
  if (streamError) return streamError;

  if (!hasEnoughFluxGems) {
    return `You need ${generationCost} FluxGems for this generation.`;
  }

  return "";
};
