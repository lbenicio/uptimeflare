import { beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

let tlsError
mock.module('node:tls', {
  namedExports: {
    connect: () => {
      const socket = new EventEmitter()
      socket.destroy = () => {}
      socket.getPeerCertificate = () => ({})
      process.nextTick(() => socket.emit('error', tlsError))
      return socket
    },
    checkServerIdentity: () => undefined,
  },
})

const { getStatus } = await import('../../worker/src/monitor.ts')
const monitor = {
  id: 'edge-cert',
  name: 'Edge cert',
  method: 'GET',
  target: 'https://www.example.test',
  certificateExpiryWarningDays: 30,
  certificateZoneName: 'example.test',
}
const token = { CLOUDFLARE_API_TOKEN: 'test-token' }

beforeEach(() => {
  tlsError = Object.assign(new Error('Cannot connect to the specified address'), { code: 'EHOSTUNREACH' })
})

function apiResponse(scenario, url) {
  if (String(url) === monitor.target) return new Response('ok')
  if (String(url).includes('/zones?')) {
    if (scenario === 'zone-http') return new Response('', { status: 503 })
    if (scenario === 'zone-errors') return Response.json({ success: false, errors: [{ message: 'denied' }, {}] })
    if (scenario === 'zone-errors-empty') return Response.json({ success: false })
    if (scenario === 'zone-not-found') return Response.json({ success: true, result: [] })
    if (scenario === 'zone-missing-result') return Response.json({ success: true })
    return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
  }
  if (scenario === 'packs-http') return new Response('', { status: 503 })
  if (scenario === 'packs-errors') return Response.json({ success: false, errors: [{ message: 'denied' }] })
  if (scenario === 'packs-errors-empty') return Response.json({ success: false })
  if (scenario === 'missing-result') return Response.json({ success: true })
  if (scenario === 'active-no-expiry') {
    return Response.json({ success: true, result: [{ hosts: ['www.example.test'], status: 'active', certificates: [{ hosts: ['www.example.test'], status: 'active' }] }] })
  }
  if (scenario === 'invalid-expiry') {
    return Response.json({
      success: true,
      result: [{ hosts: ['www.example.test'], status: 'active', certificates: [{ expires_on: 'invalid' }] }],
    })
  }
  if (scenario === 'expired-edge-cert') {
    return Response.json({
      success: true,
      result: [{
        hosts: ['www.example.test'],
        status: 'active',
        certificates: [{ expires_on: new Date(Date.now() + 2 * 86400000).toISOString() }],
      }],
    })
  }
  if (scenario === 'wildcard-apex') {
    return Response.json({
      success: true,
      result: [{ hosts: ['*.example.test'], status: 'active', certificates: [{ expires_on: new Date(Date.now() + 365 * 86400000).toISOString() }] }],
    })
  }
  return Response.json({ success: true, result: [] })
}

async function edgeCheck(t, scenario, target = monitor, config = token) {
  t.mock.method(globalThis, 'fetch', async (url) => apiResponse(scenario, url))
  return getStatus(target, config)
}

describe('Cloudflare edge certificate fallback', () => {
  it('handles Cloudflare API errors and incomplete responses', async (t) => {
    let scenario = ''
    t.mock.method(globalThis, 'fetch', async (url) => apiResponse(scenario, url))
    for (const caseName of [
      'zone-http',
      'zone-errors',
      'zone-errors-empty',
      'zone-not-found',
      'zone-missing-result',
      'packs-http',
      'packs-errors',
      'packs-errors-empty',
      'missing-result',
      'active-no-expiry',
      'invalid-expiry',
    ]) {
      scenario = caseName
      const result = await getStatus(monitor, token)
      assert.equal(result.certificate.status, 'unavailable', caseName)
    }
  })

  it('requires a zone name after receiving a Cloudflare token', async (t) => {
    const result = await edgeCheck(t, 'ok', { ...monitor, certificateZoneName: undefined })
    assert.equal(result.certificate.status, 'unavailable')
    assert.match(result.certificate.error, /certificateZoneName is not set/)
  })

  it('matches exact hosts, inherits pack fields, and returns the nearest expiry', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const value = String(url)
      if (value === monitor.target) return new Response('ok')
      if (value.includes('/zones?')) return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
      return Response.json({
        success: true,
        result: [
          {
            hosts: ['www.example.test'],
            status: 'active',
            certificates: [
              { expires_on: new Date(Date.now() + 40 * 86400000).toISOString() },
              { expires_on: new Date(Date.now() + 10 * 86400000).toISOString() },
            ],
          },
        ],
      })
    })
    const result = await getStatus(monitor, { apiToken: 'test-token' })
    assert.equal(result.certificate.status, 'warning')
    assert.equal(result.certificate.daysRemaining, 10)
  })

  it('paginates through full certificate-pack pages and evaluates all returned certificates', async (t) => {
    const pages = []
    t.mock.method(globalThis, 'fetch', async (url) => {
      const value = String(url)
      if (value === monitor.target) return new Response('ok')
      if (value.includes('/zones?')) return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
      const page = new URL(value).searchParams.get('page')
      pages.push(Number(page))
      const expires = new Date(Date.now() + 365 * 86400000).toISOString()
      if (page === '1') {
        return Response.json({
          success: true,
          result: Array.from({ length: 50 }, () => ({
            hosts: ['*.example.test'],
            status: 'active',
            certificates: [{ hosts: [], expires_on: 'invalid' }],
          })),
          result_info: { total_pages: 2 },
        })
      }
      return Response.json({
        success: true,
        result: [{
          hosts: ['www.example.test'],
          status: 'active',
          certificates: [{ hosts: ['www.example.test'], status: 'active', expires_on: expires }],
        }],
        result_info: { total_pages: 2 },
      })
    })
    const result = await getStatus(monitor, token)
    assert.deepEqual(pages, [1, 2])
    assert.equal(result.certificate.status, 'valid')
  })

  it('stops when the current page has fewer than 50 results even if more pages are reported', async (t) => {
    let pageRequests = 0
    t.mock.method(globalThis, 'fetch', async (url) => {
      const value = String(url)
      if (value === monitor.target) return new Response('ok')
      if (value.includes('/zones?')) return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
      pageRequests += 1
      return Response.json({
        success: true,
        result: [{ hosts: ['www.example.test'], status: 'active', certificates: [{ expires_on: new Date(Date.now() + 365 * 86400000).toISOString() }] }],
        result_info: { total_pages: 10 },
      })
    })
    const result = await getStatus(monitor, token)
    assert.equal(pageRequests, 1)
    assert.equal(result.certificate.status, 'valid')
  })

  it('caps certificate pack pagination at twenty pages', async (t) => {
    let pageRequests = 0
    t.mock.method(globalThis, 'fetch', async (url) => {
      const value = String(url)
      if (value === monitor.target) return new Response('ok')
      if (value.includes('/zones?')) return Response.json({ success: true, result: [{ id: 'zone', name: 'example.test' }] })
      pageRequests += 1
      return Response.json({
        success: true,
        result: Array.from({ length: 50 }, () => ({
          hosts: ['www.example.test'],
          status: 'active',
          certificates: [{ expires_on: new Date(Date.now() + 365 * 86400000).toISOString() }],
        })),
        result_info: { total_pages: 21 },
      })
    })
    const result = await getStatus(monitor, token)
    assert.equal(pageRequests, 20)
    assert.equal(result.certificate.status, 'valid')
  })

  it('does not treat a wildcard edge certificate as matching the zone apex', async (t) => {
    const result = await edgeCheck(t, 'wildcard-apex', { ...monitor, target: 'https://example.test' })
    assert.equal(result.certificate.status, 'unavailable')
  })
})
