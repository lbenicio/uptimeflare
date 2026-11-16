import '@mantine/core/styles.css'
import type { AppProps } from 'next/app'
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core'
import NoSsr from '@/components/NoSsr'
import '@/styles/globals.css'

const colorSchemeManager = localStorageColorSchemeManager({ key: 'uptimeflare-color-scheme' })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NoSsr>
      <MantineProvider colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
        <Component {...pageProps} />
      </MantineProvider>
    </NoSsr>
  )
}
