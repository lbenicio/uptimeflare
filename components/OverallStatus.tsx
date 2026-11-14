import { MaintenanceConfig, MonitorTarget } from '@/types/config'
import { Container, Text } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import MaintenanceAlert from './MaintenanceAlert'
import classes from '@/styles/OverallStatus.module.css'

function useWindowVisibility() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return isVisible
}

export default function OverallStatus({
  state,
  maintenances,
  monitors,
}: {
  state: { overallUp: number; overallDown: number; lastUpdate: number }
  maintenances: MaintenanceConfig[]
  monitors: MonitorTarget[]
}) {
  const [currentTime, setCurrentTime] = useState(() => Math.round(Date.now() / 1000))
  const isWindowVisible = useWindowVisibility()
  const total = state.overallUp + state.overallDown

  useEffect(() => {
    if (!isWindowVisible) return
    const interval = setInterval(() => setCurrentTime(Math.round(Date.now() / 1000)), 10_000)
    return () => clearInterval(interval)
  }, [isWindowVisible])

  let status: 'up' | 'down' | 'partial' | 'unknown' = 'unknown'
  let statusString = 'No data yet'
  let statusDescription = 'Status data will appear here after the first monitor check.'
  let StatusIcon = IconAlertCircle

  if (total > 0 && state.overallDown === 0) {
    status = 'up'
    statusString = 'All systems operational'
    statusDescription = 'All monitored services are responding normally.'
    StatusIcon = IconCircleCheck
  } else if (state.overallUp === 0 && state.overallDown > 0) {
    status = 'down'
    statusString = 'Systems are experiencing issues'
    statusDescription = 'One or more services are currently unavailable.'
  } else if (state.overallDown > 0) {
    status = 'partial'
    statusString = 'Some systems are experiencing issues'
    statusDescription = `${state.overallDown} of ${total} monitored services need attention.`
    StatusIcon = IconAlertTriangle
  }

  const now = new Date()
  const filteredMaintenances: (Omit<MaintenanceConfig, 'monitors'> & {
    monitors?: MonitorTarget[]
  })[] = maintenances
    .filter(
      (maintenance) =>
        now >= new Date(maintenance.start) && (!maintenance.end || now <= new Date(maintenance.end))
    )
    .map((maintenance) => ({
      ...maintenance,
      monitors: maintenance.monitors
        ?.map((monitorId) => monitors.find((monitor) => monitor.id === monitorId)!)
        .filter(Boolean),
    }))

  const checkedAt = new Date(state.lastUpdate * 1000)
  const secondsAgo = Math.max(0, currentTime - state.lastUpdate)
  const ago =
    secondsAgo < 60
      ? `${secondsAgo}s ago`
      : secondsAgo < 3600
        ? `${Math.floor(secondsAgo / 60)}m ago`
        : `${Math.floor(secondsAgo / 3600)}h ago`

  return (
    <Container fluid className={classes.container}>
      <section className={classes.statusCard} data-status={status} aria-live="polite">
        <div className={classes.statusHeading}>
          <div className={classes.statusCopy}>
            <Text className={classes.eyebrow}>CURRENT STATUS</Text>
            <h1 className={classes.title}>{statusString}</h1>
            <p className={classes.description}>{statusDescription}</p>
          </div>
          <div className={classes.statusIcon} aria-hidden="true">
            <StatusIcon size={27} stroke={1.9} />
          </div>
        </div>

        <div className={classes.statusMeta}>
          <div className={classes.metric}>
            <span className={classes.metricLabel}>Operational</span>
            <span className={classes.metricValue}>{state.overallUp}</span>
          </div>
          <div className={classes.metric}>
            <span className={classes.metricLabel}>Needs attention</span>
            <span className={classes.metricValue}>{state.overallDown}</span>
          </div>
          <div className={`${classes.metric} ${classes.lastCheck}`}>
            <span className={classes.metricLabel}>Last checked</span>
            <span className={classes.metricValue}>{ago}</span>
            <span className={classes.checkedAt}>{checkedAt.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {filteredMaintenances.map((maintenance, index) => (
        <MaintenanceAlert
          key={`${maintenance.title || 'maintenance'}-${index}`}
          maintenance={maintenance}
        />
      ))}
    </Container>
  )
}
