const assert = require('assert/strict')
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
