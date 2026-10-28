import {
  ERRORS,
  isInApp,
  isKLONSupported,
  closeWindow,
  requestAppUpdate,
} from "@pocketsign/in-app-sdk";

export interface AppEnvironment {
  readonly isInApp: boolean;
  readonly isKLONSupported: boolean;
}

// isInApp() はポケットサインアプリ 6.9.0 以降でだけ true になる。
// それより前のアプリで開かれた場合は、ブラウザと同じ扱いになる。
export function detectEnvironment(): AppEnvironment {
  const inApp = isInApp();
  return {
    isInApp: inApp,
    isKLONSupported: inApp ? isKLONSupported() : false,
  };
}

export function handleCloseWindow(): void {
  closeWindow({ confirm: true });
}

/**
 * - requested: アップデートを要求した（ストアへの遷移、またはアプリの再起動）
 * - no_update: いま適用できるアップデートがない
 * - retry_later: この端末でアップデートを確認・取得できなかった。時間をおいて呼び直すと成功することがある
 * - failed: それ以外のエラー
 */
export type AppUpdateResult = "requested" | "no_update" | "retry_later" | "failed";

// isInApp() が true のアプリ（6.9.0 以降）は requestAppUpdate() に対応しているため、
// SDK インスタンスを使う requestAppUpdateLegacy() へのフォールバックは不要。
export async function handleRequestAppUpdate(): Promise<AppUpdateResult> {
  try {
    const res = await requestAppUpdate();
    if (res.result !== "error") {
      return "requested";
    }
    switch (res.errno) {
      case ERRORS.NO_UPDATE_AVAILABLE:
        return "no_update";
      case ERRORS.DEVICE_UNABLE_TO_PROCESS:
        return "retry_later";
      default:
        return "failed";
    }
  } catch {
    return "failed";
  }
}
