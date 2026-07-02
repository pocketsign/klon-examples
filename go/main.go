// KLON Go SDK の最小サンプル。
// Authorization Code Flow + PKCE → トークン取得 → Registry API (ConnectRPC) 呼び出しまでのフルフローを実装する。
//
// 使い方:
//
//	cp .env.template .env  # CLIENT_ID 等を設定
//	source .env && go run .
//
// ブラウザで http://localhost:8080 を開く。
package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

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
// セッションはコールバック後に即削除されるため、グローバル Map で問題ない。

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

// --- トークン Cookie (ユーザーごとに分離) ---

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
		MaxAge:   86400, // 24 hours
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
		Expires:  time.Unix(0, 0),
	})
}

// bearerTransport は Authorization ヘッダーを付与する http.RoundTripper。
type bearerTransport struct {
	token string
}

func (t *bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+t.token)
	return http.DefaultTransport.RoundTrip(req)
}

func main() {
	issuer := envOrDefault("ISSUER", "https://klonidp.localhost")
	clientID := envOrDefault("CLIENT_ID", "c9cb64b1-2c9f-4738-8b1b-09009a13a6a6")
	clientSecret := envOrDefault("CLIENT_SECRET", "wHfdmAVPWbX5VHnX4pZpQ3SKkUJWtH")
	registryURL := envOrDefault("REGISTRY_URL", "https://klonregistry.localhost")
	redirectURI := envOrDefault("REDIRECT_URI", "https://klonexample.localhost/callback")
	port := envOrDefault("PORT", "8080")

	oidcClient := klon.NewClient(klon.ClientConfig{
		Issuer:       issuer,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURI:  redirectURI,
	})

	store := &sessionStore{sessions: make(map[string]*klon.AuthorizationSession)}
	mux := http.NewServeMux()

	// --- / : ログインページ ---
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if ts := getTokenFromCookie(r); ts != nil {
			http.Redirect(w, r, "/dashboard", http.StatusFound)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!DOCTYPE html><html><head><style>
			body { font-family: monospace; max-width: 800px; margin: 2em auto; text-align: center; }
			a.btn { display: inline-block; margin-top: 2em; padding: 0.8em 2em; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; }
			a.btn:hover { background: #0052a3; }
		</style></head><body>
		<h1>KLON Go SDK Example</h1>
		<p>Authorization Code Flow + PKCE + Authorization Details</p>
		<a class="btn" href="/authorize">KLON でログイン</a>
		</body></html>`)
	})

	// --- /authorize : 認可リクエスト構築 → IdP にリダイレクト ---
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
		http.Redirect(w, r, "/dashboard", http.StatusFound)
	})

	// --- /dashboard : トークン + API 呼び出し結果 ---
	mux.HandleFunc("GET /dashboard", func(w http.ResponseWriter, r *http.Request) {
		ts := getTokenFromCookie(r)
		if ts == nil {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!DOCTYPE html><html><head><style>
			body { font-family: monospace; max-width: 800px; margin: 2em auto; }
			pre { background: #f4f4f4; padding: 1em; overflow-x: auto; }
			h2 { border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
			.error { color: red; }
			a { color: #0066cc; }
		</style></head><body>`)
		fmt.Fprint(w, `<h1>KLON Go SDK Example</h1>`)

		// Token Set
		fmt.Fprint(w, `<h2>Token Set</h2>`)
		writeJSON(w, ts)

		// Authorization Details (grant 内容)
		if len(ts.AuthorizationDetails) > 0 {
			fmt.Fprint(w, `<h2>Authorization Details (granted)</h2>`)
			writeJSON(w, ts.AuthorizationDetails)
		}

		// UserService.ReadResourceValues via ConnectRPC
		fmt.Fprint(w, `<h2>UserService.ReadResourceValues</h2>`)
		fmt.Fprint(w, `<p>ユーザーのアクセストークンで Registry API を呼び出し</p>`)

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
			fmt.Fprintf(w, `<pre class="error">%s</pre>`, html.EscapeString(err.Error()))
		} else {
			writeJSON(w, resp.Msg)
		}

		// Refresh Token
		if ts.RefreshToken != "" {
			fmt.Fprint(w, `<h2>Token Refresh</h2>`)
			fmt.Fprint(w, `<p><a href="/refresh">リフレッシュトークンで新しいトークンを取得する</a></p>`)
		}

		fmt.Fprint(w, `<p><a href="/logout">ログアウト</a></p>`)
		fmt.Fprint(w, `</body></html>`)
	})

	// --- /refresh : トークンリフレッシュ ---
	mux.HandleFunc("GET /refresh", func(w http.ResponseWriter, r *http.Request) {
		ts := getTokenFromCookie(r)
		if ts == nil || ts.RefreshToken == "" {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}

		newTokens, err := oidcClient.RefreshToken(r.Context(), ts.RefreshToken)
		if err != nil {
			log.Printf("RefreshToken failed: %v", err)
			http.Error(w, "token refresh failed", http.StatusInternalServerError)
			return
		}

		setTokenCookie(w, newTokens)
		http.Redirect(w, r, "/dashboard", http.StatusFound)
	})

	// --- /logout ---
	mux.HandleFunc("GET /logout", func(w http.ResponseWriter, r *http.Request) {
		clearTokenCookie(w)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<p>ログアウトしました。<a href="/">再ログイン</a></p>`)
	})

	addr := ":" + port
	log.Printf("listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func writeJSON(w http.ResponseWriter, v any) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprint(w, "<pre>(marshal error)</pre>")
		return
	}
	fmt.Fprintf(w, "<pre>%s</pre>", html.EscapeString(string(b)))
}
