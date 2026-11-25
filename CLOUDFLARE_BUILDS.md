# Cloudflare Workers Builds

This repository contains two Cloudflare Workers. Connect the same GitHub repository to each Worker in Cloudflare Workers Builds, using a different root directory for each project.

| Worker | Root directory | Build command | Deploy command |
| --- | --- | --- | --- |
| `uptimeflare` (Next.js status page) | `/` | `npm run cf:build` | `npm run cf:deploy:built` |
| `uptimeflare_worker` (scheduled monitor) | `/worker` | `npm run cf:build` | `npm run cf:deploy:built` |

For both projects, select `main` as the production branch and disable Preview Builds. The Wrangler configs also disable `workers.dev` and preview URLs. The Next.js Worker serves only `status.lbenicio.dev`; the monitor Worker has no public route.

## Build settings

The build scripts resolve the `uptimeflare_state` D1 database by name with `wrangler d1 list --json`, then inject its UUID into the local Wrangler configs before building. No duplicate D1 ID build variable is needed. The build token selected in **Settings → Build** must have D1 read access for discovery, plus D1 edit access for the monitor Worker's migration step. Locally, authenticate Wrangler with `wrangler login` or `CLOUDFLARE_API_TOKEN`; never store the token in this repository.

The monitor Worker's deploy command applies pending D1 migrations before publishing the Worker. Its cron schedule is declared in `worker/wrangler.toml`. The D1 database must already exist; Workers Builds does not provision it. Terraform now describes only that database and no longer publishes either Worker or configures the cron trigger.

Set **Build watch paths** so changes build only the affected Worker. Patterns below are relative to the repository root:

- `uptimeflare`: `pages/*, components/*, styles/*, public/*, lib/*, util/*, types/*, scripts/*, uptime.config.ts, middleware.ts, next.config.js, open-next.config.ts, wrangler.jsonc, package.json, package-lock.json, tsconfig.json, env.d.ts, .nvmrc`
- `uptimeflare_worker`: `worker/*, lib/*, types/*, uptime.config.ts, scripts/set-wrangler-d1-id.mjs`

Workers Builds reads `.nvmrc` in each project root to select Node.js 22. Both package manifests pin npm to `10.9.2` for consistent dependency installation.

Use the same restricted Cloudflare build token for both Workers, with Workers Scripts edit and D1 edit access scoped to `uptimeflare_state`. The status page's custom domain may also require Workers Routes edit. Keep the token in Cloudflare's build settings; do not add it to this repository. The GitHub Actions workflows remain responsible for tests, while Cloudflare Workers Builds handles deployment.

The monitor Worker only needs a separate runtime secret named `CLOUDFLARE_API_TOKEN` when a configured monitor uses the Cloudflare edge-certificate check. Add it as a Worker secret for `uptimeflare_worker`, scoped to read the relevant zone certificate data. Do not put it in the Wrangler file or GitHub Actions variables.

Umami is optional and disabled unless both `NEXT_PUBLIC_UMAMI_SCRIPT_URL` and `NEXT_PUBLIC_UMAMI_WEBSITE_ID` are set as build variables for the `uptimeflare` page Worker. These are public browser configuration, not secrets; use an analytics property you control.
