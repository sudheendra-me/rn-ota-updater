# rn-ota-updater

A React Native library for implementing Over-The-Air (OTA) updates with custom update delivery. This package allows you to download, validate, and apply updates to your React Native application without going through the App Store or Play Store.

## Features

- 🚀 **Custom OTA Updates**: Deliver updates directly to your users without app store approval
- 🔒 **Secure Validation**: SHA256 hash verification for downloaded bundles
- 📱 **Android Support**: Supports React Native 0.70+ including New Architecture (Fabric/TurboModules)
- 🔄 **Atomic Updates**: Rollback capability with backup system
- 🛡️ **Error Recovery**: Automatic recovery from failed updates
- 🎨 **Assets Mapping**: Automatic asset resolution for updated images and static files
- 📦 **Peer Dependencies**: No bundled native modules - you control the versions

## Installation

```bash
npm install rn-ota-updater
```

## Quick Start

### 1. Install

```bash
npm install rn-ota-updater react-native-fs react-native-zip-archive
```

### 2. Add OTA bundle injection

Inside `MainApplication.kt`, keep your generated RN template and add the OTA fallback inside `reactNativeHost`:

```kotlin
override fun getJSBundleFile(): String? {
  return if (!BuildConfig.DEBUG) {
    getOtaBundlePath() ?: super.getJSBundleFile()
  } else {
    super.getJSBundleFile()
  }
}
```

### 3. Initialize on app startup

```typescript
import {recoverIfNeeded, loadOtaAssetsMap} from 'rn-ota-updater';

await recoverIfNeeded();
await loadOtaAssetsMap();
```

### 4. Apply OTA update

```typescript
import {OTARestart, runOTA} from 'rn-ota-updater';

const result = await runOTA(update);

if (result.reloadRequired) {
  OTARestart.restartApp();
}
```

## Platform Support

| Platform | Supported |
| -------- | --------- |
| Android  | Yes       |
| iOS      | Planned   |
| Expo     | No        |

## Peer Dependencies

This package uses **peer dependencies** to avoid bundling native modules. You must install these dependencies in your React Native app:

### Required Peer Dependencies

| Package                    | Version    | Purpose                |
| -------------------------- | ---------- | ---------------------- |
| `react-native`             | `>=0.70`   | React Native framework |
| `react-native-fs`          | `>=2.20.0` | File system operations |
| `react-native-zip-archive` | `>=6.0.0`  | ZIP file extraction    |

## React Native Architecture Support

`rn-ota-updater` supports:

- Old Architecture
- New Architecture
- Fabric
- TurboModules
- Hermes
- Designed to support Bridgeless mode on RN 0.76+
- React Native 0.70+

## Important Architecture Clarification

React Native `0.76+` templates commonly include both:

- `reactNativeHost`
- `reactHost`

inside `MainApplication.kt`.

Do NOT remove the generated `reactNativeHost` from newer React Native templates.

The correct approach is:

- Keep the default React Native generated architecture setup
- Inject OTA bundle loading through:

```kotlin
override fun getJSBundleFile(): String?
```

This setup supports:

- Old Architecture
- New Architecture
- Fabric
- TurboModules
- Bridgeless mode on RN 0.76+

You do NOT need to disable:

```properties
newArchEnabled=true
```

## React Native Version Compatibility

| React Native | Architecture     | Supported |
| ------------ | ---------------- | --------- |
| 0.70 - 0.75  | Old Architecture | Yes       |
| 0.76+        | Old Architecture | Yes       |
| 0.76+        | New Architecture | Yes       |
| 0.79+        | Bridgeless       | Designed  |

## Bridgeless Mode Support

`rn-ota-updater` is designed to support React Native Bridgeless mode on RN 0.76+.

OTA bundle injection is designed to work with:

```properties
newArchEnabled=true
```

and:

```properties
hermesEnabled=true
```

without requiring users to disable Fabric or TurboModules.

## Expo Support

This package currently supports React Native CLI projects only.

Expo managed workflow is not supported because OTA bundle injection requires native Android integration.

### Install Peer Dependencies

