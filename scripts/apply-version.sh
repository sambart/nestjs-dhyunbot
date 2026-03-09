#!/bin/bash
set -e

NEW_VERSION=$1
if [ -z "$NEW_VERSION" ] || [ "$NEW_VERSION" == "no-bump" ]; then
  echo "No version bump needed"
  exit 0
fi

# package.json 3곳 업데이트
npm version "$NEW_VERSION" --no-git-tag-version
npm version "$NEW_VERSION" --no-git-tag-version --workspace=@dhyunbot/api
npm version "$NEW_VERSION" --no-git-tag-version --workspace=@dhyunbot/web

echo "Updated all package.json to v${NEW_VERSION}"
