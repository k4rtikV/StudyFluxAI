import crypto from "node:crypto";

const getEncryptionKey = () => {
  const secret = String(
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "",
  ).trim();

  if (secret.length < 32) {
    const error = new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY must be set to a random secret of at least 32 characters.",
    );
    error.code = "GOOGLE_TOKEN_ENCRYPTION_NOT_CONFIGURED";
    throw error;
  }

  return crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest();
};

export const encryptSecret = (plainText) => {
  const value = String(plainText || "");

  if (!value) {
    throw new Error("Cannot encrypt an empty secret.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

export const decryptSecret = (payload) => {
  const [version, ivPart, authTagPart, encryptedPart] =
    String(payload || "").split(".");

  if (
    version !== "v1" ||
    !ivPart ||
    !authTagPart ||
    !encryptedPart
  ) {
    const error = new Error(
      "Stored Google credential is invalid.",
    );
    error.code = "GOOGLE_TOKEN_DECRYPT_FAILED";
    throw error;
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );

    decipher.setAuthTag(
      Buffer.from(authTagPart, "base64url"),
    );

    return Buffer.concat([
      decipher.update(
        Buffer.from(encryptedPart, "base64url"),
      ),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    const error = new Error(
      "Stored Google credential could not be decrypted.",
    );
    error.code = "GOOGLE_TOKEN_DECRYPT_FAILED";
    throw error;
  }
};
