# Cloudflare Workers Builds

This repository contains two Cloudflare Workers. Connect the same GitHub repository to each Worker in Cloudflare Workers Builds, using a different root directory for each project.

| Worker | Root directory | Build command | Deploy command |
| --- | --- | --- | --- |
| `uptimeflare` (Next.js status page) | `/` | `npm run cf:build` | `npm run cf:deploy:built` |
| `uptimeflare_worker` (scheduled monitor) | `/worker` | `npm run cf:build` | `npm run cf:deploy:built` |

For both projects, select `main` as the production branch and disable Preview Builds. The Wrangler configs also disable `workers.dev` and preview URLs. The Next.js Worker serves only `status.lbenicio.dev`; the monitor Worker has no public route.

## Build settings

Add `UPTIMEFLARE_D1_DATABASE_ID` under **Settings → Build → Build variables and secrets** for both Workers. Use the ID of the existing `uptimeflare_state` D1 database. This identifier is a build input, not a credential. The build script injects it into the local Wrangler configs before building.

The monitor Worker's deploy command applies pending D1 migrations before publishing the Worker. Its cron schedule is declared in `worker/wrangler.toml`. The D1 database must already exist; Workers Builds does not provision it. Terraform now describes only that database and no longer publishes either Worker or configures the cron trigger.

Set **Build watch paths** so changes build only the affected Worker. Patterns below are relative to the repository root:

- `uptimeflare`: `pages/*, components/*, styles/*, public/*, lib/*, util/*, types/*, scripts/*, uptime.config.ts, middleware.ts, next.config.js, open-next.config.ts, wrangler.jsonc, package.json, package-lock.json, tsconfig.json, env.d.ts, .nvmrc`
- `uptimeflare_worker`: `worker/*, lib/*, types/*, uptime.config.ts, scripts/set-wrangler-d1-id.mjs`

Workers Builds reads `.nvmrc` in each project root to select Node.js 22. Both package manifests pin npm to `10.9.2` for consistent dependency installation.

Use the same restricted Cloudflare build token for both Workers, with Workers Scripts edit and D1 edit access scoped to `uptimeflare_state`. The status page's custom domain may also require Workers Routes edit. Keep the token in Cloudflare's build settings; do not add it to this repository. The GitHub Actions workflows remain responsible for tests, while Cloudflare Workers Builds handles deployment.
