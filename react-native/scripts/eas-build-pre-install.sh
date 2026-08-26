#!/usr/bin/env bash
set -euo pipefail

# @pocketsign スコープは repo.platform.p8n.app にあり、認証が必要。
# プロジェクトの .npmrc に書いても pnpm は環境変数を展開しないため
# (commit されるファイルの認証情報は信用しない)、~/.npmrc に書く。
if [ "${EAS_BUILD_RUNNER:-}" = "eas-build" ]; then
  if [ -z "${POCKETSIGN_SDK_TOKEN:-}" ]; then
    echo "POCKETSIGN_SDK_TOKEN is not set. Add it to the EAS environment variables." >&2
    exit 1
  fi
  echo "//repo.platform.p8n.app/:_authToken=${POCKETSIGN_SDK_TOKEN}" >> ~/.npmrc
fi
