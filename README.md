# rn-ota-updater

A React Native library for implementing Over-The-Air (OTA) updates with custom update delivery. This package allows you to download, validate, and apply updates to your React Native application without going through the App Store or Play Store.

## Features

- 🚀 **Custom OTA Updates**: Deliver updates directly to your users without app store approval
- 🔒 **Secure Validation**: SHA256 hash verification for downloaded bundles
- 📱 **Android Support**: Currently supports Android platform
- 🔄 **Atomic Updates**: Rollback capability with backup system
- 🛡️ **Error Recovery**: Automatic recovery from failed updates
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

## API Reference

### `runOTA(bundle: OTABundle): Promise<OTAResult>`

Applies an OTA update.

**Parameters:**
- `bundle`: Object containing update information

**Returns:**
- `Promise<OTAResult>`: Result object with success/error information

### `recoverIfNeeded(): Promise<void>`

Recovers from a failed update if needed. Should be called on app startup.

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
│   │   └── hash.txt
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