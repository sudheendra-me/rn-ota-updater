#!/usr/bin/env node

console.log("OTA CLI running...");

// ===== CLI ARGS =====
const args = process.argv.slice(2);

let rnAssetsSrc = 'src/assets/images';
let androidResDir = 'android/app/src/main/res';
let resetCache = false;

// Parse args
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rn-assets' && args[i + 1]) {
    rnAssetsSrc = args[i + 1];
    i++;
  } else if (args[i] === '--android-res' && args[i + 1]) {
    androidResDir = args[i + 1];
    i++;
  } else if (args[i] === '--reset-cache') {
    resetCache = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
OTA Build Tool

Usage: npx rn-ota-build-file [options]

Options:
  --rn-assets <path>       RN assets path
  --android-res <path>     Android res path
  --reset-cache            Reset Metro cache
  --help, -h               Show help
`);
    process.exit(0);
  }
}

console.log(`Using RN assets path: ${rnAssetsSrc}`);
console.log(`Using Android res path: ${androidResDir}`);
console.log(`Reset cache: ${resetCache}`);
console.log('');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// ===== CONFIG =====
const BUILD_DIR = path.join(process.cwd(), 'ota_build');
const ASSETS_DIR = path.join(BUILD_DIR, 'assets');
const RN_OTA_DIR = path.join(ASSETS_DIR, 'rn');
const ZIP_PATH = path.join(process.cwd(), 'otaBundle.zip');

const ANDROID_RES_DIR = path.join(process.cwd(), androidResDir);
const RN_ASSETS_SRC = path.join(process.cwd(), rnAssetsSrc);

const VALID_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ttf', '.mp4',
];

// ===== HELPERS =====
function getAllFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });

  return results;
}

function computeHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function computeHashSync(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// ===== START =====
console.log('🔄 Starting OTA Build...\n');

// CLEAN
if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(RN_OTA_DIR, { recursive: true });

// ===== BUNDLE =====
console.log('📦 Generating bundle...');

try {
  const resetFlag = resetCache ? '--reset-cache' : '';

  execSync(
    `npx react-native bundle \
    --platform android \
    --dev false \
    ${resetFlag} \
    --entry-file index.js \
    --bundle-output ota_build/index.android.bundle \
    --assets-dest ota_build`,
    { stdio: 'inherit' }
  );
} catch (error) {
  console.error('❌ Bundle generation failed');
  console.error(error?.stdout?.toString() || error.message);
  process.exit(1);
}

const bundlePath = path.join(BUILD_DIR, 'index.android.bundle');

if (!fs.existsSync(bundlePath)) {
  console.error('❌ Bundle not found');
  process.exit(1);
}

// ✅ Bundle size validation
const stat = fs.statSync(bundlePath);
if (stat.size < 5 * 1024) {
  console.error('❌ Bundle too small (corrupt)');
  process.exit(1);
}

console.log('✅ Bundle verified');

// ===== COPY RN ASSETS =====
console.log('\n📂 Copying RN assets...');

const densityDirs = fs
  .readdirSync(BUILD_DIR)
  .filter(d => /^(drawable|raw)/.test(d))
  .map(d => path.join(BUILD_DIR, d))
  .filter(d => fs.statSync(d).isDirectory());

let copied = 0;

densityDirs.forEach(dir => {
  fs.readdirSync(dir).forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) return;

    if (!file.startsWith('src_') && !file.startsWith('node_modules_')) return;

    const dest = path.join(RN_OTA_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(dir, file), dest);
      copied++;
    }
  });
});

console.log(`✅ Copied ${copied} assets`);

// ===== COPY ANDROID RES ASSETS =====
console.log('\n📂 Copying Android res assets...');

let copiedAndroidRes = 0;

getAllFiles(ANDROID_RES_DIR).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) return;

  const key = path.relative(ANDROID_RES_DIR, file).replace(/\\/g, '/');
  copyFileSync(file, path.join(ASSETS_DIR, key));
  copiedAndroidRes++;
});

console.log(`✅ Copied ${copiedAndroidRes} Android res assets`);

// ===== assets.json =====
console.log('\n📄 Generating assets.json...');

const assetsMap = {};

getAllFiles(ASSETS_DIR).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) return;

  const key = path.relative(ASSETS_DIR, file).replace(/\\/g, '/');
  assetsMap[key] = {
    path: key,
    hash: computeHashSync(file),
  };
});

fs.writeFileSync(
  path.join(BUILD_DIR, 'assets.json'),
  JSON.stringify(assetsMap, null, 2)
);

console.log(`✅ assets.json generated — ${Object.keys(assetsMap).length} entries`);

// ===== MAIN =====
(async () => {
  try {
    console.log('\n🔐 Computing bundle hash...');
    const bundleHash = await computeHash(bundlePath);

    console.log('\n🗜️ Creating ZIP...');
    if (process.platform === 'win32') {
      execSync(
        `powershell Compress-Archive -Path "${BUILD_DIR}\\*" -DestinationPath "${ZIP_PATH}" -Force`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`cd ota_build && zip -r "${ZIP_PATH}" .`, { stdio: 'inherit' });
    }

    console.log('✅ ZIP created');

    const zipHash = await computeHash(ZIP_PATH);

    // save manifest
    const manifest = {
      version: 'x.x.x',
      zipHash,
      bundleHash,
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'ota-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    fs.rmSync(BUILD_DIR, { recursive: true, force: true });

    console.log('\n🎉 OTA BUILD SUCCESS');
    console.log(JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error('❌ OTA build failed:', err.message);
    process.exit(1);
  }
})();
