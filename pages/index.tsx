import Head from 'next/head'

import { Inter } from 'next/font/google'
import { MonitorState, MonitorTarget } from '@/types/config'
import { KVNamespace } from '@cloudflare/workers-types'
import { maintenances, pageConfig, workerConfig } from '@/uptime.config'
import OverallStatus from '@/components/OverallStatus'
import Header from '@/components/Header'
import MonitorList from '@/components/MonitorList'
import { Center, Text } from '@mantine/core'
import MonitorDetail from '@/components/MonitorDetail'
import mock from '@/mock/state.json'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import classes from '@/styles/Home.module.css'

const inter = Inter({ subsets: ['latin'] })

export default function Home({
  state: stateStr,
  monitors,
}: {
  state: string
  monitors: MonitorTarget[]
  tooltip?: string
  statusPageLink?: string
}) {
  let state
  if (stateStr !== undefined) {
    state = JSON.parse(stateStr) as MonitorState
  }

  // Specify monitorId in URL hash to view a specific monitor (can be used in iframe)
  const monitorId = window.location.hash.substring(1)
  if (monitorId) {
    const monitor = monitors.find((monitor) => monitor.id === monitorId)
    if (!monitor || !state) {
      return <Text fw={700}>Monitor with id {monitorId} not found!</Text>
    }
    return (
      <div className={classes.embeddedView}>
        <MonitorDetail monitor={monitor} state={state} />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{pageConfig.title}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={`${inter.className} ${classes.page}`}>
        <Header />

        {state == undefined ? (
          <Center className={classes.errorState}>
            <Text fw={700}>
              Monitor State is not defined now, please check your worker&apos;s status and KV
              binding!
            </Text>
          </Center>
        ) : (
          <div className={classes.content}>
            <OverallStatus state={state} monitors={monitors} maintenances={maintenances} />
            <MonitorList monitors={monitors} state={state} />
          </div>
        )}

        <footer className={classes.footer}>
          <span>Powered by</span>{' '}
          <a href="https://github.com/lyc8503/UptimeFlare" target="_blank" rel="noreferrer">
            UptimeFlare
          </a>{' '}
          <span>and</span>{' '}
          <a href="https://www.cloudflare.com/" target="_blank" rel="noreferrer">
            Cloudflare
          </a>
          <span className={classes.footerDivider}>·</span>
          <a href="https://github.com/lbenicio" target="_blank" rel="noreferrer">
            Made by lbenicio
          </a>
        </footer>
      </main>
    </>
  )
}

export async function getServerSideProps() {
  let state: MonitorState

  if (process.env.NODE_ENV !== 'development') {
    const ctx = await getCloudflareContext({ async: true })
    const { UPTIMEFLARE_STATE } = ctx.env as unknown as {
      UPTIMEFLARE_STATE: KVNamespace
    }

    // Read state as string from KV, to avoid hitting server-side cpu time limit
    state = (await UPTIMEFLARE_STATE?.get('state')) as unknown as MonitorState
  } else {
    state = JSON.stringify(mock) as unknown as MonitorState
  }

  // Only present these values to client
  const monitors = workerConfig.monitors.map((monitor) => {
    return {
      id: monitor.id,
      name: monitor.name,
      // @ts-ignore
      tooltip: monitor?.tooltip,
      // @ts-ignore
      statusPageLink: monitor?.statusPageLink,
      // @ts-ignore
      hideLatencyChart: monitor?.hideLatencyChart,
    }
  })

  return { props: { state, monitors } }
}
