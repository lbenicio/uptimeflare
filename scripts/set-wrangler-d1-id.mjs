import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

const databaseName = 'uptimeflare_state'
const placeholder = '00000000-0000-0000-0000-000000000000'
const databaseIdPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

function discoverDatabaseId() {
  let databases

  try {
    const output = execFileSync('wrangler', ['d1', 'list', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    databases = JSON.parse(output)
  } catch {
    throw new Error(
      'Could not list D1 databases. Ensure the Cloudflare build token has D1 access and is available to Wrangler during the build.',
    )
  }

  if (!Array.isArray(databases)) {
    throw new Error('Wrangler returned an unexpected D1 database list.')
  }

  const matches = databases.filter((database) => database.name === databaseName)
  if (matches.length !== 1 || !databaseIdPattern.test(matches[0]?.uuid ?? '')) {
    throw new Error(
      `Expected exactly one D1 database named "${databaseName}" with a valid UUID.`,
    )
  }

  return matches[0].uuid
}

const databaseId = discoverDatabaseId()

const configs = [
  {
    path: new URL('../wrangler.jsonc', import.meta.url),
    placeholderValue: `"database_id": "${placeholder}"`,
    databaseValue: `"database_id": "${databaseId}"`,
  },
  {
    path: new URL('../worker/wrangler.toml', import.meta.url),
    placeholderValue: `database_id = "${placeholder}"`,
    databaseValue: `database_id = "${databaseId}"`,
  },
]

for (const { path, placeholderValue, databaseValue } of configs) {
  const config = await readFile(path, 'utf8')
  if (config.includes(placeholderValue)) {
    await writeFile(path, config.replace(placeholderValue, databaseValue))
  } else if (!config.includes(databaseValue)) {
    throw new Error(`Could not find the D1 database ID placeholder in ${path.pathname}.`)
  }
}

console.log(`Resolved D1 binding ${databaseName} for Wrangler.`)
