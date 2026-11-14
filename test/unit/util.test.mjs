import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchTimeout,
  formatStatusChangeNotification,
  getWorkerLocation,
  notifyWithApprise,
  withTimeout,
} from '../../worker/src/util.ts'

describe('worker utilities', () => {
  it('extracts a colo from the Cloudflare trace response', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('fl=abc\ncolo=GRU\n'))
    assert.equal(await getWorkerLocation(), 'GRU')
  })

  it('returns undefined when the trace response has no colo', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('fl=abc\n'))
    assert.equal(await getWorkerLocation(), undefined)
  })

  it('fetches and clears its timeout after success', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal)
      return new Response('ok')
    })
    assert.equal(await (await fetchTimeout('https://example.test', 100)).text(), 'ok')
    assert.equal(fetchMock.mock.callCount(), 1)
  })

  it('propagates an upstream abort through a local abort signal', async (t) => {
    t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const upstream = new AbortController()
    const pending = fetchTimeout('https://example.test', 1000, { signal: upstream.signal })
    upstream.abort()
    await assert.rejects(pending, { name: 'AbortError' })
  })

  it('aborts fetch when its timeout expires', async (t) => {
    let observedSignal
    t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_resolve, reject) => {
      observedSignal = options.signal
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    await assert.rejects(fetchTimeout('https://example.test', 5), { name: 'AbortError' })
    assert.equal(observedSignal.aborted, true)
  })

  it('resolves before the withTimeout deadline', async () => {
    assert.equal(await withTimeout(100, Promise.resolve('done')), 'done')
  })

  it('rejects when the withTimeout deadline wins', async () => {
    await assert.rejects(withTimeout(1, new Promise(() => {})), /Promise timed out after 1ms/)
  })

  it('formats a recovery notification', () => {
    assert.deepEqual(
      formatStatusChangeNotification({ name: 'API' }, true, 100, 220, 'OK', 'UTC'),
      {
        title: '✅ API is up!',
        body: 'The service is up again after being down for 2 minutes.',
      },
    )
  })

  it('formats an initial outage notification', () => {
    const result = formatStatusChangeNotification({ name: 'API' }, false, 100, 100, '', 'UTC')
    assert.equal(result.title, '🔴 API is currently down.')
    assert.match(result.body, /Issue: unspecified/)
  })

  it('formats a continuing outage with its reason', () => {
    const result = formatStatusChangeNotification({ name: 'API' }, false, 100, 220, '503', 'UTC')
    assert.equal(result.title, '🔴 API is still down.')
    assert.match(result.body, /Issue: 503/)
  })

  it('sends a successful Apprise notification', async (t) => {
    let request
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      request = { url, options }
      return new Response('', { status: 200 })
    })
    await notifyWithApprise('https://apprise.test/notify', 'mailto://x', 'Title', 'Body')
    assert.equal(request.url, 'https://apprise.test/notify')
    assert.equal(request.options.method, 'POST')
    assert.deepEqual(JSON.parse(request.options.body), {
      urls: 'mailto://x',
      title: 'Title',
      body: 'Body',
      type: 'warning',
      format: 'text',
    })
  })

  it('handles a non-success Apprise response', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('bad request', { status: 400 }))
    await notifyWithApprise('https://apprise.test/notify', 'mailto://x', 'Title', 'Body')
  })

  it('handles an Apprise network error', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline') })
    await notifyWithApprise('https://apprise.test/notify', 'mailto://x', 'Title', 'Body')
  })
})
