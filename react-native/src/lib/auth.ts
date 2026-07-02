import {
  createClient,
  Scopes,
  type AuthorizationSession,
  type TokenSet,
} from "@pocketsign/klon-sdk";
import * as WebBrowser from "expo-web-browser";
import { fetch as expoFetch } from "expo/fetch";

import { IDP_BASE_URL } from "../constants";
import { Platform } from "react-native";
import { secureStoreDPoPKeyStore } from "./dpop-key-store";

// EXPO_PUBLIC_CLIENT_ID 環境変数で上書き可能。
const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID ?? "e7f8a9b0-c1d2-3e4f-5a6b-7c8d9e0f1a2b";
export const APP_SCHEME = "klon-example-app";
const REDIRECT_URI = `${APP_SCHEME}://callback`;

export type { TokenSet };

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  acr?: string;
  [key: string]: unknown;
}

// expo/fetch の FetchResponse はネイティブ側でデータ受信時に bodyUsed=true を設定するため
// (ResponseSink.appendBufferBody)、oauth4webapi の assertReadableResponse チェックで常に失敗する。
// body を読み取って標準 Response に変換するラッパーで回避する。
const customFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await expoFetch(input, init);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
};

export const oidcClient = createClient({
  issuer: IDP_BASE_URL,
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
  customFetch,
  // DPoP (RFC 9449) を有効化: access_token が sender-constrained になる。
  // 鍵ペアは expo-secure-store（セキュアストレージ）に保存する。
  dpop: { keyStore: secureStoreDPoPKeyStore },
  // ローカル実機検証で http://localhost:8443 を使うため許可。本番では外すこと。
  allowInsecureRequests: IDP_BASE_URL.startsWith("http://"),
});

interface PendingAuth {
  readonly session: AuthorizationSession;
  readonly promise: Promise<TokenSet>;
  resolve(tokens: TokenSet): void;
  reject(error: Error): void;
}

function createPendingAuth(session: AuthorizationSession): PendingAuth {
  let resolve!: (tokens: TokenSet) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<TokenSet>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { session, promise, resolve, reject };
}

// 進行中の認証フロー。startLogin() で作成し、handleCallback() で消費する。
let pendingAuth: PendingAuth | null = null;

/**
 * PAR + PKCE を使用したPublic Clientログインフローを開始する。
 *
 * RFC 8252 (OAuth 2.0 for Native Apps) + RFC 9126 (PAR) に従い、
 * ネイティブアプリが直接IdPのエンドポイントを呼び出す。
 * client_secretは不要（Public Client）。
 *
 * フロー:
 * 1. SDK が PKCE + PAR を処理し、認可URLを生成
 * 2. 認可URLをシステムブラウザで開く（CustomTabs/ASWebAuthenticationSession）
 * 3. ユーザーがKLON IdPで認証（マイナカード via MPA）
 * 4. MPA完了後、Safari/Chromeに戻りIdPが認可コードを発行
 * 5. IdPが「アプリに戻る」中間画面を表示し、klon-example-app://callback にリダイレクト
 * 6. Expo Routerが /callback ルートにナビゲーション -> handleCallback()でトークン交換
 *
 * MPA認証では必ずシステムブラウザ外（MPA -> Safari/Chrome）でリダイレクトが
 * 発生するため、openAuthSessionAsync はコールバックURLをキャッチしない。
 * コールバックは常に Deep Link 経由で /callback ルートに到達し、
 * handleCallback() が deferred promise を resolve する。
 */
export interface LoginOptions {
  readonly scopes?: string[];
  readonly acrValues?: string[];
  readonly maxAge?: number;
  readonly prompt?: string[];
}

