import { MaintenanceConfig, PageConfig, WorkerConfig } from './types/config'

const pageConfig: PageConfig = {
  // Title for your status page
  title: 'lbenicio status page',
  // Links shown at the header of your status page, could set `highlight` to `true`
  links: [
    { link: 'https://github.com/lbenicio', label: 'GitHub' },
    { link: 'https://blog.lbenicio.dev', label: 'Blog' },
    { link: 'mailto:hi@lbenicio.dev', label: 'Email Me', highlight: true },
  ],
  // [OPTIONAL] Group your monitors
  // If not specified, all monitors will be shown in a single list
  // If specified, monitors will be grouped and ordered, not-listed monitors will be invisble (but still monitored)
  group: {
    // '🌐 Public (example group name)': ['foo_monitor', 'bar_monitor', 'more monitor ids...'],
    // '🔐 Private': ['test_tcp_monitor'],
  },
}

const workerConfig: WorkerConfig = {
  // Write D1 at most every 3 minutes unless the status changed
  stateWriteCooldownMinutes: 3,
  // Enable HTTP Basic auth for status page & API by uncommenting the line below, format `<USERNAME>:<PASSWORD>`
  // passwordProtection: 'username:password',
  // Define all your monitors here
  monitors: [
    // Certificate checks are attached to each HTTPS service and shown inline.
    // Example HTTP Monitor
    {
      // `id` should be unique, history will be kept if the `id` remains constant
      id: 'homepage',
      // `name` is used at status page and callback message
      name: 'About me',
      // `method` should be an HTTP method, TCP_PING, or SSL_CERT
      method: 'GET',
      // `target` is a valid URL
      target: 'https://lbenicio.dev',
      certificateExpiryWarningDays: 30,
      certificateZoneName: 'lbenicio.dev',
      // [OPTIONAL] `tooltip` is ONLY used at status page to show a tooltip
      tooltip: 'My personal website homepage',
      // [OPTIONAL] `statusPageLink` is ONLY used for clickable link at status page
      statusPageLink: 'https://lbenicio.dev',
      // [OPTIONAL] `hideLatencyChart` will hide status page latency chart if set to true
      hideLatencyChart: false,
      // [OPTIONAL] `expectedCodes` is an array of acceptable HTTP response codes, if not specified, default to 2xx
      expectedCodes: [200],
      // [OPTIONAL] `timeout` in millisecond, if not specified, default to 10000
      timeout: 10000,
      // [OPTIONAL] headers to be sent
      headers: {
        'User-Agent': 'Uptimeflare',
      },
    },
    {
      // `id` should be unique, history will be kept if the `id` remains constant
      id: 'blog',
      // `name` is used at status page and callback message
      name: 'Blog',
      // `method` should be a valid HTTP Method
      method: 'GET',
      // `target` is a valid URL
      target: 'https://blog.lbenicio.dev',
      certificateExpiryWarningDays: 30,
      certificateZoneName: 'lbenicio.dev',
      // [OPTIONAL] `tooltip` is ONLY used at status page to show a tooltip
      tooltip: 'My personal blog',
      // [OPTIONAL] `statusPageLink` is ONLY used for clickable link at status page
      statusPageLink: 'https://blog.lbenicio.dev',
      // [OPTIONAL] `hideLatencyChart` will hide status page latency chart if set to true
      hideLatencyChart: false,
      // [OPTIONAL] `expectedCodes` is an array of acceptable HTTP response codes, if not specified, default to 2xx
      expectedCodes: [200],
      // [OPTIONAL] `timeout` in millisecond, if not specified, default to 10000
      timeout: 10000,
      // [OPTIONAL] headers to be sent
      headers: {
        'User-Agent': 'Uptimeflare',
      },
    },
    {
      // `id` should be unique, history will be kept if the `id` remains constant
      id: 'newsletter',
      // `name` is used at status page and callback message
      name: 'Newsletter',
      // `method` should be a valid HTTP Method
      method: 'GET',
      // `target` is a valid URL
      target: 'https://newsletter.lbenicio.dev',
      certificateExpiryWarningDays: 30,
      certificateZoneName: 'lbenicio.dev',
      // [OPTIONAL] `tooltip` is ONLY used at status page to show a tooltip
      tooltip: 'Sign up for my personal newsletter',
      // [OPTIONAL] `statusPageLink` is ONLY used for clickable link at status page
      statusPageLink: 'https://newsletter.lbenicio.dev',
      // [OPTIONAL] `hideLatencyChart` will hide status page latency chart if set to true
      hideLatencyChart: false,
      // [OPTIONAL] `expectedCodes` is an array of acceptable HTTP response codes, if not specified, default to 2xx
      expectedCodes: [200],
      // [OPTIONAL] `timeout` in millisecond, if not specified, default to 10000
      timeout: 10000,
      // [OPTIONAL] headers to be sent
      headers: {
        'User-Agent': 'Uptimeflare',
      },
    },
    {
      // `id` should be unique, history will be kept if the `id` remains constant
      id: 'pgp',
      // `name` is used at status page and callback message
      name: 'PGP',
      // `method` should be a valid HTTP Method
      method: 'GET',
      // `target` is a valid URL
      target: 'https://pgp.lbenicio.dev',
      certificateExpiryWarningDays: 30,
      certificateZoneName: 'lbenicio.dev',
      // [OPTIONAL] `tooltip` is ONLY used at status page to show a tooltip
      tooltip: 'Myt personal pgp key',
      // [OPTIONAL] `statusPageLink` is ONLY used for clickable link at status page
      statusPageLink: 'https://pgp.lbenicio.dev',
      // [OPTIONAL] `hideLatencyChart` will hide status page latency chart if set to true
      hideLatencyChart: false,
      // [OPTIONAL] `expectedCodes` is an array of acceptable HTTP response codes, if not specified, default to 2xx
      expectedCodes: [200],
      // [OPTIONAL] `timeout` in millisecond, if not specified, default to 10000
      timeout: 10000,
      // [OPTIONAL] headers to be sent
      headers: {
        'User-Agent': 'Uptimeflare',
      },
    },
    {
      // `id` should be unique, history will be kept if the `id` remains constant
      id: 'socials',
      // `name` is used at status page and callback message
      name: 'Socials',
      // `method` should be a valid HTTP Method
      method: 'GET',
      // `target` is a valid URL
      target: 'https://socials.lbenicio.dev',
      certificateExpiryWarningDays: 30,
      certificateZoneName: 'lbenicio.dev',
      // [OPTIONAL] `tooltip` is ONLY used at status page to show a tooltip
      tooltip: 'My social networks links',
      // [OPTIONAL] `statusPageLink` is ONLY used for clickable link at status page
      statusPageLink: 'https://socials.lbenicio.dev',
      // [OPTIONAL] `hideLatencyChart` will hide status page latency chart if set to true
      hideLatencyChart: false,
      // [OPTIONAL] `expectedCodes` is an array of acceptable HTTP response codes, if not specified, default to 2xx
      expectedCodes: [200],
      // [OPTIONAL] `timeout` in millisecond, if not specified, default to 10000
      timeout: 10000,
      // [OPTIONAL] headers to be sent
      headers: {
        'User-Agent': 'Uptimeflare',
      },
    },
  ],
  notification: {},
  callbacks: {
    onStatusChange: async (
      env: any,
      monitor: any,
      isUp: boolean,
      timeIncidentStart: number,
      timeNow: number,
      reason: string
    ) => {
      // This callback will be called when there's a status change for any monitor
      // Write any Typescript code here
      // This will not follow the grace period settings and will be called immediately when the status changes
      // You need to handle the grace period manually if you want to implement it
    },
    onIncident: async (
      env: any,
      monitor: any,
      timeIncidentStart: number,
      timeNow: number,
      reason: string
    ) => {
      // This callback will be called EVERY 1 MINTUE if there's an on-going incident for any monitor
      // Write any Typescript code here
    },
  },
}

// You can define multiple maintenances here
// During maintenance, an alert will be shown at status page
// Also, related downtime notifications will be skipped (if any)
// Of course, you can leave it empty if you don't need this feature
// const maintenances: MaintenanceConfig[] = []
const maintenances: MaintenanceConfig[] = []

// Don't forget this, otherwise compilation fails.
export { pageConfig, workerConfig, maintenances }
