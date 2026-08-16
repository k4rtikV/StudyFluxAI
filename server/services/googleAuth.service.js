import { OAuth2Client } from "google-auth-library";

let googleClient;

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is missing from environment variables.",
    );
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(clientId);
  }

  return {
    client: googleClient,
    clientId,
  };
};

export const verifyGoogleCredential = async (credential) => {
  if (
    typeof credential !== "string" ||
    !credential.trim()
  ) {
    throw new Error("Google credential is required.");
  }

  const { client, clientId } = getGoogleClient();

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  if (
    !payload?.sub ||
    !payload?.email ||
    payload.email_verified !== true
  ) {
    throw new Error(
      "Google account information could not be verified.",
    );
  }

  const email = payload.email
    .trim()
    .toLowerCase();

  const isGmail =
    email.endsWith("@gmail.com");

  const isGoogleWorkspace =
    payload.email_verified === true &&
    Boolean(payload.hd);

  return {
    googleId: payload.sub,
    email,
    emailVerified: true,
    fullName:
      payload.name?.trim() ||
      email.split("@")[0],
    avatar: payload.picture || "",
    hostedDomain: payload.hd || null,

    googleIsAuthoritativeForEmail:
      isGmail || isGoogleWorkspace,
  };
};