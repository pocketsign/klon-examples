import { useEffect, useRef, useState } from "react";
import {
  type IdTokenClaims,
  type TokenSet,
  decodeIdToken,
  refreshAccessToken,
  startLogin,
} from "../lib/auth";
import { oidcClient } from "../lib/auth";
import { clearTokens, loadTokens, saveTokens } from "../lib/token-storage";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens: TokenSet | null;
  claims: IdTokenClaims | null;
  error: string | null;
}

function extractClaims(tokens: TokenSet): IdTokenClaims | null {
  return tokens.idToken ? decodeIdToken(tokens.idToken) : null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    tokens: null,
    claims: null,
    error: null,
  });

  // refresh が最新の refreshToken を参照できるよう ref で保持
  const tokensRef = useRef(state.tokens);

  useEffect(() => {
    tokensRef.current = state.tokens;
  }, [state.tokens]);

  // マウント時に保存済みトークンを読み込む
  useEffect(() => {
    loadTokens()
      .then((tokens) => {
        if (tokens) {
          setState({
            isLoading: false,
            isAuthenticated: true,
            tokens,
            claims: extractClaims(tokens),
            error: null,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      })
      .catch(() => {
        setState((prev) => ({ ...prev, isLoading: false }));
      });
  }, []);

  const login = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const tokens = await startLogin();
      await saveTokens(tokens);
      setState({
        isLoading: false,
        isAuthenticated: true,
        tokens,
        claims: extractClaims(tokens),
        error: null,
      });
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
    await clearTokens();
    // DPoP 鍵もログアウト時に破棄する。KeyStore のクリアと SDK 内部キャッシュ
    // (DPoPHandle) の無効化を一括で行う。キャッシュ無効化を忘れると、
    // ストレージが空でも次回リクエストで古い鍵が再利用されてしまう。
    await oidcClient.resetDPoPKey();
    setState({
      isLoading: false,
      isAuthenticated: false,
      tokens: null,
      claims: null,
      error: null,
    });
  };

  const refresh = async () => {
    const currentTokens = tokensRef.current;
    if (!currentTokens?.refreshToken) {
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const newTokens = await refreshAccessToken(currentTokens.refreshToken);
      // nativeではRTローテーション無効のため、新しいRTが返らない場合は既存RTを保持する
      const tokens: TokenSet = {
        ...newTokens,
        refreshToken: newTokens.refreshToken || currentTokens.refreshToken,
      };
      await saveTokens(tokens);
      setState({
        isLoading: false,
        isAuthenticated: true,
        tokens,
        claims: extractClaims(tokens),
        error: null,
      });
    } catch (err) {
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
