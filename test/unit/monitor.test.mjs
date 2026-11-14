import { beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

let tlsBehavior = {}
let socketsConnect = () => ({ opened: Promise.resolve(), close: async () => {} })
let identityCheck = () => undefined
let lastTlsOptions
let lastSocket

mock.module('node:tls', {
  namedExports: {
    connect: (options) => {
      lastTlsOptions = options
      const socket = new EventEmitter()
      socket.authorized = tlsBehavior.authorized ?? true
      socket.authorizationError = tlsBehavior.authorizationError
      socket.destroyCalls = 0
      socket.destroy = () => { socket.destroyCalls += 1 }
      socket.getPeerCertificate = () => tlsBehavior.certificate ?? {
        valid_from: new Date(Date.now() - 86400000).toUTCString(),
        valid_to: new Date(Date.now() + 365 * 86400000).toUTCString(),
        subject: { CN: 'example.test' },
      }
      lastSocket = socket
      if (tlsBehavior.error) {
        process.nextTick(() => socket.emit('error', tlsBehavior.error))
      } else if (tlsBehavior.noEvent !== true) {
        process.nextTick(() => socket.emit('secureConnect'))
      }
      return socket
    },
    checkServerIdentity: (hostname, certificate) => identityCheck(hostname, certificate),
  },
})
globalThis.__uptimeflareSocketsConnect = (...args) => socketsConnect(...args)

beforeEach(() => {
  tlsBehavior = {}
  socketsConnect = () => ({ opened: Promise.resolve(), close: async () => {} })
  identityCheck = () => undefined
})

const { getStatus } = await import('../../worker/src/monitor.ts')

const baseMonitor = {
  id: 'example',
  name: 'Example',
  method: 'GET',
  target: 'https://example.test',
  certificateExpiryWarningDays: 30,
}

function response(body = 'ok', status = 200) {
  return new Response(status === 204 ? null : body, { status })
}

async function runStatus(t, monitor = baseMonitor, cloudflare) {
  t.mock.method(globalThis, 'fetch', async () => response())
  return getStatus(monitor, cloudflare)
}

describe('monitor endpoint checks', () => {
  it('accepts a successful default 2xx response without a certificate check', async (t) => {
    const status = await runStatus(t, { ...baseMonitor, certificateExpiryWarningDays: undefined })
    assert.equal(status.up, true)
    assert.equal(status.err, '')
    assert.equal(status.certificate, undefined)
  })

  it('does not run the certificate check for SSL_CERT method', async (t) => {
    const status = await runStatus(t, { ...baseMonitor, method: 'SSL_CERT' })
    assert.equal(status.up, true)
    assert.equal(status.certificate, undefined)
  })

  it('accepts configured expected codes', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response('', 204))
    const status = await getStatus({ ...baseMonitor, expectedCodes: [204] })
    assert.equal(status.up, true)
  })

  it('rejects a response outside configured expected codes', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response('', 503))
    const status = await getStatus({ ...baseMonitor, expectedCodes: [200] })
    assert.equal(status.up, false)
    assert.match(status.err, /Expected codes/)
  })

  it('rejects a non-2xx response when expected codes are not configured', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response('', 404))
    const status = await getStatus({ ...baseMonitor, certificateExpiryWarningDays: undefined })
    assert.equal(status.up, false)
    assert.equal(status.err, 'Expected codes: 2xx, Got: 404')
  })

  it('checks required response keywords', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response('service ready'))
    const ok = await getStatus({ ...baseMonitor, responseKeyword: 'ready', certificateExpiryWarningDays: undefined })
    assert.equal(ok.up, true)

    const missing = await getStatus({ ...baseMonitor, responseKeyword: 'healthy', certificateExpiryWarningDays: undefined })
    assert.equal(missing.up, false)
    assert.equal(missing.err, "HTTP response doesn't contain the configured keyword")
  })

  it('rejects forbidden response keywords', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response('service degraded'))
    const status = await getStatus({ ...baseMonitor, responseForbiddenKeyword: 'degraded', certificateExpiryWarningDays: undefined })
    assert.equal(status.up, false)
    assert.equal(status.err, 'HTTP response contains the configured forbidden keyword')
  })

  it('reports fetch aborts as monitor timeouts', async (t) => {
    const error = new DOMException('aborted', 'AbortError')
    t.mock.method(globalThis, 'fetch', async () => { throw error })
    const status = await getStatus({ ...baseMonitor, timeout: 25, certificateExpiryWarningDays: undefined })
    assert.equal(status.up, false)
    assert.equal(status.ping, 25)
    assert.equal(status.err, 'Timeout after 25ms')
  })

  it('reports other fetch errors', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline') })
    const status = await getStatus({ ...baseMonitor, certificateExpiryWarningDays: undefined })
    assert.equal(status.up, false)
    assert.equal(status.err, 'Error: offline')
  })

  it('connects to TCP targets and closes successful sockets', async (t) => {
    socketsConnect = () => ({ opened: Promise.resolve(), close: async () => { socketsConnect.closed = true } })
    const status = await getStatus({ ...baseMonitor, method: 'TCP_PING', target: 'example.test:443' })
    assert.equal(status.up, true)
    assert.equal(status.err, '')
    assert.equal(socketsConnect.closed, true)
  })

  it('reports TCP socket failures', async (t) => {
    socketsConnect = () => ({ opened: Promise.reject(new Error('connection refused')), close: async () => {} })
    const status = await getStatus({ ...baseMonitor, method: 'TCP_PING', target: 'example.test:443' })
    assert.equal(status.up, false)
    assert.match(status.err, /connection refused/)
  })

  it('uses the configured timeout for TCP connection timeouts', async (t) => {
    socketsConnect = () => ({ opened: Promise.reject(new Error('Promise timed out after 5ms')), close: async () => {} })
    const status = await getStatus({ ...baseMonitor, method: 'TCP_PING', target: 'example.test:443', timeout: 5 })
    assert.equal(status.up, false)
    assert.equal(status.ping, 5)
  })
})

