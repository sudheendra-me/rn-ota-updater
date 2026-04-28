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

| Package | Version | Purpose |
|---------|---------|---------|
| `react-native` | `>=0.70` | React Native framework |
| `react-native-fs` | `>=2.20.0` | File system operations |
| `react-native-zip-archive` | `>=6.0.0` | ZIP file extraction |

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

## Usage

### Basic Example

```typescript
import { runOTA } from 'rn-ota-updater';

const updateBundle = {
  url: 'https://your-server.com/updates/update.zip',
  shaHash: 'abc123...', // SHA256 hash of the ZIP file
  bundleHash: 'def456...', // SHA256 hash of the bundle (optional)
  sizeBytes: 1024000 // Size in bytes (optional)
};

const result = await runOTA(updateBundle);

if (result.updated) {
  // Update successful - app will reload
  console.log('Update applied successfully');
} else {
  // Update failed
  console.error('Update failed:', result.error);
}
```

### Recovery

The package includes automatic recovery functionality. Call this on app startup:

```typescript
import { recoverIfNeeded } from 'rn-ota-updater';

await recoverIfNeeded(); // Call this early in your app initialization
```

### Assets Mapping

For updates that include image assets or other static files, you can enable asset mapping to serve updated assets from the OTA directory:

```typescript
import { loadOtaAssetsMap, recoverIfNeeded } from 'rn-ota-updater';

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
import RNFS from 'react-native-fs';

const VERSION_FILE = `${RNFS.DocumentDirectoryPath}/ota/version.txt`;

const newVersion = '1';
let lastVersion = null;
const exists = await RNFS.exists(VERSION_FILE);
if (exists) {
  lastVersion = await RNFS.readFile(VERSION_FILE, 'utf8');
}

console.log('[OTA] lastVersion:', lastVersion);

if (lastVersion === newVersion) {
  console.log('[OTA] Already up to date');
  return;
}
```

This ensures the update only runs when the stored OTA version differs from the incoming version.

## API Reference

### `runOTA(bundle: OTABundle): Promise<OTAResult>`

Applies an OTA update.

**Parameters:**
- `bundle`: Object containing update information

**Returns:**
- `Promise<OTAResult>`: Result object with success/error information

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
  url: string;        // URL to download the update ZIP
  shaHash: string;    // SHA256 hash of the ZIP file
  bundleHash?: string; // SHA256 hash of the extracted bundle
  sizeBytes?: number;  // Size of the update in bytes
}

interface OTAResult {
  onSuccess: boolean;
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