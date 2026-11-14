import { Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import { MonitorState, MonitorTarget } from '@/types/config'
import DetailChart from './DetailChart'
import DetailBar from './DetailBar'
import { getColor } from '@/util/color'
import { maintenances } from '@/uptime.config'
import classes from '@/styles/MonitorDetail.module.css'

export default function MonitorDetail({
  monitor,
  state,
}: {
  monitor: MonitorTarget
  state: MonitorState
}) {
  const incidents = state.incident[monitor.id] ?? []
  const latency = state.latency[monitor.id]

  if (!latency || incidents.length === 0) {
    return (
      <div className={classes.emptyState}>
        <Text className={classes.monitorName}>{monitor.name}</Text>
        <Text className={classes.noData}>
          No monitor history is available yet. Check that your worker has deployed the latest config.
        </Text>
      </div>
    )
  }

  const latestIncident = incidents.at(-1)!
  let status: 'up' | 'down' | 'maintenance' = latestIncident.end === undefined ? 'down' : 'up'
  const now = new Date()
  const hasMaintenance = maintenances.some(
    (maintenance) =>
      now >= new Date(maintenance.start) &&
      (!maintenance.end || now <= new Date(maintenance.end)) &&
      maintenance.monitors?.includes(monitor.id)
  )
  if (hasMaintenance) status = 'maintenance'

  const StatusIcon =
    status === 'down'
      ? IconAlertCircle
      : status === 'maintenance'
        ? IconAlertTriangle
        : IconCircleCheck
  const totalTime = Math.max(1, Date.now() / 1000 - incidents[0].start[0])
  const downTime = incidents.reduce(
    (total, incident) => total + (incident.end ?? Date.now() / 1000) - incident.start[0],
    0
  )
  const uptimePercent = Math.max(0, Math.min(100, ((totalTime - downTime) / totalTime) * 100))
  const formattedUptime = uptimePercent.toFixed(2)

  const monitorName = (
    <Text component="span" className={classes.monitorName}>
      <StatusIcon
        className={classes.statusIcon}
        data-status={status}
        size={17}
        stroke={2}
        aria-hidden="true"
      />
      {monitor.statusPageLink ? (
        <a
          href={monitor.statusPageLink}
          target="_blank"
          rel="noreferrer"
          className={classes.monitorLink}
        >
          {monitor.name}
        </a>
      ) : (
        <span>{monitor.name}</span>
      )}
    </Text>
  )

  return (
    <div className={classes.monitor}>
      <div className={classes.monitorHeader}>
        {monitor.tooltip ? <Tooltip label={monitor.tooltip}>{monitorName}</Tooltip> : monitorName}
        <div className={classes.uptime} style={{ color: getColor(formattedUptime, true) }}>
          <span className={classes.uptimeLabel}>90-day uptime</span>
          <span>{formattedUptime}%</span>
        </div>
      </div>

      <DetailBar monitor={monitor} state={state} />
      {!monitor.hideLatencyChart && <DetailChart monitor={monitor} state={state} />}
    </div>
  )
}
