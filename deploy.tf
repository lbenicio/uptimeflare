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

variable "CREATE_REMOTE_CHECKER_NAMESPACE" {
  description = "Create the SQLite Durable Object namespace only when it is not already bound."
  type        = bool
  default     = false
}

# Temporary read-only migration source for the old `state` KV value.
resource "cloudflare_workers_kv_namespace" "uptimeflare_kv" {
  account_id = var.CLOUDFLARE_ACCOUNT_ID
  title      = "uptimeflare_kv"
}

resource "cloudflare_d1_database" "uptimeflare" {
  account_id = var.CLOUDFLARE_ACCOUNT_ID
  name       = "uptimeflare_state"
}

resource "cloudflare_workers_script" "uptimeflare" {
  account_id         = var.CLOUDFLARE_ACCOUNT_ID
  script_name        = "uptimeflare_worker"
  main_module        = "index.js"
  content            = trimspace(file("worker/dist/index.js"))
  compatibility_date = "2026-11-14"
  compatibility_flags = ["nodejs_compat"]
  observability = {
    enabled = true
  }

  bindings = [
    {
      name        = "UPTIMEFLARE_DB"
      type        = "d1"
      id          = cloudflare_d1_database.uptimeflare.id
    },
    {
      # Read only while migrating the previous status value into D1.
      name        = "UPTIMEFLARE_STATE_LEGACY"
      type        = "kv_namespace"
      namespace_id = cloudflare_workers_kv_namespace.uptimeflare_kv.id
    },
    {
      name       = "REMOTE_CHECKER_DO"
      type       = "durable_object_namespace"
      class_name = "RemoteChecker"
    }
  ]

  migrations = var.CREATE_REMOTE_CHECKER_NAMESPACE ? {
    new_sqlite_classes = ["RemoteChecker"]
    new_tag            = "v1"
  } : null
}

resource "cloudflare_workers_cron_trigger" "uptimeflare_worker_cron" {
  account_id  = var.CLOUDFLARE_ACCOUNT_ID
  script_name = cloudflare_workers_script.uptimeflare.script_name
  schedules = [{
    cron = "* * * * *" # every minute; D1 writes are throttled by stateWriteCooldownMinutes
  }]
}

resource "cloudflare_pages_project" "uptimeflare" {
  account_id        = var.CLOUDFLARE_ACCOUNT_ID
  name              = "uptimeflare"
  production_branch = "main"

  deployment_configs = {
    production = {
      d1_databases = {
        UPTIMEFLARE_DB = {
          id = cloudflare_d1_database.uptimeflare.id
        }
      }
      compatibility_date  = "2026-11-14"
      compatibility_flags = ["nodejs_compat"]
    }
  }
}

output "uptimeflare_d1_database_id" {
  value       = cloudflare_d1_database.uptimeflare.id
  description = "D1 database ID for the Wrangler app binding."
}
