# KLON サンプル ミニアプリ

ポケットサインアプリのミニアプリブラウザ（WebView）と通常のブラウザの両方で動作するサンプルミニアプリ。Go バックエンド（KLON Go SDK）と React SPA（In-App SDK）で構成する。

## このサンプルが示すもの

- OIDC 認可コードフロー（PAR + PKCE）でのログイン。`acr_values=urn:klon:acr:high`、`prompt=consent`、`max_age`、`grant_management_action=replace` を指定
- `authorization_details` によるリソース権限要求（`klon/merged_full_name` は `required=true`、`klon/merged_birth_date`、`klon/email_address`）
- Registry UserService の `ReadResourceValues` でのリソース取得と、`authorization_details`（付与済み権限）の表示
- リフレッシュトークンによるトークン更新（`offline_access` スコープ）とログアウト
- In-App SDK によるアプリ内判定（`isInApp`）、KLON 対応判定（`isKLONSupported`）、アップデート要求（`requestAppUpdate`）、ウィンドウを閉じる（`closeWindow`）
- `pocketsign-manifest.json` の配置

## 構成

```
backend/    Go バックエンド。OIDC 認可フローと Registry API 呼び出しを担当し、SPA に JSON API を提供する
frontend/   React SPA。In-App SDK を使い、バックエンドの JSON API を呼ぶ
```

KLON はトークンエンドポイントで機密クライアント認証を要求するため、フロントエンド単独では認可フローを完結できない。認可フローとトークンの保持はバックエンドが行い、フロントエンドはセッション cookie 越しに自サービスの API を呼ぶだけにする。

バックエンドが提供するエンドポイント。

| エンドポイント | 内容 |
| --- | --- |
| `GET /authorize` | 認可 URL を組み立てて IdP にリダイレクトする |
| `GET /callback` | 認可コードをトークンに交換し、HttpOnly cookie に保存する |
| `GET /api/me` | Registry の `ReadResourceValues` の結果を返す |
| `GET /api/token-info` | 付与済みの `authorization_details` とリフレッシュトークンの有無を返す |
| `POST /api/refresh` | リフレッシュトークンでトークンを更新する |
| `POST /api/logout` | トークン cookie を破棄する |
| `GET /*` | `frontend/dist` を配信する（SPA フォールバック） |

## 前提

- SDK 取得用トークン。`@pocketsign/in-app-sdk` は `https://repo.platform.p8n.app` から取得するため、`~/.npmrc` に `//repo.platform.p8n.app/:_authToken=<YOUR_SDK_TOKEN>` を設定する。トークンの作成方法は [In-App SDK](https://docs.p8n.app/docs/link-v2/guide/pocketsign-app/in-app-sdk)のセットアップを参照
- PocketSign Platform でのサービス登録
  - OIDC クライアント（機密クライアント）の `client_id` / `client_secret`
  - `redirect_uri` に `REDIRECT_URI` と同じ値を登録する
  - ミニアプリの URL を登録する。`pocketsign-manifest.json` はその URL から解決されるパスに配信する（[マニフェスト](https://docs.p8n.app/docs/link-v2/guide/pocketsign-app/manifest)）
  - このサンプルが要求するリソース権限（`klon/merged_full_name` / `klon/merged_birth_date` / `klon/email_address`）を許可する

## セットアップ

```sh
cp .env.template .env  # CLIENT_ID / CLIENT_SECRET 等を設定
```

| 環境変数 | 既定値 | 内容 |
| --- | --- | --- |
| `CLIENT_ID` | （必須） | OIDC クライアント ID |
| `CLIENT_SECRET` | （必須） | OIDC クライアントシークレット |
| `ISSUER` | `https://id.mock.klon.you` | IdP のエンドポイント |
| `REGISTRY_URL` | `https://registry.mock.klon.you` | Registry のエンドポイント |
| `REDIRECT_URI` | `http://localhost:8080/callback` | 認可コードの受け取り先 |
| `PORT` | `8080` | バックエンドの待ち受けポート |
| `FRONTEND_DIR` | `../frontend/dist` | 配信する SPA のビルド成果物 |
| `VITE_SERVICE_ID` | - | 旧アプリ向けの `requestAppUpdate` フォールバックで使うサービス ID。フロントエンドのビルド時に埋め込まれる |

環境ごとのエンドポイントは[環境](https://docs.p8n.app/docs/link-v2/guide/environment)を参照。

## 起動

フロントエンドをビルドしてバックエンドから配信する。

```sh
cd frontend && pnpm install && pnpm run build
cd ../backend && source ../.env && go run .
```

http://localhost:8080 を開く。

フロントエンドを編集しながら開発する場合は、Vite の開発サーバーを使う。`/authorize` / `/callback` / `/api` はバックエンドにプロキシされる。

```sh
cd frontend && pnpm run dev  # http://localhost:5173
```

## ポケットサインアプリで開く

ミニアプリブラウザから開いた場合のみ、In-App SDK のアプリ固有機能（`closeWindow` など）が使える。KLON 非対応の旧バージョンのアプリで開かれた場合はアップデート要求の画面を表示する。

ブラウザで開いた場合は `isInApp` が `false` になり、アプリ固有機能のボタンは表示されない。認証・リソース取得はブラウザでもそのまま動作する。

## pocketsign-manifest.json

[frontend/public/pocketsign-manifest.json](frontend/public/pocketsign-manifest.json) はミニアプリブラウザの動作設定を配信するファイル。このサンプルは自オリジン内でのみ遷移するため `version` だけを持つ。

別オリジンの URL をミニアプリブラウザ内で開く必要がある場合は `allowOrigins` にそのオリジンを追加する。オリジン（scheme + host + port）の完全一致で判定されるため、信頼できるオリジンのみを追加する。

```json
{
  "version": 1,
  "allowOrigins": ["https://example.com"]
}
```

## ローカルの klon 環境に向ける

klon リポジトリをローカルで動かして検証する場合は `.env` を次のように設定する。クライアントはローカルのシードに登録済みのものを使う。

```sh
ISSUER=https://klonidp.localhost
REGISTRY_URL=https://klonregistry.localhost
REDIRECT_URI=https://klonexample.localhost/callback
```

`klonexample.localhost` は klon リポジトリの Caddy がバックエンドの `:8080` にプロキシする。

## チェック

```sh
cd backend && go build ./... && go vet ./...
```

```sh
cd frontend && pnpm run check
```
