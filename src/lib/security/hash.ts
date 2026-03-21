import { createHash, randomBytes } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiKey() {
  return randomBytes(24).toString("base64url");
}

export function previewSecret(secret: string) {
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length])
    .join("")
    .slice(0, 8);
}
