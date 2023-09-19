import { useRouter } from 'next/navigation'
import React from 'react'

export function useQsState<T>(paramName: string, initialState: T, opts = { encode: JSON.stringify, decode: JSON.parse }) {
  const router = useRouter()
  const [paramValue, setParamValue] = React.useState(initialState)
  React.useEffect(() => {
    const listener = () => {
      const url = new URLSearchParams(window.location.search)
      const value = url.get(paramName)
      if (value !== null) {
        setParamValue(opts.decode(value))
      }
    }
    listener()
    window.addEventListener('popstate', listener)
    return () => {window.removeEventListener('popstate', listener)}
  }, [paramName, opts])
  const setParam = React.useCallback((paramValue: T) => {
    const url = new URLSearchParams(window.location.search)
    url.set(paramName, opts.encode(paramValue))
    router.replace(window.location.pathname + '?' + url.toString(), { scroll: false })
  }, [router, paramName, opts])
  return [paramValue, setParam] as const
}
