import { readFile, writeFile } from 'node:fs/promises'

const databaseId = process.argv[2]
const placeholder = '00000000-0000-0000-0000-000000000000'

if (!databaseId || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(databaseId)) {
  throw new Error('Pass the D1 database UUID as the first argument.')
}

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
