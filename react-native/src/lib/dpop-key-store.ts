import * as SecureStore from "expo-secure-store";
import type { DPoPKeyStore } from "@pocketsign/klon-sdk";

// DPoP 秘密鍵はセキュアストレージ (expo-secure-store) に保存する。
// 鍵が漏洩すると sender-constrained トークンの保護が無効化されるため、平文保存 (AsyncStorage 等) は避ける。
// CryptoKeyPair はそのまま保存できないため JWK に変換して永続化し、復元時に秘密鍵は
// extractable: false で取り込んで再エクスポートを防ぐ。
const STORAGE_KEY = "klon_dpop_keypair";

interface StoredKeyPair {
  readonly privateJwk: JsonWebKey;
  readonly publicJwk: JsonWebKey;
}

const EC_P256: EcKeyImportParams = { name: "ECDSA", namedCurve: "P-256" };

export const secureStoreDPoPKeyStore: DPoPKeyStore = {
  load: async () => {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const { privateJwk, publicJwk } = JSON.parse(raw) as StoredKeyPair;
    const privateKey = await crypto.subtle.importKey("jwk", privateJwk, EC_P256, false, ["sign"]);
    const publicKey = await crypto.subtle.importKey("jwk", publicJwk, EC_P256, true, ["verify"]);
    return { privateKey, publicKey };
  },
  save: async (keyPair) => {
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    // AFTER_FIRST_UNLOCK: デバイスロック中（バックグラウンドのトークンリフレッシュ等）でも
    // 鍵にアクセスできるようにする。デフォルト (iOS WHEN_UNLOCKED) だとロック中に読めない。
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ privateJwk, publicJwk }), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  },
};
