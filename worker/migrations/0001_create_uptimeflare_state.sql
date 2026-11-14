CREATE TABLE IF NOT EXISTS uptimeflare_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
