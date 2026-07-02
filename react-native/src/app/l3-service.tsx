import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { useAuth } from "../hooks/use-auth";
import { useWebViewAuth } from "../hooks/use-webview-auth";
import { RP_DEBUG_URL, NATIVE_APP_USER_AGENT_SUFFIX } from "../constants";

export default function L3ServiceScreen() {
  const { isAuthenticated } = useAuth();
  const { webViewRef, isBinding, error, handleShouldStartLoadWithRequest } = useWebViewAuth();

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Home タブでログインしてから L3 サービスを利用してください
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isBinding && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.overlayText}>セッションをバインド中...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: RP_DEBUG_URL }}
        style={styles.webview}
        applicationNameForUserAgent={NATIVE_APP_USER_AGENT_SUFFIX}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  webview: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 14,
    color: "#374151",
  },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    padding: 12,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
  },
});
