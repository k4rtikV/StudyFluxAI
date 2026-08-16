let initialized = false;
let initializedClientId = null;
let currentCredentialHandler = null;

const waitForGoogleIdentity = (timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }

    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(window.google.accounts.id);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(
          new Error(
            "Google Identity Services did not load in time.",
          ),
        );
      }
    }, 50);
  });

export const initializeGoogleIdentity = async ({
  clientId,
  onCredential,
}) => {
  if (!clientId) {
    throw new Error(
      "VITE_GOOGLE_CLIENT_ID is missing from the frontend environment.",
    );
  }

  currentCredentialHandler = onCredential;

  const googleIdentity = await waitForGoogleIdentity();

  if (initialized) {
    if (initializedClientId !== clientId) {
      throw new Error(
        "Google Identity Services was initialized with a different client ID.",
      );
    }

    return;
  }

  googleIdentity.initialize({
    client_id: clientId,
    ux_mode: "popup",
    auto_select: false,
    callback: (response) => {
      currentCredentialHandler?.(response);
    },
  });

  initialized = true;
  initializedClientId = clientId;
};

export const renderGoogleButton = ({
  element,
  text = "continue_with",
  width = 400,
}) => {
  if (!element || !window.google?.accounts?.id) {
    return;
  }

  element.innerHTML = "";

  const safeWidth = Math.max(
    200,
    Math.min(400, Math.floor(width)),
  );

  window.google.accounts.id.renderButton(element, {
    type: "standard",
    theme: "outline",
    size: "large",
    text,
    shape: "rectangular",
    logo_alignment: "left",
    width: String(safeWidth),
  });
};

export const clearGoogleCredentialHandler = (handler) => {
  if (currentCredentialHandler === handler) {
    currentCredentialHandler = null;
  }
};