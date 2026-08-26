// NOTE: AsyncStorageはデータを平文で保存します。
// 本番アプリでは、expo-secure-storeやreact-native-keychainを使用して
// 機密トークンを安全に保存してください。
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TokenSet } from "./auth";

const TOKEN_KEY = "klon_tokens";

// トークンは複数の呼び出し元 (useAuth の各インスタンス、コールドスタート時の
// handleCallback) から更新されるため、保存済みトークンを唯一の真実として扱い、
// 変更を購読できるようにする。
type TokensListener = (tokens: TokenSet | null) => void;
const listeners = new Set<TokensListener>();

function notify(tokens: TokenSet | null): void {
  for (const listener of listeners) listener(tokens);
}

export function subscribeTokens(listener: TokensListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  notify(tokens);
}

export async function loadTokens(): Promise<TokenSet | null> {
  const raw = await AsyncStorage.getItem(TOKEN_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as TokenSet;
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  notify(null);
}
