import { useRef, useState } from "react";
import type { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import { bindSession } from "../lib/bound-session";
import { startReauthLogin } from "../lib/auth";
import { loadTokens } from "../lib/token-storage";
import { classifyNavigation } from "../lib/webview-navigation";

interface UseWebViewAuthState {
  readonly isBinding: boolean;
  readonly error: string | null;
}

export function useWebViewAuth() {
  const webViewRef = useRef<WebView>(null);
  const [state, setState] = useState<UseWebViewAuthState>({
    isBinding: false,
    error: null,
  });

  const handleShouldStartLoadWithRequest = (request: ShouldStartLoadRequest): boolean => {
    const action = classifyNavigation(request.url);

    if (action.type === "allow") {
      return true;
    }

    // bind or reauth - ネイティブ側で処理するため WebView のナビゲーションをキャンセル
    if (action.type === "bind") {
      void handleBind(action.bindId);
    } else {
      void handleReauth(action.bindId, action.acrValues, action.maxAge);
    }

    return false;
  };

  const handleBind = async (bindId: string) => {
    setState({ isBinding: true, error: null });
    try {
      const tokens = await loadTokens();
      if (!tokens?.accessToken) {
        throw new Error("No access token available. Please login first.");
      }

      const { bindCompleteUrl } = await bindSession(bindId, tokens.accessToken);
      webViewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(bindCompleteUrl)};`,
      );
      setState({ isBinding: false, error: null });
    } catch (err) {
      setState({
        isBinding: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleReauth = async (bindId: string, acrValues: string, maxAge: string) => {
    setState({ isBinding: true, error: null });
    try {
      // 再認証フローを実行 (システムブラウザで認証)
      const newTokens = await startReauthLogin({ acrValues, maxAge });

      // 再認証で取得した新しいアクセストークンでバインド
      const { bindCompleteUrl } = await bindSession(bindId, newTokens.accessToken);
      webViewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(bindCompleteUrl)};`,
      );
      setState({ isBinding: false, error: null });
    } catch (err) {
      setState({
        isBinding: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return {
    webViewRef,
    isBinding: state.isBinding,
    error: state.error,
    handleShouldStartLoadWithRequest,
  };
}
