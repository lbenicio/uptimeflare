# Contributing

Thanks for considering a contribution.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security vulnerability, use the private reporting instructions in [SECURITY.md](SECURITY.md) rather than opening a public issue.

## Before opening a pull request

- Keep monitor targets and status-page content intentional; these settings may become public.
- Do not commit API tokens, notification URLs containing credentials, local environment files, Terraform state, or private endpoints.
- Keep Cloudflare credentials in Cloudflare Worker secrets or Workers Builds settings, as described in [CLOUDFLARE_BUILDS.md](CLOUDFLARE_BUILDS.md).
- Run the relevant checks locally:

  ```sh
  npm ci
  npm ci --prefix worker
  npm run test
  npm --prefix worker run typecheck
  ```

- Format TypeScript and configuration changes with `npm run fmt:format` and fix lint issues with `npm run fmt:lint`.

The repository contains two Workers. Changes to shared monitor configuration or D1 state may affect both the status page Worker and the scheduled monitor Worker; review both deployment configs when changing their bindings or build behavior.
