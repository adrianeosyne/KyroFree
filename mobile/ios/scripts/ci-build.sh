#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
python3 scripts/generate-project.py
git diff --exit-code -- Kyro.xcodeproj
plutil -lint Kyro/Info.plist Kyro/PrivacyInfo.xcprivacy Kyro.xcodeproj/project.pbxproj
xcodebuild -version
xcrun simctl list devices available --json > build/simulators.json
SIMULATOR_ID="$(python3 - <<'PY'
import json
with open('build/simulators.json') as stream:
    devices = json.load(stream)['devices']
for runtime in sorted(devices, reverse=True):
    phones = [device for device in devices[runtime] if '.iOS-' in runtime and device.get('isAvailable') and device['name'].startswith('iPhone')]
    if phones:
        print(phones[0]['udid'])
        break
else:
    raise SystemExit('No available iPhone simulator runtime; install one in Xcode Settings > Components.')
PY
)"
xcrun simctl boot "$SIMULATOR_ID" || true
xcrun simctl bootstatus "$SIMULATOR_ID" -b
xcodebuild -project Kyro.xcodeproj -scheme Kyro -configuration Debug \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath build/DerivedData -resultBundlePath build/KyroTests.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test | tee build/test.log
xcrun simctl shutdown "$SIMULATOR_ID"
IPAD_SIMULATOR_ID="$(python3 - <<'PY'
import json
with open('build/simulators.json') as stream:
    devices = json.load(stream)['devices']
for runtime in sorted(devices, reverse=True):
    tablets = [device for device in devices[runtime] if '.iOS-' in runtime and device.get('isAvailable') and device['name'].startswith('iPad')]
    if tablets:
        print(tablets[0]['udid'])
        break
else:
    raise SystemExit('No available iPad simulator; install an iOS simulator runtime in Xcode Settings > Components.')
PY
)"
xcrun simctl boot "$IPAD_SIMULATOR_ID" || true
xcrun simctl bootstatus "$IPAD_SIMULATOR_ID" -b
xcodebuild -project Kyro.xcodeproj -scheme Kyro -configuration Debug \
  -destination "platform=iOS Simulator,id=$IPAD_SIMULATOR_ID" \
  -derivedDataPath build/DerivedData -resultBundlePath build/KyroIPadTests.xcresult \
  -only-testing:KyroUITests -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test | tee build/ipad-test.log
xcrun simctl shutdown "$IPAD_SIMULATOR_ID"
xcodebuild -project Kyro.xcodeproj -scheme Kyro -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Kyro.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive | tee build/archive.log
ditto -c -k --keepParent build/Kyro.xcarchive build/Kyro-iOS-unsigned.xcarchive.zip
ditto -c -k --keepParent build/DerivedData/Build/Products/Debug-iphonesimulator/Kyro.app build/Kyro-iOS-simulator.app.zip
shasum -a 256 build/Kyro-iOS-unsigned.xcarchive.zip build/Kyro-iOS-simulator.app.zip > build/SHA256SUMS.txt
