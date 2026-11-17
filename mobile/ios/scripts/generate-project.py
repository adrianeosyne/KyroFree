#!/usr/bin/env python3
"""Generate the checked-in Xcode project without external packages (Python 3.9+)."""
import hashlib
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def object_id(name):
    return hashlib.sha256(name.encode()).hexdigest()[:24].upper()


def quote(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


objects = {}


def add(object_name, isa, **fields):
    identifier = object_id(object_name)
    objects[identifier] = dict(isa=isa, **fields)
    return identifier


def ref(identifier):
    return ("ref", identifier)


def render(value):
    if isinstance(value, tuple) and value[0] == "ref":
        return value[1]
    if isinstance(value, dict):
        return "{ " + " ".join(f"{quote(k)} = {render(v)};" for k, v in value.items()) + " }"
    if isinstance(value, list):
        return "( " + ", ".join(render(v) for v in value) + ("," if value else "") + " )"
    return quote(value)


app_name = "Kyro"
target_ids = {name: object_id("target:" + name) for name in ["Kyro", "KyroTests", "KyroUITests"]}
products = []
groups = []
for name in target_ids:
    product_type = "wrapper.application" if name == app_name else "wrapper.cfbundle"
    product_suffix = ".app" if name == app_name else ".xctest"
    product = add("product:" + name, "PBXFileReference", explicitFileType=product_type, includeInIndex="0", path=name + product_suffix, sourceTree="BUILT_PRODUCTS_DIR")
    products.append(ref(product))
    source_files = sorted((ROOT / name).glob("*.swift"))
    if not source_files:
        raise SystemExit(f"No Swift source in {name}; generate after creating the app and tests.")
    files, sources, resources = [], [], []
    paths = source_files + ([ROOT / name / "Assets.xcassets", ROOT / name / "PrivacyInfo.xcprivacy", ROOT / name / "Info.plist"] if name == app_name else [])
    for path in paths:
        file_type = {".swift": "sourcecode.swift", ".xcassets": "folder.assetcatalog", ".xcprivacy": "text.xml", ".plist": "text.plist.xml"}[path.suffix]
        relative = path.relative_to(ROOT).as_posix()
        file_ref = add("file:" + relative, "PBXFileReference", lastKnownFileType=file_type, path=path.name, sourceTree="<group>")
        files.append(ref(file_ref))
        if path.suffix != ".plist":
            build_ref = add("build:" + relative, "PBXBuildFile", fileRef=ref(file_ref))
            (sources if path.suffix == ".swift" else resources).append(ref(build_ref))
    groups.append(ref(add("group:" + name, "PBXGroup", children=files, path=name, sourceTree="<group>")))
    source_phase = add("sources:" + name, "PBXSourcesBuildPhase", buildActionMask="2147483647", files=sources, runOnlyForDeploymentPostprocessing="0")
    resource_phase = add("resources:" + name, "PBXResourcesBuildPhase", buildActionMask="2147483647", files=resources, runOnlyForDeploymentPostprocessing="0")
    framework_phase = add("frameworks:" + name, "PBXFrameworksBuildPhase", buildActionMask="2147483647", files=[], runOnlyForDeploymentPostprocessing="0")
    dependencies = []
    if name != app_name:
        proxy = add("proxy:" + name, "PBXContainerItemProxy", containerPortal=ref(object_id("project")), proxyType="1", remoteGlobalIDString=ref(target_ids[app_name]), remoteInfo=app_name)
        dependencies.append(ref(add("dependency:" + name, "PBXTargetDependency", target=ref(target_ids[app_name]), targetProxy=ref(proxy))))
    configurations = []
    for mode in ["Debug", "Release"]:
        settings = {
            "PRODUCT_NAME": "$(TARGET_NAME)",
            "PRODUCT_BUNDLE_IDENTIFIER": "cyou.kyro.app" + ("" if name == app_name else "." + name.lower()),
            "SWIFT_VERSION": "5.0",
            "IPHONEOS_DEPLOYMENT_TARGET": "16.0",
            "TARGETED_DEVICE_FAMILY": "1,2",
            "CODE_SIGN_STYLE": "Automatic",
            "MARKETING_VERSION": "1.0.0",
            "CURRENT_PROJECT_VERSION": "1",
            "LD_RUNPATH_SEARCH_PATHS": ["$(inherited)", "@executable_path/Frameworks"] if name == app_name else ["$(inherited)", "@executable_path/Frameworks", "@loader_path/Frameworks"],
        }
        if name == app_name:
            settings.update(INFOPLIST_FILE="Kyro/Info.plist", ASSETCATALOG_COMPILER_APPICON_NAME="AppIcon", SUPPORTS_MACCATALYST="NO", ENABLE_PREVIEWS="NO")
        else:
            settings["GENERATE_INFOPLIST_FILE"] = "YES"
            if name == "KyroTests":
                settings.update(TEST_HOST="$(BUILT_PRODUCTS_DIR)/Kyro.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Kyro", BUNDLE_LOADER="$(TEST_HOST)")
            else:
                settings["TEST_TARGET_NAME"] = app_name
        configurations.append(ref(add("config:" + name + ":" + mode, "XCBuildConfiguration", buildSettings=settings, name=mode)))
    config_list = add("configs:" + name, "XCConfigurationList", buildConfigurations=configurations, defaultConfigurationIsVisible="0", defaultConfigurationName="Release")
    add("target:" + name, "PBXNativeTarget", buildConfigurationList=ref(config_list), buildPhases=[ref(source_phase), ref(framework_phase), ref(resource_phase)], buildRules=[], dependencies=dependencies, name=name, productName=name, productReference=ref(product), productType="com.apple.product-type.application" if name == app_name else "com.apple.product-type.bundle.unit-test" if name == "KyroTests" else "com.apple.product-type.bundle.ui-testing")

products_group = add("products", "PBXGroup", children=products, name="Products", sourceTree="<group>")
main_group = add("main", "PBXGroup", children=groups + [ref(products_group)], sourceTree="<group>")
project_configs = []
for mode in ["Debug", "Release"]:
    settings = {
        "ALWAYS_SEARCH_USER_PATHS": "NO", "CLANG_ENABLE_MODULES": "YES", "CLANG_ENABLE_OBJC_ARC": "YES",
        "CLANG_WARN_DOCUMENTATION_COMMENTS": "YES", "CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER": "YES",
        "GCC_C_LANGUAGE_STANDARD": "gnu17", "GCC_NO_COMMON_BLOCKS": "YES", "GCC_WARN_64_TO_32_BIT_CONVERSION": "YES",
        "GCC_WARN_ABOUT_RETURN_TYPE": "YES_ERROR", "GCC_WARN_UNINITIALIZED_AUTOS": "YES_AGGRESSIVE",
        "GCC_WARN_UNUSED_FUNCTION": "YES", "GCC_WARN_UNUSED_VARIABLE": "YES", "SDKROOT": "iphoneos",
        "IPHONEOS_DEPLOYMENT_TARGET": "16.0", "SWIFT_VERSION": "5.0", "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
        "DEBUG_INFORMATION_FORMAT": "dwarf" if mode == "Debug" else "dwarf-with-dsym",
        "SWIFT_OPTIMIZATION_LEVEL": "-Onone" if mode == "Debug" else "-O",
        "SWIFT_COMPILATION_MODE": "singlefile" if mode == "Debug" else "wholemodule",
    }
    if mode == "Debug":
        settings.update(ENABLE_TESTABILITY="YES", GCC_OPTIMIZATION_LEVEL="0", GCC_PREPROCESSOR_DEFINITIONS=["DEBUG=1", "$(inherited)"], SWIFT_ACTIVE_COMPILATION_CONDITIONS="DEBUG", ONLY_ACTIVE_ARCH="YES")
    else:
        settings["VALIDATE_PRODUCT"] = "YES"
    project_configs.append(ref(add("project-config:" + mode, "XCBuildConfiguration", buildSettings=settings, name=mode)))
project_config_list = add("project-configs", "XCConfigurationList", buildConfigurations=project_configs, defaultConfigurationIsVisible="0", defaultConfigurationName="Release")
add("project", "PBXProject", attributes={"BuildIndependentTargetsInParallel": "YES", "LastUpgradeCheck": "1600", "TargetAttributes": {identifier: {"CreatedOnToolsVersion": "16.0", **({"TestTargetID": ref(target_ids[app_name])} if name != app_name else {})} for name, identifier in target_ids.items()}}, buildConfigurationList=ref(project_config_list), compatibilityVersion="Xcode 14.0", developmentRegion="en", hasScannedForEncodings="0", knownRegions=["en", "Base"], mainGroup=ref(main_group), productRefGroup=ref(products_group), projectDirPath="", projectRoot="", targets=[ref(value) for value in target_ids.values()])
project_dir = ROOT / "Kyro.xcodeproj"
project_dir.mkdir(exist_ok=True)
text = "// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n"
for identifier, fields in objects.items():
    text += f"\t\t{identifier} = {render(fields)};\n"
text += f"\t}};\n\trootObject = {object_id('project')};\n}}\n"
(project_dir / "project.pbxproj").write_bytes(text.encode("utf-8"))

scheme = ET.Element("Scheme", LastUpgradeVersion="1600", version="1.3")


def buildable(parent, name):
    return ET.SubElement(parent, "BuildableReference", BuildableIdentifier="primary", BlueprintIdentifier=target_ids[name], BuildableName=name + (".app" if name == app_name else ".xctest"), BlueprintName=name, ReferencedContainer="container:Kyro.xcodeproj")


build_action = ET.SubElement(scheme, "BuildAction", parallelizeBuildables="YES", buildImplicitDependencies="YES")
entries = ET.SubElement(build_action, "BuildActionEntries")
entry = ET.SubElement(entries, "BuildActionEntry", buildForTesting="YES", buildForRunning="YES", buildForProfiling="YES", buildForArchiving="YES", buildForAnalyzing="YES")
buildable(entry, app_name)
test_action = ET.SubElement(scheme, "TestAction", buildConfiguration="Debug", selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB", selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB", shouldUseLaunchSchemeArgsEnv="YES")
testables = ET.SubElement(test_action, "Testables")
for name in ["KyroTests", "KyroUITests"]:
    buildable(ET.SubElement(testables, "TestableReference", skipped="NO", parallelizable="NO"), name)
launch = ET.SubElement(scheme, "LaunchAction", buildConfiguration="Debug", selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB", selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB", launchStyle="0", useCustomWorkingDirectory="NO", ignoresPersistentStateOnLaunch="NO", debugDocumentVersioning="YES", debugServiceExtension="internal", allowLocationSimulation="YES")
buildable(ET.SubElement(launch, "BuildableProductRunnable", runnableDebuggingMode="0"), app_name)
profile = ET.SubElement(scheme, "ProfileAction", buildConfiguration="Release", shouldUseLaunchSchemeArgsEnv="YES", savedToolIdentifier="", useCustomWorkingDirectory="NO", debugDocumentVersioning="YES")
buildable(ET.SubElement(profile, "BuildableProductRunnable", runnableDebuggingMode="0"), app_name)
ET.SubElement(scheme, "AnalyzeAction", buildConfiguration="Debug")
ET.SubElement(scheme, "ArchiveAction", buildConfiguration="Release", revealArchiveInOrganizer="YES")
ET.indent(scheme, space="  ")
scheme_dir = project_dir / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
(scheme_dir / "Kyro.xcscheme").write_bytes(ET.tostring(scheme, encoding="utf-8", xml_declaration=True) + b"\n")
print(f"Generated {project_dir} ({len(objects)} objects).")
