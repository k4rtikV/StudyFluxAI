import jwt from "jsonwebtoken";
import { google } from "googleapis";

const GOOGLE_FORMS_SCOPE =
  "https://www.googleapis.com/auth/drive.file";


export const GOOGLE_FORMS_EXPORT_MODES = {
  STANDARD: "standard",
  STUDENT_DETAILS: "student_details",
};

export const normalizeGoogleFormsExportMode = (value) =>
  value === GOOGLE_FORMS_EXPORT_MODES.STUDENT_DETAILS
    ? GOOGLE_FORMS_EXPORT_MODES.STUDENT_DETAILS
    : GOOGLE_FORMS_EXPORT_MODES.STANDARD;

const getOauthConfig = () => {
  const clientId = String(
    process.env.GOOGLE_FORMS_CLIENT_ID || "",
  ).trim();
  const clientSecret = String(
    process.env.GOOGLE_FORMS_CLIENT_SECRET || "",
  ).trim();
  const redirectUri = String(
    process.env.GOOGLE_FORMS_REDIRECT_URI || "",
  ).trim();

  if (!clientId || !clientSecret || !redirectUri) {
    const error = new Error(
      "Google Forms OAuth is not configured on the server.",
    );
    error.code = "GOOGLE_FORMS_NOT_CONFIGURED";
    throw error;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
};

const createOauthClient = () => {
  const {
    clientId,
    clientSecret,
    redirectUri,
  } = getOauthConfig();

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
};

const getStateSecret = () => {
  const secret = String(
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
      process.env.JWT_SECRET ||
      "",
  ).trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET or GOOGLE_OAUTH_STATE_SECRET is required for Google Forms OAuth state signing.",
    );
  }

  return secret;
};

export const createGoogleFormsOauthState = ({
  userId,
  sessionId = "",
  exportMode = GOOGLE_FORMS_EXPORT_MODES.STANDARD,
}) =>
  jwt.sign(
    {
      purpose: "google_forms_connect",
      sessionId: String(sessionId || ""),
      exportMode: normalizeGoogleFormsExportMode(exportMode),
    },
    getStateSecret(),
    {
      subject: String(userId),
      expiresIn: "10m",
      issuer: "studyfluxai",
      audience: "studyfluxai-google-forms",
    },
  );

export const verifyGoogleFormsOauthState = (state) => {
  const payload = jwt.verify(
    String(state || ""),
    getStateSecret(),
    {
      issuer: "studyfluxai",
      audience: "studyfluxai-google-forms",
    },
  );

  if (payload.purpose !== "google_forms_connect") {
    throw new Error("Invalid Google Forms OAuth state.");
  }

  return {
    userId: payload.sub,
    sessionId: String(payload.sessionId || ""),
    exportMode: normalizeGoogleFormsExportMode(payload.exportMode),
  };
};

export const getGoogleFormsAuthorizationUrl = ({
  state,
}) => {
  const oauthClient = createOauthClient();

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: [GOOGLE_FORMS_SCOPE],
    state,
  });
};

export const exchangeGoogleFormsAuthorizationCode =
  async (code) => {
    const oauthClient = createOauthClient();
    const { tokens } = await oauthClient.getToken(
      String(code || ""),
    );

    return {
      refreshToken: tokens.refresh_token || "",
      scopes: String(tokens.scope || GOOGLE_FORMS_SCOPE)
        .split(/\s+/)
        .filter(Boolean),
    };
  };

const validateQuizForExport = (quiz) => {
  const questions = quiz?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    const error = new Error(
      "This learning item does not contain a quiz to export.",
    );
    error.code = "QUIZ_NOT_AVAILABLE";
    throw error;
  }

  questions.forEach((question, index) => {
    const options = question?.options || [];
    const correctOptionIndex =
      question?.correctOptionIndex;

    if (
      !question?.question ||
      !Array.isArray(options) ||
      options.length < 2 ||
      !Number.isInteger(correctOptionIndex) ||
      correctOptionIndex < 0 ||
      correctOptionIndex >= options.length
    ) {
      const error = new Error(
        `Quiz question ${index + 1} cannot be exported because it is malformed.`,
      );
      error.code = "INVALID_QUIZ_EXPORT_DATA";
      throw error;
    }

    const normalizedOptions = options.map((option) =>
      String(option || "").trim(),
    );

    if (
      normalizedOptions.some((option) => !option) ||
      new Set(normalizedOptions).size !==
        normalizedOptions.length
    ) {
      const error = new Error(
        `Quiz question ${index + 1} must have distinct non-empty answer options before it can be exported.`,
      );
      error.code = "INVALID_QUIZ_EXPORT_DATA";
      throw error;
    }

    const formsDisplayOptions = options.map((option) =>
      cleanDisplayedText(option, 1000),
    );

    if (
      formsDisplayOptions.some((option) => !option) ||
      new Set(formsDisplayOptions).size !==
        formsDisplayOptions.length
    ) {
      const error = new Error(
        `Quiz question ${index + 1} has answer options that become empty or identical after Google Forms text normalization.`,
      );
      error.code = "INVALID_QUIZ_EXPORT_DATA";
      throw error;
    }
  });

  return questions;
};

const cleanText = (value, maxLength = 5000) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

