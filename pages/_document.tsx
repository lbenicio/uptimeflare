import { Html, Head, Main, NextScript } from 'next/document'
import { ColorSchemeScript } from '@mantine/core'
import Script from 'next/script'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <ColorSchemeScript
          defaultColorScheme="auto"
          localStorageKey="uptimeflare-color-scheme"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
        <Script
          src="https://analytics.4686189.xyz/script.js"
          strategy="afterInteractive"
          data-website-id="8ccc9510-e226-4014-98b2-1bca137c22b4"
        />
      </body>
    </Html>
  )
}
