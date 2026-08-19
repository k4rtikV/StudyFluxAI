const STUDY_PLANNER_EVENT = "studyflux:planner-changed";

export const emitStudyPlannerChanged = (detail = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STUDY_PLANNER_EVENT, { detail }));
};

export const subscribeToStudyPlannerChanges = (callback) => {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => callback(event.detail || {});
  window.addEventListener(STUDY_PLANNER_EVENT, handler);
  return () => window.removeEventListener(STUDY_PLANNER_EVENT, handler);
};
