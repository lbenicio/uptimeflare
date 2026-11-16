import type { MonitorTarget } from '../../types/config'
import type { Status } from './types/status.type'
import { fetchTimeout, withTimeout } from './util'
import { isIP } from 'node:net'
import { checkServerIdentity, connect as tlsConnect } from 'node:tls'
import type { CertificateCheck } from '../../types/config'

type CloudflareCertificateApi = { apiToken?: string; CLOUDFLARE_API_TOKEN?: string }

export async function getStatus(
  monitor: MonitorTarget,
  cloudflare?: CloudflareCertificateApi
): Promise<Status> {
  const endpointCheck = getEndpointStatus(monitor)
  if (monitor.method === 'SSL_CERT' || monitor.certificateExpiryWarningDays === undefined) {
    return endpointCheck
  }

  const certificateCheck = (async (): Promise<CertificateCheck> => {
    try {
      const target = new URL(monitor.target)
      if (target.protocol !== 'https:') throw new Error('TLS checks require an https:// target')
      return await checkCertificate(monitor, target, cloudflare)
    } catch (error: any) {
      return {
        status: 'unavailable',
        checkedAt: Math.round(Date.now() / 1000),
        error: error.name + ': ' + error.message,
      }
    }
  })()

  const [status, certificate] = await Promise.all([endpointCheck, certificateCheck])
  status.certificate = certificate
  return status
}

async function getEndpointStatus(monitor: MonitorTarget): Promise<Status> {
  let status: Status = {
    ping: 0,
    up: false,
    err: 'Unknown',
  }

  const startTime: number = Date.now()

  if (monitor.method === 'TCP_PING') {
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
  cloudflare?: CloudflareCertificateApi
): Promise<CertificateCheck> {
  const timeout = monitor.timeout || 10000
  const port = Number(target.port || 443)

  return new Promise((resolve) => {
    // Let TLS perform normal CA-chain validation. The old implementation disabled
    // verification and then rejected the socket because it was not authorized.
    const socket = tlsConnect({
      host: target.hostname,
      port,
      servername: isIP(target.hostname) ? undefined : target.hostname,
      rejectUnauthorized: true,
    })

    let settled = false
    const timeoutId = setTimeout(() => {
      finish('unavailable', `TLS connection timed out after ${timeout}ms`)
    }, timeout)

    const finish = (
      status: CertificateCheck['status'],
      error = '',
      expiresAt?: number,
      daysRemaining?: number
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      socket.destroy()
      resolve({
        status,
        checkedAt: Math.round(Date.now() / 1000),
        ...(expiresAt === undefined ? {} : { expiresAt }),
        ...(daysRemaining === undefined ? {} : { daysRemaining }),
        ...(error ? { error } : {}),
      })
    }

    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate()
      if (!certificate || Object.keys(certificate).length === 0) {
        finish('invalid', 'TLS connection did not provide a peer certificate')
        return
      }

      const validFrom = Date.parse(certificate.valid_from)
      const validTo = Date.parse(certificate.valid_to)
      const now = Date.now()
      if (!Number.isFinite(validFrom) || !Number.isFinite(validTo)) {
        finish('invalid', 'TLS certificate has invalid validity dates')
        return
      }
      if (now < validFrom) {
        finish('invalid', `TLS certificate is not valid until ${certificate.valid_from}`)
        return
      }
      if (now > validTo) {
        finish('invalid', `TLS certificate expired at ${certificate.valid_to}`)
        return
      }

      const identityError = checkServerIdentity(target.hostname, certificate)
      if (identityError) {
        finish('invalid', `TLS certificate hostname check failed: ${identityError.message}`)
        return
      }
      if (!socket.authorized) {
        finish(
          'invalid',
          `TLS certificate validation failed: ${socket.authorizationError || 'unknown error'}`
        )
        return
      }

      const warningDays = Math.max(0, monitor.certificateExpiryWarningDays ?? 30)
      const remainingDays = Math.ceil((validTo - now) / (24 * 60 * 60 * 1000))
      if (remainingDays <= warningDays) {
        finish(
          'warning',
          `TLS certificate expires soon on ${certificate.valid_to}`,
          validTo,
          remainingDays
        )
        return
      }

      finish('valid', '', validTo, remainingDays)
    })

    socket.once('error', async (error: Error) => {
      if (
        port === 443 &&
        error.message.toLowerCase().includes('cannot connect to the specified address')
      ) {
        try {
          const remoteStatus = await checkCloudflareEdgeCertificate(
            target.hostname,
            monitor,
            cloudflare
          )
          finish(
            remoteStatus.status,
            remoteStatus.error ?? '',
            remoteStatus.expiresAt,
            remoteStatus.daysRemaining
          )
        } catch (remoteError: any) {
          finish('unavailable', `Cloudflare edge certificate check failed: ${remoteError.message}`)
        }
        return
      }

      const code = (error as NodeJS.ErrnoException).code ?? ''
      const certificateValidationCodes = new Set([
        'CERT_HAS_EXPIRED',
        'CERT_NOT_YET_VALID',
        'CERT_REVOKED',
        'CERT_UNTRUSTED',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'UNABLE_TO_GET_ISSUER_CERT',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      ])
      const invalidCertificate = certificateValidationCodes.has(code)
      finish(
        invalidCertificate ? 'invalid' : 'unavailable',
        `TLS connection failed: ${error.message}`
      )
    })
  })
}

