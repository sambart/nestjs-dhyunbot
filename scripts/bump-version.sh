#!/bin/bash
set -e

# 마지막 태그 조회 (없으면 최초 커밋부터)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
  COMMITS=$(git log --oneline --format="%s")
else
  COMMITS=$(git log "${LAST_TAG}..HEAD" --oneline --format="%s")
fi

# 버전 레벨 결정
BUMP="none"
while IFS= read -r msg; do
  # 빈 줄 스킵
  [ -z "$msg" ] && continue

  # Merge 커밋 스킵
  [[ "$msg" =~ ^Merge ]] && continue

  # release 커밋 스킵
  [[ "$msg" =~ ^\[release\] ]] && continue

  # BREAKING CHANGE 체크
  if [[ "$msg" =~ ^[a-z]+!: ]] || [[ "$msg" =~ BREAKING\ CHANGE ]]; then
    BUMP="major"
    break
  fi

  # feat → minor
  if [[ "$msg" =~ ^feat ]]; then
    [ "$BUMP" != "major" ] && BUMP="minor"
  fi

  # fix → patch
  if [[ "$msg" =~ ^fix ]]; then
    [ "$BUMP" == "none" ] && BUMP="patch"
  fi
done <<< "$COMMITS"

# 현재 버전 읽기
CURRENT_VERSION=$(node -p "require('./package.json').version")

# 새 버전 계산
if [ "$BUMP" == "none" ]; then
  echo "no-bump"
  exit 0
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "$NEW_VERSION"
