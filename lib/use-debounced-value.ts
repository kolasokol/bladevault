'use client'

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [value, delayMs])

  return debouncedValue
}
