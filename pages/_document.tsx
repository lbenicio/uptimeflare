import { Head, Html, Main, NextScript } from 'next/document'
import { ColorSchemeScript } from '@mantine/core'
import Script from 'next/script'

export default function Document() {
  const analyticsScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL
  const analyticsWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

  return (
    <Html lang="en">
      <Head>
        <ColorSchemeScript defaultColorScheme="auto" localStorageKey="uptimeflare-color-scheme" />
      </Head>
      <body>
        <Main />
        <NextScript />
        {analyticsScriptUrl && analyticsWebsiteId ? (
          <Script
            src={analyticsScriptUrl}
            strategy="afterInteractive"
            data-website-id={analyticsWebsiteId}
          />
        ) : null}
      </body>
    </Html>
  )
}
