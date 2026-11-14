import { MonitorState, MonitorTarget } from '@/types/config'
import { Modal, Tooltip } from '@mantine/core'
import { useState } from 'react'
import { getColor } from '@/util/color'
import classes from '@/styles/DetailBar.module.css'

const moment = require('moment')
require('moment-precise-range-plugin')

export default function DetailBar({
  monitor,
  state,
}: {
  monitor: MonitorTarget
  state: MonitorState
}) {
  const [modalOpened, setModalOpened] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState(<div />)
  const incidents = state.incident[monitor.id] ?? []
  const currentTime = Math.round(Date.now() / 1000)
  const monitorStartTime = incidents[0]?.start[0] ?? currentTime

  const overlapLen = (x1: number, x2: number, y1: number, y2: number) =>
    Math.max(0, Math.min(x2, y2) - Math.max(x1, y1))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const bars = []

  for (let index = 89; index >= 0; index--) {
    const dayStart = Math.round(todayStart.getTime() / 1000) - index * 86400
    const dayEnd = dayStart + 86400
    const dayMonitorTime = overlapLen(dayStart, dayEnd, monitorStartTime, currentTime)
    let dayDownTime = 0
    const incidentReasons: string[] = []

    for (const incident of incidents) {
      const incidentStart = incident.start[0]
      const incidentEnd = incident.end ?? currentTime
      const overlap = overlapLen(dayStart, dayEnd, incidentStart, incidentEnd)
      dayDownTime += overlap

      if (overlap > 0) {
        for (let errorIndex = 0; errorIndex < incident.error.length; errorIndex++) {
          let partStart = incident.start[errorIndex]
          let partEnd =
            errorIndex === incident.error.length - 1
              ? incident.end ?? currentTime
              : incident.start[errorIndex + 1]
          partStart = Math.max(partStart, dayStart)
          partEnd = Math.min(partEnd, dayEnd)

          if (overlapLen(dayStart, dayEnd, partStart, partEnd) > 0) {
            const startStr = new Date(partStart * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
            const endStr = new Date(partEnd * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
            incidentReasons.push(`[${startStr}–${endStr}] ${incident.error[errorIndex]}`)
          }
        }
      }
    }

    const dayPercent =
      dayMonitorTime > 0 ? ((dayMonitorTime - dayDownTime) / dayMonitorTime) * 100 : NaN
    const date = new Date(dayStart * 1000)
    const dateLabel = date.toLocaleDateString()
    const hasIncidents = dayDownTime > 0

    bars.push(
      <Tooltip
        multiline
        key={index}
        events={{ hover: true, focus: true, touch: true }}
        label={
          Number.isNaN(dayPercent) ? (
            `No data at ${dateLabel}`
          ) : (
            <>
              <div>
                {dayPercent.toFixed(2)}% on {dateLabel}
              </div>
              {hasIncidents && (
                <div>
                  Down for {moment.preciseDiff(moment(0), moment(dayDownTime * 1000))} · click for
                  details
                </div>
              )}
            </>
          )
        }
      >
        <button
          type="button"
          className={classes.day}
          style={{ backgroundColor: getColor(dayPercent, false) }}
          aria-label={`${dateLabel}: ${Number.isNaN(dayPercent) ? 'no data' : `${dayPercent.toFixed(2)}% uptime`}${hasIncidents ? ', view incident details' : ''}`}
          data-has-incidents={hasIncidents}
          onClick={() => {
            if (!hasIncidents) return
            setModalTitle(`${monitor.name} incidents on ${dateLabel}`)
            setModalContent(
              <div className={classes.incidents}>
                {incidentReasons.map((reason, reasonIndex) => (
                  <p key={reasonIndex}>{reason}</p>
                ))}
              </div>
            )
            setModalOpened(true)
          }}
        />
      </Tooltip>
    )
  }

  return (
    <>
      <div className={classes.historyHeading}>
        <span>90-day history</span>
        <span className={classes.historyLegend}>
          <span>90 days ago</span>
          <span>Today</span>
        </span>
      </div>
      <div
        className={classes.historyBar}
        role="group"
        aria-label={`${monitor.name} 90-day uptime history`}
      >
        {bars}
      </div>
      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title={modalTitle} size="lg">
        {modalContent}
      </Modal>
    </>
  )
}
