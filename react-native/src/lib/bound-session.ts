import type { BindNativeSessionResult } from "@pocketsign/klon-sdk";

import { oidcClient } from "./auth";

/**
 * ネイティブアプリの WebView セッションをバインドする。
 * DPoP が有効なら SDK が proof を自動付与する。
 *
 * @param bindId WebView の `/native/start?bind_id=...` から取り出した bound_session_id (UUID)
 * @param accessToken ログイン時に発行された access_token (DPoP 有効時は DPoP-bound トークン)
 * @returns `bindCompleteUrl` を含む結果オブジェクト。IdP オリジン配下の URL であることが
 *   SDK 側で検証されている
 * @throws {Error} サーバが 2xx 以外を返した、または `bind_complete_url` が IdP オリジン外だった場合
 */
export async function bindSession(
  bindId: string,
  accessToken: string,
): Promise<BindNativeSessionResult> {
  return oidcClient.bindNativeSession(bindId, accessToken);
}
