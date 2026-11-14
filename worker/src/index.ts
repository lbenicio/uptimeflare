import { workerConfig, maintenances } from '../../uptime.config'
import { formatStatusChangeNotification, getWorkerLocation, notifyWithApprise } from './util'
import { MonitorState, MonitorTarget } from '../../types/config'
import { getStatus } from './monitor'
import { DurableObject } from 'cloudflare:workers'
import { readOrCreateMonitorState, writeMonitorState } from '../../lib/monitor-state'

export interface Env {
  UPTIMEFLARE_DB: D1Database
  REMOTE_CHECKER_DO: DurableObjectNamespace<RemoteChecker>
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ZONE_ID?: string
}

const Worker = {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const workerLocation = (await getWorkerLocation()) || 'ERROR'
    console.log(`Running scheduled event on ${workerLocation}...`)

    // Auxiliary function to format notification and send it via apprise
    let formatAndNotify = async (
      monitor: MonitorTarget,
      isUp: boolean,
      timeIncidentStart: number,
      timeNow: number,
      reason: string
    ) => {
      // Skip notification if monitor is in the skip list
      const skipList = workerConfig.notification?.skipNotificationIds
      if (skipList && skipList.includes(monitor.id)) {
        console.log(
          `Skipping notification for ${monitor.name} (${monitor.id} in skipNotificationIds)`
        )
        return
      }

      // Skip notification if monitor is in maintenance
      const maintenanceList: string[] = maintenances
        .filter(
          (m) =>
            new Date(timeNow * 1000) >= new Date(m.start) &&
            (!m.end || new Date(timeNow * 1000) <= new Date(m.end))
        )
        .map((e) => (e.monitors || []))
        .flat()

      if (maintenanceList.includes(monitor.id)) {
        console.log(`Skipping notification for ${monitor.name} (in maintenance)`)
        return
      }

      if (workerConfig.notification?.appriseApiServer && workerConfig.notification?.recipientUrl) {
        const notification = formatStatusChangeNotification(
          monitor,
          isUp,
          timeIncidentStart,
          timeNow,
          reason,
          workerConfig.notification?.timeZone ?? 'Etc/GMT'
        )
        await notifyWithApprise(
          workerConfig.notification.appriseApiServer,
          workerConfig.notification.recipientUrl,
          notification.title,
          notification.body
        )
      } else {
        console.log(
          `Apprise API server or recipient URL not set, skipping apprise notification for ${monitor.name}`
        )
      }
    }

    // Load status from D1, initializing an empty state for a new installation.
    let state: MonitorState = await readOrCreateMonitorState(env.UPTIMEFLARE_DB)
    state.certificates = state.certificates || {}
    const monitorStateMissing = workerConfig.monitors.some(
      (monitor) =>
        !state.incident[monitor.id] ||
        !state.latency[monitor.id] ||
        (monitor.certificateExpiryWarningDays !== undefined && !state.certificates?.[monitor.id])
    )
    state.overallDown = 0
    state.overallUp = 0

    let statusChanged: boolean = false
    const currentTimeSecond: number = Math.round(Date.now() / 1000)

    // Check each monitor in parallel
    await Promise.all(
      workerConfig.monitors.map(async (monitor) => {
        // console.log(`[${workerLocation}] Checking ${monitor.name}...`)

        let monitorStatusChanged: boolean = false
        let checkLocation: string = workerLocation
        let status

        if (monitor.checkProxy) {
          // Initiate a check using proxy (Geo-specific monitoring)
          try {
            // console.log('Calling check proxy: ' + monitor.checkProxy)
            let resp
            if (monitor.checkProxy.startsWith('worker://')) {
              const doLoc: string = monitor.checkProxy.replace('worker://', '')
              const doId: DurableObjectId = env.REMOTE_CHECKER_DO.idFromName(doLoc)
              const doStub: DurableObjectStub<RemoteChecker> = env.REMOTE_CHECKER_DO.get(doId, {
                locationHint: doLoc as DurableObjectLocationHint,
              })
              resp = await doStub.getLocationAndStatus(monitor)
              try {
                // Kill the DO instance after use, to avoid extra resource usage
                await doStub.kill()
              } catch (err) {
                // An error here is expected, ignore it
              }
            } else {
              resp = await (
                await fetch(monitor.checkProxy, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(monitor),
                })
              ).json<{ location: string; status: { ping: number; up: boolean; err: string; certificate?: import('../../types/config').CertificateCheck } }>()
            }
            checkLocation = resp.location
            status = resp.status
          } catch (err) {
            console.error('Error calling proxy: ' + err)
            if (monitor.checkProxyFallback) {
              // console.log('Falling back to local check...')
              status = await getStatus(monitor, env)
            } else {
              status = { ping: 0, up: false, err: 'Error initiating check from remote worker' }
            }
          }
        } else {
          // Initiate a check from the current location
          status = await getStatus(monitor, env)
        }

        // const status = await getStatus(monitor, env)
        const currentTimeSecond = Math.round(Date.now() / 1000)

        if (status.certificate) {
          state.certificates![monitor.id] = status.certificate
        }

        // Update counters
        status.up ? state.overallUp++ : state.overallDown++

        // Update incidents
        // Create a dummy incident to store the start time of the monitoring and simplify logic
        state.incident[monitor.id] = state.incident[monitor.id] || [
          {
            start: [currentTimeSecond],
            end: currentTimeSecond,
            error: ['dummy'],
          },
        ]
        // Then lastIncident here must not be undefined
        let lastIncident = state.incident[monitor.id].slice(-1)[0]

        if (status.up) {
          // Current status is up
          // close existing incident if any
          if (lastIncident.end === undefined) {
            lastIncident.end = currentTimeSecond
            monitorStatusChanged = true
            try {
              if (
                // grace period not set OR ...
                workerConfig.notification?.gracePeriod === undefined ||
                // only when we have sent a notification for DOWN status, we will send a notification for UP status (within 30 seconds of possible drift)
                currentTimeSecond - lastIncident.start[0] >=
                  (workerConfig.notification.gracePeriod + 1) * 60 - 30
              ) {
                await formatAndNotify(monitor, true, lastIncident.start[0], currentTimeSecond, 'OK')
              } else {
                // Grace period not met
              }

              // console.log('Calling config onStatusChange callback...')
              await workerConfig.callbacks?.onStatusChange(
                env,
                monitor,
                true,
                lastIncident.start[0],
                currentTimeSecond,
                'OK'
              )
            } catch (e) {
              console.error('Error calling callback: ', e)
            }
          }
        } else {
          // Current status is down
          // open new incident if not already open
          if (lastIncident.end !== undefined) {
            state.incident[monitor.id].push({
              start: [currentTimeSecond],
              end: undefined,
              error: [status.err],
            })
            monitorStatusChanged = true
          } else if (
            lastIncident.end === undefined &&
            lastIncident.error.slice(-1)[0] !== status.err
          ) {
            // append if the error message changes
            lastIncident.start.push(currentTimeSecond)
            lastIncident.error.push(status.err)
            monitorStatusChanged = true
          }

          const currentIncident = state.incident[monitor.id].slice(-1)[0]
          try {
            if (
              // monitor status changed AND...
              (monitorStatusChanged &&
                // grace period not set OR ...
                (workerConfig.notification?.gracePeriod === undefined ||
                  // have sent a notification for DOWN status
                  currentTimeSecond - currentIncident.start[0] >=
                    (workerConfig.notification.gracePeriod + 1) * 60 - 30)) ||
              // grace period is set AND...
              (workerConfig.notification?.gracePeriod !== undefined &&
                // grace period is met
                currentTimeSecond - currentIncident.start[0] >=
                  workerConfig.notification.gracePeriod * 60 - 30 &&
                currentTimeSecond - currentIncident.start[0] <
                  workerConfig.notification.gracePeriod * 60 + 30)
            ) {
              await formatAndNotify(
                monitor,
                false,
                currentIncident.start[0],
                currentTimeSecond,
                status.err
              )
            } else {
              // Grace period not met
            }

            if (monitorStatusChanged) {
              // console.log('Calling config onStatusChange callback...')
              await workerConfig.callbacks?.onStatusChange(
                env,
                monitor,
                false,
                currentIncident.start[0],
                currentTimeSecond,
                status.err
              )
            }
          } catch (e) {
            console.error('Error calling callback: ', e)
          }

          try {
            // console.log('Calling config onIncident callback...')
            await workerConfig.callbacks?.onIncident(
              env,
              monitor,
              currentIncident.start[0],
              currentTimeSecond,
              status.err
            )
          } catch (e) {
            console.error('Error calling callback: ', e)
          }
        }

        // append to latency data
        let latencyLists = state.latency[monitor.id] || {
          recent: [],
        }
        latencyLists.all = []

        const record = {
          loc: checkLocation,
          ping: status.ping,
          time: currentTimeSecond,
        }
        latencyLists.recent.push(record)

        // discard old data
        while (latencyLists.recent[0]?.time < currentTimeSecond - 12 * 60 * 60) {
          latencyLists.recent.shift()
        }
        state.latency[monitor.id] = latencyLists

        // discard old incidents
        let incidentList = state.incident[monitor.id]
        while (
          incidentList.length > 0 &&
          incidentList[0].end &&
          incidentList[0].end < currentTimeSecond - 90 * 24 * 60 * 60
        ) {
          incidentList.shift()
        }

        if (
          incidentList.length == 0 ||
          (incidentList[0].start[0] > currentTimeSecond - 90 * 24 * 60 * 60 &&
            incidentList[0].error[0] != 'dummy')
        ) {
          // put the dummy incident back
          incidentList.unshift({
            start: [currentTimeSecond - 90 * 24 * 60 * 60],
            end: currentTimeSecond - 90 * 24 * 60 * 60,
            error: ['dummy'],
          })
        }
        state.incident[monitor.id] = incidentList

        if (monitorStatusChanged) {
          statusChanged = true
        }
      })
    )

    console.log(
      `statusChanged: ${statusChanged}, lastUpdate: ${state.lastUpdate}, currentTime: ${currentTimeSecond}`
    )
    // Update state
    // Allow for a cooldown period before writing to D1
    if (
      statusChanged ||
      monitorStateMissing ||
      currentTimeSecond - state.lastUpdate >= workerConfig.stateWriteCooldownMinutes * 60 - 10 // Allow for 10 seconds of clock drift
    ) {
      console.log('Updating state...')
      state.lastUpdate = currentTimeSecond
      await writeMonitorState(env.UPTIMEFLARE_DB, state)
    } else {
      console.log('Skipping state update due to cooldown period.')
    }
  },
}

export default Worker

export class RemoteChecker extends DurableObject {
  private env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.env = env
  }

  async getLocationAndStatus(
    monitor: MonitorTarget
  ): Promise<{ location: string; status: { ping: number; up: boolean; err: string; certificate?: import('../../types/config').CertificateCheck } }> {
    const colo = (await getWorkerLocation()) as string
    console.log(`Running remote checker (DurableObject) at ${colo}...`)
    const status = await getStatus(monitor, this.env)
    return {
      location: colo,
      status: status,
    }
  }

  async kill(): Promise<void> {
    // Throwing an error in `blockConcurrencyWhile` will terminate the Durable Object instance
    // https://developers.cloudflare.com/durable-objects/api/state/#blockconcurrencywhile
    this.ctx.blockConcurrencyWhile(async () => {
      throw 'killed'
    })
  }
}
