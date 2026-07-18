const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')
const { autoUpdater } = require('electron-updater')
const builderConfig = require('../electron-builder.config.cjs')

async function verify() {
  await app.whenReady()

  const windowsTargets = Array.isArray(builderConfig.win?.target)
    ? builderConfig.win.target
    : [builderConfig.win?.target]
  const hasNsisTarget = windowsTargets.some((target) =>
    typeof target === 'string' ? target === 'nsis' : target?.target === 'nsis',
  )

  assert.equal(hasNsisTarget, true, 'Windows must be packaged with NSIS.')

  const installerArtifact = String(builderConfig.nsis?.artifactName || '')
    .replace('${ext}', 'exe')
    .replace('${version}', require('../package.json').version)
  const appExecutable = `${builderConfig.productName}.exe`
  assert.notEqual(
    path.basename(installerArtifact).toLowerCase(),
    appExecutable.toLowerCase(),
    'The NSIS installer filename must differ from the app executable; otherwise NSIS skips closing the running app during upgrades.',
  )
  assert.equal(
    builderConfig.nsis?.include,
    'installer.nsh',
    'Windows upgrades must include the legacy runtime-cache cleanup.',
  )
  const installerInclude = fs.readFileSync(
    path.join(__dirname, '..', 'build', builderConfig.nsis.include),
    'utf8',
  )
  assert.ok(
    installerInclude.includes('\\\\?\\$INSTDIR\\${LEGACY_NEXT_CACHE}'),
    'The NSIS include must remove the legacy cache using an extended-length path.',
  )
  assert.match(
    installerInclude,
    /standalone\\\.next\\cache/,
    'The NSIS include must target the legacy standalone Next cache.',
  )
  const nextConfigSource = fs.readFileSync(
    path.join(__dirname, '..', 'next.config.ts'),
    'utf8',
  )
  assert.match(
    nextConfigSource,
    /maximumDiskCacheSize:\s*0/,
    'The desktop runtime must not write Next image-cache files inside the installation.',
  )
  assert.equal(
    builderConfig.publish?.provider,
    'github',
    'The updater feed must use the GitHub provider.',
  )
  assert.equal(
    typeof autoUpdater.checkForUpdates,
    'function',
    'electron-updater did not load in Electron.',
  )
  assert.equal(
    typeof autoUpdater.quitAndInstall,
    'function',
    'The NSIS install handoff is unavailable.',
  )

  console.log('Windows updater integration check passed.')
}

verify()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
