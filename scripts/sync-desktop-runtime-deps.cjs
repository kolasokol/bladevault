const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()
const rootNodeModules = path.join(projectRoot, 'node_modules')
const standaloneNodeModules = path.join(
  projectRoot,
  '.next',
  'standalone',
  'node_modules',
)
const tracedNodeModules = path.join(
  projectRoot,
  '.next',
  'standalone',
  '.next',
  'node_modules',
)

const packagesToSync = [
  'better-sqlite3',
  'playwright',
  'playwright-core',
  'sharp',
  '@img',
  'fsevents',
]

function syncPackage(packageName) {
  const source = path.join(rootNodeModules, packageName)
  const destination = path.join(standaloneNodeModules, packageName)

  if (!fs.existsSync(source)) {
    return
  }

  fs.rmSync(destination, { force: true, recursive: true })
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, {
    force: true,
    recursive: true,
  })
}

function materializeTracedAliases() {
  if (!fs.existsSync(tracedNodeModules)) {
    return
  }

  for (const entry of fs.readdirSync(tracedNodeModules)) {
    const aliasPath = path.join(tracedNodeModules, entry)
    const stats = fs.lstatSync(aliasPath)

    if (!stats.isSymbolicLink()) {
      continue
    }

    const linkTarget = fs.readlinkSync(aliasPath)
    const resolvedTarget = path.resolve(path.dirname(aliasPath), linkTarget)

    if (!fs.existsSync(resolvedTarget)) {
      throw new Error(
        `Missing traced dependency target for ${aliasPath}: ${resolvedTarget}`,
      )
    }

    fs.rmSync(aliasPath, { force: true, recursive: true })
    fs.cpSync(resolvedTarget, aliasPath, {
      dereference: true,
      force: true,
      recursive: true,
    })
  }
}

if (!fs.existsSync(standaloneNodeModules)) {
  throw new Error(
    `Missing standalone node_modules at ${standaloneNodeModules}. Run "npm run build:desktop" first.`,
  )
}

for (const packageName of packagesToSync) {
  syncPackage(packageName)
}

materializeTracedAliases()
