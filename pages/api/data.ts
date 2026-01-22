import { workerConfig } from '@/uptime.config'
import { MonitorState } from '@/types/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import mock from '@/mock/state.json'
import type { KVNamespace } from '@cloudflare/workers-types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // In production, read from the Cloudflare KV binding via OpenNext.
  // In development, fall back to the local `mock` to avoid failing when KV isn't available.
  const stateStr =
    process.env.NODE_ENV !== 'development'
      ? await (async () => {
          const { env } = await getCloudflareContext({ async: true })
          const UPTIMEFLARE_STATE = env.UPTIMEFLARE_STATE as KVNamespace
          return await UPTIMEFLARE_STATE?.get('state')
        })()
      : JSON.stringify(mock)

  if (!stateStr) {
    res.status(500).json({ error: 'No data available' })
    return
  }
  const state = JSON.parse(stateStr) as MonitorState

  const monitors: Record<string, any> = {}

  for (const monitor of workerConfig.monitors) {
    const lastIncident = state.incident[monitor.id].slice(-1)[0]
    const isUp = lastIncident.end !== undefined
    const lastLatency = state.latency[monitor.id].recent.slice(-1)[0]
    monitors[monitor.id] = {
      up: isUp,
      latency: lastLatency.ping,
      location: lastLatency.loc,
      message: isUp ? 'OK' : lastIncident.error.slice(-1)[0],
    }
  }

  const ret = {
    up: state.overallUp,
    down: state.overallDown,
    updatedAt: state.lastUpdate,
    monitors,
  }

  res.setHeader('Content-Type', 'application/json')
  res.status(200).send(JSON.stringify(ret))
}
