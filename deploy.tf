terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  # read token from $CLOUDFLARE_API_TOKEN
}

variable "CLOUDFLARE_ACCOUNT_ID" {
  # read account id from $TF_VAR_CLOUDFLARE_ACCOUNT_ID
  type = string
}

resource "cloudflare_d1_database" "uptimeflare" {
  account_id = var.CLOUDFLARE_ACCOUNT_ID
  name       = "uptimeflare_state"
}

# This Worker was created with the legacy v1 Durable Object migration.
data "cloudflare_workers_scripts" "uptimeflare" {
  account_id = var.CLOUDFLARE_ACCOUNT_ID
}

locals {
  uptimeflare_migration_tag = try(one([
    for script in data.cloudflare_workers_scripts.uptimeflare.result : script.migration_tag
    if script.id == "uptimeflare_worker"
  ]), null)

  # Apply the v1 -> v2 removal once; later deployments omit the write-only migration.
  uptimeflare_migrations = local.uptimeflare_migration_tag == "v1" ? {
    old_tag         = "v1"
    new_tag         = "v2"
    deleted_classes = ["RemoteChecker"]
  } : null
}

resource "cloudflare_workers_script" "uptimeflare" {
  account_id          = var.CLOUDFLARE_ACCOUNT_ID
  script_name         = "uptimeflare_worker"
  main_module         = "index.js"
  content             = trimspace(file("worker/dist/index.js"))
  compatibility_date  = "2026-11-14"
  compatibility_flags = ["nodejs_compat"]
  observability = {
    enabled = true
  }

  bindings = [
    {
      name = "UPTIMEFLARE_DB"
      type = "d1"
      id   = cloudflare_d1_database.uptimeflare.id
    }
  ]

  # Deletion permanently removes the legacy namespace and its storage.
  migrations = local.uptimeflare_migrations
}

resource "cloudflare_workers_cron_trigger" "uptimeflare_worker_cron" {
  account_id  = var.CLOUDFLARE_ACCOUNT_ID
  script_name = cloudflare_workers_script.uptimeflare.script_name
  schedules = [{
    cron = "* * * * *" # every minute; D1 writes are throttled by stateWriteCooldownMinutes
  }]
}

output "uptimeflare_d1_database_id" {
  value       = cloudflare_d1_database.uptimeflare.id
  description = "D1 database ID for the Wrangler app binding."
}
