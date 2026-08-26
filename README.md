# klon-examples

PocketSign KLON SDK のサンプル集です。Go と TypeScript のそれぞれで、
OpenID Connect の Authorization Code Flow から Registry API 呼び出しまでの一連の流れを実装しています。

## サンプル一覧

| ディレクトリ | 内容 |
| --- | --- |
| [`go/`](go/) | Go SDK (`github.com/pocketsign/klon-sdk-go`) を使った最小サンプル |
| [`typescript/`](typescript/) | TypeScript SDK (`@pocketsign/klon-sdk`) を使った最小サンプル |

どちらも同じフローを実装しており、ローカルで HTTP サーバー (既定で `http://localhost:8080`) を起動します。

1. `/` : ログイン開始画面
2. `/authorize` : PKCE + PAR + Authorization Details 付きの認可リクエストを組み立て、IdP へリダイレクト
3. `/callback` : 認可コードをトークンに交換し、Cookie に保存
4. `/dashboard` : 取得したトークンと認可内容を表示し、アクセストークンで Registry API (ConnectRPC) の
   `UserService.ReadResourceValues` を呼び出して結果を表示
5. `/refresh` : リフレッシュトークンで新しいトークンを取得
6. `/logout` : トークンを破棄

## 前提

- KLON にクライアントを登録し、クライアント ID / クライアントシークレットを取得していること
- 登録したクライアントのリダイレクト URI に、サンプルで使う URI (既定は `http://localhost:8080/callback`) が含まれていること
- Go サンプル: Go 1.25 以降
- TypeScript サンプル: Node.js 22 以降と pnpm

### 環境変数

各ディレクトリの `.env.template` をコピーして `.env` を作成し、値を設定してください。

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

## SDK 取得用トークン (TypeScript のみ)

`typescript/.npmrc` は `@pocketsign` スコープを PocketSign のレジストリに向けています。

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
