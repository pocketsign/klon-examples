// IdP のベースURL
export const IDP_BASE_URL = process.env.EXPO_PUBLIC_IDP_BASE_URL ?? "https://id.mock.klon.you";

// WebView に読み込む RP (L3 サービス) の URL。
// バインド対象の RP は利用者ごとに異なるため、既定値は持たせない。
// 未設定の場合 L3 Service 画面は設定手順を表示する。
export const RP_URL = process.env.EXPO_PUBLIC_RP_URL;

// ネイティブアプリ識別用 UserAgent サフィックス
// サーバー側の nativebind.NativeAppUserAgentSuffix と一致させる
export const NATIVE_APP_USER_AGENT_SUFFIX = "KLON-NativeApp";

// バインド開始のパス (onShouldStartLoadWithRequest で検出)
// フロントエンドルート (サーバー API ではない)
export const NATIVE_START_PATH = "/native/start";

// 再認証バインド開始のパス
export const NATIVE_LOGIN_START_PATH = "/native/login-start";
