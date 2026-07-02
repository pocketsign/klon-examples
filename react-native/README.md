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

### pocketsign スコープ

このアプリは `pocketsign` スコープを使用する。`pocketsign` スコープのみでリソース権限を要求しない場合、IdP 側で同意画面が自動的にスキップされる。

## セットアップ

```sh
pnpm install
```

## 開発

### ローカル開発用アプリ

```sh
eas build --profile development
```

ローカル開発用のアプリをビルドします。
[Development builds](https://expo.dev/accounts/pocketsign/projects/klon-example-app/development-builds)からビルドしたアプリをインストールします。

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

## ビルド・配布（EAS）

### ビルド

```sh
eas build --auto-submit
```

ストアへの自動提出を含むビルドを行います。

### OTA 更新

```sh
eas update
```

既存インストール済みアプリに対して OTA 更新を配信します。
