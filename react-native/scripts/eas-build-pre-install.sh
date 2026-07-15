#!/usr/bin/env bash

if [ $EAS_BUILD_RUNNER == "eas-build" ]; then
  echo "//repo.platform.p8n.app/:_authToken=$NPM_TOKEN" >> ~/.npmrc
fi
