import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createInitialMonitorState,
  readMonitorState,
  readOrCreateMonitorState,
  writeMonitorState,
} from '../../lib/monitor-state.ts'

function databaseWithRow(row) {
  const calls = { prepare: [], bind: [], run: 0 }
  return {
    calls,
    prepare(sql) {
      calls.prepare.push(sql)
      return {
        bind(...values) {
          calls.bind.push(values)
          return {
            async first() { return row },
            async run() { calls.run += 1 },
          }
        },
      }
    },
  }
}

describe('monitor state persistence', () => {
  it('creates a complete empty state', () => {
    assert.deepEqual(createInitialMonitorState(), {
      version: 1,
      lastUpdate: 0,
      overallUp: 0,
      overallDown: 0,
      incident: {},
      latency: {},
      certificates: {},
    })
  })

  it('returns null when no database row exists', async () => {
    const db = databaseWithRow(null)
    assert.equal(await readMonitorState(db), null)
    assert.match(db.calls.prepare[0], /SELECT state_json/)
    assert.deepEqual(db.calls.bind[0], [1])
  })

  it('deserializes existing state', async () => {
    const expected = createInitialMonitorState()
    const db = databaseWithRow({ state_json: JSON.stringify(expected) })
    assert.deepEqual(await readMonitorState(db), expected)
  })

  it('surfaces corrupt persisted JSON', async () => {
    const db = databaseWithRow({ state_json: '{broken' })
    await assert.rejects(readMonitorState(db), SyntaxError)
  })

  it('creates state only when no row exists', async () => {
    assert.deepEqual(await readOrCreateMonitorState(databaseWithRow(null)), createInitialMonitorState())
    const saved = { ...createInitialMonitorState(), lastUpdate: 123 }
    assert.deepEqual(
      await readOrCreateMonitorState(databaseWithRow({ state_json: JSON.stringify(saved) })),
      saved,
    )
  })

  it('writes the state with its timestamp using an upsert', async () => {
    const db = databaseWithRow(null)
    const state = { ...createInitialMonitorState(), lastUpdate: 456 }
    await writeMonitorState(db, state)
    assert.match(db.calls.prepare[0], /ON CONFLICT\(id\) DO UPDATE/)
    assert.deepEqual(db.calls.bind[0], [1, JSON.stringify(state), 456])
    assert.equal(db.calls.run, 1)
  })
})
