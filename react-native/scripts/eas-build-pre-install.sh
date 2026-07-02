#!/usr/bin/env bash

if [ $EAS_BUILD_RUNNER == "eas-build" ]; then
  echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> ~/.npmrc
fi
