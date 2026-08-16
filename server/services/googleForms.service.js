import jwt from "jsonwebtoken";
import { google } from "googleapis";

const GOOGLE_FORMS_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

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
}) =>
  jwt.sign(
    {
      purpose: "google_forms_connect",
      sessionId: String(sessionId || ""),
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
  });

  return questions;
};

const cleanText = (value, maxLength = 5000) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const buildQuestionRequest = (
  question,
  index,
) => {
  const explanation =
    cleanText(question.explanation, 2000) ||
    "Review the correct answer and the related StudyFluxAI notes.";

  const correctValue = cleanText(
    question.options[question.correctOptionIndex],
    1000,
  );

  return {
    createItem: {
      item: {
        title: cleanText(
          `${index + 1}. ${question.question}`,
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
              options: question.options.map(
                (option) => ({
                  value: cleanText(option, 1000),
                }),
              ),
            },
          },
        },
      },
      location: {
        index,
      },
    },
  };
};

export const createGoogleFormsQuiz = async ({
  refreshToken,
  studySession,
}) => {
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
    cleanText(studySession.output?.quiz?.title, 250) ||
    cleanText(studySession.output?.sessionTitle, 250) ||
    "StudyFluxAI Quiz";

  const documentTitle = cleanText(
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

  const requests = [
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
    {
      updateFormInfo: {
        info: {
          description:
            descriptionParts.join("\n\n"),
        },
        updateMask: "description",
      },
    },
    ...questions.map(buildQuestionRequest),
  ];

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests,
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
