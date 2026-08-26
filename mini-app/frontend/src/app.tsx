import { useEffect, useState } from "react";
import type { AppEnvironment } from "./in-app";
import { detectEnvironment, handleCloseWindow, handleRequestAppUpdate } from "./in-app";
import type { UserProfile, TokenInfo } from "./api";
import { fetchMe, fetchTokenInfo, postRefresh, postLogout } from "./api";

const SERVICE_ID = import.meta.env.VITE_SERVICE_ID ?? "";

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-ng"}`}>
      {label}: {ok ? "YES" : "NO"}
    </span>
  );
}

function EnvSection({ env }: { env: AppEnvironment }) {
  return (
    <div className="env-section">
      <h2>Environment</h2>
      <Badge label="isInApp" ok={env.isInApp} />
      <Badge label="isKLONSupported" ok={env.isKLONSupported} />
    </div>
  );
}

function UnsupportedPage({ env }: { env: AppEnvironment }) {
  return (
    <>
      <h1>KLON Mini App Example</h1>
      <EnvSection env={env} />
      <p className="error">
        KLON に対応していないバージョンのアプリです。アプリを更新してください。
      </p>
      <button className="btn" onClick={() => handleRequestAppUpdate(SERVICE_ID)}>
        アプリを更新
      </button>
    </>
  );
}

function LoginPage({ env }: { env: AppEnvironment }) {
  return (
    <>
      <h1>KLON Mini App Example</h1>
      <p>OIDC Authorization Code Flow + Registry API + In-App SDK</p>
      <EnvSection env={env} />
      <a className="btn" href="/authorize">
        KLON でログイン
      </a>
      {env.isInApp && (
        <button className="btn btn-secondary" onClick={handleCloseWindow}>
          閉じる
        </button>
      )}
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
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <h1>KLON Mini App Example</h1>
      <EnvSection env={env} />

      <h2>User Resources</h2>
      {me.error ? (
        <pre className="error">{me.error}</pre>
      ) : me.resources ? (
        <pre>{JSON.stringify(me.resources, null, 2)}</pre>
      ) : null}

      {tokenInfo.authorizationDetails && tokenInfo.authorizationDetails.length > 0 && (
        <>
          <h2>Authorization Details</h2>
          <pre>{JSON.stringify(tokenInfo.authorizationDetails, null, 2)}</pre>
        </>
      )}

      {tokenInfo.hasRefreshToken && (
        <button className="btn" onClick={onRefresh}>
          トークンをリフレッシュ
        </button>
      )}
      <button className="btn btn-danger" onClick={onLogout}>
        ログアウト
      </button>
      {env.isInApp && (
        <button className="btn btn-secondary" onClick={handleCloseWindow}>
          閉じる
        </button>
      )}
    </>
  );
}

export function App() {
  const [env] = useState(() => detectEnvironment());
  const [me, setMe] = useState<UserProfile | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  const load = async () => {
    try {
      const [meData, tokenData] = await Promise.all([fetchMe(), fetchTokenInfo()]);
      setMe(meData);
      setTokenInfo(tokenData);
    } catch {
      setMe({ authenticated: false });
      setTokenInfo({ authenticated: false });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (env.isInApp && !env.isKLONSupported) {
    return <UnsupportedPage env={env} />;
  }

  if (!me || !tokenInfo) {
    return <p>Loading...</p>;
  }

  if (!me.authenticated) {
    return <LoginPage env={env} />;
  }

  return (
    <Dashboard
      env={env}
      me={me}
      tokenInfo={tokenInfo}
      onRefresh={() => {
        void postRefresh()
          .catch(() => {})
          .then(load);
      }}
      onLogout={() => {
        void postLogout()
          .catch(() => {})
          .then(load);
      }}
    />
  );
}
