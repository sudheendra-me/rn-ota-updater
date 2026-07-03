
```markdown
# rn-ota-updater

A React Native library for implementing Over-The-Air (OTA) updates with custom update delivery. This package allows you to download, validate, and apply updates to your React Native application without going through the App Store or Play Store.

## Features

- 🚀 **Custom OTA Updates**: Deliver updates directly to your users without app store approval
- 🔒 **Secure Validation**: SHA256 hash verification for downloaded bundles
- 📱 **Android Support**: Supports React Native 0.70+ including New Architecture (Fabric/TurboModules)
- 🔄 **Atomic Updates**: Rollback capability with backup system
- 🛡️ **Error Recovery**: Automatic recovery from failed updates
- 📊 **Rich Metadata**: Track version, hashes, installation timestamps, and bundle size
- 🎨 **Assets Mapping**: Automatic asset resolution for updated images and static files
- 📦 **Peer Dependencies**: No bundled native modules - you control the versions

## Installation

```bash
npm install rn-ota-updater
```

## Quick Start

### 1. Install Dependencies

```bash
npm install rn-ota-updater react-native-fs react-native-zip-archive
```

### 2. Add OTA Bundle Injection

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

### 3. Initialize on App Startup

```typescript
import { recoverIfNeeded, loadOtaAssetsMap } from 'rn-ota-updater';

async function bootstrap() {
  await recoverIfNeeded();
  await loadOtaAssetsMap();
}

bootstrap();
```

### 4. Apply OTA Update

```typescript
import { runOTA, getCurrentBundleVersion } from 'rn-ota-updater';

const currentVersion = await getCurrentBundleVersion();
console.log('Current OTA version:', currentVersion);

const result = await runOTA({
  url: 'https://your-server.com/updates/update.zip',
  version: '2',
  shaHash: 'abc123...',
  bundleHash: 'def456...',
  sizeBytes: 10240,
  autoReload: true,
});

