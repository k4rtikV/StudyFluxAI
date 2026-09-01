import {
  OTHER_VALUE,
  getProgramOptions,
  getStreamOptions,
  levelUsesProgram,
  levelUsesStream,
} from "../data/learningCatalog.js";

const addChoiceIssue = ({
  choice,
  custom,
  options,
  choicePath,
  customPath,
  missingMessage,
  invalidMessage,
  customMessage,
  ctx,
}) => {
  if (!choice) {
    ctx.addIssue({
      code: "custom",
      path: [choicePath],
      message: missingMessage,
    });
    return;
  }

  if (choice === OTHER_VALUE) {
    if (custom.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: [customPath],
        message: customMessage,
      });
    }
    return;
  }

  if (!options.includes(choice)) {
    ctx.addIssue({
      code: "custom",
      path: [choicePath],
      message: invalidMessage,
    });
  }
};

export const addProgramAndStreamIssues = (data, ctx) => {
  if (levelUsesProgram(data.educationLevel)) {
    addChoiceIssue({
      choice: data.programChoice,
      custom: data.customProgram,
      options: getProgramOptions(data.educationLevel),
      choicePath: "programChoice",
      customPath: "customProgram",
      missingMessage: "Select your program or degree.",
      invalidMessage: "Choose a valid program.",
      customMessage: "Enter your program or degree.",
      ctx,
    });
  }

  if (levelUsesStream(data.educationLevel)) {
    addChoiceIssue({
      choice: data.streamChoice,
      custom: data.customStream,
      options: getStreamOptions(
        data.educationLevel,
        data.programChoice === OTHER_VALUE ? "" : data.programChoice,
      ),
      choicePath: "streamChoice",
      customPath: "customStream",
      missingMessage: "Select your stream or specialization.",
      invalidMessage: "Choose a valid stream or specialization.",
      customMessage: "Enter your stream or specialization.",
      ctx,
    });
  }
};
