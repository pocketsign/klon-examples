# klon-examples

PocketSign KLON SDK のサンプル集です。
OpenID Connect の Authorization Code Flow を、サーバーサイドとネイティブアプリのそれぞれで実装しています。

## サンプル一覧

| ディレクトリ | 内容 |
| --- | --- |
| [`go/`](go/) | Go SDK (`github.com/pocketsign/klon-sdk-go`) を使った最小サンプル |
| [`typescript/`](typescript/) | TypeScript SDK (`@pocketsign/klon-sdk`) を使った最小サンプル |
| [`react-native/`](react-native/) | TypeScript SDK を使った Expo / React Native のネイティブアプリサンプル |

### サーバーサイド (`go/`, `typescript/`)

Confidential Client として、認可コードの交換から Registry API 呼び出しまでを実装しています。
どちらも同じフローで、ローカルで HTTP サーバー (既定で `http://localhost:8080`) を起動します。

1. `/` : ログイン開始画面
2. `/authorize` : PKCE + PAR + Authorization Details 付きの認可リクエストを組み立て、IdP へリダイレクト
3. `/callback` : 認可コードをトークンに交換し、Cookie に保存
4. `/dashboard` : 取得したトークンと認可内容を表示し、アクセストークンで Registry API (ConnectRPC) の
   `UserService.ReadResourceValues` を呼び出して結果を表示
5. `/refresh` : リフレッシュトークンで新しいトークンを取得
6. `/logout` : トークンを破棄

### ネイティブアプリ (`react-native/`)

RFC 8252 (OAuth 2.0 for Native Apps) に従った Public Client として、PKCE + PAR + DPoP による
認可フローと、WebView のネイティブセッションバインドを実装しています。
セットアップと実行手順は [`react-native/README.md`](react-native/README.md) を参照してください。

## 前提

- KLON にクライアントを登録していること
  (サーバーサイドサンプルは Confidential Client としてクライアントシークレットも必要、
  React Native サンプルは Public Client)
- 登録したクライアントのリダイレクト URI に、サンプルで使う URI が含まれていること
  (サーバーサイドは既定で `http://localhost:8080/callback`、React Native は `klon-example-app://callback`)
- Go サンプル: Go 1.25 以降
- TypeScript サンプル: Node.js 22 以降と pnpm
- React Native サンプル: Node.js 22 以降と pnpm、および iOS / Android の実機かシミュレータ

### 環境変数 (サーバーサイドサンプル)

各ディレクトリの `.env.template` をコピーして `.env` を作成し、値を設定してください。
React Native サンプルの環境変数は [`react-native/README.md`](react-native/README.md) を参照してください。

```sh
cp .env.template .env
```

| 変数 | 説明 |
| --- | --- |
| `CLIENT_ID` | 登録したクライアントのクライアント ID (必須) |
| `CLIENT_SECRET` | 登録したクライアントのクライアントシークレット (必須) |
| `ISSUER` | IdP の issuer URL |
| `REGISTRY_URL` | Registry API のエンドポイント |
| `REDIRECT_URI` | 認可後のリダイレクト先。クライアント登録時の値と一致させる |
| `PORT` | サンプルサーバーの待ち受けポート |

`.env` にはクライアントシークレットが含まれます。コミットしないでください (`.gitignore` で除外済みです)。

## 実行手順

### Go

```sh
cd go
cp .env.template .env   # 値を設定する
set -a && source .env && set +a
go run .
```

`set -a && source .env && set +a` は bash / zsh 向けです。それ以外のシェルでは、同等の方法で `.env` の内容を環境変数としてエクスポートしてください。

TypeScript サンプルは Node.js の `--env-file` で `.env` を読み込むため、この手順は不要です。

### TypeScript

TypeScript サンプルの依存関係の取得には、SDK 取得用トークンが必要です (後述)。

```sh
cd typescript
cp .env.template .env   # 値を設定する
pnpm install
pnpm run dev
```

いずれもサーバー起動後、ブラウザで `http://localhost:8080` を開いてください。

## SDK 取得用トークン (TypeScript / React Native)

`typescript/.npmrc` と `react-native/.npmrc` は `@pocketsign` スコープを
PocketSign のレジストリに向けています。

```
@pocketsign:registry=https://repo.platform.p8n.app
```

このレジストリからのインストールにはトークンによる認証が必要です。
取得方法は [SDK トークンの取得](https://docs.p8n.app/docs/verify/guide/getting-started/sdk-token) を参照してください。

## TLS 証明書について

これらのサンプルは TLS 証明書の検証を有効にしたまま動作します。
検証を無効にする設定 (`NODE_TLS_REJECT_UNAUTHORIZED=0` など) はサンプルには含めていません。
そのまま本番相当の設定として利用できるようにするためです。

自己署名証明書を使う環境に接続する場合は、検証を無効にするのではなく、
その CA 証明書を信頼させてください。

- Node.js: `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`
- Go: `SSL_CERT_FILE=/path/to/ca.pem`

## ライセンス

[CC0 1.0 Universal](LICENSE) で公開しています。
帰属表示なしで自由にコピーして利用できます。
