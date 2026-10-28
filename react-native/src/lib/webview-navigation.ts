import { IDP_BASE_URL, NATIVE_LOGIN_START_PATH, NATIVE_START_PATH } from "../constants";

export type NavigationAction =
  | { readonly type: "allow" }
  | { readonly type: "bind"; readonly bindId: string }
  | {
      readonly type: "reauth";
      readonly bindId: string;
      readonly acrValues: string;
      readonly maxAge: string;
    };

/**
 * WebView のナビゲーションURLを判定し、ネイティブ側で処理すべきアクションを返す。
 * origin が IdP と一致しない場合は常に allow を返す (セッション固定攻撃の防止)。
 */
export function classifyNavigation(url: string): NavigationAction {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { type: "allow" };
  }

  // Origin 検証: IdP のオリジンと一致しない URL は無視する
  const allowedOrigin = new URL(IDP_BASE_URL).origin;
  if (parsed.origin !== allowedOrigin) {
    return { type: "allow" };
  }

  const pathname = parsed.pathname;

  if (pathname === NATIVE_START_PATH) {
    const bindId = parsed.searchParams.get("bind_id");
    if (bindId) {
      return { type: "bind", bindId };
    }
  }

  if (pathname === NATIVE_LOGIN_START_PATH) {
    const bindId = parsed.searchParams.get("bind_id");
    if (bindId) {
      return {
        type: "reauth",
        bindId,
        acrValues: parsed.searchParams.get("request_acr_values") ?? "",
        maxAge: parsed.searchParams.get("max_age") ?? "",
      };
    }
  }

  return { type: "allow" };
}
