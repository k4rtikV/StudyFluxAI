import api from "./authService";

const getApiOrigin = () => {
  const baseUrl = String(
    api.defaults.baseURL || "",
  ).replace(/\/+$/, "");

  return baseUrl;
};

const getDownloadFilename = (
  contentDisposition,
  fallback,
) => {
  const match = String(
    contentDisposition || "",
  ).match(
    /filename\*?=(?:UTF-8''|")?([^";]+)"?/i,
  );

  if (!match?.[1]) {
    return fallback;
  }

  try {
    return decodeURIComponent(
      match[1].replace(/^"|"$/g, ""),
    );
  } catch {
    return match[1].replace(
      /^"|"$/g,
      "",
    );
  }
};

export const downloadStudyNotesPdf =
  async (sessionId) => {
    const response = await api.get(
      `/study-exports/${sessionId}/notes/pdf`,
      {
        responseType: "blob",
      },
    );

    const filename = getDownloadFilename(
      response.headers?.[
        "content-disposition"
      ],
      "studyfluxai-notes.pdf",
    );

    const url = URL.createObjectURL(
      response.data,
    );
    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000,
    );

    return {
      filename,
    };
  };

export const getGoogleFormsStatus =
  async () => {
    const response = await api.get(
      "/integrations/google-forms/status",
    );

    return response.data;
  };

export const disconnectGoogleForms =
  async () => {
    const response = await api.delete(
      "/integrations/google-forms/disconnect",
    );

    return response.data;
  };

export const getGoogleFormsExport =
  async (sessionId) => {
    const response = await api.get(
      `/study-exports/${sessionId}/google-forms`,
    );

    return response.data;
  };

export const exportQuizToGoogleForms =
  async (sessionId) => {
    const response = await api.post(
      `/study-exports/${sessionId}/google-forms`,
    );

    return response.data;
  };

export const redirectToGoogleFormsConnection =
  (sessionId) => {
    const url =
      `${getApiOrigin()}/integrations/google-forms/connect` +
      `?sessionId=${encodeURIComponent(sessionId)}`;

    window.location.assign(url);
  };
