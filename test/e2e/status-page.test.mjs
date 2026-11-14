import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

let serverProcess
let baseUrl
let output = ''

async function getFreePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitForServer(url, processRef, getOutput) {
  const deadline = Date.now() + 90000
  let lastError
  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready (code ${processRef.exitCode}).\n${getOutput()}`)
    }
    try {
      const response = await fetch(url)
      if (response.status < 500) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Next.js did not become ready: ${lastError}\n${getOutput()}`)
}

describe('Uptimeflare web app end-to-end', () => {
  before(async () => {
    const port = await getFreePort()
    baseUrl = `http://127.0.0.1:${port}`
    serverProcess = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'development',
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    serverProcess.stdout.setEncoding('utf8')
    serverProcess.stderr.setEncoding('utf8')
    serverProcess.stdout.on('data', (chunk) => { output += chunk })
    serverProcess.stderr.on('data', (chunk) => { output += chunk })
    await waitForServer(`${baseUrl}/api/data`, serverProcess, () => output)
  }, { timeout: 120000 })

  after(() => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM')
    }
  })

  it('serves the status API from the application using mock state', async () => {
    const response = await fetch(`${baseUrl}/api/data`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
    assert.match(response.headers.get('content-type'), /application\/json/)
    const data = await response.json()
    assert.equal(typeof data.up, 'number')
    assert.equal(typeof data.down, 'number')
    assert.equal(typeof data.updatedAt, 'number')
    assert.ok(data.monitors.homepage)
    assert.equal(typeof data.monitors.homepage.up, 'boolean')
    assert.equal(typeof data.monitors.homepage.latency, 'number')
    assert.equal(typeof data.monitors.homepage.location, 'string')
  })

  it('renders the public status page and footer', async () => {
    const response = await fetch(baseUrl)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /<div id="__next">/)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\\/json">([^<]+)<\\/script>/)
    assert.ok(nextDataMatch, 'Next.js hydration payload should be present')
    const nextData = JSON.parse(nextDataMatch[1])
    const props = nextData.props.pageProps
    assert.ok(props.state, 'status state should be passed to the page')
    assert.equal(props.monitors.find((monitor) => monitor.id === 'homepage')?.name, 'About me')
  })
})