async function checkCloudflareEdgeCertificate(
  hostname: string,
  monitor: MonitorTarget,
  config?: CloudflareCertificateApi
): Promise<CertificateCheck> {
  const apiToken = config?.CLOUDFLARE_API_TOKEN ?? config?.apiToken
  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN is required for the Cloudflare edge certificate check')
  }

  type EdgeCertificate = {
    hosts?: string[]
    status?: string
    expires_on?: string
  }
  type CertificatePack = {
    hosts?: string[]
    status?: string
    certificates?: EdgeCertificate[]
  }
  type CertificatePackResponse = {
    success: boolean
    errors?: { message?: string }[]
    result?: CertificatePack[]
    result_info?: { total_pages?: number }
  }

  const zoneName = monitor.certificateZoneName
  if (!zoneName) throw new Error('certificateZoneName is not set for this monitor')

  const zonesUrl = new URL('https://api.cloudflare.com/client/v4/zones')
  zonesUrl.searchParams.set('name', zoneName)
  zonesUrl.searchParams.set('per_page', '1')
  const zonesResponse = await fetchTimeout(zonesUrl.toString(), monitor.timeout || 10000, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    },
  })
  if (!zonesResponse.ok)
    throw new Error(`Cloudflare Zones API returned HTTP ${zonesResponse.status}`)

  const zonesPayload = (await zonesResponse.json()) as {
    success: boolean
    errors?: { message?: string }[]
    result?: { id: string; name: string }[]
  }
  if (!zonesPayload.success) {
    throw new Error(
      zonesPayload.errors
        ?.map((item) => item.message)
        .filter(Boolean)
        .join('; ') || 'Cloudflare Zones API request failed'
    )
  }
  const zone = zonesPayload.result?.find((result) => result.name === zoneName)
  if (!zone) throw new Error(`Cloudflare zone ${zoneName} was not found for this API token`)

  const packs: CertificatePack[] = []
  const perPage = 50
  for (let page = 1; page <= 20; page++) {
    const endpoint = new URL(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone.id)}/ssl/certificate_packs`
    )
    endpoint.searchParams.set('status', 'all')
    endpoint.searchParams.set('per_page', String(perPage))
    endpoint.searchParams.set('page', String(page))

    const response = await fetchTimeout(endpoint.toString(), monitor.timeout || 10000, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
      },
    })
    if (!response.ok) throw new Error(`Cloudflare API returned HTTP ${response.status}`)

    const payload = (await response.json()) as CertificatePackResponse
    if (!payload.success) {
      throw new Error(
        payload.errors
          ?.map((item) => item.message)
          .filter(Boolean)
          .join('; ') || 'Cloudflare API request failed'
      )
    }
    packs.push(...(payload.result ?? []))
    const totalPages = payload.result_info?.total_pages ?? page
    if (page >= totalPages || (payload.result?.length ?? 0) < perPage) break
  }

  const matchesHostname = (host: string) =>
    host === hostname ||
    (host.startsWith('*.') && hostname.endsWith(host.slice(1)) && hostname.length > host.length - 1)

  const matchingCertificates = packs.flatMap((pack) =>
    (pack.certificates ?? [])
      .map((certificate) => ({
        ...certificate,
        hosts: certificate.hosts?.length ? certificate.hosts : (pack.hosts ?? []),
        status: certificate.status ?? pack.status,
      }))
      .filter((certificate) => (certificate.hosts ?? []).some(matchesHostname))
  )
  const activeCertificates = matchingCertificates
    .filter((certificate) => certificate.status === 'active' && certificate.expires_on)
    .map((certificate) => ({
      ...certificate,
      expiresAt: Date.parse(certificate.expires_on!),
    }))
    .filter((certificate) => Number.isFinite(certificate.expiresAt))

  if (activeCertificates.length === 0) {
    throw new Error('No active Cloudflare edge certificate matched this hostname')
  }

  const expiresAt = Math.min(...activeCertificates.map((certificate) => certificate.expiresAt))
  const daysRemaining = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
  const warningDays = Math.max(0, monitor.certificateExpiryWarningDays ?? 30)
  return {
    status: daysRemaining <= warningDays ? 'warning' : 'valid',
    checkedAt: Math.round(Date.now() / 1000),
    expiresAt,
    daysRemaining,
    ...(daysRemaining <= warningDays
      ? { error: `Cloudflare edge certificate expires in ${daysRemaining} days` }
      : {}),
  }
}