async function startLoginInternal(options?: LoginOptions): Promise<TokenSet> {
  // 既存のフローがあればキャンセルする
  if (pendingAuth) {
    pendingAuth.reject(new Error("A new login flow was started"));
    pendingAuth = null;
  }

  // Step 1: SDK が PKCE + PAR を処理し、認可URLを生成
  const { url, session } = await oidcClient.createAuthorizationURL({
    scopes: options?.scopes ?? [Scopes.OPENID, Scopes.OFFLINE_ACCESS, "pocketsign", "native"],
    acrValues: options?.acrValues,
    maxAge: options?.maxAge,
    prompt: options?.prompt,
    usePAR: true,
  });

  // Step 2: deferred promise を作成（handleCallback() が resolve する）
  const auth = createPendingAuth(session);
  pendingAuth = auth;

  // Step 3: システムブラウザを開く
  // MPA 認証後は Safari/Chrome 経由でコールバックが到達するため、
  // openAuthSessionAsync はコールバックをキャッチせず cancel/dismiss で返る。
  const result = await WebBrowser.openAuthSessionAsync(url.toString(), `${APP_SCHEME}://callback`);

  // 既ログイン等でコールバックがセッション内で捕捉された場合は、
  // Deep Link ルート遷移を待たずにここで処理する。
  if (result.type === "success" && result.url) {
    await handleCallback(result.url);
  }

  // openAuthSessionAsync は cancel/dismiss で返る。
  // handleCallback が既に処理済みなら pendingAuth === null なので何もしない。
  // まだ処理されていなければユーザーがキャンセルしたと判断する。
  if (pendingAuth === auth) {
    pendingAuth = null;
    auth.reject(new Error("Authentication was cancelled"));
  }

  return auth.promise;
}

export async function startLogin(): Promise<TokenSet> {
  return startLoginInternal();
}

/**
 * 再認証フローを開始する。
 * WebView の /native/login_start から渡された acr_values, max_age を使い、
 * prompt=login 付きで認可フローを実行する。
 */
export async function startReauthLogin(options: {
  readonly acrValues?: string;
  readonly maxAge?: string;
}): Promise<TokenSet> {
  const acrValues = options.acrValues ? [options.acrValues] : undefined;
  const maxAge = options.maxAge ? parseInt(options.maxAge, 10) : undefined;
  return startLoginInternal({
    prompt: ["login"],
    acrValues,
    maxAge: maxAge !== undefined && !isNaN(maxAge) ? maxAge : undefined,
  });
}

/**
 * OAuth コールバックを処理する（Deep Link 経由）。
 *
 * Expo Router の /callback ルートから呼び出される。
 * システムブラウザを閉じ、認可コードでトークン交換を行い、
 * startLogin() が返した Promise を resolve する。
 * state の検証は client.exchangeCode() 内で SDK が行う。
 */
export async function handleCallback(callbackUrl: string): Promise<void> {
  const auth = pendingAuth;
  pendingAuth = null;

  if (!auth) return;

  // システムブラウザが開きっぱなしの場合は閉じる
  if (Platform.OS === "ios") WebBrowser.dismissAuthSession();

  try {
    const callbackURL = new URL(callbackUrl);

    const error = callbackURL.searchParams.get("error");
    if (error) {
      const description = callbackURL.searchParams.get("error_description") ?? "";
      throw new Error(`${error}: ${description}`);
    }

    const code = callbackURL.searchParams.get("code") ?? "";
    const state = callbackURL.searchParams.get("state") ?? "";
    const tokens = await oidcClient.exchangeCode(code, state, auth.session);
    auth.resolve(tokens);
  } catch (err) {
    auth.reject(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * リフレッシュトークンを使用してアクセストークンを更新する。
 * nativeスコープではリフレッシュトークンのローテーションが無効化されているため、
 * 同じリフレッシュトークンを繰り返し使用する。
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  return oidcClient.refreshToken(refreshToken);
}

/**
 * JWT（IDトークン）のペイロードを検証なしでデコードする。
 * 検証はトークン交換時にサーバー側で行われる。
 */
export function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const base = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base.padEnd(base.length + ((4 - (base.length % 4)) % 4), "=");
  const decoded = atob(padded);
  return JSON.parse(decoded) as IdTokenClaims;
}
