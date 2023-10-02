'use client'
import React from 'react'
import useSWR from 'swr/immutable'

const fallbackRuntimeConfig = {
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ? process.env.NEXT_PUBLIC_URL  : '',
}
const RuntimeConfigContext = React.createContext(fallbackRuntimeConfig)

export async function fetchRuntimeConfig(baseUrl: string) {
  const req = await fetch(`${baseUrl}/api/config`, { headers: { 'Content-Type': 'application/json' } })
  return await req.json() as typeof fallbackRuntimeConfig
}

export function RuntimeConfig({ children }: React.PropsWithChildren<{}>) {
  const { data: runtimeConfig } = useSWR(() => window.location.origin, fetchRuntimeConfig)
  return (
    <RuntimeConfigContext.Provider value={runtimeConfig ? runtimeConfig : fallbackRuntimeConfig}>
      {children}
    </RuntimeConfigContext.Provider>
  )
}

export function useRuntimeConfig() {
  return React.useContext(RuntimeConfigContext)
}
