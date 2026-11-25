# UptimeFlare Status

A Cloudflare Workers deployment of [UptimeFlare](https://github.com/lyc8503/UptimeFlare), with a Next.js status page and a scheduled monitor Worker. The monitor checks configured HTTP, HTTPS, and TCP endpoints, stores status history in Cloudflare D1, and serves the current status through the website and its JSON API.

## Deploy

This project uses two Cloudflare Workers and a shared D1 database. Follow [CLOUDFLARE_BUILDS.md](CLOUDFLARE_BUILDS.md) for the required Workers Builds settings, bindings, build token permissions, and optional runtime secrets.

The checked-in Wrangler configuration uses `status.lbenicio.dev` as the status page domain and `uptimeflare_state` as the D1 database name. Change these values to match your Cloudflare account and domain before deploying your own copy. The OpenNext cache also needs the configured R2 bucket.

## Configure monitors

Edit [`uptime.config.ts`](uptime.config.ts) to set the page title, links, monitor targets, expected HTTP responses, timeouts, and maintenance windows. The monitor list and displayed status data are intended for public use. Do not put credentials, private URLs, or personal contact details in tracked configuration unless you intend to publish them.

The status page includes an optional Umami integration. It is disabled by default. To enable analytics, set `NEXT_PUBLIC_UMAMI_SCRIPT_URL` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` as Cloudflare build variables for the page Worker. These values are visible to visitors; configure an analytics property you control.

## Local development

Use Node.js 22 and npm 10.9.2.

```sh
npm ci
npm run start:dev
```

The monitor Worker is in `worker/`:

```sh
npm ci --prefix worker
npm --prefix worker run start:dev
```

The Next.js development server uses the sample data in `mock/state.json`. Wrangler uses a local D1 database for the monitor Worker.

## Checks

```sh
npm ci
npm ci --prefix worker
npm run test
npm --prefix worker run typecheck
```

GitHub Actions runs the unit and end-to-end tests, coverage checks, and the monitor Worker typecheck on pull requests and pushes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. This project is licensed under the [GNU General Public License v3.0](LICENSE.txt).