// Google Forms rejects newlines in several user-visible fields such as
// item titles and choice values. Tutor-created quizzes can legitimately
// contain Markdown/code blocks, so normalize only the Forms payload while
// preserving the richer source content stored in StudyFluxAI.
const cleanDisplayedText = (value, maxLength = 5000) =>
  String(value || "")
    // Remove fenced-code delimiters/language labels while keeping code text.
    .replace(/```[a-zA-Z0-9_+-]*\s*/g, " ")
    .replace(/```/g, " ")
    // Remove inline-code delimiters; Forms does not render Markdown.
    .replace(/`([^`]*)`/g, "$1")
    // Displayed text sent to Forms must be a single line.
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const STUDENT_DETAIL_FIELDS = [
  {
    title: "Student name",
    description: "Enter your full name.",
  },
  {
    title: "Class",
    description: "Enter your class or year.",
  },
  {
    title: "Division",
    description: "Enter your division or section.",
  },
];

const buildStudentDetailRequest = (field, index) => ({
  createItem: {
    item: {
      title: field.title,
      description: field.description,
      questionItem: {
        question: {
          required: true,
          textQuestion: {
            paragraph: false,
          },
        },
      },
    },
    location: {
      index,
    },
  },
});

const buildQuestionRequest = (
  question,
  questionIndex,
  locationIndex = questionIndex,
) => {
  const explanation =
    cleanDisplayedText(question.explanation, 2000) ||
    "Review the correct answer and the related StudyFluxAI notes.";

  const displayOptions = question.options.map((option) =>
    cleanDisplayedText(option, 1000),
  );

  const correctValue =
    displayOptions[question.correctOptionIndex];

  return {
    createItem: {
      item: {
        title: cleanDisplayedText(
          `${questionIndex + 1}. ${question.question}`,
          4000,
        ),
        questionItem: {
          question: {
            required: true,
            grading: {
              pointValue: 1,
              correctAnswers: {
                answers: [
                  {
                    value: correctValue,
                  },
                ],
              },
              whenRight: {
                text: `Correct. ${explanation}`,
              },
              whenWrong: {
                text: explanation,
              },
            },
            choiceQuestion: {
              type: "RADIO",
              shuffle: false,
              options: displayOptions.map(
                (option) => ({
                  value: option,
                }),
              ),
            },
          },
        },
      },
      location: {
        index: locationIndex,
      },
    },
  };
};

export const createGoogleFormsQuiz = async ({
  refreshToken,
  studySession,
  exportMode = GOOGLE_FORMS_EXPORT_MODES.STANDARD,
}) => {
  const normalizedExportMode =
    normalizeGoogleFormsExportMode(exportMode);
  const questions = validateQuizForExport(
    studySession?.output?.quiz,
  );

  const oauthClient = createOauthClient();
  oauthClient.setCredentials({
    refresh_token: refreshToken,
  });

  const forms = google.forms({
    version: "v1",
    auth: oauthClient,
  });

  const quizTitle =
    cleanDisplayedText(studySession.output?.quiz?.title, 250) ||
    cleanDisplayedText(studySession.output?.sessionTitle, 250) ||
    "StudyFluxAI Quiz";

  const documentTitle = cleanDisplayedText(
    `StudyFluxAI - ${quizTitle}`,
    250,
  );

  const createResponse =
    await forms.forms.create({
      unpublished: true,
      requestBody: {
        info: {
          title: quizTitle,
          documentTitle,
        },
      },
    });

  const formId = createResponse.data?.formId;

  if (!formId) {
    const error = new Error(
      "Google Forms did not return a form ID.",
    );
    error.code = "GOOGLE_FORMS_CREATE_FAILED";
    throw error;
  }

  const descriptionParts = [
    cleanText(
      studySession.output?.shortDescription,
      1500,
    ),
    cleanText(
      studySession.output?.quiz?.instructions,
      1500,
    ),
    "Generated from a saved StudyFluxAI quiz.",
  ].filter(Boolean);

  // Keep form metadata separate from item creation. More importantly,
  // create the non-scored student identity fields while the form is still
  // a normal form. Google Forms can then be switched into quiz mode before
  // the scored MCQs are added. This avoids mixing ungraded text questions,
  // quiz-mode activation and graded choice questions in one batch request.
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [
        {
          updateFormInfo: {
            info: {
              description:
                descriptionParts.join("\n\n"),
            },
            updateMask: "description",
          },
        },
      ],
    },
  });

  let questionOffset = 0;

  if (
    normalizedExportMode ===
    GOOGLE_FORMS_EXPORT_MODES.STUDENT_DETAILS
  ) {
    const studentDetailRequests =
      STUDENT_DETAIL_FIELDS.map(
        buildStudentDetailRequest,
      );

    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: studentDetailRequests,
      },
    });

    questionOffset =
      studentDetailRequests.length;
  }

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [
        {
          updateSettings: {
            settings: {
              quizSettings: {
                isQuiz: true,
              },
            },
            updateMask: "quizSettings.isQuiz",
          },
        },
      ],
    },
  });

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: questions.map(
        (question, index) =>
          buildQuestionRequest(
            question,
            index,
            index + questionOffset,
          ),
      ),
    },
  });

  await forms.forms.setPublishSettings({
    formId,
    requestBody: {
      publishSettings: {
        publishState: {
          isPublished: true,
          isAcceptingResponses: true,
        },
      },
      updateMask: "publishState",
    },
  });

  const getResponse =
    await forms.forms.get({
      formId,
    });

  const responderUrl =
    getResponse.data?.responderUri || "";

  return {
    formId,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    responderUrl,
  };
};

export const isGoogleFormsReconnectError = (
  error,
) => {
  const status = Number(
    error?.response?.status ||
      error?.status ||
      error?.statusCode ||
      0,
  );
  const oauthError = String(
    error?.response?.data?.error ||
      error?.errors?.[0]?.reason ||
      "",
  );

  return (
    status === 401 ||
    oauthError === "invalid_grant" ||
    /invalid_grant|token has been expired|revoked/i.test(
      String(error?.message || ""),
    )
  );
};