describe('TLS certificate checks', () => {
  it('validates a trusted certificate and uses SNI for DNS names', async (t) => {
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'valid')
    assert.ok(status.certificate.daysRemaining > 30)
    assert.equal(lastTlsOptions.rejectUnauthorized, true)
    assert.equal(lastTlsOptions.servername, 'example.test')
    assert.equal(lastTlsOptions.port, 443)
    assert.equal(lastSocket.destroyCalls, 1)
  })

  it('omits SNI for IP address targets and respects explicit ports', async (t) => {
    const status = await runStatus(t, { ...baseMonitor, target: 'https://127.0.0.1:8443' })
    assert.equal(status.certificate.status, 'valid')
    assert.equal(lastTlsOptions.servername, undefined)
    assert.equal(lastTlsOptions.port, 8443)
  })

  it('warns when a valid certificate is within the configured expiry window', async (t) => {
    tlsBehavior.certificate = {
      valid_from: new Date(Date.now() - 86400000).toUTCString(),
      valid_to: new Date(Date.now() + 3 * 86400000).toUTCString(),
    }
    const status = await runStatus(t, { ...baseMonitor, certificateExpiryWarningDays: 5 })
    assert.equal(status.certificate.status, 'warning')
    assert.equal(status.certificate.daysRemaining, 3)
    assert.match(status.certificate.error, /expires soon/)
  })

  it('rejects certificates with invalid validity dates', async (t) => {
    tlsBehavior.certificate = { valid_from: 'invalid', valid_to: 'invalid' }
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /invalid validity dates/)
  })

  it('rejects certificates that are not yet valid', async (t) => {
    tlsBehavior.certificate = {
      valid_from: new Date(Date.now() + 86400000).toUTCString(),
      valid_to: new Date(Date.now() + 365 * 86400000).toUTCString(),
    }
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /not valid until/)
  })

  it('rejects expired certificates', async (t) => {
    tlsBehavior.certificate = {
      valid_from: new Date(Date.now() - 365 * 86400000).toUTCString(),
      valid_to: new Date(Date.now() - 86400000).toUTCString(),
    }
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /expired at/)
  })

  it('rejects certificates whose hostname does not match', async (t) => {
    identityCheck = () => new Error('hostname mismatch')
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /hostname check failed/)
  })

  it('rejects untrusted certificates', async (t) => {
    tlsBehavior.authorized = false
    tlsBehavior.authorizationError = 'self-signed certificate'
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /self-signed certificate/)
  })

  it('rejects a TLS connection that has no peer certificate', async (t) => {
    tlsBehavior.certificate = {}
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /did not provide a peer certificate/)
  })

  it('classifies known certificate validation socket errors as invalid', async (t) => {
    tlsBehavior.error = Object.assign(new Error('expired'), { code: 'CERT_HAS_EXPIRED' })
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'invalid')
    assert.match(status.certificate.error, /TLS connection failed/)
  })

  it('classifies ordinary TLS socket errors as unavailable', async (t) => {
    tlsBehavior.error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    const status = await runStatus(t)
    assert.equal(status.certificate.status, 'unavailable')
  })

  it('reports a TLS handshake timeout as unavailable', async (t) => {
    tlsBehavior.noEvent = true
    const status = await runStatus(t, { ...baseMonitor, timeout: 5 })
    assert.equal(status.certificate.status, 'unavailable')
    assert.match(status.certificate.error, /timed out/)
  })

  it('reports non-HTTPS targets as an unavailable certificate check', async (t) => {
    const status = await runStatus(t, { ...baseMonitor, target: 'http://example.test' })
    assert.equal(status.certificate.status, 'unavailable')
    assert.match(status.certificate.error, /require an https/)
  })

  it('falls back to the Cloudflare API when Worker TCP sockets cannot reach port 443', async (t) => {
    tlsBehavior.error = Object.assign(
      new Error('Cannot connect to the specified address'),
      { code: 'EHOSTUNREACH' },
    )
    const calls = []
    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
      calls.push({ url: String(url), options })
      if (String(url) === 'https://www.example.test') return response()
      if (String(url).includes('/zones?')) {
        return Response.json({ success: true, result: [{ id: 'zone/id', name: 'example.test' }] })
      }
      return Response.json({
        success: true,
        result: [{
          hosts: ['*.example.test'],
          status: 'active',
          certificates: [{ expires_on: new Date(Date.now() + 365 * 86400000).toISOString() }],
        }],
        result_info: { total_pages: 1 },
      })
    })
    const status = await getStatus(
      { ...baseMonitor, target: 'https://www.example.test', certificateZoneName: 'example.test' },
      { CLOUDFLARE_API_TOKEN: 'test-token' },
    )
    assert.equal(status.certificate.status, 'valid')
    assert.equal(calls.length, 3)
    assert.ok(calls.every(({ options }) => options.headers?.Authorization === 'Bearer test-token'))
    assert.match(calls[2].url, /zones%2Fid%2Fssl|zones\/zone%2Fid\/ssl/)
  })

  it('returns unavailable when the edge fallback has no API token', async (t) => {
    tlsBehavior.error = Object.assign(new Error('Cannot connect to the specified address'), { code: 'EHOSTUNREACH' })
    const status = await runStatus(t, { ...baseMonitor, certificateZoneName: 'example.test' })
    assert.equal(status.certificate.status, 'unavailable')
    assert.match(status.certificate.error, /CLOUDFLARE_API_TOKEN is required/)
  })

  it('returns unavailable when no active edge certificate matches', async (t) => {
    tlsBehavior.error = Object.assign(new Error('Cannot connect to the specified address'), { code: 'EHOSTUNREACH' })
    t.mock.method(globalThis, 'fetch', async (url) => {
      if (String(url) === baseMonitor.target) return response()
      if (String(url).includes('/zones?')) return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
      return Response.json({ success: true, result: [{ hosts: ['other.test'], status: 'pending' }] })
    })
    const status = await getStatus(
      { ...baseMonitor, certificateZoneName: 'example.test' },
      { CLOUDFLARE_API_TOKEN: 'token' },
    )
    assert.equal(status.certificate.status, 'unavailable')
    assert.match(status.certificate.error, /No active Cloudflare edge certificate/)
  })
})
