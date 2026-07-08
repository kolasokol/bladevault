const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, 'build')
const sourcePath = path.join(buildRoot, 'dmg-background.svg')
const backgroundWidth = 920
const backgroundHeight = 720

function renderBackground(size, outputName) {
  const targetPath = path.join(buildRoot, outputName)
  const height = Math.round(size * (backgroundHeight / backgroundWidth))

  return sharp(sourcePath).resize(size, height).png().toFile(targetPath)
}

async function generateDmgBackground() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing DMG background source at ${sourcePath}`)
  }

  await renderBackground(920, 'background.png')
  await renderBackground(1840, 'background@2x.png')
}

module.exports = {
  generateDmgBackground,
}

if (require.main === module) {
  generateDmgBackground().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
