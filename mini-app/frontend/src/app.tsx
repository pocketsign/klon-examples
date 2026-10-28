import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AppEnvironment, AppUpdateResult } from "./in-app";
import { detectEnvironment, handleCloseWindow, handleRequestAppUpdate } from "./in-app";
import type { UserProfile, TokenInfo } from "./api";
import { fetchMe, fetchTokenInfo, postRefresh, postLogout } from "./api";

const TITLE = "KLON ミニアプリのサンプル";

// 表示する本人情報の項目名
const RESOURCE_LABELS: Record<string, string> = {
  "klon/merged_full_name": "氏名",
  "klon/merged_birth_date": "生年月日",
  "klon/email_address": "メールアドレス",
};

// Registry の取得エラーを、利用者向けの言葉にする
const RESOURCE_ERROR_LABELS: Record<string, string> = {
  READ_RESOURCE_VALUE_ERROR_NO_VALUE: "未登録",
  READ_RESOURCE_VALUE_ERROR_NO_PERMISSION: "提供が許可されていません",
};

function formatResourceValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "error" in value) {
    return RESOURCE_ERROR_LABELS[String(value.error)] ?? "取得できませんでした";
  }
  return JSON.stringify(value);
}

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-ng"}`}>
      {label}: {ok ? "YES" : "NO"}
    </span>
  );
}

// アプリ内判定の結果と生のデータは、開発者向けの情報として畳んでおく
function DevInfo({ env, children }: { env: AppEnvironment; children?: ReactNode }) {
  return (
    <details>
      <summary>開発者向け情報</summary>
      <Badge label="isInApp" ok={env.isInApp} />
      <Badge label="isKLONSupported" ok={env.isKLONSupported} />
      {children}
    </details>
  );
}

const UPDATE_RESULT_MESSAGES: Record<Exclude<AppUpdateResult, "requested">, string> = {
  no_update:
    "いま適用できるアップデートはありません。取得済みのアップデートは、アプリを再起動すると適用されます。",
  retry_later: "アップデートを確認できませんでした。時間をおいてもう一度お試しください。",
  failed: "アップデートを要求できませんでした。ストアからアプリを更新してください。",
};

function UnsupportedPage({ env }: { env: AppEnvironment }) {
  const [result, setResult] = useState<AppUpdateResult | null>(null);

  return (
    <>
      <h1>{TITLE}</h1>
      <p className="error">
        KLON に対応していないバージョンのアプリです。アプリを更新してください。
      </p>
      {result && result !== "requested" && (
        <p className="notice">{UPDATE_RESULT_MESSAGES[result]}</p>
      )}
      {/* 適用できるアップデートがない場合は、アップデートを促す導線を出さない */}
      {result !== "no_update" && (
        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              void handleRequestAppUpdate().then(setResult);
            }}
          >
            アプリを更新
          </button>
        </div>
      )}
      <DevInfo env={env} />
    </>
  );
}

function LoginPage({ env, loadFailed }: { env: AppEnvironment; loadFailed: boolean }) {
  return (
    <>
      <h1>{TITLE}</h1>
      <p>
        KLON
        でログインすると、あなたが提供を許可した本人情報（氏名・生年月日・メールアドレス）を、このサービスが取得して表示します。
      </p>
      {loadFailed && (
        <p className="error">
          サーバーに接続できませんでした。時間をおいて再読み込みしてください。
        </p>
      )}
      <div className="actions">
        <a className="btn" href="/authorize">
          KLON でログイン
        </a>
        {env.isInApp && (
          <button className="btn btn-secondary" onClick={handleCloseWindow}>
            閉じる
          </button>
        )}
      </div>
      <DevInfo env={env} />
    </>
  );
}

function Dashboard({
  env,
  me,
  tokenInfo,
  onRefresh,
  onLogout,
}: {
  env: AppEnvironment;
  me: UserProfile;
  tokenInfo: TokenInfo;
  onRefresh: () => Promise<string>;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  // 実行中はボタンを無効にし、終わったら結果のメッセージを出す
  const refresh = async () => {
    setBusy(true);
    setMessage(await onRefresh());
    setBusy(false);
  };
  const logout = () => {
    setBusy(true);
    void onLogout();
  };

  return (
    <>
      <h1>{TITLE}</h1>
      <h2>取得した本人情報</h2>
      {me.error ? (
        <p className="error">{me.error}</p>
      ) : (
        <dl className="profile">
          {Object.entries(RESOURCE_LABELS).map(([id, label]) => (
            <Fragment key={id}>
              <dt>{label}</dt>
              <dd>{formatResourceValue(me.resources?.[id])}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {message && <p className="notice">{message}</p>}

      <div className="actions">
        {tokenInfo.hasRefreshToken && (
          <button className="btn" disabled={busy} onClick={() => void refresh()}>
            トークンを更新
          </button>
        )}
        <button className="btn btn-danger" disabled={busy} onClick={logout}>
          ログアウト
        </button>
        {env.isInApp && (
          <button className="btn btn-secondary" onClick={handleCloseWindow}>
            閉じる
          </button>
        )}
      </div>

      <DevInfo env={env}>
        <h3>Registry の取得結果</h3>
        <pre>{JSON.stringify(me.resources ?? null, null, 2)}</pre>
        <h3>付与された権限（authorization_details）</h3>
        <pre>{JSON.stringify(tokenInfo.authorizationDetails ?? [], null, 2)}</pre>
      </DevInfo>
    </>
  );
}

export function App() {
  const [env] = useState(() => detectEnvironment());
  const [me, setMe] = useState<UserProfile | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = async () => {
    try {
      const [meData, tokenData] = await Promise.all([fetchMe(), fetchTokenInfo()]);
      setMe(meData);
      setTokenInfo(tokenData);
      setLoadFailed(false);
    } catch {
      setMe({ authenticated: false });
      setTokenInfo({ authenticated: false });
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (env.isInApp && !env.isKLONSupported) {
    return <UnsupportedPage env={env} />;
  }

  if (!me || !tokenInfo) {
    return <p>読み込み中…</p>;
  }

  if (!me.authenticated) {
    return <LoginPage env={env} loadFailed={loadFailed} />;
  }

  return (
    <Dashboard
      env={env}
      me={me}
      tokenInfo={tokenInfo}
      onRefresh={async () => {
        const message = await postRefresh().then(
          () => "トークンを更新しました。",
          () => "トークンを更新できませんでした。",
        );
        await load();
        return message;
      }}
      onLogout={async () => {
        await postLogout().catch(() => {});
        await load();
      }}
    />
  );
}
