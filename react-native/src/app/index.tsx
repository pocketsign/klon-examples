import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/use-auth";
import type { IDTokenClaims } from "../lib/auth";

export default function HomeScreen() {
  const { isLoading, isAuthenticated, tokens, claims, error, login, logout, refresh } = useAuth();

  if (isLoading && !isAuthenticated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>KLON Sample App</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isAuthenticated ? (
        <AuthenticatedView
          claims={claims}
          tokens={tokens}
          isLoading={isLoading}
          onRefresh={refresh}
          onLogout={logout}
        />
      ) : (
        <UnauthenticatedView isLoading={isLoading} onLogin={login} />
      )}
    </ScrollView>
  );
}

function UnauthenticatedView({ isLoading, onLogin }: { isLoading: boolean; onLogin: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.description}>KLON IdP with OAuth 2.0 Authorization Code + PKCE</Text>
      <Pressable style={[styles.button, styles.loginButton]} onPress={onLogin} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login with KLON</Text>
        )}
      </Pressable>
    </View>
  );
}

function AuthenticatedView({
  claims,
  tokens,
  isLoading,
  onRefresh,
  onLogout,
}: {
  claims: IDTokenClaims | null;
  tokens: { accessToken: string; refreshToken?: string; scope?: string } | null;
  isLoading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  return (
    <>
      <Pressable
        style={[styles.button, styles.l3Button]}
        onPress={() => router.push("/l3-service")}
      >
        <Text style={styles.buttonText}>L3 Service (RP Debug) を開く</Text>
      </Pressable>

      {claims && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ID Token Claims</Text>
          <View style={styles.claimsBox}>
            {Object.entries(claims).map(([key, value]) => (
              <View key={key} style={styles.claimRow}>
                <Text style={styles.claimKey}>{key}</Text>
                <Text style={styles.claimValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {tokens && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tokens</Text>
          <TokenField label="access_token" value={tokens.accessToken} />
          {tokens.refreshToken && <TokenField label="refresh_token" value={tokens.refreshToken} />}
          {tokens.scope && <TokenField label="scope" value={tokens.scope} />}
        </View>
      )}

      <View style={styles.buttonRow}>
        {tokens?.refreshToken && (
          <Pressable
            style={[styles.button, styles.refreshButton]}
            onPress={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Refresh Token</Text>
            )}
          </Pressable>
        )}
        <Pressable
          style={[styles.button, styles.logoutButton]}
          onPress={() =>
            Alert.alert("Logout", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: onLogout },
            ])
          }
        >
          <Text style={styles.buttonText}>Logout</Text>
        </Pressable>
      </View>
    </>
  );
}

function TokenField({ label, value }: { label: string; value: string }) {
  const truncated = value.length > 40 ? `${value.slice(0, 40)}...` : value;
  return (
    <View style={styles.tokenRow}>
      <Text style={styles.tokenLabel}>{label}</Text>
      <Text style={styles.tokenValue} numberOfLines={1}>
        {truncated}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
  },
  claimsBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 12,
  },
  claimRow: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  claimKey: {
    width: 100,
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    fontFamily: "monospace",
  },
  claimValue: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "monospace",
  },
  tokenRow: {
    marginBottom: 8,
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "monospace",
    backgroundColor: "#F3F4F6",
    padding: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  loginButton: {
    backgroundColor: "#2563EB",
  },
  l3Button: {
    backgroundColor: "#7C3AED",
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: "#059669",
  },
  logoutButton: {
    backgroundColor: "#DC2626",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
