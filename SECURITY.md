# Security Policy

## System and scope

This repository deploys two Cloudflare Workers: a Next.js status page with a public JSON status endpoint, and a scheduled monitor that checks configured HTTP, HTTPS, and TCP targets. The Workers share status history in Cloudflare D1. The monitor can also send notifications and optionally query Cloudflare's API for edge-certificate information.

This policy covers the application and monitor code, D1 state access and migrations, monitor configuration, Wrangler and Terraform deployment configuration, and GitHub Actions workflows in this repository.

## Threat model and trust boundaries

- The status page and JSON status endpoint receive unauthenticated internet traffic and intentionally expose configured monitor names, availability, latency, and related public status information.
- The scheduled monitor makes outbound requests to configured targets and external notification or Cloudflare APIs. Responses from those services must be treated as untrusted data.
- `uptime.config.ts` is tracked source configuration. Some monitor metadata is sent to the browser; secrets or private endpoints must not be included in values exposed to the client.
- Cloudflare D1 stores monitor state. Cloudflare runtime secrets, Workers Builds credentials, and GitHub tokens are trusted only within their intended runtime or workflow scope.
- Pull requests and other repository contributions can change application, configuration, and workflow code. Workflow permissions and handling of contributor-controlled content are part of the security boundary.

## Security invariants

- Never expose Cloudflare tokens, notification credentials, or other secrets in browser bundles, public responses, committed configuration, test fixtures, workflow logs, or build artifacts.
- Public status responses contain only information intended for the status page. Private endpoints, credentials, internal response data, and unrelated D1 contents must remain inaccessible to visitors.
- Keep outbound monitor and API requests bounded, validate data used in state changes, and avoid allowing untrusted request or response data to select arbitrary privileged actions or destinations.
- Restrict CI and deployment permissions to the operations each job needs. Do not let untrusted pull-request content access deployment secrets or perform privileged deployments.
- D1 reads and writes must stay within the monitor-state data needed by the application; migrations and deployment bindings must not grant broader access than required.

## Reportable findings and severity context

Report a vulnerability when a realistic attacker can cross a trust boundary or violate an invariant above. Examples include secret or private configuration disclosure, unauthorized changes to monitor state, exploitable request handling, unsafe outbound-request behavior, injection or code execution, and workflow or deployment paths that expose credentials or permit unauthorized releases.

Assess severity by reachability, required attacker access, and impact on confidentiality, integrity, and availability. A directly exploitable issue affecting secrets, deployment control, or data across deployments is more severe than a narrowly scoped issue requiring unusual access or conditions. Include practical reproduction details and affected files or versions, but do not include live secrets or unnecessary personal data in the report.

Configured monitor names, public status, latency, and the corresponding public JSON response are intentional features. Their public availability alone is not a vulnerability. Exposure of private endpoints, credentials, internal data, or information beyond the configured public status is reportable.

## Out of scope and limitations

There are no security finding classes categorically excluded from review. Ordinary feature requests, visual defects, and availability problems without a security impact are not security vulnerabilities, though they may be valid project issues. Report an upstream dependency issue here when this application is affected, even if it should also be reported to the upstream maintainer.

Cloudflare's managed platform is an external trust dependency; platform vulnerabilities should be reported to Cloudflare, while application-specific unsafe use of Cloudflare bindings, APIs, or secrets remains in scope here.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting option on the repository's **Security** page when it is available. If private reporting is unavailable, contact the maintainer through [GitHub](https://github.com/lbenicio) before sharing technical details publicly. Do not open a public issue containing exploit details, credentials, or personal data. Please include the affected commit or version, impact, reproduction steps, and any suggested mitigation that can be shared safely.
