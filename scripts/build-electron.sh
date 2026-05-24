#!/usr/bin/env bash
set -euo pipefail

echo "=== Building Next.js standalone ==="
npm run build

echo "=== Preparing standalone bundle ==="
rm -rf .electron-standalone
cp -r .next/standalone .electron-standalone
cp -r public .electron-standalone/public
cp -r .next/static .electron-standalone/.next/static
mkdir -p .electron-standalone/scripts/macos
cp scripts/macos/*.applescript .electron-standalone/scripts/macos/

echo "=== Compiling Electron ==="
npx tsc -p electron/tsconfig.json

echo "=== Packaging with electron-builder ==="
npx electron-builder --mac

echo "=== Injecting standalone node_modules ==="
# electron-builder strips node_modules from extraResources; copy them manually
APP_DIR=$(find dist -maxdepth 2 -name "AgentVille.app" -type d | head -1)
if [ -n "$APP_DIR" ]; then
  cp -r .electron-standalone/node_modules "$APP_DIR/Contents/Resources/standalone/node_modules"
  echo "Injected node_modules into $APP_DIR"
fi

echo "=== Cleanup ==="
rm -rf .electron-standalone

echo "=== Done ==="
echo "App is in dist/"
