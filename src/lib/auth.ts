const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function createSessionCookie(userId: string, secret: string) {
  const payload = encodeBase64Url(JSON.stringify({ userId }));
  const signature = await signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export async function parseSessionCookie(cookie: string, secret: string) {
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await signPayload(payload, secret);
  if (signature !== expectedSignature) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const userId = (parsed as { userId?: unknown }).userId;
    return typeof userId === "string" ? userId : null;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) return false;
  return (await hashPassword(password)) === passwordHash;
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return encodeBase64Url(signature);
}

function encodeBase64Url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return decoder.decode(bytes);
}
