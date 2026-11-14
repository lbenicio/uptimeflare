import type { MonitorState } from '../types/config'

const STATE_ROW_ID = 1

export function createInitialMonitorState(): MonitorState {
  return {
    version: 1,
    lastUpdate: 0,
    overallUp: 0,
    overallDown: 0,
    incident: {},
    latency: {},
    certificates: {},
  }
}

export async function readMonitorState(db: D1Database): Promise<MonitorState | null> {
  const row = await db
    .prepare('SELECT state_json FROM uptimeflare_state WHERE id = ?')
    .bind(STATE_ROW_ID)
    .first<{ state_json: string }>()

  return row ? (JSON.parse(row.state_json) as MonitorState) : null
}

export async function readOrCreateMonitorState(db: D1Database): Promise<MonitorState> {
  const storedState = await readMonitorState(db)
  if (storedState) return storedState
  return createInitialMonitorState()
}

export async function writeMonitorState(db: D1Database, state: MonitorState): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uptimeflare_state (id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`
    )
    .bind(STATE_ROW_ID, JSON.stringify(state), state.lastUpdate)
    .run()
}
