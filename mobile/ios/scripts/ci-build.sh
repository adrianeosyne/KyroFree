#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
python3 scripts/generate-project.py
git diff --exit-code -- Kyro.xcodeproj
plutil -lint Kyro/Info.plist Kyro/PrivacyInfo.xcprivacy Kyro.xcodeproj/project.pbxproj
xcodebuild -version
export IOS_SIMULATOR_SDK_VERSION="$(xcrun --sdk iphonesimulator --show-sdk-version)"
xcrun simctl list devices available --json > build/simulators.json
SIMULATOR_ID="$(python3 - <<'PY'
import json, os
with open('build/simulators.json') as stream:
    devices = json.load(stream)['devices']
def numeric_version(value):
    parts = tuple(map(int, value.replace('-', '.').split('.')))
    return parts + (0,) * max(0, 3 - len(parts))
sdk = numeric_version(os.environ['IOS_SIMULATOR_SDK_VERSION'])
runtimes = []
for runtime in devices:
    if '.iOS-' in runtime:
        version = numeric_version(runtime.split('.iOS-')[1])
        if (16, 0, 0) <= version <= sdk:
            runtimes.append((version, runtime))
for _, runtime in sorted(runtimes, reverse=True):
    available = [device for device in devices[runtime] if device.get('isAvailable')]
    phones = [device for device in available if device['name'].startswith('iPhone')]
    tablets = [device for device in available if device['name'].startswith('iPad')]
    if phones and tablets:
        with open('build/selected-runtime.txt', 'w') as stream:
            stream.write(runtime)
        print(phones[0]['udid'])
        break
else:
    raise SystemExit('No iOS16+ runtime with an iPhone and iPad compatible with the selected Xcode SDK; install a matching runtime in Xcode Settings > Components.')
PY
)"
echo "Testing on $(cat build/selected-runtime.txt) with iOS SDK $IOS_SIMULATOR_SDK_VERSION"
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
with open('build/selected-runtime.txt') as stream:
    runtime = stream.read().strip()
tablets = [device for device in devices[runtime] if device.get('isAvailable') and device['name'].startswith('iPad')]
if tablets:
    print(tablets[0]['udid'])
else:
    raise SystemExit('No available iPad simulator in the selected compatible runtime.')
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
