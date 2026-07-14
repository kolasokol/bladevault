'use client'

import { useCallback, useEffect, useState } from 'react'

const idleStatus: BladeVaultUpdateStatus = { status: 'idle' }

export function useDesktopUpdates() {
  const [update, setUpdate] = useState<BladeVaultUpdateStatus>(idleStatus)

  useEffect(() => {
    const desktop = window.bladevaultDesktop
    if (!desktop) return

    let active = true
    void desktop.getUpdateStatus().then((status) => {
      if (active) setUpdate(status)
    })
    const unsubscribe = desktop.onUpdateStatus((status) => setUpdate(status))

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const checkForUpdates = useCallback(async () => {
    const desktop = window.bladevaultDesktop
    if (!desktop) return null
    const status = await desktop.checkForUpdates()
    setUpdate(status)
    return status
  }, [])

  const downloadUpdate = useCallback(async () => {
    const desktop = window.bladevaultDesktop
    if (!desktop) return null
    const status = await desktop.downloadUpdate()
    setUpdate(status)
    return status
  }, [])

  return { update, checkForUpdates, downloadUpdate }
}
