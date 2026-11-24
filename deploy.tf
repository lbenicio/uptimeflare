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

output "uptimeflare_d1_database_id" {
  value       = cloudflare_d1_database.uptimeflare.id
  description = "D1 database ID used by both Wrangler Workers."
}
