import { MonitorState, MonitorTarget } from '@/types/config'
import { Accordion, Text } from '@mantine/core'
import MonitorDetail from './MonitorDetail'
import { pageConfig } from '@/uptime.config'
import classes from '@/styles/MonitorList.module.css'

function countDownCount(state: MonitorState, ids: string[]) {
  return ids.filter((id) => {
    const latestIncident = state.incident[id]?.at(-1)
    return latestIncident !== undefined && latestIncident.end === undefined
  }).length
}

export default function MonitorList({
  monitors,
  state,
}: {
  monitors: MonitorTarget[]
  state: MonitorState
}) {
  const groups = pageConfig.group
  const groupedMonitor = Boolean(groups && Object.keys(groups).length > 0)

  return (
    <section className={classes.section} aria-labelledby="services-heading">
      <div className={classes.sectionHeading}>
        <div>
          <h2 id="services-heading" className={classes.title}>
            Monitored services
          </h2>
          <p className={classes.description}>Service health and uptime over the last 90 days.</p>
        </div>
        <Text className={classes.count}>
          {monitors.length} {monitors.length === 1 ? 'service' : 'services'}
        </Text>
      </div>

      {groupedMonitor ? (
        <Accordion multiple defaultValue={Object.keys(groups!)} className={classes.accordion}>
          {Object.keys(groups!).map((groupName) => {
            const ids = groups![groupName]
            const groupMonitors = monitors
              .filter((monitor) => ids.includes(monitor.id))
              .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
            const downCount = countDownCount(
              state,
              groupMonitors.map((monitor) => monitor.id)
            )

            return (
              <Accordion.Item key={groupName} value={groupName} className={classes.group}>
                <Accordion.Control>
                  <span className={classes.groupHeading}>
                    <span className={classes.groupName}>{groupName}</span>
                    <span
                      className={classes.groupStatus}
                      data-status={downCount > 0 ? 'issue' : 'up'}
                    >
                      <span className={classes.statusDot} />
                      {groupMonitors.length - downCount} / {groupMonitors.length} operational
                    </span>
                  </span>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={classes.groupServices}>
                    {groupMonitors.map((monitor) => (
                      <article className={classes.service} key={monitor.id}>
                        <MonitorDetail monitor={monitor} state={state} />
                      </article>
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
        </Accordion>
      ) : (
        <div className={classes.serviceList}>
          {monitors.map((monitor) => (
            <article className={classes.service} key={monitor.id}>
              <MonitorDetail monitor={monitor} state={state} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
