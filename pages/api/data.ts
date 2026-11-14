import { workerConfig } from '@/uptime.config'
import { MonitorState } from '@/types/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import mock from '@/mock/state.json'
import { readMonitorState } from '@/lib/monitor-state'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const state =
    process.env.NODE_ENV !== 'development'
      ? await (async () => {
          const { env } = await getCloudflareContext({ async: true })
          const { UPTIMEFLARE_DB } = env as { UPTIMEFLARE_DB: D1Database }
          return await readMonitorState(UPTIMEFLARE_DB)
        })()
      : (mock as MonitorState)

  if (!state) {
    res.status(503).json({ error: 'No data available yet' })
    return
  }

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
