const encoder = new TextEncoder();
const GRANT_SECONDS = 3600;

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unhex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16));
}

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return hex(salt) + "." + hex(await derive(password, salt));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, digest] = stored.split(".");
  if (!salt || !digest) return false;
  const actual = await derive(password, unhex(salt));
  return crypto.subtle.timingSafeEqual(actual, unhex(digest));
}

async function grantKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function grantCookie(
  secret: string,
  path: string,
  hash: string,
  secure: boolean,
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + GRANT_SECONDS;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await grantKey(secret),
    encoder.encode(`${path}\n${hash}\n${expires}`),
  );
  return `share_access=${expires}.${hex(signature)}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${GRANT_SECONDS}${secure ? "; Secure" : ""}`;
}

export async function hasGrant(
  request: Request,
  secret: string,
  path: string,
  hash: string,
): Promise<boolean> {
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("share_access="))
    ?.slice(13);
  if (!cookie || !/^\d+\.[a-f0-9]{64}$/.test(cookie)) return false;
  const [expires, signature] = cookie.split(".");
  const now = Math.floor(Date.now() / 1000);
  if (!expires || !signature || Number(expires) <= now || Number(expires) > now + GRANT_SECONDS)
    return false;
  return crypto.subtle.verify(
    "HMAC",
    await grantKey(secret),
    unhex(signature),
    encoder.encode(`${path}\n${hash}\n${expires}`),
  );
}
