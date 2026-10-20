#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/Muzic.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"

cd "$SCRIPT_DIR"
swift build

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
cp "$SCRIPT_DIR/.build/debug/MuzicSwiftUI" "$MACOS_DIR/MuzicSwiftUI"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>MuzicSwiftUI</string>
  <key>CFBundleIdentifier</key>
  <string>local.muzic.swiftui</string>
  <key>CFBundleName</key>
  <string>Muzic</string>
  <key>CFBundleDisplayName</key>
  <string>Muzic</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

echo "Built $APP_DIR"
