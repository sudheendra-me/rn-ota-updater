# rn-ota-updater

A React Native library for implementing Over-The-Air (OTA) updates with custom update delivery. This package allows you to download, validate, and apply updates to your React Native application without going through the App Store or Play Store.

## Features

- 🚀 **Custom OTA Updates**: Deliver updates directly to your users without app store approval
- 🔒 **Secure Validation**: SHA256 hash verification for downloaded bundles
- 📱 **Android Support**: Currently supports Android platform
- 🔄 **Atomic Updates**: Rollback capability with backup system
- 🛡️ **Error Recovery**: Automatic recovery from failed updates
- 🎨 **Assets Mapping**: Automatic asset resolution for updated images and static files
- 📦 **Peer Dependencies**: No bundled native modules - you control the versions

## Installation

```bash
npm install rn-ota-updater
```

## Peer Dependencies

This package uses **peer dependencies** to avoid bundling native modules. You must install these dependencies in your React Native app:

### Required Peer Dependencies

| Package                    | Version    | Purpose                |
| -------------------------- | ---------- | ---------------------- |
| `react-native`             | `>=0.70`   | React Native framework |
| `react-native-fs`          | `>=2.20.0` | File system operations |
| `react-native-zip-archive` | `>=6.0.0`  | ZIP file extraction    |

### Install Peer Dependencies

```bash
npm install react-native-fs react-native-zip-archive
```

### iOS Additional Setup

For iOS, you may need to add permissions to your `Info.plist`:

```xml
<key>NSAllowsArbitraryLoads</key>
<true/>
```

### Android Additional Setup

For Android, add these permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### Android MainApplication.kt Integration

To enable OTA bundle loading in your React Native Android app, update your `android/app/src/main/java/com/yourcompany/MainApplication.kt`:

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
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  // ===== OTA BUNDLE RESOLUTION =====
  private fun getOtaBundlePath(): String? {
    val otaDir = File(filesDir, "ota")
    val currentDir = File(otaDir, "current")
    val backupDir = File(otaDir, "backup")

    val bundleFile = File(currentDir, "index.android.bundle")
    val hashFile = File(currentDir, "hash.txt")

    // Recovery: restore from backup if current missing
    if (!currentDir.exists() && backupDir.exists()) {
      Log.w("OTA", "Recovering from backup...")
      backupDir.renameTo(currentDir)
    }

    // No valid OTA bundle
    if (!bundleFile.exists() || !hashFile.exists()) {
      Log.d("OTA", "No OTA bundle found → using default")
      return null
    }

    // Sanity check: bundle too small
    if (bundleFile.length() < 2 * 1024) {
      Log.e("OTA", "Bundle suspiciously small → deleting")
      currentDir.deleteRecursively()
      return null
    }

    // Hash validation
    return try {
      val expectedHash = hashFile.readText().trim()
      val actualHash = computeSHA256(bundleFile)

      if (expectedHash.equals(actualHash, ignoreCase = true)) {
        Log.d("OTA", "OTA bundle verified ✅")
        bundleFile.absolutePath
      } else {
        Log.e("OTA", "Hash mismatch → rollback to backup")
        currentDir.deleteRecursively()

        if (backupDir.exists()) {
          backupDir.renameTo(currentDir)
          val recovered = File(currentDir, "index.android.bundle")
          if (recovered.exists()) {
            Log.d("OTA", "Recovered from backup")
            recovered.absolutePath
          } else {
            null
          }
        } else {
          null
        }
      }
    } catch (e: Exception) {
      Log.e("OTA", "Bundle verification error", e)
      null
    }
  }

  override val reactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {

      override fun getPackages(): List<ReactPackage> =
        PackageList(this).packages.apply {
          // Add your custom packages here
        }

      override fun getJSMainModuleName(): String = "index"

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      // ===== OTA INJECTION POINT =====
      override fun getJSBundleFile(): String? {
        return if (!BuildConfig.DEBUG) {
          // Try OTA bundle first, fall back to default
          getOtaBundlePath() ?: super.getJSBundleFile()
        } else {
          super.getJSBundleFile()
        }
      }
    }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
  }
}
```

**Key features:**

- Validates OTA bundle hash before loading
- Automatically recovers from backup if validation fails
- Only loads OTA bundle in release builds (`BuildConfig.DEBUG`)
- Falls back to default bundle if OTA is unavailable

## Usage

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

A helper script is included to generate an OTA ZIP bundle with bundled RN assets and an `assets.json` mapping.

Run the script with:

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
- `--help, -h` - Show help message

**Examples:**

```bash
# Use default paths
npx rn-ota-build-file

# Custom RN assets location
npx rn-ota-build-file --rn-assets assets/images

# Custom Android resources and RN assets
npx rn-ota-build-file --android-res android/app/src/main/res --rn-assets src/assets
```

This creates `otaBundle.zip` in the repository root and prints both:

- `bundleHash` — SHA256 of the generated JS bundle
- `zipHash` — SHA256 of the final ZIP bundle

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

## Directory Structure

The package creates the following directory structure in the app's document directory:

```
DocumentDirectory/
├── ota/
│   ├── current/          # Active bundle
│   │   ├── index.android.bundle
│   │   ├── hash.txt
│   │   └── assets.json   # Assets mapping (if included in update)
│   ├── assets/           # Updated assets directory
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
