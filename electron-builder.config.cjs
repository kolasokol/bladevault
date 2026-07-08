const path = require('path');

const isMacHost = process.platform === 'darwin';
const isMacSigningEnabled = process.env.BLADEVAULT_MAC_SIGN === '1';
const isMacNotarizeEnabled = process.env.BLADEVAULT_MAC_NOTARIZE === '1';
const isUnsignedMacBuild = isMacHost && !isMacSigningEnabled;

const config = {
  appId: 'com.bladevault.desktop',
  productName: 'BladeVault',
  asar: true,
  asarUnpack: [
    '.next/standalone/**/*',
    'node_modules/**/*.node',
    'node_modules/better-sqlite3/**/*',
  ],
  artifactName: isUnsignedMacBuild
    ? 'BladeVault-${version}-${os}-${arch}-unsigned.${ext}'
    : 'BladeVault-${version}-${os}-${arch}.${ext}',
  directories: {
    output: 'dist/desktop',
    buildResources: 'build',
  },
  files: [
    'package.json',
    'electron/**/*',
    '.next/standalone/**/*',
  ],
  mac: {
    category: 'public.app-category.utilities',
    target: ['dmg'],
    identity: isUnsignedMacBuild ? null : undefined,
    hardenedRuntime: isMacSigningEnabled,
    gatekeeperAssess: false,
    entitlements: path.join('build', 'entitlements.mac.plist'),
    entitlementsInherit: path.join('build', 'entitlements.mac.inherit.plist'),
  },
  dmg: {
    background: 'background.png',
    window: {
      width: 540,
      height: 420,
    },
    contents: [
      {
        x: 150,
        y: 334,
        type: 'file',
      },
      {
        x: 390,
        y: 334,
        type: 'link',
        path: '/Applications',
      },
    ],
    iconSize: 92,
    iconTextSize: 14,
    title: '${productName} ${version}',
  },
  afterSign:
    isMacSigningEnabled && isMacNotarizeEnabled
      ? path.join(__dirname, 'scripts', 'notarize-macos.cjs')
      : undefined,
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};

module.exports = config;
