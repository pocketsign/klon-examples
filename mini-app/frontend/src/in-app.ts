import {
  isInApp,
  isKLONSupported,
  isMethodSupported,
  closeWindow,
  createSDKInstance,
  requestAppUpdate,
  requestAppUpdateLegacy,
} from "@pocketsign/in-app-sdk";

export interface AppEnvironment {
  readonly isInApp: boolean;
  readonly isKLONSupported: boolean;
}

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

export async function handleRequestAppUpdate(serviceId: string): Promise<void> {
  if (isMethodSupported(requestAppUpdate)) {
    await requestAppUpdate();
  } else {
    const sdk = await createSDKInstance({ serviceId });
    await requestAppUpdateLegacy(sdk);
  }
}
