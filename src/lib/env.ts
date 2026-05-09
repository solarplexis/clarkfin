const SESSION_COOKIE_NAME = "clarkfin_session";

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getPublicFirebaseConfig() {
  const configFromJson = parseJson<Record<string, string>>(
    process.env.NEXT_PUBLIC_FIREBASE_CONFIG,
    {}
  );

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? configFromJson.apiKey ?? "",
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? configFromJson.authDomain ?? "",
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? configFromJson.projectId ?? "",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
      configFromJson.storageBucket ??
      "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
      configFromJson.messagingSenderId ??
      "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? configFromJson.appId ?? ""
  };
}

export function getServiceAccount() {
  return parseJson<Record<string, string>>(process.env.FIREBASE_SERVICE_ACCOUNT, {});
}

export function getSessionCookieName() {
  return process.env.SESSION_COOKIE_NAME ?? SESSION_COOKIE_NAME;
}

export function getSessionDurationMs() {
  const configured = Number(process.env.SESSION_DURATION_HOURS ?? "120");

  return configured * 60 * 60 * 1000;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getOpenAIKey(): string {
  const key = process.env.OPEN_AI_KEY ?? "";
  if (!key) throw new Error("OPEN_AI_KEY is not configured.");
  return key;
}

export function getResendKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

export function getFirebaseApiKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
}
