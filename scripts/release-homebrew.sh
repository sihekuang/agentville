#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FORMULA="$PROJECT_DIR/HomebrewFormula/agentville.rb"

VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
TAG="v$VERSION"
REPO="sihekuang/agentville"
TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz"

echo "=== AgentVille Homebrew Release ==="
echo "Version: $VERSION"
echo "Tag:     $TAG"
echo "Tarball: $TARBALL_URL"
echo ""

# Check for uncommitted changes
if ! git -C "$PROJECT_DIR" diff --quiet; then
  echo "ERROR: You have uncommitted changes. Commit or stash them first."
  exit 1
fi

# Check tag doesn't already exist
if git -C "$PROJECT_DIR" rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists."
  read -rp "Re-use existing tag? [y/N] " REUSE
  if [[ ! "$REUSE" =~ ^[Yy]$ ]]; then
    echo "Aborted. Bump the version in package.json first."
    exit 1
  fi
else
  echo "Creating tag $TAG..."
  git -C "$PROJECT_DIR" tag -a "$TAG" -m "Release $TAG"
  echo "Pushing tag to origin..."
  git -C "$PROJECT_DIR" push origin "$TAG"
fi

# Wait for GitHub to make the tarball available
echo ""
echo "Fetching tarball to compute sha256..."
TMPFILE=$(mktemp)
HTTP_CODE=$(curl -sL -o "$TMPFILE" -w "%{http_code}" "$TARBALL_URL")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Failed to download tarball (HTTP $HTTP_CODE)"
  echo "The tag may not be pushed yet, or the repo may be private."
  rm -f "$TMPFILE"
  exit 1
fi

SHA256=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
rm -f "$TMPFILE"

echo "SHA256: $SHA256"
echo ""

# Update the formula
sed -i '' "s|url \".*\"|url \"$TARBALL_URL\"|" "$FORMULA"
sed -i '' "s|sha256 \".*\"|sha256 \"$SHA256\"|" "$FORMULA"

echo "Updated homebrew/agentville.rb:"
grep -E 'url |sha256 ' "$FORMULA"
echo ""

# Commit the formula update in the main repo
git -C "$PROJECT_DIR" add "$FORMULA"
git -C "$PROJECT_DIR" commit -m "chore: update Homebrew formula for $TAG"

echo ""
echo "Done! Push this branch and merge to main."
echo ""
echo "Users install with:"
echo "  brew tap sihekuang/agentville https://github.com/sihekuang/agentville.git"
echo "  brew install agentville"
