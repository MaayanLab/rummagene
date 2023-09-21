import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

const identity = <T>(item: T) => item
type Codec<T> = {
  encode: (decoded: T) => string,
  decode: (encoded: string) => T,
}
export const JsonCodec = { encode: JSON.stringify, decode: JSON.parse }
export const StringCodec = { encode: identity, decode: identity }

export function useQsState<T>(paramName: string, initialState: T, codec_?: Codec<T>) {
  const codec = codec_ !== undefined ? codec_ : (typeof initialState === 'string') ? StringCodec : JsonCodec
  const router = useRouter()
  const searchParams = useSearchParams()
  const [paramValue, setParamValue] = React.useState(initialState)
  React.useEffect(() => {
    const value = searchParams?.get(paramName)
    if (value === undefined || value === null) {
      setParamValue(initialState)
    } else {
      setParamValue(codec.decode(value))
    }
  }, [searchParams, paramName, initialState, codec])
  const setParam = React.useCallback((paramValue: T) => {
    const url = new URLSearchParams(window.location.search)
    url.set(paramName, codec.encode(paramValue))
    router.replace(window.location.pathname + '?' + url.toString(), { scroll: false })
  }, [router, paramName, codec])
  return [paramValue, setParam] as const
}
