import toast from "react-hot-toast";

import {
  exportQuizToGoogleForms,
  redirectToGoogleFormsConnection,
} from "./studyExportService";

export const GOOGLE_FORMS_EXPORT_TASK_EVENT =
  "studyflux:google-forms-export-task";

const activeTasks = new Map();

const getTaskKey = (sessionId) => String(sessionId || "");

const emitTaskChanged = (detail) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(GOOGLE_FORMS_EXPORT_TASK_EVENT, {
      detail,
    }),
  );
};

export const isGoogleFormsExportTaskActive = (sessionId) =>
  activeTasks.has(getTaskKey(sessionId));

export const getGoogleFormsExportTask = (sessionId) =>
  activeTasks.get(getTaskKey(sessionId)) || null;

export const startGoogleFormsExportTask = ({
  sessionId,
  exportMode = "standard",
}) => {
  const key = getTaskKey(sessionId);

  if (!key) {
    return null;
  }

  const existingTask = activeTasks.get(key);

  if (existingTask) {
    toast(
      "This quiz is already being exported to Google Forms in the background.",
    );
    return existingTask;
  }

  const toastId = `google-forms-export-${key}`;
  const task = {
    sessionId: key,
    exportMode,
    startedAt: Date.now(),
    promise: null,
  };

  toast.loading(
    "Creating your Google Form in the background. You can keep using StudyFluxAI.",
    {
      id: toastId,
      duration: Infinity,
    },
  );

  emitTaskChanged({
    sessionId: key,
    exportMode,
    status: "started",
  });

  task.promise = (async () => {
    try {
      const response = await exportQuizToGoogleForms(
        key,
        exportMode,
      );
      const studyExport = response?.data?.studyExport || null;

      toast.success(
        response?.message || "Quiz exported to Google Forms.",
        {
          id: toastId,
          duration: 5200,
        },
      );

      emitTaskChanged({
        sessionId: key,
        exportMode,
        status: "success",
        studyExport,
      });

      return {
        status: "success",
        response,
        studyExport,
      };
    } catch (error) {
      const code = error?.response?.data?.code;

      if (
        code === "GOOGLE_FORMS_NOT_CONNECTED" ||
        code === "GOOGLE_FORMS_RECONNECT_REQUIRED"
      ) {
        toast(
          code === "GOOGLE_FORMS_RECONNECT_REQUIRED"
            ? "Google Forms needs to be reconnected. Opening Google authorization…"
            : "Connect Google Forms to continue. Opening Google authorization…",
          {
            id: toastId,
            duration: 2600,
          },
        );

        emitTaskChanged({
          sessionId: key,
          exportMode,
          status: "authorization_required",
        });

        window.setTimeout(() => {
          redirectToGoogleFormsConnection(key, exportMode);
        }, 250);

        return {
          status: "authorization_required",
          error,
        };
      }

      toast.error(
        error?.response?.data?.message ||
          "Google Forms could not export this quiz.",
        {
          id: toastId,
          duration: 5200,
        },
      );

      emitTaskChanged({
        sessionId: key,
        exportMode,
        status: "error",
      });

      return {
        status: "error",
        error,
      };
    } finally {
      const currentTask = activeTasks.get(key);

      if (currentTask === task) {
        activeTasks.delete(key);
      }

      emitTaskChanged({
        sessionId: key,
        exportMode,
        status: "settled",
      });
    }
  })();

  activeTasks.set(key, task);
  return task;
};
