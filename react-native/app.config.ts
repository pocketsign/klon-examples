import type { ExpoConfig } from "expo/config";

import { version } from "./package.json";

const config: ExpoConfig = {
  name: "KLONサンプルアプリ",
  slug: "klon-example-app",
  owner: "pocketsign",
  version,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "klon-example-app",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "ing.klon.mock.example.app",
    associatedDomains: ["applinks:app.example.mock.klon.ing"],
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "ing.klon.mock.example.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "app.example.mock.klon.ing",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
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
    "@react-native-community/datetimepicker",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "9e3156fb-e8a6-4cc3-bd11-fb66c4a271ee",
    },
  },
};

export default config;