```bash
npm install react-native-fs react-native-zip-archive
```

### Android Additional Setup

For Android, add this permission to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Storage permissions are NOT required because OTA files are stored in app-private storage.

### Correct MainApplication.kt Setup

This setup is designed to work with:

- RN 0.76+
- RN 0.77+
- RN 0.78+
- RN 0.79+
- Fabric
- TurboModules
- Hermes
- Bridgeless mode on RN 0.76+

The exact `MainApplication.kt` template differs slightly between RN versions. Keep the default generated structure from your RN template and only add the OTA helper functions plus the `getJSBundleFile()` override shown below.

Always start from the generated React Native template for your RN version.

Do not fully replace your existing `MainApplication.kt`.

Only:

- add OTA helper functions
- add the `getJSBundleFile()` override

Keep the rest of the generated RN template intact.

`getJSBundleFile()` is ignored in debug builds because Metro serves the JS bundle directly.

<details>
<summary>Full MainApplication.kt Example</summary>

```kotlin
package com.yourcompany

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import java.io.File
import java.security.MessageDigest

class MainApplication : Application(), ReactApplication {

  // ===== HASH VALIDATION =====
  private fun computeSHA256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")

    file.inputStream().use { fis ->
      val buffer = ByteArray(8192)
      var bytesRead: Int

      while (fis.read(buffer).also { bytesRead = it } != -1) {
        digest.update(buffer, 0, bytesRead)
      }
    }

    return digest.digest().joinToString("") {
      "%02x".format(it)
    }
  }

  // ===== OTA BUNDLE RESOLUTION =====
  private fun getOtaBundlePath(): String? {
    val otaDir = File(filesDir, "ota")
    val currentDir = File(otaDir, "current")
    val backupDir = File(otaDir, "backup")

    val bundleFile = File(currentDir, "index.android.bundle")
    val hashFile = File(currentDir, "hash.txt")

    // Recover backup if needed
    if (!currentDir.exists() && backupDir.exists()) {
      Log.w("OTA", "Recovering OTA backup")
      backupDir.renameTo(currentDir)
    }

    // No OTA available
    if (!bundleFile.exists() || !hashFile.exists()) {
      Log.d("OTA", "No OTA bundle found")
      return null
    }

    // Sanity check
    if (bundleFile.length() < 2048) {
      Log.e("OTA", "Bundle too small - deleting")
      currentDir.deleteRecursively()
      return null
    }

    return try {
      val expectedHash = hashFile.readText().trim()
      val actualHash = computeSHA256(bundleFile)

      if (expectedHash.equals(actualHash, ignoreCase = true)) {
        Log.d("OTA", "OTA bundle verified")
        bundleFile.absolutePath
      } else {
        Log.e("OTA", "OTA hash mismatch - rolling back")
        currentDir.deleteRecursively()

        if (backupDir.exists()) {
          backupDir.renameTo(currentDir)
          val recovered = File(currentDir, "index.android.bundle")

          if (recovered.exists()) {
            recovered.absolutePath
          } else {
            null
          }
        } else {
          null
        }
      }
    } catch (e: Exception) {
      Log.e("OTA", "Bundle validation failed", e)
      null
    }
  }

  // REQUIRED FOR RN 0.76+
  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {

      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {
          // Add your custom packages here
        }

      override fun getJSMainModuleName(): String = "index"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override fun isNewArchEnabled(): Boolean =
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

      override fun isHermesEnabled(): Boolean =
        BuildConfig.IS_HERMES_ENABLED

      // OTA Injection
      override fun getJSBundleFile(): String? {
        return if (!BuildConfig.DEBUG) {
          getOtaBundlePath() ?: super.getJSBundleFile()
        } else {
          super.getJSBundleFile()
        }
      }
    }

  // NEW ARCHITECTURE HOST
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      reactNativeHost = reactNativeHost
    )
  }

  override fun onCreate() {
    super.onCreate()

    SoLoader.init(this, OpenSourceMergedSoMapping)

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
```

</details>

