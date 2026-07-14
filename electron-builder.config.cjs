const path = require('path')

const isMacHost = process.platform === 'darwin'
const isMacSigningEnabled = process.env.BLADEVAULT_MAC_SIGN === '1'
const isMacNotarizeEnabled = process.env.BLADEVAULT_MAC_NOTARIZE === '1'
const isUnsignedMacBuild = isMacHost && !isMacSigningEnabled
const dmgLaunchTextPath = path.join(__dirname, 'build', 'First Launch.txt')
const dmgWindow = {
  width: 920,
  height: 720,
}
const dmgContents = [
  {
    x: 241,
    y: 394,
    type: 'file',
  },
  {
    x: 679,
    y: 394,
    type: 'link',
    path: '/Applications',
  },
  {
    x: 717,
    y: 601,
    type: 'file',
    path: dmgLaunchTextPath,
  },
]

const config = {
  appId: 'com.bladevault.desktop',
  productName: 'BladeVault',
  asar: true,
  asarUnpack: [
    '.next/standalone/**/*',
    'node_modules/**/*.node',
    'node_modules/better-sqlite3/**/*',
  ],
  directories: {
    output: 'dist/desktop',
    buildResources: 'build',
  },
  files: ['package.json', 'electron/**/*', '.next/standalone/**/*'],
  publish: {
    provider: 'github',
    owner: 'dedkola',
    repo: 'bladevault',
    releaseType: 'release',
  },
  mac: {
    category: 'public.app-category.utilities',
    target: ['dmg', 'zip'],
    artifactName: 'BladeVault.${ext}',
    identity: isUnsignedMacBuild ? null : undefined,
    hardenedRuntime: isMacSigningEnabled,
    gatekeeperAssess: false,
    entitlements: path.join('build', 'entitlements.mac.plist'),
    entitlementsInherit: path.join('build', 'entitlements.mac.inherit.plist'),
  },
  dmg: {
    background: 'background.png',
    window: {
      width: dmgWindow.width,
      height: dmgWindow.height,
    },
    contents: dmgContents,
    iconSize: 108,
    iconTextSize: 15,
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
    artifactName: 'BladeVault.${ext}',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
}

module.exports = config
