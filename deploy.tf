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

resource "cloudflare_d1_database" "uptimeflare" {
  account_id = var.CLOUDFLARE_ACCOUNT_ID
  name       = "uptimeflare_state"
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

output "uptimeflare_d1_database_id" {
  value       = cloudflare_d1_database.uptimeflare.id
  description = "D1 database ID for the Wrangler app binding."
}