If your generated RN template differs, keep the generated `reactNativeHost`, `reactHost`, `SoLoader.init(...)`, and `load()` structure. Only add the OTA helper functions and the `getJSBundleFile()` override.

### Why This Setup Works

#### Old Architecture

React Native loads JS using:

```text
ReactNativeHost
```

and:

```kotlin
getJSBundleFile()
```

#### New Architecture

React Native internally creates:

```text
ReactHost
```

using:

```text
reactNativeHost
```

as configuration.

Therefore:

```kotlin
getJSBundleFile()
```

still works correctly.

### Important

Do NOT:

- remove `reactNativeHost`
- remove `reactHost`
- remove `load()`
- remove the generated `isNewArchEnabled()` / `isHermesEnabled()` declarations

Doing so may break:

- Fabric
- Bridgeless
- TurboModules
- startup initialization

**Key features:**

- Validates OTA bundle hash before loading
- Automatically recovers from backup if validation fails
- Only loads OTA bundle in release builds (`BuildConfig.DEBUG`)
- Falls back to default bundle if OTA is unavailable

## Migration Guide

### Migrating from RN 0.75 to RN 0.76+

If your OTA setup previously used:

```kotlin
override fun getJSBundleFile(): String?
```

keep using the same OTA injection point inside the generated `reactNativeHost`.

React Native `0.76+` New Architecture templates still use `reactNativeHost` as configuration for `reactHost`, so do not remove either generated property.

## Usage

> OTA bundles are only loaded in release builds.
>
> Debug builds use Metro and ignore OTA bundles.

### Startup Initialization

Call recovery first, then load the OTA assets map:

```typescript
import {recoverIfNeeded, loadOtaAssetsMap} from 'rn-ota-updater';

async function bootstrap() {
  await recoverIfNeeded();
  await loadOtaAssetsMap();
}

bootstrap();
```

### Basic Example

```typescript
import { OTARestart, runOTA } from "rn-ota-updater";

const updateBundle = {
  url: "https://your-server.com/updates/update.zip",
  shaHash: "abc123...", // SHA256 hash of the ZIP file
  bundleHash: "def456...", // SHA256 hash of the bundle (optional)
  sizeBytes: 1024000, // Size in bytes (optional)
};

const result = await runOTA(updateBundle);

if (result.reloadRequired) {
  OTARestart.restartApp();
} else {
  // Update failed
  console.error('Update failed:', result.error);
}
```

Example server manifest:

```json
{
  "version": "2",
  "url": "https://your-server.com/ota/otaBundle.zip",
  "shaHash": "ZIP_SHA256",
  "bundleHash": "BUNDLE_SHA256"
}
```

### Production Update Check

```typescript
import {OTARestart, runOTA} from 'rn-ota-updater';

const checkForUpdates = async () => {
  const response = await fetch(
    'https://your-server.com/ota-manifest.json',
  );

  const manifest = await response.json();

  const result = await runOTA({
    url: manifest.url,
    version: manifest.version,
    shaHash: manifest.zipHash,
    bundleHash: manifest.bundleHash,
  });

  if (result.reloadRequired) {
    OTARestart.restartApp();
  }
};
```

> In development, `OTARestart.restartApp()` uses `DevSettings.reload()` to force a reload from the current bundle.
>
> In production on Android, `OTARestart.restartApp()` calls the native `OTARestart.restartApp()` module when it is available.

### Auto Reload

If you want the package to restart immediately after a successful OTA update, pass `autoReload: true`:

```typescript
await runOTA({
  ...updateBundle,
  autoReload: true,
});
```

By default, Android restarts the current app package automatically. If you need to restart a specific package, pass `restartPackageName`:

```typescript
await runOTA({
  ...updateBundle,
  autoReload: true,
  restartPackageName: "com.yourcompany.yourapp",
});
```

Use this only when it is safe to restart the app immediately. For payment, form, or other critical flows, prefer checking `result.reloadRequired` and calling `OTARestart.restartApp()` yourself.

### Android OTA Restart Module

The native Android `OTARestart` module is included in this package and is autolinked by React Native. Apps do not need to add their own `NativeModules.OTARestart` implementation.

