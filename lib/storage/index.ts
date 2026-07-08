import { LocalStorage } from './local'
import { Storage } from './types'

let localInstance: LocalStorage | null = null

export function getStorage(): Storage {
  if (!localInstance) {
    localInstance = new LocalStorage()
  }
  return localInstance
}

export function clearStorageCache(): void {
  localInstance = null
}

export * from './types'
