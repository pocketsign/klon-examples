import { useEffect, useRef, useState } from "react";
import { type IDTokenClaims, type TokenSet, refreshAccessToken, startLogin } from "../lib/auth";
import { oidcClient } from "../lib/auth";
import { clearTokens, loadTokens, saveTokens, subscribeTokens } from "../lib/token-storage";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens: TokenSet | null;
  claims: IDTokenClaims | null;
  error: string | null;
}

// SDK が ID Token を検証したうえでデコード済みクレームを返す。
// 自前で JWT を base64 デコードすると、atob がバイト列を返すため
// 氏名などの非 ASCII クレームが文字化けする。
function extractClaims(tokens: TokenSet): IDTokenClaims | null {
  return tokens.idTokenClaims ?? null;
}

// 保存済みトークンはアプリ全体で 1 つなので、世代番号もモジュール単位で共有する。
// これがないと、リフレッシュ中にログアウトした場合に後から返ってきたトークンが
// 再保存され、破棄済み DPoP 鍵に紐づくセッションが復活してしまう。
let sessionGeneration = 0;

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    tokens: null,
    claims: null,
    error: null,
  });

  const applyTokens = (tokens: TokenSet | null) => {
    setState({
      isLoading: false,
      isAuthenticated: tokens !== null,
      tokens,
      claims: tokens ? extractClaims(tokens) : null,
      error: null,
    });
  };

  // refresh が最新の refreshToken を参照できるよう ref で保持
  const tokensRef = useRef(state.tokens);

  useEffect(() => {
    tokensRef.current = state.tokens;
  }, [state.tokens]);

  // 保存済みトークンを唯一の真実として扱う。マウント時に読み込み、以降は変更を購読する。
  // コールドスタート時の handleCallback や別画面の useAuth による更新も、この経路で伝わる。
  useEffect(() => {
    let notified = false;
    const unsubscribe = subscribeTokens((tokens) => {
      notified = true;
      applyTokens(tokens);
    });

    loadTokens()
      .then((tokens) => {
        // 読み込み中に通知が届いていた場合、古い値で上書きしない。
        if (notified) return;
        applyTokens(tokens);
      })
      .catch(() => {
        setState((prev) => ({ ...prev, isLoading: false }));
      });

    return unsubscribe;
  }, []);

  const login = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const tokens = await startLogin();
      await saveTokens(tokens);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  };

  const logout = async () => {
    sessionGeneration += 1;
    await clearTokens();
    // DPoP 鍵もログアウト時に破棄する。KeyStore のクリアと SDK 内部キャッシュ
    // (DPoPHandle) の無効化を一括で行う。キャッシュ無効化を忘れると、
    // ストレージが空でも次回リクエストで古い鍵が再利用されてしまう。
    await oidcClient.resetDPoPKey();
  };

  const refresh = async () => {
    const currentTokens = tokensRef.current;
    if (!currentTokens?.refreshToken) {
      return;
    }
    const generation = sessionGeneration;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const newTokens = await refreshAccessToken(currentTokens.refreshToken);
      if (generation !== sessionGeneration) return;
      // nativeではRTローテーション無効のため、新しいRTが返らない場合は既存RTを保持する
      const tokens: TokenSet = {
        ...newTokens,
        refreshToken: newTokens.refreshToken || currentTokens.refreshToken,
        // リフレッシュ応答に id_token が含まれない場合があるため既存クレームを温存する
        idTokenClaims: newTokens.idTokenClaims ?? currentTokens.idTokenClaims,
      };
      await saveTokens(tokens);
    } catch (err) {
      if (generation !== sessionGeneration) return;
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  };

  return {
    ...state,
    login,
    logout,
    refresh,
  };
}
