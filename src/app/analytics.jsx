'use client'
import React from 'react'
import Script from "next/script"
import { usePathname } from 'next/navigation'
import { useRuntimeConfig } from '@/app/runtimeConfig'

function GA({ id }) {
  const pathname = usePathname()
  React.useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', id);
  }, [id])
  React.useEffect(() => {
    if (typeof window.dataLayer === 'undefined') return
    function gtag(){window.dataLayer.push(arguments);}
    gtag({
      event: 'pageview',
      pageUrl: pathname,
    })
  }, [pathname])
  return <Script
    src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
    strategy="lazyOnload"
  />
}

function Matomo({ url, siteId }) {
  const pathname = usePathname()
  React.useEffect(() => {
    var _paq = window._paq = window._paq || [];
    /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    _paq.push(['setTrackerUrl', url+'matomo.php']);
    _paq.push(['setSiteId', siteId]);
  }, [siteId, url])
  React.useEffect(() => {
    if (typeof window._paq === 'undefined') return
    window._paq.push(['setCustomUrl', pathname])
    window._paq.push(['trackPageView'])
  }, [pathname])
  return <Script
    src={`${url}/matomo.js`}
    strategy="lazyOnload"
  />
}

export default function Analytics() {
  const runtimeConfig = useRuntimeConfig()
  return (
    <>
      {runtimeConfig.NEXT_PUBLIC_GA_MEASUREMENT_ID ?
        <GA id={runtimeConfig.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        : null}
      {runtimeConfig.NEXT_PUBLIC_MATOMO_URL && runtimeConfig.NEXT_PUBLIC_MATOMO_SITE_ID ?
        <Matomo url={runtimeConfig.NEXT_PUBLIC_MATOMO_URL} siteId={runtimeConfig.NEXT_PUBLIC_MATOMO_SITE_ID} />
        : null}
    </>
  )
}
