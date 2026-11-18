import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { retryD1Write } from '../../lib/d1-write-retry.ts'

function useImmediateTimers(t) {
  const delays = []
  t.mock.method(Math, 'random', () => 0)
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    delays.push(delay)
    queueMicrotask(callback)
    return 0
  })
  t.mock.method(console, 'warn', () => {})
  return delays
}

describe('D1 write retries', () => {
  it('returns immediately when the write succeeds', async () => {
    let attempts = 0
    const result = await retryD1Write(async () => {
      attempts += 1
      return 'saved'
    })

    assert.equal(result, 'saved')
    assert.equal(attempts, 1)
  })

  it('retries transient connection failures with exponential backoff and jitter', async (t) => {
    const delays = useImmediateTimers(t)
    let attempts = 0
    const result = await retryD1Write(async () => {
      attempts += 1
      if (attempts < 3) throw new Error('D1_ERROR: Network connection lost.')
      return 'saved'
    })

    assert.equal(result, 'saved')
    assert.equal(attempts, 3)
    assert.deepEqual(delays, [100, 200])
  })

  it('does not retry non-transient failures', async (t) => {
    useImmediateTimers(t)
    const failure = { message: 'invalid SQL' }
    let attempts = 0

    await assert.rejects(
      retryD1Write(async () => {
        attempts += 1
        throw failure
      }),
      (error) => error === failure
    )
    assert.equal(attempts, 1)
  })

  it('stops after five attempts when the transient failure persists', async (t) => {
    const delays = useImmediateTimers(t)
    const failure = new Error('D1_ERROR: Network connection lost.')
    let attempts = 0

    await assert.rejects(
      retryD1Write(async () => {
        attempts += 1
        throw failure
      }),
      (error) => error === failure
    )
    assert.equal(attempts, 5)
    assert.deepEqual(delays, [100, 200, 400, 800])
  })
})
