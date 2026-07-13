import fs from 'fs'
import os from 'os'
import path from 'path'

type BladeVaultConfig = {
  localDataDir?: string
}

function getConfigRootDir(): string {
  const homeDir = os.homedir().trim()
  if (!homeDir) {
    return process.cwd()
  }

  return path.join(homeDir, 'BladeVault')
}

export function getBladeVaultConfigPath(): string {
  return path.join(getConfigRootDir(), 'config.json')
}

function readConfig(): BladeVaultConfig {
  try {
    const raw = fs.readFileSync(getBladeVaultConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as BladeVaultConfig
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {}
    }

    return {}
  }
}

function normalizeDataDir(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Choose a local data folder before saving.')
  }

  return path.resolve(trimmed)
}

export function getPersistedLocalDataDirPreference(): string | null {
  const configuredDataDir = readConfig().localDataDir
  if (!configuredDataDir || !configuredDataDir.trim()) {
    return null
  }

  return normalizeDataDir(configuredDataDir)
}

export function savePersistedLocalDataDirPreference(
  nextDataDir: string | null,
): string | null {
  const current = readConfig()
  const normalizedDataDir = nextDataDir ? normalizeDataDir(nextDataDir) : null

  if (normalizedDataDir) {
    current.localDataDir = normalizedDataDir
  } else {
    delete current.localDataDir
  }

  fs.mkdirSync(path.dirname(getBladeVaultConfigPath()), { recursive: true })
  fs.writeFileSync(
    getBladeVaultConfigPath(),
    `${JSON.stringify(current, null, 2)}\n`,
    'utf8',
  )

  return normalizedDataDir
}
