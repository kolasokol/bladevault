const fs = require('fs')
const path = require('path')
const { generateDmgBackground } = require('./generate-dmg-background.cjs')

const projectRoot = process.cwd()
const standaloneRoot = path.join(projectRoot, '.next', 'standalone')
const standaloneStaticRoot = path.join(standaloneRoot, '.next', 'static')
const nextStaticRoot = path.join(projectRoot, '.next', 'static')
const publicRoot = path.join(projectRoot, 'public')
const standalonePublicRoot = path.join(standaloneRoot, 'public')

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `Missing ${label} at ${targetPath}. Run "npm run build" first.`,
    )
  }
}

function copyDirectory(source, destination) {
  fs.rmSync(destination, { force: true, recursive: true })
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, { recursive: true })
}

async function main() {
  ensureExists(standaloneRoot, 'standalone build output')
  ensureExists(nextStaticRoot, 'Next static output')

  copyDirectory(nextStaticRoot, standaloneStaticRoot)

  if (fs.existsSync(publicRoot)) {
    copyDirectory(publicRoot, standalonePublicRoot)
  }

  await generateDmgBackground()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
