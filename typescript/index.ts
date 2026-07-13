// KLON TypeScript SDK の最小サンプル。
// Authorization Code Flow + PKCE -> トークン取得 -> Registry API (ConnectRPC) 呼び出しまでのフルフローを実装する。
//
// 使い方:
//   cp .env.template .env  # CLIENT_ID 等を設定
//   pnpm run dev
//
// ブラウザで http://localhost:8080 を開く。

import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createClient as createConnectClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  createClient,
  AcrValues,
  Prompts,
  Scopes,
  Resources,
  type AuthorizationSession,
  type TokenSet,
} from "@pocketsign/klon-sdk";
import { RegistryUserService } from "@buf/pocketsign_apis.bufbuild_es/pocketsign/link/v2/registry_user_service_pb.js";
import { toJson } from "@bufbuild/protobuf";
import { RegistryUserServiceReadResourceValuesResponseSchema } from "@buf/pocketsign_apis.bufbuild_es/pocketsign/link/v2/registry_user_service_pb.js";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const ISSUER = process.env.ISSUER ?? "https://id.mock.klon.ing";
const REGISTRY_URL = process.env.REGISTRY_URL ?? "https://registry.mock.klon.ing";
const PORT = Number(process.env.PORT ?? "8080");
const REDIRECT_URI = process.env.REDIRECT_URI ?? "http://localhost:8080/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("CLIENT_ID と CLIENT_SECRET を設定してください (cp .env.template .env)");
}

