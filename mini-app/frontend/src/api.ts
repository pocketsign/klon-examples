export interface UserProfile {
  readonly authenticated: boolean;
  readonly resources?: Record<string, unknown>;
  readonly error?: string;
}

export interface TokenInfo {
  readonly authenticated: boolean;
  readonly authorizationDetails?: unknown[];
  readonly hasRefreshToken?: boolean;
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    throw new Error(`${res.url}: ${res.status}`);
  }
}

export async function fetchMe(): Promise<UserProfile> {
  const res = await fetch("/api/me", { credentials: "include" });
  await assertOk(res);
  return res.json() as Promise<UserProfile>;
}

export async function fetchTokenInfo(): Promise<TokenInfo> {
  const res = await fetch("/api/token-info", { credentials: "include" });
  await assertOk(res);
  return res.json() as Promise<TokenInfo>;
}

export async function postRefresh(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/refresh", {
    method: "POST",
    credentials: "include",
  });
  await assertOk(res);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function postLogout(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
  await assertOk(res);
  return res.json() as Promise<{ ok: boolean }>;
}
