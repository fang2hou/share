import { messages, pickLang, type Lang } from "../shared/i18n.ts";

const SESSION_COOKIE = "ts_session";
const STATE_COOKIE = "ts_oauth_state";
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

type Session = { sub: string; login: string; exp: number };

const te = new TextEncoder();
const td = new TextDecoder();

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const ab = te.encode(a);
  const bb = te.encode(b);
  if (ab.length !== bb.length) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

export async function signSession(
  secret: string,
  s: { sub: string; login: string },
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: Session = { sub: s.sub, login: s.login, exp: nowSec + SESSION_TTL_SEC };
  const body = bytesToB64url(te.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(body)));
  return body + "." + bytesToB64url(mac);
}

export async function readSession(
  request: Request,
  env: Env,
): Promise<{ sub: string; login: string } | null> {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const token = parseCookie(cookie, SESSION_COOKIE);
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey(env.SESSION_SECRET);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), te.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(td.decode(b64urlToBytes(body))) as Partial<Session>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.login !== "string" ||
      typeof payload.exp !== "number"
    )
      return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, login: payload.login };
  } catch {
    return null;
  }
}

export function appOrigin(env: Env, url: URL): string {
  return env.APP_ORIGIN || url.origin;
}

export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return (
    origin === new URL(request.url).origin || (env.APP_ORIGIN !== "" && origin === env.APP_ORIGIN)
  );
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`;
}

export function loginRedirect(request: Request, env: Env): Response {
  const state = crypto.randomUUID();
  const redirectUri = appOrigin(env, new URL(request.url)) + "/auth/callback";
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", authorize.toString()],
      [
        "Set-Cookie",
        `${STATE_COOKIE}=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      ],
    ],
  });
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function oauthFailure(request: Request, step: string, status: number): Response {
  console.error(JSON.stringify({ event: "oauth_failed", step, status }));
  const tags = (request.headers.get("Accept-Language") ?? "")
    .split(",")
    .map((t) => (t.split(";")[0] ?? "").trim())
    .filter(Boolean);
  const lang: Lang = pickLang(tags);
  const m = messages[lang];
  const html = `<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:system-ui,sans-serif;padding:2rem">${escapeHtml(m.loginFailed)} <a href="/auth/login">${escapeHtml(m.retry)}</a></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookieState = parseCookie(request.headers.get("Cookie") ?? "", STATE_COOKIE) ?? "";
  if (!code || !(await timingSafeEqualStr(state, cookieState)))
    return oauthFailure(request, "state", 0);

  const redirectUri = appOrigin(env, url) + "/auth/callback";
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) return oauthFailure(request, "token", tokenRes.status);
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return oauthFailure(request, "token_payload", tokenRes.status);

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "User-Agent": "share",
      Accept: "application/vnd.github+json",
    },
  });
  if (!userRes.ok) return oauthFailure(request, "user", userRes.status);
  const user = (await userRes.json()) as { id?: unknown; login?: unknown };
  if (typeof user.id !== "number" || typeof user.login !== "string")
    return oauthFailure(request, "user_payload", userRes.status);

  const token = await signSession(env.SESSION_SECRET, { sub: String(user.id), login: user.login });
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", "/"],
      ["Set-Cookie", sessionCookie(token)],
      ["Set-Cookie", `${STATE_COOKIE}=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`],
    ],
  });
}