const oidcClient = createClient({
  issuer: ISSUER,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

// --- セッション (Cookie ベース) ---
// 認可フロー用: セッションを Map で一時保存 (コールバック後に即削除されるため共有可)
const sessions = new Map<string, AuthorizationSession>();

// トークン用: Cookie に保存 (ユーザーごとに分離)
const TOKEN_COOKIE = "oidc_tokens";
const TOKEN_MAX_AGE = 60 * 60 * 24; // 24 hours

function setTokenCookie(c: Context, tokens: TokenSet): void {
  setCookie(c, TOKEN_COOKIE, Buffer.from(JSON.stringify(tokens), "utf-8").toString("base64url"), {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });
}

function getTokenFromCookie(c: Context): TokenSet | null {
  const cookie = getCookie(c, TOKEN_COOKIE);
  if (!cookie) return null;
  try {
    return JSON.parse(Buffer.from(cookie, "base64url").toString("utf-8")) as TokenSet;
  } catch {
    return null;
  }
}

function clearTokenCookie(c: Context): void {
  deleteCookie(c, TOKEN_COOKIE, { path: "/" });
}

const app = new Hono();

// --- / : 認証フロー開始 ---
app.get("/", (c) => {
  if (getTokenFromCookie(c)) {
    return c.redirect("/dashboard");
  }

  return c.html(`<!DOCTYPE html><html><head><style>
    body { font-family: monospace; max-width: 800px; margin: 2em auto; text-align: center; }
    a.btn { display: inline-block; margin-top: 2em; padding: 0.8em 2em; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; }
    a.btn:hover { background: #0052a3; }
  </style></head><body>
  <h1>KLON TypeScript SDK Example</h1>
  <p>Authorization Code Flow + PKCE + PAR + Authorization Details</p>
  <a class="btn" href="/authorize">KLON でログイン</a>
  </body></html>`);
});

// --- /authorize : 認可リクエスト構築 -> IdP にリダイレクト ---
app.get("/authorize", async (c) => {
  const { url, session } = await oidcClient.createAuthorizationURL({
    scopes: [Scopes.OPENID, Scopes.PROFILE, Scopes.OFFLINE_ACCESS],
    authorizationDetails: [
      {
        identifiers: [Resources.MERGED_FULL_NAME],
        actions: ["read"],
        required: true,
      },
      {
        identifiers: [Resources.MERGED_BIRTH_DATE],
        actions: ["read"],
      },
      {
        identifiers: [Resources.EMAIL_ADDRESS],
        actions: ["read"],
      },
    ],
    acrValues: [AcrValues.HIGH],
    prompt: [Prompts.CONSENT],
    maxAge: 3600,
    grantManagementAction: "replace",
    usePAR: true,
  });

  sessions.set(session.state, session);
  return c.redirect(url.toString());
});

// --- /callback : 認可コード -> トークン交換 ---
app.get("/callback", async (c) => {
  const error = c.req.query("error");
  if (error) {
    return c.text(`${error}: ${c.req.query("error_description")}`, 400);
  }

  const state = c.req.query("state") ?? "";
  const session = sessions.get(state);
  if (!session) {
    return c.text("invalid state", 400);
  }
  sessions.delete(state);

  const code = c.req.query("code") ?? "";
  const tokens = await oidcClient.exchangeCode(code, state, session);
  setTokenCookie(c, tokens);
  return c.redirect("/dashboard");
});

// --- /dashboard : トークン + API 呼び出し結果 ---
app.get("/dashboard", async (c) => {
  const ts = getTokenFromCookie(c);
  if (!ts) {
    return c.redirect("/");
  }

  const sections: string[] = [];

  // Token Set
  sections.push(`<h2>Token Set</h2>`);
  sections.push(`<pre>${JSON.stringify(ts, null, 2)}</pre>`);

  // Authorization Details (grant 内容)
  if (ts.authorizationDetails && ts.authorizationDetails.length > 0) {
    sections.push(`<h2>Authorization Details (granted)</h2>`);
    sections.push(`<pre>${JSON.stringify(ts.authorizationDetails, null, 2)}</pre>`);
  }

  // UserService.ReadResourceValues via ConnectRPC
  sections.push(`<h2>UserService.ReadResourceValues</h2>`);
  sections.push(`<p>ユーザーのアクセストークンで Registry API を呼び出し</p>`);

  try {
    const transport = createConnectTransport({
      baseUrl: REGISTRY_URL,
      httpVersion: "1.1",
      interceptors: [
        (next) => async (request) => {
          request.header.set("Authorization", `Bearer ${ts.accessToken}`);
          return next(request);
        },
      ],
    });
    const registryClient = createConnectClient(RegistryUserService, transport);
    const result = await registryClient.readResourceValues({
      idOrAliases: [
        Resources.MERGED_FULL_NAME,
        Resources.MERGED_BIRTH_DATE,
        Resources.EMAIL_ADDRESS,
      ],
    });
    sections.push(
      `<pre>${JSON.stringify(toJson(RegistryUserServiceReadResourceValuesResponseSchema, result), null, 2)}</pre>`,
    );
  } catch (e) {
    sections.push(`<pre class="error">${e instanceof Error ? e.message : String(e)}</pre>`);
  }

  // Refresh Token
  if (ts.refreshToken) {
    sections.push(`<h2>Token Refresh</h2>`);
    sections.push(`<p><a href="/refresh">リフレッシュトークンで新しいトークンを取得する</a></p>`);
  }

  sections.push(`<p><a href="/logout">ログアウト</a></p>`);

  return c.html(`<!DOCTYPE html><html><head><style>
    body { font-family: monospace; max-width: 800px; margin: 2em auto; }
    pre { background: #f4f4f4; padding: 1em; overflow-x: auto; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
    .error { color: red; }
    a { color: #0066cc; }
  </style></head><body>
  <h1>KLON TypeScript SDK Example</h1>
  ${sections.join("\n")}
  </body></html>`);
});

// --- /refresh : トークンリフレッシュ ---
app.get("/refresh", async (c) => {
  const ts = getTokenFromCookie(c);
  if (!ts?.refreshToken) {
    return c.redirect("/");
  }
  const newTokens = await oidcClient.refreshToken(ts.refreshToken);
  setTokenCookie(c, newTokens);
  return c.redirect("/dashboard");
});

// --- /logout ---
app.get("/logout", (c) => {
  clearTokenCookie(c);
  return c.html(`<p>ログアウトしました。<a href="/">再ログイン</a></p>`);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`listening on http://localhost:${PORT}`);
});