If autolinking is disabled in your app, manually add `new OTARestartPackage()` from `com.rnotaupdater` to your Android package list.

### Recovery

The package includes automatic recovery functionality. Call this on app startup:

```typescript
import { recoverIfNeeded } from "rn-ota-updater";

await recoverIfNeeded(); // Call this early in your app initialization
```

If a downloaded OTA bundle fails hash validation or crashes during recovery, the previous bundle stored in:

```text
ota/backup/
```

is automatically restored.

## Automatic Rollback

If an OTA bundle:

- fails hash validation
- crashes during recovery
- is incomplete
- is corrupted

the package automatically restores:

```text
ota/backup/
```

without requiring user intervention.

### Assets Mapping

For updates that include image assets or other static files, you can enable asset mapping to serve updated assets from the OTA directory:

```typescript
import { loadOtaAssetsMap, recoverIfNeeded } from "rn-ota-updater";

// Initialize recovery first
await recoverIfNeeded();

// Then load assets mapping
await loadOtaAssetsMap();
```

This will automatically intercept asset resolution and serve updated assets when available. The assets mapping supports:

- **Metro-bundled assets** (`rn/filename.ext`)
- **Android drawables** (`drawable*/filename.ext`)
- **Android mipmaps** (`mipmap*/filename.ext`)

## OTA Build Script

A helper CLI is included to generate an Android OTA ZIP from your React Native app. It runs `react-native bundle`, copies Metro-generated assets into the OTA package, generates an `assets.json` hash map, and writes a small manifest with the ZIP and bundle hashes.

Run the script from your React Native app root:

```bash
npx rn-ota-build-file
```

### CLI Options

The build script supports custom paths for your project structure:

```bash
npx rn-ota-build-file [options]
```

**Options:**

- `--rn-assets <path>` - Path to React Native assets (default: `src/assets/images`)
- `--android-res <path>` - Path to Android resources (default: `android/app/src/main/res`)
- `--reset-cache` - Passes `--reset-cache` to Metro while generating the bundle
- `--help, -h` - Show help message

**Examples:**

```bash
# Use default paths
npx rn-ota-build-file

# Custom RN assets location
npx rn-ota-build-file --rn-assets assets/images

# Custom Android resources and RN assets
npx rn-ota-build-file --android-res android/app/src/main/res --rn-assets src/assets

# Reset Metro cache while building
npx rn-ota-build-file --reset-cache
```

### Generated Files

The CLI creates these files in the project root:

- `otaBundle.zip` - Final OTA ZIP to upload to your update server
- `ota-manifest.json` - Local manifest containing `version`, `zipHash`, and `bundleHash`

The ZIP contains:

- `index.android.bundle` - Release JS bundle generated from `index.js`
- `assets.json` - SHA256 map for supported assets
- `assets/rn/*` - Metro-generated RN assets copied from `drawable*` and `raw*` build output
- `assets/drawable*/*`, `assets/mipmap*/*`, and other supported Android resource assets copied from `android/app/src/main/res`

Supported asset extensions are `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.ttf`, and `.mp4`.

Use the generated manifest values when serving an OTA update:

```typescript
await runOTA({
  url: "https://your-server.com/updates/otaBundle.zip",
  version: "1",
  shaHash: manifest.zipHash,
  bundleHash: manifest.bundleHash,
});
```

`shaHash` must be the ZIP hash (`zipHash`), while `bundleHash` must be the hash of `index.android.bundle`.

## Example OTA Server Structure

```text
server/
|-- ota-manifest.json
`-- otaBundle.zip
```

Example manifest:

```json
{
  "version": "5",
  "url": "https://server.com/otaBundle.zip",
  "zipHash": "...",
  "bundleHash": "..."
}
```

## Version Checking

To prevent reapplying the same OTA version, you can check a local version file before processing an update. Example:

```typescript
import RNFS from "react-native-fs";

const VERSION_FILE = `${RNFS.DocumentDirectoryPath}/ota/version.txt`;

