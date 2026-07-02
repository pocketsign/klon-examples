// NOTE: AsyncStorageはデータを平文で保存します。
// 本番アプリでは、expo-secure-storeやreact-native-keychainを使用して
// 機密トークンを安全に保存してください。
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TokenSet } from "./auth";

const TOKEN_KEY = "klon_tokens";

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
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
}