if (result.updated) {
  console.log('Update applied successfully!');
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

Do **NOT** remove the generated `reactNativeHost` from newer React Native templates.

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

You do **NOT** need to disable:

```properties
newArchEnabled=true
```

## Important

React Native templates differ across versions.

Always start from the generated `MainApplication.kt` from your React Native project.

Do **NOT** fully copy-paste the README example file.

Only:

- Add OTA helper methods
- Add `getJSBundleFile()`

Keep the rest of the generated template unchanged.

## React Native 0.79+

RN 0.79 templates may no longer expose:

```kotlin
isNewArchEnabled()
isHermesEnabled()
```

inside `DefaultReactNativeHost`.

Keep the generated template from your RN version and only inject OTA bundle loading through:

```kotlin
getJSBundleFile()
```

## React Native Version Compatibility

| React Native | Architecture     | Supported |
| ------------ | ---------------- | --------- |
| 0.70 - 0.75  | Old Architecture | Yes       |
| 0.76+        | Old Architecture | Yes       |
| 0.76+        | New Architecture | Yes       |
| 0.79+        | Bridgeless       | Designed  |

## Bridgeless Mode Support

`rn-ota-updater` is compatible with the RN 0.76+ architecture setup and designed to work with Bridgeless mode.

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

## Android Additional Setup

Add this permission to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Storage permissions are **NOT** required because OTA files are stored in app-private storage.

## Minimal Required Integration

The only required OTA injection point is:

```kotlin
override fun getJSBundleFile(): String? {
  return if (!BuildConfig.DEBUG) {
    getOtaBundlePath() ?: super.getJSBundleFile()
  } else {
    super.getJSBundleFile()
  }
}
```

inside your generated `reactNativeHost`.

Keep the rest of your RN template unchanged.

The exact `MainApplication.kt` template differs slightly between RN versions. Keep the default generated structure from your RN template and only add the OTA helper functions plus the `getJSBundleFile()` override shown below.

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
      if (!backupDir.renameTo(currentDir)) {
        Log.e("OTA", "Failed to restore OTA backup")
      }
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
          if (!backupDir.renameTo(currentDir)) {
            Log.e("OTA", "Failed to restore OTA backup")
            null
          } else {
            val recovered = File(currentDir, "index.android.bundle")

            if (recovered.exists()) {
              recovered.absolutePath
            } else {
              null
            }
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

  // React Native Host
  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {

      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {
          // Add your custom packages here
        }

      override fun getJSMainModuleName(): String = "index"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

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
      applicationContext,
      reactNativeHost
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

### Important React Native Template Differences

React Native templates differ slightly across versions.

Some RN templates expose:

```kotlin
override fun isNewArchEnabled()
override fun isHermesEnabled()
```

inside `DefaultReactNativeHost`, while others do not.

If your project shows:

```text
'override fun isNewArchEnabled()' overrides nothing
```

or:

```text
'override fun isHermesEnabled()' overrides nothing
```

simply remove those overrides.

The OTA integration only requires:

```kotlin
override fun getJSBundleFile(): String?
```

inside `reactNativeHost`.

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

Do **NOT**:

- remove `reactNativeHost`
- remove `reactHost`
- remove `load()`
- manually add or remove architecture methods unless your RN template requires it

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
import { recoverIfNeeded, loadOtaAssetsMap } from 'rn-ota-updater';

async function bootstrap() {
  await recoverIfNeeded();
  await loadOtaAssetsMap();
}

bootstrap();
```

### Get Current OTA Version

```typescript
import { getCurrentBundleVersion, getCurrentBundleMetadata } from 'rn-ota-updater';

// Get just the version
const version = await getCurrentBundleVersion();
console.log('Current OTA version:', version);

// Get full metadata
const metadata = await getCurrentBundleMetadata();
if (metadata) {
  console.log('Version:', metadata.version);
  console.log('Installed at:', new Date(metadata.installedAt).toLocaleString());
  console.log('Bundle size:', metadata.bundleSize, 'bytes');
}
```

### Basic Example

```typescript
import { runOTA, getCurrentBundleVersion } from "rn-ota-updater";

// Check current version
const currentVersion = await getCurrentBundleVersion();
console.log('Current version:', currentVersion);

const updateBundle = {
  url: "https://your-server.com/updates/update.zip",
  version: "2",
  shaHash: "abc123...",
  bundleHash: "def456...",
  sizeBytes: 10240,
  autoReload: true,
};

const result = await runOTA(updateBundle);

if (result.updated) {
  console.log('Update applied successfully!');
} else {
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
import { runOTA, getCurrentBundleVersion } from 'rn-ota-updater';

const checkForUpdates = async () => {
  const currentVersion = await getCurrentBundleVersion();
  console.log('Current OTA version:', currentVersion);

  const response = await fetch(
    'https://your-server.com/ota-manifest.json',
  );

  const manifest = await response.json();

  // Only update if server version is newer
  if (parseInt(manifest.version) > parseInt(currentVersion)) {
    const result = await runOTA({
      url: manifest.url,
      version: manifest.version,
      shaHash: manifest.zipHash,
      bundleHash: manifest.bundleHash,
      autoReload: true,
    });

    if (result.updated) {
      console.log('Update applied successfully!');
    }
  } else {
    console.log('Already on latest version');
  }
};
```

### Auto Reload

If you want the package to restart immediately after a successful OTA update, pass `autoReload: true`:

```typescript
await runOTA({
  ...updateBundle,
  autoReload: true,
});
```

By default, Android restarts the current app package automatically.

Use this only when it is safe to restart the app immediately. For payment, form, or other critical flows, prefer checking `result.updated` and calling `OTARestart.restartApp()` yourself.

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

The package provides built-in version checking through `getCurrentBundleVersion()`:

```typescript
import { getCurrentBundleVersion } from "rn-ota-updater";

const currentVersion = await getCurrentBundleVersion();
const newVersion = "5";

if (currentVersion === newVersion) {
  console.log("Already up to date");
  return;
}

// Apply update...
```

For more detailed information, use `getCurrentBundleMetadata()`:

```typescript
import { getCurrentBundleMetadata } from "rn-ota-updater";

const metadata = await getCurrentBundleMetadata();
if (metadata) {
  console.log('Version:', metadata.version);
  console.log('Installed at:', new Date(metadata.installedAt).toISOString());
  console.log('Bundle size:', metadata.bundleSize, 'bytes');
}
```

## Metadata API

The package stores rich metadata about each OTA installation, making it easy to track versions, debug issues, and audit updates.

### `getCurrentBundleVersion(): Promise<string>`

Gets the current OTA bundle version. Returns `'0'` if no OTA is installed.

```typescript
import { getCurrentBundleVersion } from 'rn-ota-updater';

const version = await getCurrentBundleVersion();
console.log('Current OTA version:', version);
```

### `getCurrentBundleMetadata(): Promise<OTAMetadata | null>`

Gets detailed metadata about the current OTA bundle.

```typescript
import { getCurrentBundleMetadata } from 'rn-ota-updater';

const metadata = await getCurrentBundleMetadata();
if (metadata) {
  console.log('Version:', metadata.version);
  console.log('Installed at:', new Date(metadata.installedAt).toISOString());
  console.log('Bundle size:', metadata.bundleSize, 'bytes');
}
```

### Metadata Structure

```typescript
interface OTAMetadata {
  version: string | number;    // OTA version
  bundleHash: string;          // SHA256 hash of the bundle
  zipHash: string;             // SHA256 hash of the ZIP file
  installedAt: number;         // Unix timestamp of installation
  bundleSize: number;          // Bundle size in bytes
}
```

### Example: Displaying OTA Version in App

```typescript
import { getCurrentBundleVersion, getCurrentBundleMetadata } from 'rn-ota-updater';
import { useEffect, useState } from 'react';

function AppInfo() {
  const [otaInfo, setOtaInfo] = useState<{
    version: string;
    installedAt: string;
  } | null>(null);

  useEffect(() => {
    async function loadOtaInfo() {
      const version = await getCurrentBundleVersion();
      const metadata = await getCurrentBundleMetadata();
      
      if (version !== '0') {
        setOtaInfo({
          version: version,
          installedAt: metadata ? new Date(metadata.installedAt).toLocaleString() : 'Unknown',
        });
      }
    }
    loadOtaInfo();
  }, []);

  return (
    <View>
      <Text>App Version: 1.0.0</Text>
      {otaInfo && (
        <>
          <Text>OTA Version: {otaInfo.version}</Text>
          <Text>Installed: {otaInfo.installedAt}</Text>
        </>
      )}
    </View>
  );
}
```

### Example: Version Check Before Update

```typescript
import { getCurrentBundleVersion, runOTA } from 'rn-ota-updater';

async function checkForUpdates() {
  const currentVersion = await getCurrentBundleVersion();
  const serverVersion = '5'; // From your server

  if (currentVersion === serverVersion) {
    console.log('Already on latest version');
    return;
  }

  const result = await runOTA({
    url: 'https://your-server.com/update.zip',
    version: serverVersion,
    shaHash: 'abc123...',
    autoReload: true,
  });

  if (result.updated) {
    console.log('Update applied successfully!');
  }
}
```

## API Reference

### Core Functions

#### `runOTA(bundle: OTABundle): Promise<RunOTAResult>`

Applies an OTA update with automatic reload handling.

**Parameters:**

- `bundle`: Object containing update information

**Returns:**

- `Promise<RunOTAResult>`: Result object with update status

#### `applyOTABundle(bundle: OTABundle): Promise<OTAResult>`

Low-level update primitive used by `runOTA()`.

Most apps should call `runOTA()` instead. Use this only if you are building custom update orchestration and will handle reload behavior yourself.

#### `cleanupOTA(): Promise<void>`

Advanced cleanup helper for temporary OTA files.

Do not call this during an active update. Calling it at the wrong time can remove staging files or recovery locks.

### Metadata Functions

#### `getCurrentBundleVersion(): Promise<string>`

Gets the current OTA bundle version. Returns `'0'` if no OTA is installed.

#### `getCurrentBundleMetadata(): Promise<OTAMetadata | null>`

Gets detailed metadata about the current OTA bundle.

#### `getMetadata(): Promise<OTAMetadata | null>`

Alias for `getCurrentBundleMetadata()`. Lower-level access for advanced use cases.

### Asset Management

#### `loadOtaAssetsMap(): Promise<void>`

Loads the OTA assets map and sets up asset interception for images and other static assets. This allows serving updated assets from the OTA directory instead of bundled assets.

**Call this after `recoverIfNeeded()` and before using any assets in your app.**

`initOtaAssets()` is also exported as a backwards-compatible alias for the same behavior.

#### `clearOtaAssetsMap(): void`

Clears the loaded assets map and resets asset interception. Useful for testing or switching between OTA versions.

#### `getOtaAssetsMap(): Record<string, any>`

Returns the current assets mapping object for debugging purposes.

### Recovery & Reload

#### `recoverIfNeeded(): Promise<void>`

Recovers from a failed update if needed. Should be called on app startup.

#### `reloadApp(): void`

Reloads the app after an OTA update. In development this uses React Native `DevSettings.reload()`. In production Android this calls the native `OTARestart.restartApp()` module included in this package.

#### `OTARestart.restartApp(): void`

Package-level alias for `reloadApp()`, so app code does not need to access `NativeModules.OTARestart` directly.

### Types

```typescript
interface OTABundle {
  url: string;                    // URL to download the update ZIP
  version: string | number;       // OTA version (required)
  shaHash: string;                // SHA256 hash of the ZIP file
  bundleHash?: string;            // SHA256 hash of the extracted bundle
  sizeBytes?: number;             // Size of the update in bytes
  autoReload?: boolean;           // Reload automatically after successful update
  restartPackageName?: string;    // Optional package name override for Android restart
}

interface OTAMetadata {
  version: string | number;       // OTA version
  bundleHash: string;             // SHA256 of the bundle
  zipHash: string;                // SHA256 of the ZIP file
  installedAt: number;            // Unix timestamp of installation
  bundleSize: number;             // Size in bytes
}

interface OTAResult {
  onSuccess: boolean;
  error?: string;
  metadata?: OTAMetadata;        // Metadata of the applied update
}

interface RunOTAResult {
  updated: boolean;               // Whether update was successfully applied
  reloadRequired: boolean;        // Whether app reload is needed
  error?: string;                 // Error message if update failed
  metadata?: OTAMetadata;         // Metadata of the applied update
}
```

## How It Works

1. **Download**: Downloads the update ZIP file from your server
2. **Validation**: Verifies the ZIP file hash matches the expected SHA256
3. **Extraction**: Unzips the bundle to a staging directory
4. **Verification**: Validates the bundle contents and hash
5. **Metadata**: Creates `metadata.json` with version, hashes, and timestamp
6. **Backup**: Creates a backup of the current bundle
7. **Swap**: Atomically replaces the current bundle with the new one
8. **Cleanup**: Removes temporary files and locks

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
Create metadata.json
  |
  v
Backup current/
  |
  v
Swap current bundle
  |
  v
Cleanup temporary files
  |
  v
Restart app (if autoReload: true)
```

## Directory Structure

The package creates the following directory structure in the app's document directory:

```
DocumentDirectory/
├── ota/
│   ├── current/                  # Active bundle
│   │   ├── index.android.bundle
│   │   ├── hash.txt              # For native verification
│   │   ├── metadata.json         # Rich metadata (version, hashes, timestamp)
│   │   ├── assets.json           # Assets mapping
│   │   └── assets/               # Updated assets directory
│   ├── staging/                  # Downloaded update (temporary)
│   ├── backup/                   # Previous version (for rollback)
│   │   ├── index.android.bundle
│   │   ├── hash.txt
│   │   └── metadata.json         # Backup metadata
│   ├── update.zip                # Downloaded ZIP (temporary)
│   └── update.lock               # Lock file during update
```

### metadata.json Structure

```json
{
  "version": "26",
  "bundleHash": "ab12cd34ef56gh78ij90kl12mn34op56qr78st90",
  "zipHash": "ef56gh78ij90kl12mn34op56qr78st90uv12wx34",
  "installedAt": 1782938293000,
  "bundleSize": 1048576
}
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
- Extracted bundle SHA256

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

OTA updates **CANNOT** update:

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

## Critical Production Rule

Never ship OTA updates that require new native code.

OTA updates must remain compatible with the installed app binary.

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

Keep **BOTH**:

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
- Use `getCurrentBundleVersion()` to prevent re-applying the same version
- Store and display OTA version in your app's settings/debug screen
- Monitor `metadata.json` for audit purposes

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
| Rich Metadata        | Yes            | Limited  |
| Bundle Size Tracking | Yes            | No       |

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

### Common Issues

**Issue**: OTA version always returns '0'

**Solution**: Check that `metadata.json` exists in `ota/current/`. If not, ensure your OTA update was successfully applied.

**Issue**: Bundle not loading from OTA

**Solution**: 
1. Verify `getJSBundleFile()` is correctly implemented in `MainApplication.kt`
2. Check that `hash.txt` and `index.android.bundle` exist in `ota/current/`
3. Test in release mode: `npx react-native run-android --mode release`

**Issue**: Assets not updating

**Solution**:
1. Ensure `loadOtaAssetsMap()` is called after `recoverIfNeeded()`
2. Verify `assets.json` exists in `ota/current/`
3. Check that assets are properly copied in your OTA ZIP

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

### Where is the OTA version stored?

The version is stored in `metadata.json` inside the OTA directory. Use `getCurrentBundleVersion()` to read it.

### What's in metadata.json?

```json
{
  "version": "26",
  "bundleHash": "...",
  "zipHash": "...",
  "installedAt": 1782938293000,
  "bundleSize": 1048576
}
```

### How do I get the OTA version in my app?

```typescript
import { getCurrentBundleVersion } from 'rn-ota-updater';

const version = await getCurrentBundleVersion();
```

### Can I prevent re-applying the same OTA version?

Yes, use `getCurrentBundleVersion()` to check before applying:

```typescript
const currentVersion = await getCurrentBundleVersion();
if (currentVersion === newVersion) {
  console.log('Already up to date');
  return;
}
```

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
```

This README is now **complete, production-ready, and comprehensive**. It includes all the metadata features, proper API documentation, and follows best practices for a React Native OTA library. 🚀