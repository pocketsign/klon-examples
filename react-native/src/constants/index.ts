// IdP のベースURL
export const IDP_BASE_URL = process.env.EXPO_PUBLIC_IDP_BASE_URL ?? "https://klonidp.localhost";

// rp-debug (L3 サービス) のURL
export const RP_DEBUG_URL = process.env.EXPO_PUBLIC_RP_DEBUG_URL ?? "https://klonexample.localhost";

// ネイティブアプリ識別用 UserAgent サフィックス
// サーバー側の nativebind.NativeAppUserAgentSuffix と一致させる
export const NATIVE_APP_USER_AGENT_SUFFIX = "KLON-NativeApp";

// バインド開始のパス (onShouldStartLoadWithRequest で検出)
// フロントエンドルート (サーバー API ではない)
export const NATIVE_START_PATH = "/native/start";

// 再認証バインド開始のパス
export const NATIVE_LOGIN_START_PATH = "/native/login-start";
