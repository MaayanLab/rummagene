import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

export default function useQsState(initialState: Record<string, string | null>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [paramValue, setParamValue] = React.useState(initialState)
  React.useEffect(() => {
    if (searchParams === null) return
    const params: Record<string, string | null> = {}
    searchParams.forEach((v, k) => {
      params[k] = v
    })
    setParamValue(currentState => {
      const newState = {...currentState}
      searchParams.forEach((v, k) => {
        newState[k] = v
      })
      return newState
    })
  }, [searchParams])
  const setParams = React.useCallback((params: Record<string, string | null>) => {
    const url = new URLSearchParams(window.location.search)
    for (const k in params) {
      const v = params[k]
      if (v === null) {
        url.delete(k)
      } else {
        url.set(k, v)
      }
    }
    router.replace(window.location.pathname + '?' + url.toString(), { scroll: false })
  }, [router])
  return [paramValue, setParams] as const
}
