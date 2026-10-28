import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { APP_SCHEME, handleCallback } from "../lib/auth";

// OAuth コールバックルート。
//
// MPA認証後、システムブラウザ（ASWebAuthenticationSession / Custom Tabs）外で
// コールバックが発生し、Deep Linkとしてアプリに到達する。
// Expo Routerがこのルートにナビゲーションし、handleCallback() で認可コードの
// トークン交換とシステムブラウザのクローズを行う。
// 処理完了後は直前の画面に戻る（reauth 時は L3 Service、初回ログイン時は Home）。
export default function CallbackRoute() {
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        searchParams.set(key, value);
      }
    }
    const callbackUrl = `${APP_SCHEME}://callback?${searchParams.toString()}`;

    void handleCallback(callbackUrl, "navigation-screen").finally(() => {
      // コールドスタート時の Deep Link ではこの画面が履歴の起点なので戻り先がない。
      if (router.canGoBack()) {
        router.dismiss();
      } else {
        router.replace("/");
      }
    });
  }, [params, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
