# KLON サンプル ネイティブアプリ

KLON IdP を利用して登録・ログインするサンプルネイティブアプリ（Expo / React Native）。

## 認証フロー

RFC 8252 (OAuth 2.0 for Native Apps) に従い、Public Client として OAuth 2.0 Authorization Code + PKCE フローを PAR（Pushed Authorization Request）経由で実行する。`client_secret` は不要。

1. アプリが PKCE code_verifier/code_challenge + state + nonce を生成
2. IdP の PAR エンドポイントに直接 POST して `request_uri` を取得
3. `request_uri` を含む認可 URL を CustomTabs（Android）/ ASWebAuthenticationSession（iOS）で開く
4. KLON IdP でマイナンバーカード認証（マイナポータルアプリ経由）
5. 認証完了後、MPA から Chrome/Safari に戻り、IdP の中間画面（`/native/return`）を表示
6. 中間画面から `klon-example-app://callback?code=xxx&state=yyy` へ自動遷移（またはボタン押下）
7. アプリが直接 IdP のトークンエンドポイントに `code` + `code_verifier` を送信してトークンを取得

### なぜ中間画面があるか

マイナポータルアプリは CustomTabs/ASWebAuthenticationSession には戻れず、本物の Chrome/Safari にしか戻れない。そのため IdP ドメイン上に中間画面を表示してからカスタムスキームでアプリに遷移させる必要がある。

## セットアップ

```sh
pnpm install
cp .env.template .env
```

`.env` の既定値は KLON の mock 環境 (`id.mock.klon.you`) を指している。

### L3 サービス (ネイティブセッションバインド)

`EXPO_PUBLIC_RP_URL` に KLON へ登録済みの RP の URL を設定すると、L3 Service 画面が
その RP を WebView で開き、`/native/start` の遷移を検出してネイティブセッションバインドを行う。
未設定の場合、この画面は設定手順のみを表示する。

### EAS プロジェクト

EAS でビルド・配布する場合は、自分の Expo アカウントにプロジェクトを作成する。

```sh
eas init
```

CI などで `app.config.ts` を書き換えずに指定したい場合は、環境変数で渡す。

```sh
EAS_OWNER=<expo-account> EAS_PROJECT_ID=<uuid> eas build --profile development
```

## 開発

### ローカル開発用アプリ

```sh
eas build --profile development
```

ローカル開発用のアプリをビルドします。
ビルド完了後、Expo の Development builds ページ（`https://expo.dev/accounts/<expo-account>/projects/klon-example-app/development-builds`）からアプリをインストールします。

### ローカル開発

```sh
pnpm run start
```

`expo start --dev-client` を起動します。
ローカル開発用のアプリから開発サーバーに接続します。

## チェック/修正

```sh
pnpm run lint
```

```sh
pnpm run format
```
