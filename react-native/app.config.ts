import type { ExpoConfig } from "expo/config";

import { version } from "./package.json";

// EAS プロジェクトはビルドする人ごとに異なるため、リポジトリには固定値を持たせない。
// 未設定でもローカル開発 (expo start) はできる。EAS を使う場合は `eas init` するか
// EAS_OWNER / EAS_PROJECT_ID を設定する。
const easOwner = process.env.EAS_OWNER;
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "KLONサンプルアプリ",
  slug: "klon-example-app",
  ...(easOwner ? { owner: easOwner } : {}),
  version,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "klon-example-app",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "you.klon.mock.example.app",
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    package: "you.klon.mock.example.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  ...(easProjectId ? { extra: { eas: { projectId: easProjectId } } } : {}),
};

export default config;