const newVersion = "1";
let lastVersion = null;
const exists = await RNFS.exists(VERSION_FILE);
if (exists) {
  lastVersion = await RNFS.readFile(VERSION_FILE, "utf8");
}

console.log("[OTA] lastVersion:", lastVersion);

if (lastVersion === newVersion) {
  console.log("[OTA] Already up to date");
  return;
}
```

This ensures the update only runs when the stored OTA version differs from the incoming version.

## API Reference

### `runOTA(bundle: OTABundle): Promise<RunOTAResult>`

Applies an OTA update.

**Parameters:**

- `bundle`: Object containing update information

**Returns:**

- `Promise<RunOTAResult>`: Result object with update/reload status and error information

### `reloadApp(packageName?: string): void`

Reloads the app after an OTA update. In development this uses React Native `DevSettings.reload()`. In production Android this calls the native `OTARestart.restartApp()` module included in this package. When `packageName` is omitted, Android restarts the current app package.

### `OTARestart.restartApp(packageName?: string): void`

Package-level alias for `reloadApp()`, so app code does not need to access `NativeModules.OTARestart` directly.

### `recoverIfNeeded(): Promise<void>`

Recovers from a failed update if needed. Should be called on app startup.

### `loadOtaAssetsMap(): Promise<void>`

Loads the OTA assets map and sets up asset interception for images and other static assets. This allows serving updated assets from the OTA directory instead of bundled assets.

**Call this after `recoverIfNeeded()` and before using any assets in your app.**

`initOtaAssets()` is also exported as a backwards-compatible alias for the same behavior.

### `clearOtaAssetsMap(): void`

Clears the loaded assets map and resets asset interception. Useful for testing or switching between OTA versions.

### `getOtaAssetsMap(): Record<string, any>`

Returns the current assets mapping object for debugging purposes.

### Types

```typescript
interface OTABundle {
  url: string; // URL to download the update ZIP
  version: string; // OTA version
  shaHash: string; // SHA256 hash of the ZIP file
  bundleHash?: string; // SHA256 hash of the extracted bundle
  sizeBytes?: number; // Size of the update in bytes
  signature?: string; // Optional signature metadata
  autoReload?: boolean; // Reload automatically after a successful update
  restartPackageName?: string; // Optional package name override for Android restart
}

interface OTAResult {
  onSuccess: boolean;
  error?: string;
}

interface RunOTAResult {
  updated: boolean;
  reloadRequired: boolean;
  error?: string;
}
```

## How It Works

1. **Download**: Downloads the update ZIP file from your server
2. **Validation**: Verifies the ZIP file hash matches the expected SHA256
3. **Extraction**: Unzips the bundle to a staging directory
4. **Verification**: Validates the bundle contents and hash
5. **Backup**: Creates a backup of the current bundle
6. **Swap**: Atomically replaces the current bundle with the new one
7. **Cleanup**: Removes temporary files and locks

## OTA Flow

```text
Server
  |
  v
Download ZIP
  |
  v
SHA256 Validation
  |
  v
Extract to staging/
  |
  v
Validate bundle
  |
  v
Backup current/
  |
  v
Swap current bundle
  |
  v
