import Head from 'next/head'

import { Inter } from 'next/font/google'
import { MonitorState, MonitorTarget } from '@/types/config'
import type { GetServerSidePropsContext } from 'next'
import { maintenances, pageConfig, workerConfig } from '@/uptime.config'
import OverallStatus from '@/components/OverallStatus'
import Header from '@/components/Header'
import MonitorList from '@/components/MonitorList'
import { Center, Text } from '@mantine/core'
import MonitorDetail from '@/components/MonitorDetail'
import mock from '@/mock/state.json'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import classes from '@/styles/Home.module.css'
import { readMonitorState } from '@/lib/monitor-state'

const inter = Inter({ subsets: ['latin'] })

export default function Home({
  state: stateStr,
  monitors,
}: {
  state: string | null
  monitors: MonitorTarget[]
  tooltip?: string
  statusPageLink?: string
}) {
  let state
  if (stateStr) {
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
              Monitor State is not defined now, please check your worker&apos;s status and D1
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
          <a href="https://github.com/lbenicio" target="_blank" rel="noreferrer">
            Made by lbenicio
          </a>
        </footer>
      </main>
    </>
  )
}

export async function getServerSideProps({ res }: GetServerSidePropsContext) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  let state: MonitorState | null

  if (process.env.NODE_ENV !== 'development') {
    const ctx = await getCloudflareContext({ async: true })
    const { UPTIMEFLARE_DB } = ctx.env as unknown as { UPTIMEFLARE_DB: D1Database }

    state = await readMonitorState(UPTIMEFLARE_DB)
  } else {
    state = mock as MonitorState
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

  return {
    props: { state: state ? JSON.stringify(state) : null, monitors },
  }
}
