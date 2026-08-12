// KLON + In-App SDK ミニアプリの最小サンプル（バックエンド）。
// Go バックエンドが OIDC 認可フロー + Registry API 呼び出しを担当し、
// フロントエンド SPA に JSON API を提供する。
//
// 使い方:
//
//	cp ../.env.template ../.env && source ../.env
//	go run .
//
// フロントエンドの開発サーバー (Vite) を別ターミナルで起動し、
// http://localhost:5173 からアクセスする。
package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"connectrpc.com/connect"
	linkv2 "github.com/pocketsign/klon/protobuf/go/pocketsign/link/v2"
	"github.com/pocketsign/klon/protobuf/go/pocketsign/link/v2/linkv2connect"
	klon "github.com/pocketsign/klon/sdk/go"
)

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// --- 認可セッション (インメモリ) ---

type sessionStore struct {
	mu       sync.Mutex
	sessions map[string]*klon.AuthorizationSession
}

func (s *sessionStore) Save(session *klon.AuthorizationSession) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.State] = session
}

func (s *sessionStore) Load(state string) (*klon.AuthorizationSession, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[state]
	if ok {
		delete(s.sessions, state)
	}
	return session, ok
}

// --- トークン Cookie ---

const tokenCookieName = "oidc_tokens"

func setTokenCookie(w http.ResponseWriter, ts *klon.TokenSet) {
	b, err := json.Marshal(ts)
	if err != nil {
		log.Printf("setTokenCookie: marshal failed: %v", err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     tokenCookieName,
		Value:    base64.StdEncoding.EncodeToString(b),
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400,
	})
}

func getTokenFromCookie(r *http.Request) *klon.TokenSet {
	c, err := r.Cookie(tokenCookieName)
	if err != nil {
		return nil
	}
	b, err := base64.StdEncoding.DecodeString(c.Value)
	if err != nil {
		return nil
	}
	var ts klon.TokenSet
	if err := json.Unmarshal(b, &ts); err != nil {
		return nil
	}
	return &ts
}

func clearTokenCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     tokenCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

type bearerTransport struct {
	token string
}

func (t *bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+t.token)
	return http.DefaultTransport.RoundTrip(req)
}

func respondJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("respondJSON: encode failed: %v", err)
	}
}

