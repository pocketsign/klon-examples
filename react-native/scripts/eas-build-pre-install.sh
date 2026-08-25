#!/usr/bin/env bash
set -euo pipefail

# @pocketsign スコープは repo.platform.p8n.app にある。read は公開されているため
# 通常は認証不要だが、非公開パッケージを参照する場合に備えてトークンを渡せるようにする。
if [ "${EAS_BUILD_RUNNER:-}" = "eas-build" ] && [ -n "${POCKETSIGN_SDK_TOKEN:-}" ]; then
  echo "//repo.platform.p8n.app/:_authToken=$POCKETSIGN_SDK_TOKEN" >> ~/.npmrc
fi
