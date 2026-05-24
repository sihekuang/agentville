#!/usr/bin/env bash
set -euo pipefail

echo "=== Building Next.js standalone ==="
npm run build

echo "=== Copying static assets to standalone ==="
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "=== Copying AppleScript files to standalone ==="
mkdir -p .next/standalone/scripts/macos
cp scripts/macos/*.applescript .next/standalone/scripts/macos/

echo "=== Compiling Electron ==="
npx tsc -p electron/tsconfig.json

echo "=== Packaging with electron-builder ==="
npx electron-builder --mac

echo "=== Done ==="
echo "App is in dist/"
