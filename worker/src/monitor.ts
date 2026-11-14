import { MonitorTarget } from '../../types/config';
import type { Status } from './types/status.type';
import { withTimeout, fetchTimeout } from './util';
import { isIP } from 'node:net'
import { checkServerIdentity, connect as tlsConnect } from 'node:tls'

export async function getStatus(
  monitor: MonitorTarget
): Promise<Status> {
  let status: Status = {
    ping: 0,
    up: false,
    err: 'Unknown',
  }

  const startTime: number = Date.now()

  if (monitor.method === 'SSL_CERT') {
    try {
      const target = new URL(monitor.target)
      if (target.protocol !== 'https:') {
        throw new Error('SSL_CERT target must use https://')
      }

      status = await checkCertificate(monitor, target, startTime)
    } catch (e: any) {
      status.ping = Date.now() - startTime
      status.up = false
      status.err = e.name + ': ' + e.message
    }
  } else if (monitor.method === 'TCP_PING') {
    // TCP port endpoint monitor
    try {
      const connect = await import(/* webpackIgnore: true */ 'cloudflare:sockets').then(
        (sockets) => sockets.connect
      )
      // This is not a real https connection, but we need to add a dummy `https://` to parse the hostname & port
      const parsed = new URL('https://' + monitor.target)
      const socket: Socket = connect({ hostname: parsed.hostname, port: Number(parsed.port) })

      // Now we have an `opened` promise!
      await withTimeout(monitor.timeout || 10000, socket.opened)
      await socket.close()

      // console.log(`${monitor.name} connected to ${monitor.target}`)

      status.ping = Date.now() - startTime
      status.up = true
      status.err = ''
    } catch (e: Error | any) {
      console.error(`${monitor.name} errored with ${e.name}: ${e.message}`)
      if (e.message.includes('timed out')) {
        status.ping = monitor.timeout || 10000
      }
      status.up = false
      status.err = e.name + ': ' + e.message
    }
  } else {
    // HTTP endpoint monitor
    try {
      const response: Response = await fetchTimeout(monitor.target, monitor.timeout || 10000, {
        method: monitor.method,
        headers: monitor.headers as any,
        body: monitor.body,
        cf: {
          cacheTtlByStatus: {
            '100-599': -1, // Don't cache any status code, from https://developers.cloudflare.com/workers/runtime-apis/request/#requestinitcfproperties
          },
        },
      })

      // console.log(`${monitor.name} responded with ${response.status}`)
      status.ping = Date.now() - startTime

      if (monitor.expectedCodes) {
        if (!monitor.expectedCodes.includes(response.status)) {
          console.log(`${monitor.name} expected ${monitor.expectedCodes}, got ${response.status}`)
          status.up = false
          status.err = `Expected codes: ${JSON.stringify(monitor.expectedCodes)}, Got: ${
            response.status
          }`
          return status
        }
      } else {
        if (response.status < 200 || response.status > 299) {
          console.log(`${monitor.name} expected 2xx, got ${response.status}`)
          status.up = false
          status.err = `Expected codes: 2xx, Got: ${response.status}`
          return status
        }
      }

      if (monitor.responseKeyword || monitor.responseForbiddenKeyword) {
        // Only read response body if we have a keyword to check
        const responseBody: string = await response.text()

        // MUST contain responseKeyword
        if (monitor.responseKeyword && !responseBody.includes(monitor.responseKeyword)) {
          console.log(
            `${monitor.name} expected keyword ${
              monitor.responseKeyword
            }, not found in response (truncated to 100 chars): ${responseBody.slice(0, 100)}`
          )
          status.up = false
          status.err = "HTTP response doesn't contain the configured keyword"
          return status
        }

        // MUST NOT contain responseForbiddenKeyword
        if (
          monitor.responseForbiddenKeyword &&
          responseBody.includes(monitor.responseForbiddenKeyword)
        ) {
          console.log(
            `${monitor.name} forbidden keyword ${
              monitor.responseForbiddenKeyword
            }, found in response (truncated to 100 chars): ${responseBody.slice(0, 100)}`
          )
          status.up = false
          status.err = 'HTTP response contains the configured forbidden keyword'
          return status
        }
      }

      status.up = true
      status.err = ''
    } catch (e: any) {
      console.error(`${monitor.name} errored with ${e.name}: ${e.message}`)
      if (e.name === 'AbortError') {
        status.ping = monitor.timeout || 10000
        status.up = false
        status.err = `Timeout after ${status.ping}ms`
      } else {
        status.up = false
        status.err = e.name + ': ' + e.message
      }
    }
  }

  return status
}

function checkCertificate(
  monitor: MonitorTarget,
  target: URL,
  startTime: number
): Promise<Status> {
  const timeout = monitor.timeout || 10000
  const port = Number(target.port || 443)

  return new Promise((resolve) => {
    const socket = tlsConnect({
      host: target.hostname,
      port,
      servername: isIP(target.hostname) ? undefined : target.hostname,
      rejectUnauthorized: false,
    })

    let settled = false
    const timeoutId = setTimeout(() => {
      finish(false, `TLS connection timed out after ${timeout}ms`)
    }, timeout)

    const finish = (up: boolean, err = '') => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      const ping = Date.now() - startTime
      socket.destroy()
      resolve({ ping, up, err })
    }

    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate()
      if (!certificate || Object.keys(certificate).length === 0) {
        finish(false, 'TLS connection did not provide a peer certificate')
        return
      }

      const validFrom = Date.parse(certificate.valid_from)
      const validTo = Date.parse(certificate.valid_to)
      const now = Date.now()
      if (!Number.isFinite(validFrom) || !Number.isFinite(validTo)) {
        finish(false, 'TLS certificate has invalid validity dates')
        return
      }
      if (now < validFrom) {
        finish(false, `TLS certificate is not valid until ${certificate.valid_from}`)
        return
      }
      if (now > validTo) {
        finish(false, `TLS certificate expired at ${certificate.valid_to}`)
        return
      }

      const identityError = checkServerIdentity(target.hostname, certificate)
      if (identityError) {
        finish(false, `TLS certificate hostname check failed: ${identityError.message}`)
        return
      }
      if (!socket.authorized) {
        finish(
          false,
          `TLS certificate validation failed: ${socket.authorizationError || 'unknown error'}`
        )
        return
      }

      const warningDays = Math.max(0, monitor.certificateExpiryWarningDays ?? 30)
      const remainingDays = Math.ceil((validTo - now) / (24 * 60 * 60 * 1000))
      if (remainingDays <= warningDays) {
        finish(false, `TLS certificate expires soon on ${certificate.valid_to}`)
        return
      }

      finish(true)
    })

    socket.once('error', (error: Error) => {
      finish(false, `TLS connection failed: ${error.message}`)
    })
  })
}