Restart app
```

## Directory Structure

The package creates the following directory structure in the app's document directory:

```
DocumentDirectory/
├── ota/
│   ├── current/          # Active bundle
│   │   ├── index.android.bundle
│   │   ├── hash.txt
│   │   ├── assets.json   # Assets mapping
│   │   └── assets/       # Updated assets directory
│   ├── staging/          # Downloaded update (temporary)
│   ├── backup/           # Previous version (for rollback)
│   ├── update.zip        # Downloaded ZIP (temporary)
│   └── update.lock       # Lock file during update
```

## Error Handling

The package provides clear error messages for common issues:

- **Missing dependencies**: Clear instructions to install peer dependencies
- **Network errors**: Download failures are properly reported
- **Hash mismatches**: Security validation failures
- **Disk space**: Insufficient storage warnings
- **Platform support**: Currently Android-only with clear messaging

## Security Considerations

- Always serve updates over HTTPS
- Validate SHA256 hashes to prevent tampering
- Use proper authentication for your update server
- Consider code signing for additional security

## Security Model

The package validates:

- OTA ZIP SHA256
- extracted bundle SHA256

before activation.

Corrupted or tampered bundles are rejected automatically.

## Release Build Testing

OTA updates only work correctly in release builds.

Always test using:

```bash
npx react-native run-android --mode release
```

Debug builds use Metro and may ignore OTA bundles.

## OTA Scope

OTA updates can update:

- JavaScript
- Images/assets
- Business logic
- UI

OTA updates CANNOT update:

- Native Android/iOS code
- TurboModules
- Fabric native components
- Gradle dependencies
- Kotlin/Java/Swift/Obj-C code

## OTA Safety Warning

Never deliver OTA updates across incompatible native versions.

Example:

- App binary contains native module v1
- OTA JS expects native module v2

This can crash the app.

Always scope OTA updates using:

- app version
- build number
- native compatibility

## Recommended OTA Strategy

Always scope OTA updates by:

- app version
- native version
- build number

Never deliver OTA updates across incompatible native binaries.

## Recommended Production Setup

Recommended:

```properties
newArchEnabled=true
hermesEnabled=true
```

Hermes is strongly recommended for production OTA updates.

## Production Recommendations

Recommended:

- Hermes enabled
- release builds only
- HTTPS update delivery
- CDN hosting
- OTA version pinning
- staged rollout

## Common Crash

If you see:

```text
You should not use ReactNativeHost directly in the New Architecture
```

or:

```text
ReactInstanceManager.createReactContext is unsupported
```

it usually means:

- `reactHost` integration was removed
- RN template setup was modified incorrectly
- startup initialization was bypassed

Keep BOTH:

- `reactNativeHost`
- `reactHost`

from the generated RN template.

## Best Practices

- Always validate OTA bundle hashes
- Keep a backup OTA bundle for rollback
- Use OTA updates only for JavaScript/UI changes
- Do not ship native dependency changes via OTA
- Test OTA updates in release builds
- Call `recoverIfNeeded()` during app startup
- Use HTTPS for update delivery

## Known Limitations

- Android only currently
- Native Android/iOS code changes still require store release
- OTA updates cannot modify native dependencies
- OTA updates should not change TurboModule/Fabric native implementations

## Comparison

| Feature              | rn-ota-updater | CodePush |
| -------------------- | -------------- | -------- |
| Self-hosted          | Yes            | Optional |
| New Architecture     | Yes            | Partial  |
| Bridgeless           | Designed       | Limited  |
| Asset OTA            | Yes            | Yes      |
| Open Source          | Yes            | Yes      |
| AppCenter dependency | No             | Yes      |

## Supported Versions

| rn-ota-updater | RN Version | Architecture |
| -------------- | ---------- | ------------ |
| 1.x            | 0.70-0.75  | Old          |
| 1.x            | 0.76+      | New          |
| 1.x            | 0.79+      | Bridgeless   |

## Tested With

- React Native 0.70
- React Native 0.71
- React Native 0.72
- React Native 0.73
- React Native 0.74
- React Native 0.75
- React Native 0.76
- React Native 0.77
- React Native 0.78
- React Native 0.79

## Troubleshooting

Run:

```bash
npx react-native doctor
```

to verify your React Native environment setup.

## FAQ

### Why doesn't OTA work in debug mode?

Metro overrides JS bundle loading in debug builds. Test OTA updates in release builds.

### Can OTA update native modules?

No. OTA updates should only ship JavaScript, UI, business logic, and assets.

### Does this support Fabric?

Yes. Keep the generated RN template structure and inject OTA through `getJSBundleFile()`.

### Does this support Bridgeless?

It is designed for RN 0.76+ Bridgeless mode. Test your release APK, cold restart, and process-death relaunch before production rollout.

### Can I use this with Expo?

No. Expo managed workflow is not supported because OTA bundle injection requires native Android integration.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues:

1. Check that all peer dependencies are installed
2. Verify your update server is accessible
3. Ensure SHA256 hashes are correct
4. Check device storage space

For bugs or feature requests, please open an issue on GitHub.
