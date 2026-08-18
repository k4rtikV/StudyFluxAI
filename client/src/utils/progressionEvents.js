const PROGRESSION_CHANGED_EVENT = "studyflux:progression-changed";

export const emitProgressionChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROGRESSION_CHANGED_EVENT));
};

export const subscribeToProgressionChanges = (handler) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROGRESSION_CHANGED_EVENT, handler);
  return () => window.removeEventListener(PROGRESSION_CHANGED_EVENT, handler);
};
