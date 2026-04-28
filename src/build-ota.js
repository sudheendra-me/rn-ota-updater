#!/usr/bin/env node

console.log("OTA CLI running...");

// ===== CLI ARGS =====
const args = process.argv.slice(2);
let rnAssetsSrc = 'src/assets/images'; // default
let androidResDir = 'android/app/src/main/res'; // default

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rn-assets' && args[i + 1]) {
    rnAssetsSrc = args[i + 1];
    i++; // skip next arg
  } else if (args[i] === '--android-res' && args[i + 1]) {
    androidResDir = args[i + 1];
    i++; // skip next arg
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
OTA Build Tool

Usage: npx rn-ota-build-file [options]

Options:
  --rn-assets <path>     Path to React Native assets (default: src/assets/images)
  --android-res <path>   Path to Android resources (default: android/app/src/main/res)
  --help, -h            Show this help message

Examples:
  npx rn-ota-build-file
  npx rn-ota-build-file --rn-assets assets/images
  npx rn-ota-build-file --android-res android/app/src/main/res --rn-assets src/assets
`);
    process.exit(0);
  }
}

console.log(`Using RN assets path: ${rnAssetsSrc}`);
console.log(`Using Android res path: ${androidResDir}`);
console.log('');

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const crypto = require('crypto');

// ===== CONFIG =====
const BUILD_DIR = path.join(process.cwd(), 'ota_build');
const ASSETS_DIR = path.join(BUILD_DIR, 'assets');
const RN_OTA_DIR = path.join(ASSETS_DIR, 'rn');
const ZIP_PATH = path.join(process.cwd(), 'otaBundle.zip');

const ANDROID_RES_DIR = path.join(process.cwd(), androidResDir);
const RN_ASSETS_SRC = path.join(process.cwd(), rnAssetsSrc);

const VALID_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ttf',
  '.mp4',
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

function normalizeRnAsset(filePath) {
  const fileName = path.basename(filePath);

  const relDir = path
    .dirname(filePath)
    .replace(RN_ASSETS_SRC, '')
    .replace(/[\\/]/g, '_')
    .replace(/^_/, '');

  const prefix = relDir ? `src_images_${relDir}_` : 'src_images_';
  return (prefix + fileName).toLowerCase();
}

// ===== START =====
console.log('🔄 Starting OTA Build...\n');

// ===== CLEAN =====
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, {recursive: true, force: true});
}
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

fs.mkdirSync(ASSETS_DIR, {recursive: true});
fs.mkdirSync(RN_OTA_DIR, {recursive: true});

// ===== BUNDLE =====
console.log('📦 Generating bundle...');
try {
  execSync(
    `npx react-native bundle \
    --platform android \
    --dev false \
    --entry-file index.js \
    --bundle-output ota_build/index.android.bundle \
    --assets-dest ota_build`,
    {stdio: 'inherit'},
  );
} catch (error) {
  console.error('❌ Bundle generation failed', error.message);
  process.exit(1);
}

const bundlePath = path.join(BUILD_DIR, 'index.android.bundle');

if (!fs.existsSync(bundlePath)) {
  console.error('❌ Bundle not found');
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

// ===== GENERATE assets.json =====
console.log('\n📄 Generating assets.json...');

const assetsMap = {};

// Android assets
getAllFiles(ANDROID_RES_DIR).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) return;

  const key = path.relative(ANDROID_RES_DIR, file).replace(/\\/g, '/');
  assetsMap[key] = {
    path: key,
    hash: computeHashSync(file),
  };
});

// RN assets
getAllFiles(RN_ASSETS_SRC).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) return;

  const key = `rn/${normalizeRnAsset(file)}`;
  assetsMap[key] = {
    path: key,
    hash: computeHashSync(file),
  };
});

const assetsJsonPath = path.join(BUILD_DIR, 'assets.json');
fs.writeFileSync(assetsJsonPath, JSON.stringify(assetsMap, null, 2));

console.log(
  `✅ assets.json generated — ${Object.keys(assetsMap).length} entries`,
);

// ===== MAIN =====
(async () => {
  try {
    console.log('\n🔐 Computing bundle hash...');
    const bundleHash = await computeHash(bundlePath);
    console.log(`📦 bundleHash: ${bundleHash}`);

    // ===== ZIP =====
    console.log('\n🗜️ Creating ZIP...');
    if (process.platform === 'win32') {
      execSync(
        `powershell Compress-Archive -Path "${BUILD_DIR}\\*" -DestinationPath "${ZIP_PATH}" -Force`,
        {stdio: 'inherit'},
      );
    } else {
      execSync(`cd ota_build && zip -r "${ZIP_PATH}" .`, {
        stdio: 'inherit',
      });
    }

    console.log('✅ ZIP created');

    console.log('\n🔐 Computing zip hash...');
    const zipHash = await computeHash(ZIP_PATH);
    console.log(`📦 zipHash: ${zipHash}`);

    // ===== CLEAN =====
    fs.rmSync(BUILD_DIR, {recursive: true, force: true});

    // ===== OUTPUT =====
    console.log('\n🎉 OTA BUILD SUCCESS');
    console.log('----------------------------------');

    console.log(
      JSON.stringify(
        {
          url: 'https://your-server.com/api/v1/ota/otaBundle.zip',
          version: 'x.x.x',
          zipHash,
          bundleHash,
        },
        null,
        2,
      ),
    );

    console.log('----------------------------------\n');
  } catch (err) {
    console.error('❌ OTA build failed:', err.message);
    process.exit(1);
  }
})();
