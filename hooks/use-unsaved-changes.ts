'use client'

import { useCallback, useEffect, useRef } from 'react'

const DISCARD_MESSAGE = 'Discard your unsaved changes?'

export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty)
  const navigationAllowedRef = useRef(false)

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || navigationAllowedRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        !isDirtyRef.current ||
        navigationAllowedRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      ) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      if (destination.href === window.location.href) return

      if (window.confirm(DISCARD_MESSAGE)) {
        navigationAllowedRef.current = true
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [])

  const confirmDiscard = useCallback(() => {
    if (!isDirtyRef.current || navigationAllowedRef.current) return true
    if (!window.confirm(DISCARD_MESSAGE)) return false

    navigationAllowedRef.current = true
    return true
  }, [])

  const allowNavigation = useCallback(() => {
    navigationAllowedRef.current = true
  }, [])

  return { allowNavigation, confirmDiscard }
}