func main() {
	issuer := envOrDefault("ISSUER", "https://klonidp.localhost")
	clientID := envOrDefault("CLIENT_ID", "c9cb64b1-2c9f-4738-8b1b-09009a13a6a6")
	clientSecret := envOrDefault("CLIENT_SECRET", "wHfdmAVPWbX5VHnX4pZpQ3SKkUJWtH")
	registryURL := envOrDefault("REGISTRY_URL", "https://klonregistry.localhost")
	redirectURI := envOrDefault("REDIRECT_URI", "https://klonexample.localhost/callback")
	port := envOrDefault("PORT", "8080")
	frontendDir := envOrDefault("FRONTEND_DIR", "../frontend/dist")

	oidcClient := klon.NewClient(klon.ClientConfig{
		Issuer:       issuer,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURI:  redirectURI,
	})

	store := &sessionStore{sessions: make(map[string]*klon.AuthorizationSession)}
	mux := http.NewServeMux()

	// --- /authorize : 認可リクエスト構築 -> IdP にリダイレクト ---
	mux.HandleFunc("GET /authorize", func(w http.ResponseWriter, r *http.Request) {
		boolTrue := true
		maxAge := 3600

		authURL, session, err := oidcClient.CreateAuthorizationURL(r.Context(), klon.AuthorizeOptions{
			Scopes: []string{klon.ScopeOpenID, klon.ScopeProfile, klon.ScopeOfflineAccess},
			AuthorizationDetails: []klon.AuthorizationDetailInput{
				{
					Identifiers: []string{klon.ResourceMergedFullName},
					Actions:     []klon.ResourceAction{klon.ResourceActionRead},
					Required:    &boolTrue,
				},
				{
					Identifiers: []string{klon.ResourceMergedBirthDate},
					Actions:     []klon.ResourceAction{klon.ResourceActionRead},
				},
				{
					Identifiers: []string{klon.ResourceEmailAddress},
					Actions:     []klon.ResourceAction{klon.ResourceActionRead},
				},
			},
			AcrValues:             []string{klon.AcrHigh},
			Prompt:                []string{klon.PromptConsent},
			MaxAge:                &maxAge,
			GrantManagementAction: klon.GrantManagementReplace,
			UsePAR:                true,
		})
		if err != nil {
			log.Printf("CreateAuthorizationURL failed: %v", err)
			http.Error(w, "authorization request failed", http.StatusInternalServerError)
			return
		}

		store.Save(session)
		http.Redirect(w, r, authURL.String(), http.StatusFound)
	})

	// --- /callback : 認可コード -> トークン交換 ---
	mux.HandleFunc("GET /callback", func(w http.ResponseWriter, r *http.Request) {
		if errParam := r.URL.Query().Get("error"); errParam != "" {
			http.Error(w, fmt.Sprintf("%s: %s", errParam, r.URL.Query().Get("error_description")), http.StatusBadRequest)
			return
		}

		state := r.URL.Query().Get("state")
		session, ok := store.Load(state)
		if !ok {
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		tokenSet, err := oidcClient.ExchangeCode(r.Context(), code, state, session)
		if err != nil {
			log.Printf("ExchangeCode failed: %v", err)
			http.Error(w, "token exchange failed", http.StatusInternalServerError)
			return
		}

		setTokenCookie(w, tokenSet)
		http.Redirect(w, r, "/", http.StatusFound)
	})

	// --- /api/me : ユーザー情報 + Registry API 呼び出し ---
	mux.HandleFunc("GET /api/me", func(w http.ResponseWriter, r *http.Request) {
		ts := getTokenFromCookie(r)
		if ts == nil {
			respondJSON(w, map[string]any{"authenticated": false})
			return
		}

		userClient := linkv2connect.NewRegistryUserServiceClient(
			&http.Client{Transport: &bearerTransport{token: ts.AccessToken}},
			registryURL,
		)
		resp, err := userClient.ReadResourceValues(r.Context(), connect.NewRequest(&linkv2.RegistryUserServiceReadResourceValuesRequest{
			IdOrAliases: []string{
				klon.ResourceMergedFullName,
				klon.ResourceMergedBirthDate,
				klon.ResourceEmailAddress,
			},
		}))
		if err != nil {
			respondJSON(w, map[string]any{
				"authenticated": true,
				"error":         err.Error(),
			})
			return
		}

		resources := make(map[string]any)
		for _, rv := range resp.Msg.Results {
			if rv.Error != linkv2.ReadResourceValueError_READ_RESOURCE_VALUE_ERROR_UNSPECIFIED {
				resources[rv.IdOrAlias] = map[string]any{"error": rv.Error.String()}
				continue
			}
			switch v := rv.Value.Value.(type) {
			case *linkv2.ResourceValue_String_:
				resources[rv.IdOrAlias] = v.String_
			case *linkv2.ResourceValue_Json:
				resources[rv.IdOrAlias] = json.RawMessage(v.Json.String())
			default:
				resources[rv.IdOrAlias] = "(binary)"
			}
		}

		respondJSON(w, map[string]any{
			"authenticated": true,
			"resources":     resources,
		})
	})

	// --- /api/token-info : トークンメタデータ ---
	mux.HandleFunc("GET /api/token-info", func(w http.ResponseWriter, r *http.Request) {
		ts := getTokenFromCookie(r)
		if ts == nil {
			respondJSON(w, map[string]any{"authenticated": false})
			return
		}

		respondJSON(w, map[string]any{
			"authenticated":        true,
			"authorizationDetails": ts.AuthorizationDetails,
			"hasRefreshToken":      ts.RefreshToken != "",
		})
	})

	// --- /api/refresh : トークンリフレッシュ ---
	mux.HandleFunc("POST /api/refresh", func(w http.ResponseWriter, r *http.Request) {
		ts := getTokenFromCookie(r)
		if ts == nil || ts.RefreshToken == "" {
			http.Error(w, "no refresh token", http.StatusBadRequest)
			return
		}

		newTokens, err := oidcClient.RefreshToken(r.Context(), ts.RefreshToken)
		if err != nil {
			log.Printf("RefreshToken failed: %v", err)
			http.Error(w, "token refresh failed", http.StatusInternalServerError)
			return
		}

		setTokenCookie(w, newTokens)
		respondJSON(w, map[string]any{"ok": true})
	})

	// --- /api/logout : ログアウト ---
	mux.HandleFunc("POST /api/logout", func(w http.ResponseWriter, r *http.Request) {
		clearTokenCookie(w)
		respondJSON(w, map[string]any{"ok": true})
	})

	// --- /* : フロントエンド静的ファイル (SPA fallback) ---
	if info, err := os.Stat(frontendDir); err == nil && info.IsDir() {
		staticFS := http.FileServer(http.Dir(frontendDir))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			if _, err := fs.Stat(os.DirFS(frontendDir), path); err != nil {
				r.URL.Path = "/"
			}
			staticFS.ServeHTTP(w, r)
		})
	} else {
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			fmt.Fprint(w, "Frontend not built. Run: cd ../frontend && pnpm run build")
		})
	}

	addr := ":" + port
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
