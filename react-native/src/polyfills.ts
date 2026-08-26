import QuickCrypto, { install } from "react-native-quick-crypto";

install();

// install() は globalThis.CryptoKey を設定しないので手動で昇格する。
// QuickCrypto は内部で keys を spread しているので CryptoKey クラスを持つ。
// これで oauth4webapi 内の `instanceof CryptoKey` チェックが通る。
const QuickCryptoWithCryptoKey = QuickCrypto as unknown as { CryptoKey?: unknown };
if (typeof globalThis.CryptoKey === "undefined" && QuickCryptoWithCryptoKey.CryptoKey) {
  (globalThis as { CryptoKey?: unknown }).CryptoKey = QuickCryptoWithCryptoKey.CryptoKey;
}
