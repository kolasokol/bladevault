const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, 'build')
const sourcePath = path.join(buildRoot, 'dmg-background.svg')
const backgroundWidth = 540
const backgroundHeight = 420

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function renderBackground(size, outputName) {
  const targetPath = path.join(buildRoot, outputName)
  const height = Math.round(size * (backgroundHeight / backgroundWidth))

  execFileSync(
    'sips',
    [
      '-s',
      'format',
      'png',
      '-z',
      String(height),
      String(size),
      sourcePath,
      '--out',
      targetPath,
    ],
    { stdio: 'ignore' },
  )
}

function generateDmgBackground() {
  if (process.platform !== 'darwin') {
    return
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing DMG background source at ${sourcePath}`)
  }

  if (!commandExists('sips')) {
    throw new Error('sips is required to generate the DMG background on macOS')
  }

  renderBackground(540, 'background.png')
  renderBackground(1080, 'background@2x.png')
}

module.exports = {
  generateDmgBackground,
}

if (require.main === module) {
  generateDmgBackground()
}
